import "server-only";
import type { User } from "@supabase/supabase-js";
import { database } from "@/lib/learning-server";
import { isAiEligible } from "@/lib/eligibility";

export async function requireAiAccess(user: User): Promise<void> {
  try {
    const { data: profile, error } = await database().from("profiles").select("age").eq("id", user.id).maybeSingle();
    if (!error && isAiEligible(profile?.age, user)) return;
  } catch {}
  throw new Error("External AI requires a recorded adult age (18+) and administrator-approved AI access. Minors and accounts with unknown age cannot use external AI.");
}