import nextEnv from "@next/env";
import { z } from "zod";
import { completion, configuredFreeModels, OpenRouterError, validateFreeCatalog } from "../src/lib/openrouter-client.ts";

const probeSchema = z.object({ stage: z.literal("requirements"), explanation: z.string().min(1).max(400) });
const quotaSchema = z.object({
  data: z.object({
    free_model_daily_requests: z.object({
      used: z.number().int().nonnegative(),
      limit: z.number().int().nonnegative(),
      remaining: z.number().int().nonnegative(),
    }),
  }),
});

async function reportQuota(key, phase) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error",
    });
    if (!response.ok) {
      console.log(JSON.stringify({ phase, quota: "unavailable", status: response.status }));
      return;
    }
    const parsed = quotaSchema.safeParse(await response.json());
    console.log(JSON.stringify({ phase, quota: parsed.success ? parsed.data.data.free_model_daily_requests : "not reported by service" }));
  } catch {
    console.log(JSON.stringify({ phase, quota: "unavailable" }));
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !/^--probe=(text|structured)$/.test(arg) && !arg.startsWith("--models=")) || args.filter((arg) => arg.startsWith("--probe=")).length > 1 || args.filter((arg) => arg.startsWith("--models=")).length > 1) {
    console.error("Usage: node --experimental-strip-types scripts/check-ai.mjs [--probe=text|structured] [--models=provider/model:free,provider/fallback:free]");
    process.exitCode = 1;
    return;
  }
  nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
  const env = { ...process.env };
  const override = args.find((arg) => arg.startsWith("--models="));
  if (override) {
    const [primary, ...fallbacks] = override.slice("--models=".length).split(",");
    env.OPENROUTER_MODEL = primary;
    env.OPENROUTER_FALLBACK_MODELS = fallbacks.join(",");
  }
  const models = configuredFreeModels(env);
  const catalogResponse = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(15000), cache: "no-store", redirect: "error" });
  if (!catalogResponse.ok) throw new Error("catalog");
  const catalog = await catalogResponse.json();
  validateFreeCatalog(models, catalog);
  console.log(JSON.stringify({ catalog: "configured models verified zero-price", modelCount: models.length }));
  const key = env.OPENROUTER_API_KEY ?? env.OPEN_ROUTER_API_KEY;
  if (!key) {
    console.log(JSON.stringify({ probe: "not run", reason: "API key not configured" }));
    process.exitCode = 1;
    return;
  }
  await reportQuota(key, "before");
  const probe = args.find((arg) => arg.startsWith("--probe="))?.slice("--probe=".length);
  if (!probe) {
    console.log(JSON.stringify({ probe: "not run", reason: "Pass --probe=text or --probe=structured for one synthetic inference request." }));
    return;
  }
  try {
    const text = await completion([
      { role: "system", content: "Explain only Software Development Life Cycle concepts. No personal information. Keep the explanation to one sentence." },
      { role: "user", content: probe === "structured" ? "Return stage requirements and one sentence explaining requirements in SDLC, using the requested JSON schema." : "Explain requirements in SDLC in one sentence." },
    ], probe === "structured" ? z.toJSONSchema(probeSchema) : undefined, { env });
    if (probe === "structured" && !probeSchema.safeParse(JSON.parse(text)).success) throw new Error("schema");
    console.log(JSON.stringify({ probe, result: "success", schemaValidated: probe === "structured" }));
  } catch (error) {
    console.log(JSON.stringify({ probe, result: "failed", status: error instanceof OpenRouterError ? error.status : undefined, retryAfterSeconds: error instanceof OpenRouterError ? error.retryAfterSeconds : undefined, reason: error instanceof OpenRouterError ? error.message : "Response failed JSON/schema validation." }));
    process.exitCode = 1;
  }
  await reportQuota(key, "after");
}

main().catch(() => {
  console.error("AI check failed before inference: verify free model configuration, public catalog availability and local environment setup.");
  process.exitCode = 1;
});