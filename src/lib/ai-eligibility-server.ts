import "server-only";
import type { User } from "@supabase/supabase-js";
import { database } from "@/lib/learning-server";
import { isAiEligible } from "@/lib/eligibility";

export async function requireAiAccess(user: User): Promise<void> {
  let eligible: boolean;
  try {
    const { data: profile, error } = await database().from("profiles").select("age").eq("id", user.id).maybeSingle();
    if (error) throw error;
    eligible = isAiEligible(profile?.age, user);
  } catch {
    throw new Error("AI eligibility could not be checked. Check the learning service configuration and profile migrations, then try again.");
  }
  if (eligible) return;
  throw new Error("External AI requires a recorded adult age (18+) and administrator-approved AI access. Minors and accounts with unknown age cannot use external AI.");
}