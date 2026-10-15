"use server";
import { diagnosticInputSchema, levelInputSchema, setupFailure, type SetupResult } from "@/lib/onboarding";
import { scoreDiagnostic } from "@/lib/diagnostic";
import { loadSetup, persistSetup } from "@/lib/onboarding-server";

export async function runDiagnostic(input: unknown): Promise<SetupResult> {
  const parsed = diagnosticInputSchema.safeParse(input);
  if (!parsed.success) return setupFailure("invalid");
  const loaded = await loadSetup();
  if (loaded.code !== "ok") return loaded;
  if (parsed.data.role !== loaded.role) return setupFailure("invalid");
  if (parsed.data.revision !== loaded.profile.learning_setup_revision) return setupFailure("conflict");
  const result = await persistSetup(loaded, { diagnostic_summary: scoreDiagnostic(loaded.role, parsed.data.answers) });
  return result.code === "saved" ? { ...result, message: "Latest diagnostic summary saved. Your chosen level has not changed." } : result;
}

export async function chooseDiagnosticLevel(input: unknown): Promise<SetupResult> {
  const parsed = levelInputSchema.safeParse(input);
  if (!parsed.success) return setupFailure("invalid");
  const loaded = await loadSetup();
  if (loaded.code !== "ok") return loaded;
  const summary = loaded.profile.diagnostic_summary;
  if (parsed.data.role !== loaded.role || !summary || summary.role !== loaded.role) return setupFailure("invalid");
  if (parsed.data.revision !== loaded.profile.learning_setup_revision) return setupFailure("conflict");
  if (parsed.data.decision === "adopt" && parsed.data.level !== summary.suggested_level) return setupFailure("invalid");
  const result = await persistSetup(loaded, { learning_level: parsed.data.level });
  return result.code === "saved" ? { ...result, message: "Your explicitly chosen level is saved. The diagnostic summary is unchanged." } : result;
}
