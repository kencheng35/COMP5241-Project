import { z } from "zod";

const freeModelId = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free$/;

export function configuredFreeModels(env: NodeJS.ProcessEnv = process.env) {
  const primary = env.OPENROUTER_MODEL ?? "qwen/qwen3.8-27b:free";
  const models = [...new Set([primary.trim(), ...(env.OPENROUTER_FALLBACK_MODELS ?? "").split(",").map((model) => model.trim()).filter(Boolean)])];
  if (models.length > 10 || models.some((model) => !freeModelId.test(model))) {
    throw new Error("Only explicit free model IDs are enabled (at most ten models).");
  }
  return models;
}

const catalogSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    pricing: z.unknown(),
  })),
});
const pricingSchema = z.object({ prompt: z.string(), completion: z.string() }).catchall(z.string());

export function validateFreeCatalog(models: string[], catalog: unknown) {
  const parsed = catalogSchema.safeParse(catalog);
  if (!parsed.success) throw new Error("Could not validate the free AI model catalog. Please try later.");
  for (const model of models) {
    const entry = parsed.data.data.find((candidate) => candidate.id === model);
    const pricing = pricingSchema.safeParse(entry?.pricing);
    if (!freeModelId.test(model) || !pricing.success || !Object.values(pricing.data).every((price) => price.trim() !== "" && Number(price) === 0)) {
      throw new Error("A configured model is not a verified zero-price free catalog entry. Contact the administrator; no paid fallback was used.");
    }
  }
}

type Message = { role: "system" | "user" | "assistant"; content: string };
type ClientOptions = { env?: NodeJS.ProcessEnv; fetch?: typeof fetch; timeoutMs?: number };

export class OpenRouterError extends Error {
  readonly status?: number;
  readonly retryAfterSeconds?: number;

  constructor(message: string, status?: number, retryAfterSeconds?: number) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function serviceError(status: number, retryAfter: string | null = null) {
  const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : undefined;
  const retryAfterSeconds = seconds !== undefined && Number.isSafeInteger(seconds) ? seconds : undefined;
  if (status === 429) return new OpenRouterError("The free AI provider is busy or the account's free request quota is exhausted. Model fallback cannot bypass account quotas. Please try again later.", status, retryAfterSeconds);
  if (status === 401) return new OpenRouterError("The AI service key is invalid. Contact the administrator.", status);
  if (status === 402) return new OpenRouterError("The AI account cannot serve this request. No paid fallback was used.", status);
  if (status === 404 || status === 503) return new OpenRouterError("No free AI endpoint currently meets the required privacy and output settings. Please try later or contact the administrator.", status);
  return new OpenRouterError("The AI service could not complete this request. Please try again later.", status);
}

const completionSchema = z.object({
  error: z.object({ code: z.number().optional() }).optional(),
  choices: z.array(z.object({
    finish_reason: z.string().nullable().optional(),
    message: z.object({ content: z.string().nullable(), refusal: z.string().nullable().optional() }),
  })).optional(),
});

export async function completion(messages: Message[], schema?: Record<string, unknown>, options: ClientOptions = {}) {
  const env = options.env ?? process.env;
  const key = env.OPENROUTER_API_KEY ?? env.OPEN_ROUTER_API_KEY;
  if (!key) throw new OpenRouterError("Lesson generation is not configured.");
  const models = configuredFreeModels(env);
  const fetchRequest = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 55000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 55000) throw new OpenRouterError("Invalid AI request timeout.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new OpenRouterError("Generation timed out or could not connect. Please try again later."));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const catalogResponse = await fetchRequest("https://openrouter.ai/api/v1/models", {
        signal: controller.signal, cache: "no-store", redirect: "error",
      });
      if (!catalogResponse.ok) throw new OpenRouterError("Could not validate the free AI model catalog. Please try later.", catalogResponse.status);
      let catalog: unknown;
      try { catalog = await catalogResponse.json(); }
      catch { throw new OpenRouterError("Could not validate the free AI model catalog. Please try later."); }
      try { validateFreeCatalog(models, catalog); }
      catch { throw new OpenRouterError("A configured model could not be verified against the zero-price free catalog. Contact the administrator; no paid fallback was used."); }
      controller.signal.throwIfAborted();
      const response = await fetchRequest("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
        body: JSON.stringify({
          models,
          provider: { data_collection: "deny", zdr: true, require_parameters: true },
          reasoning: { enabled: false },
          messages,
          max_tokens: schema ? 6500 : 600,
          ...(schema ? { response_format: { type: "json_schema", json_schema: { name: "learning_lesson", strict: true, schema } } } : {}),
        }),
      });
      if (!response.ok) throw serviceError(response.status, response.headers.get("retry-after"));
      let data: unknown;
      try { data = await response.json(); }
      catch { throw new OpenRouterError("The AI returned malformed response JSON. Please try again later."); }
      const parsed = completionSchema.safeParse(data);
      if (!parsed.success) throw new OpenRouterError("The AI returned an invalid response. Please try again later.");
      if (parsed.data.error) throw serviceError(parsed.data.error.code ?? 502);
      const choice = parsed.data.choices?.[0];
      if (choice?.message.refusal || (choice?.finish_reason && choice.finish_reason !== "stop")) {
        throw new OpenRouterError("The AI returned an incomplete or refused response. Please try again later.");
      }
      const text = choice?.message.content;
      if (typeof text !== "string" || !text.trim()) throw new OpenRouterError("The AI returned an empty response. Please try again later.");
      return text;
    })()]);
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    throw new OpenRouterError("Generation timed out or could not connect. Please try again later.");
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}