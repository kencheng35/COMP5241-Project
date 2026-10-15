import "server-only";
import { createClient } from "@/lib/supabase/server";
import { database } from "@/lib/learning-server";
import { setupFailure, setupProfileSchema, setupRole, type SetupProfile, type SetupResult } from "@/lib/onboarding";
import type { User } from "@supabase/supabase-js";

const columns = "id,learning_level,learning_setup_revision,onboarding_completed_at,onboarding_background,diagnostic_summary";
type Loaded = { code: "ok"; profile: SetupProfile; user: User; role: ReturnType<typeof setupRole> };
function schemaError(error: { code?: string } | null | undefined) {
  return ["42703", "42P01", "PGRST204", "PGRST205"].includes(error?.code ?? "");
}

export async function loadSetup(): Promise<Loaded | SetupResult> {
  let user: User;
  try {
    const auth = await (await createClient()).auth.getUser();
    if (!auth?.data?.user?.id || auth.error !== null) return setupFailure("auth");
    user = auth.data.user;
  } catch { return setupFailure("auth"); }
  try {
    const result = await database().from("profiles").select(columns).eq("id", user.id).maybeSingle();
    if (!result || result.error !== null) return setupFailure(schemaError(result?.error) ? "schema" : "unavailable");
    if (result.data === null) return setupFailure("missing");
    const parsed = setupProfileSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.id !== user.id) return setupFailure("unavailable");
    return { code: "ok", profile: parsed.data, user, role: setupRole(user) };
  } catch { return setupFailure("unavailable"); }
}

// The migration increments the revision for profile level/goals edits too.
// No insert/upsert: missing historical profiles/ages must not be invented.
export async function persistSetup(loaded: Loaded, patch: Partial<Pick<SetupProfile,
  "onboarding_completed_at" | "onboarding_background" | "diagnostic_summary" | "learning_level">>): Promise<SetupResult> {
  let client;
  try { client = database(); } catch { return setupFailure("unavailable"); }
  try {
    const result = await client.from("profiles").update({
      ...patch, learning_setup_revision: loaded.profile.learning_setup_revision + 1,
    }).eq("id", loaded.user.id).eq("learning_setup_revision", loaded.profile.learning_setup_revision).select(columns).maybeSingle();
    if (schemaError(result?.error)) return setupFailure("schema");
    if (["23514", "42501", "22001"].includes(result?.error?.code ?? "")) return setupFailure("rejected");
    if (!result || result.error !== null) return setupFailure("unknown");
    if (result.data === null) return setupFailure("conflict");
    const parsed = setupProfileSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.id !== loaded.user.id ||
      parsed.data.learning_setup_revision !== loaded.profile.learning_setup_revision + 1 ||
      Object.entries(patch).some(([key, value]) => key === "onboarding_completed_at"
        ? Date.parse(parsed.data.onboarding_completed_at ?? "") !== Date.parse(String(value))
        : JSON.stringify(parsed.data[key as keyof SetupProfile]) !== JSON.stringify(value))) {
      return setupFailure("unknown");
    }
    return { code: "saved", message: "Saved.", profile: parsed.data };
  } catch { return setupFailure("unknown"); }
}
