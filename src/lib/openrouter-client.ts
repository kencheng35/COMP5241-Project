import { randomUUID } from "node:crypto";
import { z } from "zod";

const freeModelId = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*:free$/;

export function configuredFreeModels(env: NodeJS.ProcessEnv = process.env) {
  const primary = env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free";
  const models = [...new Set([primary.trim(), ...(env.OPENROUTER_FALLBACK_MODELS ?? "").split(",").map((model) => model.trim()).filter(Boolean)])];
  if (models.length > 10 || models.some((model) => model.length > 200 || !freeModelId.test(model))) {
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
  diagnosticId?: string;

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
  if (status === 404 || status === 503) return new OpenRouterError("No free AI endpoint currently meets the configured model, request and account settings. Please try later or contact the administrator.", status);
  return new OpenRouterError("The AI service could not complete this request. Please try again later.", status);
}

function boundedRetryAfter(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value || value.length > 16 || !/^\d+$/.test(value)) return null;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) ? Math.min(3600, seconds) : null;
}

type FailureReason =
  | "missing_key" | "invalid_model_config" | "invalid_timeout"
  | "catalog_http_error" | "catalog_malformed_json" | "catalog_invalid" | "catalog_unverified"
  | "upstream_unknown" | "no_endpoints" | "data_policy" | "zdr"
  | "unsupported_required_parameters" | "model_unavailable" | "rate_limit"
  | "malformed_json" | "invalid_response" | "refused_output" | "truncated_output" | "empty_output"
  | "body_too_large" | "timeout" | "transport_error";
type ErrorBodyState = "not_read" | "reading" | "json" | "empty" | "malformed_json" | "too_large" | "unreadable";

// Only the top-level error message is examined, never retained or interpolated.
// These are hints from untrusted upstream text, not proof of endpoint/account policy.
function upstreamHint(data: unknown): { reason: FailureReason; code: number | null } {
  const error = typeof data === "object" && data !== null && "error" in data ? data.error : undefined;
  if (typeof error !== "object" || error === null) return { reason: "upstream_unknown", code: null };
  const code = "code" in error && typeof error.code === "number" && Number.isSafeInteger(error.code) && Math.abs(error.code) <= 999999 ? error.code : null;
  const message = "message" in error && typeof error.message === "string" ? error.message.slice(0, 4096).toLowerCase() : "";
  let reason: FailureReason = "upstream_unknown";
  if (/\bzdr\b|zero[- ]data[- ]retention/.test(message)) reason = "zdr";
  else if (/data[-_ ](?:collection|policy)|privacy (?:policy|settings)/.test(message)) reason = "data_policy";
  else if (/require_parameters|required parameters|unsupported (?:required )?parameters|no endpoints.*support.*(?:requested parameters|json_schema|structured output)|(?:json_schema|structured output).*(?:unsupported|not supported)|(?:unsupported|not supported).*(?:json_schema|structured output)/.test(message)) reason = "unsupported_required_parameters";
  else if (/model.*(?:unavailable|not found|does not exist)|(?:unavailable|unknown) model/.test(message)) reason = "model_unavailable";
  else if (/rate[- ]limit|too many requests|quota.*(?:exhausted|exceeded)/.test(message)) reason = "rate_limit";
  else if (/no (?:available )?endpoints/.test(message)) reason = "no_endpoints";
  return { reason, code };
}

class BodyReadError extends Error {
  readonly reason: "too_large" | "malformed_json" | "empty" | "unreadable";
  constructor(reason: "too_large" | "malformed_json" | "empty" | "unreadable") {
    super("Response body could not be read safely.");
    this.reason = reason;
  }
}

// Never use response.text()/json() for diagnostics: they can buffer unbounded input.
// Cancellation is best effort and must not extend the shared operation deadline.
async function boundedJson(response: Response, limit: number, signal: AbortSignal): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new BodyReadError("empty");
  const buffer = new Uint8Array(limit);
  let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      if (bytes + value.byteLength > limit) throw new BodyReadError("too_large");
      buffer.set(value, bytes);
      bytes += value.byteLength;
    }
    if (!bytes) throw new BodyReadError("empty");
    try { return JSON.parse(new TextDecoder().decode(buffer.subarray(0, bytes))); }
    catch { throw new BodyReadError("malformed_json"); }
  } catch (error) {
    if (error instanceof BodyReadError) throw error;
    throw new BodyReadError("unreadable");
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

const completionSchema = z.object({
  choices: z.array(z.object({
    finish_reason: z.string().nullable().optional(),
    message: z.object({ content: z.string().nullable(), refusal: z.string().nullable().optional() }),
  })).optional(),
});

export async function completion(messages: Message[], schema?: Record<string, unknown>, options: ClientOptions = {}) {
  const diagnosticId = randomUUID();
  const started = performance.now();
  let stage = "config";
  let reason: FailureReason = "missing_key";
  let models: string[] = [];
  let verifiedModels: string[] = [];
  let httpStatus: number | null = null;
  let providerCode: number | null = null;
  let retryAfterSeconds: number | null = null;
  let errorBodyState: ErrorBodyState = "not_read";
  let timedOut = false;
  let primaryError: OpenRouterError | undefined;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const env = options.env ?? process.env;
    const key = env.OPENROUTER_API_KEY ?? env.OPEN_ROUTER_API_KEY;
    if (!key) throw new OpenRouterError("Lesson generation is not configured.");
    reason = "invalid_model_config";
    try { models = configuredFreeModels(env); }
    catch { throw new OpenRouterError("Only explicit free model IDs are enabled (at most ten models)."); }
    const fetchRequest = options.fetch ?? fetch;
    reason = "invalid_timeout";
    const timeoutMs = options.timeoutMs ?? 30000;
    if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw new OpenRouterError("Invalid AI request timeout.");
    // Python len(text): total Unicode code points in all outgoing message content, not UTF-16 units.
    const characterCount = messages.reduce((total, { content }) => total + [...content].length, 0);
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new OpenRouterError("Generation timed out or could not connect. Please try again later."));
        controller.abort();
      }, timeoutMs);
    });
    return await Promise.race([deadline, (async () => {
      stage = "catalog_fetch";
      reason = "transport_error";
      const catalogResponse = await fetchRequest("https://openrouter.ai/api/v1/models", {
        signal: controller.signal, cache: "no-store", redirect: "error",
      });
      controller.signal.throwIfAborted();
      httpStatus = catalogResponse.status;
      retryAfterSeconds = boundedRetryAfter(catalogResponse);
      stage = "catalog_body";
      if (!catalogResponse.ok) {
        reason = "catalog_http_error";
        primaryError = new OpenRouterError("Could not validate the free AI model catalog. Please try later.", catalogResponse.status);
        await inspectError(catalogResponse);
        throw primaryError;
      }
      let catalog: unknown;
      try { catalog = await boundedJson(catalogResponse, 2 * 1024 * 1024, controller.signal); }
      catch (error) {
        reason = error instanceof BodyReadError && error.reason === "too_large" ? "body_too_large" : error instanceof BodyReadError && error.reason === "unreadable" ? "transport_error" : "catalog_malformed_json";
        throw new OpenRouterError("Could not validate the free AI model catalog. Please try later.");
      }
      controller.signal.throwIfAborted();
      stage = "catalog_validation";
      reason = catalogSchema.safeParse(catalog).success ? "catalog_unverified" : "catalog_invalid";
      try { validateFreeCatalog(models, catalog); }
      catch { throw new OpenRouterError("A configured model could not be verified against the zero-price free catalog. Contact the administrator; no paid fallback was used."); }
      verifiedModels = models;
      controller.signal.throwIfAborted();
      stage = "inference_fetch";
      httpStatus = null;
      retryAfterSeconds = null;
      reason = "transport_error";
      const response = await fetchRequest("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: controller.signal,
        cache: "no-store",
        redirect: "error",
        body: JSON.stringify({
          ...(models.length === 1 ? { model: models[0] } : { models }),
          // Approved note.py compatibility: no provider or reasoning overrides.
          // Account/provider defaults still apply; this request does not enforce ZDR or data collection denial.
          messages,
          max_tokens: Math.min(16384, Math.max(256, characterCount * 3)),
          ...(schema ? { response_format: { type: "json_schema", json_schema: { name: "learning_lesson", strict: true, schema } } } : {}),
        }),
      });
      controller.signal.throwIfAborted();
      httpStatus = response.status;
      retryAfterSeconds = boundedRetryAfter(response);
      stage = "inference_body";
      if (!response.ok) {
        reason = "upstream_unknown";
        primaryError = serviceError(response.status, response.headers.get("retry-after"));
        await inspectError(response);
        throw primaryError;
      }
      let data: unknown;
      try { data = await boundedJson(response, 1024 * 1024, controller.signal); }
      catch (error) {
        reason = error instanceof BodyReadError && error.reason === "too_large" ? "body_too_large" : error instanceof BodyReadError && error.reason === "unreadable" ? "transport_error" : "malformed_json";
        throw new OpenRouterError("The AI returned malformed response JSON. Please try again later.");
      }
      controller.signal.throwIfAborted();
      stage = "output_validation";
      // Inspect envelopes before choices validation; providers may send both.
      if (typeof data === "object" && data !== null && "error" in data && data.error !== undefined) {
        const hint = upstreamHint(data);
        reason = hint.reason;
        providerCode = hint.code;
        errorBodyState = "json";
        throw serviceError(providerCode ?? 502);
      }
      reason = "invalid_response";
      const parsed = completionSchema.safeParse(data);
      if (!parsed.success) throw new OpenRouterError("The AI returned an invalid response. Please try again later.");
      const choice = parsed.data.choices?.[0];
      if (choice?.message.refusal || (choice?.finish_reason && choice.finish_reason !== "stop")) {
        reason = choice?.message.refusal ? "refused_output" : "truncated_output";
        throw new OpenRouterError("The AI returned an incomplete or refused response. Please try again later.");
      }
      const text = choice?.message.content;
      reason = "empty_output";
      if (typeof text !== "string" || !text.trim()) throw new OpenRouterError("The AI returned an empty response. Please try again later.");
      return text;
    })()]);
  } catch (error) {
    const publicError = primaryError ?? (error instanceof OpenRouterError ? error : new OpenRouterError("Generation timed out or could not connect. Please try again later."));
    publicError.diagnosticId = diagnosticId;
    // Exactly one emission at the operation boundary. Late ignored-abort work never logs.
    // No raw errors, headers, bodies, schema, prompts or environment values are serialized.
    try { console.error(JSON.stringify({
      event: "openrouter_completion_failed", diagnostic_id: diagnosticId, stage,
      http_status: httpStatus, provider_code: providerCode,
      elapsed_ms: Math.max(0, Math.round(performance.now() - started)), timed_out: timedOut,
      retry_after_seconds: retryAfterSeconds, models: verifiedModels, output_mode: schema ? "json_schema" : "text",
      // null means no request override, not false; effective account/provider defaults are unknown.
      provider: null,
      reasoning_enabled: null, reason: timedOut ? "timeout" : reason, error_body_state: errorBodyState,
    })); } catch { /* A failing log sink must not replace the primary sanitized failure. */ }
    throw publicError;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }

  async function inspectError(response: Response) {
    errorBodyState = "reading";
    try {
      const data = await boundedJson(response, 16 * 1024, controller.signal);
      controller.signal.throwIfAborted();
      const hint = upstreamHint(data);
      providerCode = hint.code;
      // Catalog HTTP failure remains distinct from inference classification.
      if (stage === "inference_body") reason = hint.reason;
      errorBodyState = "json";
    } catch (error) {
      errorBodyState = error instanceof BodyReadError ? error.reason : "unreadable";
    }
  }
}