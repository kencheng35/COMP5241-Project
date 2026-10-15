"use server";
import { onboardingInputSchema, setupFailure, setupMessages, type SetupResult } from "@/lib/onboarding";
import { loadSetup, persistSetup } from "@/lib/onboarding-server";

export async function saveOnboarding(input: unknown): Promise<SetupResult> {
  const parsed = onboardingInputSchema.safeParse(input);
  if (!parsed.success) return setupFailure("invalid");
  const loaded = await loadSetup();
  if (loaded.code !== "ok") return loaded;
  const data = parsed.data;
  if (data.role !== loaded.role) return setupFailure("invalid");
  if (data.revision !== loaded.profile.learning_setup_revision) return setupFailure("conflict");
  const result = await persistSetup(loaded, {
    onboarding_background: { version: 1, role: loaded.role, experience: data.experience, goals: data.goals },
    onboarding_completed_at: loaded.profile.onboarding_completed_at ?? new Date().toISOString(),
    learning_level: data.level,
  });
  return result.code === "saved" ? { ...result, message: "Background, goals and your chosen level are saved. The optional diagnostic is separate." } : result;
}

export async function reloadLearningSetup(): Promise<SetupResult> {
  const loaded = await loadSetup();
  return loaded.code === "ok"
    ? { code: "loaded", message: setupMessages.loaded, profile: loaded.profile, role: loaded.role }
    : loaded;
}
