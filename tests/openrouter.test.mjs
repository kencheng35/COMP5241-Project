import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { completion, configuredFreeModels, validateFreeCatalog } from "../src/lib/openrouter-client.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (specifier.startsWith("@/lib/")) return nextResolve(new URL(`../src/lib/${specifier.slice(6)}.ts`, import.meta.url).href, context);
    return nextResolve(specifier, context);
  },
});
const { generateLesson, coachReply } = await import("../src/lib/openrouter.ts");
const { interviewReply } = await import("../src/lib/interview-ai.ts");
const { FAMILIES } = await import("../src/lib/curriculum.ts");

const defaultModel = "nvidia/nemotron-3-ultra-550b-a55b:free";
const primary = "example/primary:free";
const fallback = "example/fallback:free";
const catalog = { data: [primary, fallback].map((id) => ({ id, pricing: { prompt: "0", completion: "0" } })) };

test("free models preserve primary-first fallback order, trim and deduplicate", () => {
  assert.deepEqual(configuredFreeModels({}), [defaultModel]);
  assert.deepEqual(configuredFreeModels({ OPENROUTER_MODEL: primary, OPENROUTER_FALLBACK_MODELS: ` ${fallback}, ,${primary},${fallback}` }), [primary, fallback]);
  assert.deepEqual(configuredFreeModels({ OPENROUTER_MODEL: primary }), [primary]);
});

test("paid IDs, routers, aliases and forged free variants fail closed", () => {
  for (const model of ["example/paid", "openrouter/auto", "openrouter/free", "~example/model:free", "example/model:free:free", "example/model/paid:free", "example/model?route=paid:free", ""]) {
    assert.throws(() => configuredFreeModels({ OPENROUTER_MODEL: model }), /Only explicit free/);
    assert.throws(() => configuredFreeModels({ OPENROUTER_MODEL: primary, OPENROUTER_FALLBACK_MODELS: model || "example/paid" }), /Only explicit free/);
  }
  assert.throws(() => validateFreeCatalog(["example/paid:free"], catalog), /not a verified/);
  assert.throws(() => validateFreeCatalog(["example/paid"], { data: [{ id: "example/paid", pricing: { prompt: "0", completion: "0" } }] }), /not a verified/);
});

test("every selected free catalog entry must have explicit zero pricing", () => {
  validateFreeCatalog([primary, fallback], catalog);
  validateFreeCatalog([primary], { data: [...catalog.data, { id: "example/unrelated-paid", pricing: { tiers: [{ price: "1" }], discount: null } }] });
  for (const pricing of [{ prompt: "1", completion: "0" }, { prompt: "0", completion: "0", request: "0.01" }, { prompt: "", completion: "0" }, { prompt: "NaN", completion: "0" }]) {
    assert.throws(() => validateFreeCatalog([primary], { data: [{ id: primary, pricing }] }), /not a verified/);
  }
  for (const malformed of [null, {}, { data: [] }, { data: [{ id: primary }] }]) {
    assert.throws(() => validateFreeCatalog([primary], malformed), /catalog/);
  }
});

const env = { OPENROUTER_API_KEY: "synthetic-key", OPENROUTER_MODEL: primary, OPENROUTER_FALLBACK_MODELS: fallback };
const response = (content = "Synthetic SDLC response", extra = {}) => Response.json({ choices: [{ message: { content }, finish_reason: "stop" }], ...extra });
const stubFetch = (reply, calls = []) => async (url, options) => {
  calls.push({ url, options });
  return url.endsWith("/models") ? Response.json(catalog) : reply();
};

let diagnostics;
beforeEach(context => {
  diagnostics = [];
  context.mock.method(console, "error", (...args) => {
    assert.equal(args.length, 1);
    assert.equal(typeof args[0], "string");
    diagnostics.push(JSON.parse(args[0]));
  });
  // Every test must explicitly supply a mock; a regression must never reach the network.
  context.mock.method(globalThis, "fetch", async () => { throw new Error("Unexpected network forbidden"); });
});

test("text and structured requests use singular default or override with no implicit fallback or request overrides", async () => {
  for (const schema of [undefined, { type: "object" }]) {
    for (const [configuration, model] of [[{}, defaultModel], [{ OPENROUTER_MODEL: primary }, primary]]) {
      let body;
      const messages = [{ role: "user", content: "Explain SDLC" }];
      await completion(messages, schema, {
        // Existing key alias still works.
        env: { OPEN_ROUTER_API_KEY: "synthetic-key", ...configuration },
        fetch: async (url, options) => {
          if (url.endsWith("/models")) {
            assert.equal(options.headers, undefined);
            return Response.json({ data: [{ id: model, pricing: { prompt: "0", completion: "0" } }] });
          }
          assert.equal(options.headers.Authorization, "Bearer synthetic-key");
          body = JSON.parse(options.body);
          return response();
        },
      });
      assert.deepEqual(Object.keys(body).sort(), ["model", "messages", "max_tokens", ...(schema ? ["response_format"] : [])].sort());
      assert.equal(body.model, model);
      for (const key of ["models", "provider", "reasoning"]) assert.equal(Object.hasOwn(body, key), false);
      assert.deepEqual(body.messages, messages);
      assert.equal(body.max_tokens, 256);
      if (schema) assert.deepEqual(body.response_format, { type: "json_schema", json_schema: { name: "learning_lesson", strict: true, schema } });
    }
  }
});

test("the requested default still fails closed for missing or nonzero catalog entries", async () => {
  for (const data of [[], [{ id: defaultModel, pricing: { prompt: "0", completion: "0.01" } }]]) {
    let requests = 0;
    await assert.rejects(completion([], undefined, {
      env: { OPENROUTER_API_KEY: "synthetic-key" },
      fetch: async () => { requests++; return Response.json({ data }); },
    }), /zero-price free catalog/);
    assert.equal(requests, 1);
  }
});

test("token budget uses total message Unicode code points with identical schema and text thresholds", async () => {
  // Neither clamp is divisible by three: test the adjacent integer character counts.
  const cases = [
    ["", 256], ["a".repeat(85), 256], ["a".repeat(86), 258],
    ["a".repeat(100), 300], ["a".repeat(5461), 16383],
    ["a".repeat(5462), 16384], ["a".repeat(10000), 16384],
    ["😀".repeat(86), 258], ["漢".repeat(86), 258],
    ["e\u0301".repeat(43), 258],
  ];
  for (const schema of [undefined, { type: "object" }]) {
    for (const [content, expected] of cases) {
      const calls = [];
      // Split across roles: count all content, not just the latest user text.
      const points = [...content];
      const messages = ["system", "assistant", "user"].map((role, i) => ({
        role, content: points.slice(Math.floor(i * points.length / 3), Math.floor((i + 1) * points.length / 3)).join(""),
      }));
      await completion(messages, schema, { env, fetch: stubFetch(response, calls) });
      const body = JSON.parse(calls[1].options.body);
      assert.equal(body.max_tokens, expected, `code points=${points.length}, schema=${!!schema}`);
      assert.deepEqual(body.messages, messages);
      assert.equal(!!body.response_format, !!schema);
    }
  }
});

test("text and structured fallback requests use only ordered free models without provider or reasoning overrides", async () => {
  for (const schema of [undefined, { type: "object" }]) {
    const calls = [];
    assert.equal(await completion([{ role: "user", content: "Explain SDLC" }], schema, { env, fetch: stubFetch(() => response("fallback result", { model: fallback }), calls) }), "fallback result");
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.headers, undefined);
    assert.equal(calls[0].url, "https://openrouter.ai/api/v1/models");
    assert.equal(calls[1].url, "https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(calls[1].options.body);
    assert.deepEqual(Object.keys(body).sort(), ["models", "messages", "max_tokens", ...(schema ? ["response_format"] : [])].sort());
    assert.deepEqual(body.models, [primary, fallback]);
    for (const key of ["model", "provider", "reasoning"]) assert.equal(Object.hasOwn(body, key), false);
    if (schema) assert.deepEqual(body.response_format, { type: "json_schema", json_schema: { name: "learning_lesson", strict: true, schema } });
    assert.equal(body.max_tokens, 256);
    for (const call of calls) {
      assert.equal(call.options.cache, "no-store");
      assert.equal(call.options.redirect, "error");
      assert.ok(call.options.signal instanceof AbortSignal);
    }
  }
});

test("unverified or malformed catalog never reaches authenticated inference", async () => {
  for (const reply of [Response.json({ data: [] }), Response.json({ data: null }), Response.json({ data: [{ id: primary }] }), Response.json({ data: [{ id: primary, pricing: { prompt: "0", completion: "0.01" } }] }), new Response("invalid JSON"), new Response(null, { status: 503 })]) {
    let requests = 0;
    await assert.rejects(completion([], undefined, { env, fetch: async (url, options) => {
      requests++;
      assert.equal(url, "https://openrouter.ai/api/v1/models");
      assert.equal(options.headers, undefined);
      return reply;
    } }), /catalog/);
    assert.equal(requests, 1);
  }
});

test("invalid or paid primary and fallback configurations block all fetches", async () => {
  let requests = 0;
  for (const configuration of [
    { OPENROUTER_MODEL: "example/paid" }, { OPENROUTER_MODEL: "" },
    { OPENROUTER_FALLBACK_MODELS: "example/paid" }, { OPENROUTER_FALLBACK_MODELS: "openrouter/auto" },
  ]) {
    await assert.rejects(completion([], undefined, {
      env: { ...env, ...configuration }, fetch: async () => { requests++; throw new Error("Network forbidden"); },
    }), /Only explicit free/);
  }
  assert.equal(requests, 0);
});

test("quota and provider failures are clear, sanitized and never locally retried", async () => {
  for (const [status, message] of [[429, /quota/], [401, /key is invalid/], [402, /No paid fallback/], [404, /configured model, request and account settings/], [503, /configured model, request and account settings/], [500, /could not complete/]]) {
    const calls = [];
    await assert.rejects(completion([], undefined, { env, fetch: stubFetch(() => new Response("private provider error", { status, headers: { "retry-after": "30" } }), calls) }), (error) => {
      assert.match(error.message, message);
      assert.equal(error.status, status);
      assert.ok(!error.message.includes("private provider error"));
      if (status === 429) assert.equal(error.retryAfterSeconds, 30);
      return true;
    });
    assert.equal(calls.length, 2);
  }
  await assert.rejects(completion([], undefined, { env, fetch: stubFetch(() => response("", { error: { code: 429, message: "private" } })) }), /quota/);
});

test("malformed, empty, refused and incomplete completions are rejected", async () => {
  for (const reply of [() => new Response("not JSON"), () => Response.json(null), () => Response.json({ choices: "wrong" }), () => response(12)]) {
    await assert.rejects(completion([], undefined, { env, fetch: stubFetch(reply) }), /malformed|invalid response/);
  }
  for (const reply of [() => response("  "), () => response(null), () => Response.json({ choices: [] }), () => Response.json({})]) {
    await assert.rejects(completion([], undefined, { env, fetch: stubFetch(reply) }), /empty response/);
  }
  for (const choice of [{ message: { content: "partial" }, finish_reason: "length" }, { message: { content: "refused", refusal: "policy" }, finish_reason: "stop" }]) {
    await assert.rejects(completion([], undefined, { env, fetch: stubFetch(() => Response.json({ choices: [choice] })) }), /incomplete or refused/);
  }
});

test("default deadline is 30000ms and explicit maximum is 60000ms; smaller deadlines remain valid", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  for (const timeoutMs of [undefined, 30000, 60000, 1, 10]) {
    let signal, settled = false;
    const pending = completion([], undefined, {
      env, ...(timeoutMs === undefined ? {} : { timeoutMs }),
      fetch: async (_url, options) => { signal = options.signal; return new Promise(() => {}); },
    });
    pending.then(() => { settled = true; }, () => { settled = true; });
    const rejected = assert.rejects(pending, /timed out/);
    context.mock.timers.tick((timeoutMs ?? 30000) - 1);
    await Promise.resolve();
    assert.equal(settled, false);
    assert.equal(signal.aborted, false);
    context.mock.timers.tick(1);
    await rejected;
    assert.equal(signal.aborted, true);
  }
});

test("one shared finite deadline covers both fetches and bodies even if they ignore abort", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  for (const timeoutMs of [10, 60000]) {
  for (const phase of ["catalog", "catalog body", "inference", "body"]) {
    const signals = [];
    let elapsed = 0, reachedPhase, settled = false;
    const reached = new Promise(resolve => { reachedPhase = resolve; });
    const advance = ms => { elapsed += ms; context.mock.timers.tick(ms); };
    const block = () => { reachedPhase(); return new Promise(() => {}); };
    const fetch = async (url, options) => {
      signals.push(options.signal);
      if (url.endsWith("/models")) {
        if (phase === "catalog") return block();
        advance(timeoutMs * 0.4);
        return new Response(new ReadableStream({
          async start(controller) {
            if (phase === "catalog body") { await block(); return; }
            advance(timeoutMs * 0.3);
            controller.enqueue(new TextEncoder().encode(JSON.stringify(catalog)));
            controller.close();
          },
        }));
      }
      if (phase === "inference") return block();
      advance(timeoutMs * 0.2);
      return new Response(new ReadableStream({ start: block }));
    };
    const pending = completion([], undefined, { env, fetch, timeoutMs });
    pending.then(() => { settled = true; }, () => { settled = true; });
    const rejected = assert.rejects(pending, /timed out/);
    await reached;
    advance(timeoutMs - 1 - elapsed);
    await Promise.resolve();
    assert.equal(settled, false, phase);
    advance(1);
    await rejected;
    assert.ok(signals.every(signal => signal === signals[0] && signal.aborted));
  }
  }
});

test("invalid deadlines and transport details fail safely", async () => {
  let requests = 0;
  for (const timeoutMs of [Infinity, NaN, 0, -1, 60001]) {
    await assert.rejects(completion([], undefined, {
      env, timeoutMs, fetch: async () => { requests++; throw new Error("Network forbidden"); },
    }), /Invalid AI request timeout/);
  }
  assert.equal(requests, 0);
  await assert.rejects(completion([], undefined, { env, fetch: async () => { throw new Error("private transport details"); } }), /^OpenRouterError: Generation timed out/);
});

const privateMarkers = ["SYNTHETIC_KEY_9df", "SYNTHETIC_PROMPT_6ab", "learner-private@example.test", "SYNTHETIC_METADATA_87c", "SYNTHETIC_HEADER_4cd", "SYNTHETIC_SCHEMA_5bc", "secret/synthetic-sensitive-value:free"];
const privateText = privateMarkers.join(" ");
const privateMessages = [{ role: "user", content: privateText }];
const privateSchema = { type: "object", description: privateMarkers[5] };
const privateEnv = { ...env, OPENROUTER_API_KEY: privateMarkers[0] };
const hostileEnvelope = (message, code) => ({
  error: { code, message: `${message} ${privateText}`, metadata: { raw: privateText, provider_name: privateText } },
  user: privateText,
});

async function failed(options, schema) {
  const before = diagnostics.length;
  let publicError;
  await assert.rejects(completion(privateMessages, schema, { env: privateEnv, ...options }), error => {
    publicError = error;
    return true;
  });
  assert.equal(diagnostics.length, before + 1, "one JSON console.error record per failed operation");
  const record = diagnostics.at(-1);
  assert.deepEqual(Object.keys(record).sort(), [
    "event", "diagnostic_id", "stage", "http_status", "provider_code", "elapsed_ms", "timed_out",
    "retry_after_seconds", "models", "output_mode", "provider", "reasoning_enabled", "reason", "error_body_state",
  ].sort());
  assert.equal(record.event, "openrouter_completion_failed");
  assert.match(record.diagnostic_id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  assert.equal(publicError.diagnosticId, record.diagnostic_id);
  assert.ok(Number.isSafeInteger(record.elapsed_ms) && record.elapsed_ms >= 0);
  assert.equal(typeof record.timed_out, "boolean");
  assert.equal(record.provider, null, "no request provider override; effective account/provider policy unknown");
  assert.equal(record.reasoning_enabled, null, "no request reasoning override, not reasoning disabled");
  assert.ok(record.retry_after_seconds === null || (record.retry_after_seconds >= 0 && record.retry_after_seconds <= 3600));
  for (const marker of privateMarkers) {
    assert.ok(!JSON.stringify(record).includes(marker));
    assert.ok(!JSON.stringify(publicError).includes(marker));
    assert.ok(!String(publicError).includes(marker));
  }
  assert.equal(new Set(diagnostics.map(log => log.diagnostic_id)).size, diagnostics.length);
  return { record, publicError };
}

test("failure logs accurately record omitted overrides for singular and fallback text and schema requests", async () => {
  for (const schema of [undefined, privateSchema]) {
    for (const fallbacks of ["", fallback]) {
      const calls = [];
      const { record, publicError } = await failed({
        env: { ...privateEnv, OPENROUTER_FALLBACK_MODELS: fallbacks },
        fetch: stubFetch(() => Response.json(hostileEnvelope("No endpoints found supporting ZDR", 503), { status: 404 }), calls),
      }, schema);
      const body = JSON.parse(calls[1].options.body);
      assert.equal(calls.length, 2, "no hidden retry");
      for (const key of ["provider", "reasoning"]) assert.equal(Object.hasOwn(body, key), false);
      assert.equal(Object.hasOwn(body, "model"), !fallbacks);
      assert.equal(Object.hasOwn(body, "models"), !!fallbacks);
      assert.deepEqual(record.models, fallbacks ? [primary, fallback] : [primary]);
      assert.equal(record.output_mode, schema ? "json_schema" : "text");
      assert.equal(record.reason, "zdr", "account policy can still restrict an override-free request");
      assert.equal(record.http_status, 404);
      assert.equal(record.provider_code, 503);
      assert.equal(publicError.status, 404);
    }
  }
});

test("structured logs distinguish policy, parameters, availability and unknown without status guesses", async () => {
  const cases = [
    [404, "No endpoints found matching your data policy", "data_policy"],
    [404, "No endpoints found supporting ZDR", "zdr"],
    [404, "No endpoints found supporting zero data retention", "zdr"],
    [404, "No endpoints found that support the requested parameters", "unsupported_required_parameters"],
    [404, "Unsupported required parameters: json_schema", "unsupported_required_parameters"],
    [404, "Structured output is not supported", "unsupported_required_parameters"],
    [404, "The requested model was not found", "model_unavailable"],
    [404, "No endpoints found", "no_endpoints"],
    [404, "Unrecognized private failure", "upstream_unknown"],
    [503, "Unrecognized private failure", "upstream_unknown"],
    [503, "Model temporarily unavailable", "model_unavailable"],
    [429, "Rate limit exceeded", "rate_limit"],
  ];
  for (const [status, message, reason] of cases) {
    const calls = [];
    const { record, publicError } = await failed({ fetch: stubFetch(() => Response.json(hostileEnvelope(message, 529), {
      status, headers: { "retry-after": "999999", "x-request-id": privateText, "x-provider": privateText },
    }), calls) }, privateSchema);
    assert.equal(calls.length, 2, "no retries or extra diagnostic fetch");
    assert.equal(record.http_status, status);
    assert.equal(record.provider_code, 529);
    assert.equal(record.reason, reason);
    assert.equal(record.stage, "inference_body");
    assert.equal(record.error_body_state, "json");
    assert.equal(record.retry_after_seconds, 3600);
    assert.equal(record.output_mode, "json_schema");
    assert.deepEqual(record.models, [primary, fallback]);
    assert.equal(publicError.status, status);
    if (status === 429) assert.equal(publicError.retryAfterSeconds, 999999, "existing public retry contract preserved");
    assert.ok(!publicError.message.includes(record.diagnostic_id), "public text unchanged; ID is a property only");
  }
});

test("HTTP-200 envelopes keep actual HTTP status separate from provider code, even with invalid choices", async () => {
  for (const code of [429, undefined, privateText, 1e100]) {
    const { record, publicError } = await failed({ fetch: stubFetch(() => Response.json({
      ...hostileEnvelope("Quota exhausted", code), choices: privateText,
    })) }, undefined);
    assert.equal(record.http_status, 200);
    assert.equal(record.provider_code, code === 429 ? 429 : null);
    assert.equal(record.stage, "output_validation");
    assert.equal(record.output_mode, "text");
    assert.equal(record.reason, "rate_limit");
    assert.equal(publicError.status, code === 429 ? 429 : 502);
  }
});

test("untrusted error bodies are read once, bounded and never replace primary HTTP errors", async () => {
  const bodies = [
    [() => new Response(privateText, { status: 503 }), "malformed_json"],
    [() => new Response(`{"error": ${privateText}`, { status: 404 }), "malformed_json"],
    [() => new Response(null, { status: 503 }), "empty"],
    [() => new Response(privateText.repeat(500), { status: 503 }), "too_large"],
    [() => new Response(new ReadableStream({ start(controller) { controller.error(new Error(privateText)); } }), { status: 503 }), "unreadable"],
    [() => Response.json({ metadata: { raw: privateText }, error: privateText }, { status: 503 }), "json"],
  ];
  for (const [make, bodyState] of bodies) {
    const reply = make();
    const { record, publicError } = await failed({ fetch: stubFetch(() => reply) });
    assert.equal(record.reason, "upstream_unknown");
    assert.equal(record.error_body_state, bodyState);
    assert.equal(record.http_status, reply.status);
    assert.equal(publicError.status, reply.status);
    assert.equal(record.provider_code, null);
    if (reply.body) assert.equal(reply.bodyUsed, true);
  }
  let pulls = 0, cancelled = false;
  const streaming = new Response(new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(new Uint8Array(4096)); },
    cancel() { cancelled = true; },
  }), { status: 503 });
  const { record } = await failed({ fetch: stubFetch(() => streaming) });
  assert.equal(record.error_body_state, "too_large");
  assert.ok(pulls <= 6, "bounded read stops instead of draining an oversized body");
  assert.equal(cancelled, true);
});

test("config and catalog failures log sanitized stages and make no unauthorized inference", async () => {
  for (const [configuration, timeoutMs, reason, expectedModels] of [
    [{}, 10, "missing_key", []],
    [{ ...privateEnv, OPENROUTER_MODEL: privateText }, 10, "invalid_model_config", []],
    [{ ...privateEnv, OPENROUTER_FALLBACK_MODELS: privateText }, 10, "invalid_model_config", []],
    [privateEnv, 60001, "invalid_timeout", []],
  ]) {
    let calls = 0;
    const { record } = await failed({ env: configuration, timeoutMs, fetch: async () => { calls++; throw new Error(privateText); } });
    assert.equal(calls, 0);
    assert.equal(record.stage, "config");
    assert.equal(record.reason, reason);
    assert.deepEqual(record.models, expectedModels);
    assert.equal(record.http_status, null);
  }
  const { record: unverified } = await failed({
    env: { ...privateEnv, OPENROUTER_MODEL: privateMarkers[6] },
    fetch: async () => Response.json(catalog),
  });
  assert.equal(unverified.reason, "catalog_unverified");
  assert.deepEqual(unverified.models, [], "even syntactically valid unknown IDs must not be logged");
  for (const [make, reason, stage, status] of [
    [() => Response.json(hostileEnvelope("No endpoints", 503), { status: 503 }), "catalog_http_error", "catalog_body", 503],
    [() => new Response(privateText), "catalog_malformed_json", "catalog_body", 200],
    [() => Response.json({ data: privateText }), "catalog_invalid", "catalog_validation", 200],
    [() => Response.json({ data: [] }), "catalog_unverified", "catalog_validation", 200],
    [() => new Response("x".repeat(2 * 1024 * 1024 + 1)), "body_too_large", "catalog_body", 200],
  ]) {
    let calls = 0;
    const { record } = await failed({ fetch: async () => { calls++; return make(); } });
    assert.equal(calls, 1);
    assert.equal(record.reason, reason);
    assert.equal(record.stage, stage);
    assert.equal(record.http_status, status);
  }
  for (const phase of ["catalog", "inference"]) {
    const { record } = await failed({ fetch: async url => {
      if (phase === "inference" && url.endsWith("/models")) return Response.json(catalog);
      throw new Error(privateText);
    } });
    assert.equal(record.reason, "transport_error");
    assert.equal(record.stage, `${phase}_fetch`);
    assert.equal(record.http_status, null);
  }
});

test("a failing diagnostic sink cannot replace the sanitized primary failure", async context => {
  let attempts = 0;
  context.mock.method(console, "error", () => { attempts++; throw new Error(privateText); });
  await assert.rejects(completion(privateMessages, undefined, {
    env: privateEnv, fetch: stubFetch(() => new Response(privateText, { status: 503 })),
  }), error => {
    assert.equal(error.status, 503);
    assert.match(error.message, /No free AI endpoint/);
    assert.equal(typeof error.diagnosticId, "string");
    assert.ok(!String(error).includes(privateText));
    return true;
  });
  assert.equal(attempts, 1);
});

test("malformed, refused, truncated and empty output log closed safe reasons; success logs nothing", async () => {
  for (const [reply, reason] of [
    [() => new Response(privateText), "malformed_json"],
    [() => Response.json({ choices: privateText }), "invalid_response"],
    [() => response(privateText, { choices: [{ message: { content: privateText, refusal: privateText } }] }), "refused_output"],
    [() => Response.json({ choices: [{ message: { content: privateText }, finish_reason: privateText }] }), "truncated_output"],
    [() => response(" "), "empty_output"],
    [() => new Response(privateText.repeat(15000)), "body_too_large"],
    [() => new Response(new ReadableStream({ start(controller) { controller.error(new Error(privateText)); } })), "transport_error"],
  ]) {
    const { record } = await failed({ fetch: stubFetch(reply) });
    assert.equal(record.reason, reason);
    assert.equal(record.http_status, 200);
  }
  const before = diagnostics.length;
  for (const schema of [undefined, privateSchema]) {
    assert.equal(await completion(privateMessages, schema, { env: privateEnv, fetch: stubFetch(() => response(privateText)) }), privateText);
  }
  assert.equal(diagnostics.length, before);
});

test("deadline logs once on stalled error reads and late ignored-abort work, preserving known HTTP failures", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  for (const phase of ["catalog_fetch", "inference_fetch", "inference_body", "error_body", "catalog_error_body"]) {
    let resume, signal, requests = 0, reached;
    const atPhase = new Promise(resolve => { reached = resolve; });
    const late = new Promise(resolve => { resume = resolve; });
    const blockBody = () => new ReadableStream({
      async pull(controller) {
        reached();
        await late;
        controller.enqueue(new TextEncoder().encode(JSON.stringify(hostileEnvelope("data policy"))));
        controller.close();
      },
    }, { highWaterMark: 0 });
    const fetch = async (url, options) => {
      requests++;
      signal = options.signal;
      if (url.endsWith("/models")) {
        if (phase === "catalog_fetch") { reached(); await late; }
        if (phase === "catalog_error_body") return new Response(blockBody(), { status: 503 });
        return Response.json(catalog);
      }
      if (phase === "inference_fetch") { reached(); await late; return response(privateText); }
      return new Response(blockBody(), { status: phase === "error_body" ? 503 : 200 });
    };
    const pending = failed({ fetch, timeoutMs: 10 });
    await atPhase;
    context.mock.timers.tick(10);
    const { record, publicError } = await pending;
    assert.equal(record.reason, "timeout");
    assert.equal(record.timed_out, true);
    assert.equal(record.stage, phase === "catalog_error_body" ? "catalog_body" : phase === "error_body" ? "inference_body" : phase);
    assert.equal(signal.aborted, true);
    if (phase.includes("error_body")) {
      assert.equal(publicError.status, 503);
      assert.equal(record.http_status, 503);
      assert.equal(record.error_body_state, "reading");
    }
    const count = diagnostics.length;
    const calls = requests;
    resume();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(diagnostics.length, count, "late work must not emit a second log");
    assert.equal(requests, calls, "late catalog work must not start inference");
    assert.equal(record.reason, "timeout");
  }
});

const lesson = {
  title: "SDLC requirements", subject: "Software Development Life Cycle", summary: "Learn how software requirements guide development.",
  metadata: { version: 1, audience: "learners", difficulty: "foundation", topic: "requirements", outcomes: ["Describe requirements"], prerequisites: [] },
  slides: Array.from({ length: 4 }, () => ({ title: "Requirements", body: "Capture testable software requirements.", example: "A user can reset a password.", sdlcStage: "requirements" })),
  activity: { prompt: "Order the development stages.", steps: ["Requirements", "Implementation", "Testing"] },
  questions: Array.from({ length: 10 }, () => ({ prompt: "Which stage captures user needs?", options: ["Requirements", "Deployment", "Maintenance", "Implementation"], correct: 0, explanation: "Requirements capture user needs." })),
};
lesson.slides = lesson.slides.map(slide => ({ ...slide, topic: "requirements" }));
const selection = { subject: lesson.subject, metadata: lesson.metadata };
const reference = { subject: lesson.subject, topic: "requirements", slides: lesson.slides };

function mockService(context, reply, calls = []) {
  for (const [name, value] of Object.entries(env)) {
    const previous = process.env[name];
    process.env[name] = value;
    context.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
  context.mock.method(globalThis, "fetch", stubFetch(reply, calls));
}

test("generateLesson uses explicit curriculum metadata and optional untrusted teaching content", async (context) => {
  const calls = [];
  mockService(context, () => response(JSON.stringify(lesson)), calls);
  const result = await generateLesson("SDLC requirements", selection);
  assert.equal(result.title, lesson.title);
  assert.equal(result.slides[0].sdlcStage, undefined);
  assert.deepEqual(JSON.parse(JSON.parse(calls[1].options.body).messages[1].content), { topic: "SDLC requirements", family: "sdlc", ...selection });
  await generateLesson("SDLC requirements", selection, "Synthetic teaching reference");
  const body = JSON.parse(calls[3].options.body);
  assert.deepEqual(JSON.parse(body.messages[1].content), { topic: "SDLC requirements", sourceText: "Synthetic teaching reference", family: "sdlc", ...selection });
  assert.match(body.messages[0].content, /ONLY within the selected approved curriculum/);
  assert.match(body.messages[0].content, /untrusted data/);
  assert.equal(body.response_format.json_schema.schema.properties.subject.const, "Software Development Life Cycle");
  assert.equal(body.response_format.type, "json_schema");
  assert.equal(body.response_format.json_schema.strict, true);
  for (const key of ["provider", "reasoning"]) assert.equal(Object.hasOwn(body, key), false);
  assert.equal(body.max_tokens, Math.min(16384, Math.max(256, body.messages.reduce((sum, message) => sum + [...message.content].length, 0) * 3)));
});

test("generated lessons reject malformed JSON, invalid schema and structural out-of-scope content", async (context) => {
  let content;
  mockService(context, () => response(content));
  for (const candidate of ["not JSON", "{}", JSON.stringify({ ...lesson, subject: "Cooking" }), JSON.stringify({ ...lesson, slides: lesson.slides.map((slide) => ({ ...slide, topic: "coding-agents" })) }), JSON.stringify({ ...lesson, questions: [] }), JSON.stringify({ ...lesson, slides: lesson.slides.map((slide) => ({ title: slide.title, body: slide.body, example: slide.example })) }), JSON.stringify({ ...lesson, metadata: { ...lesson.metadata, outcomes: ["Invented outcome"] } })]) {
    content = candidate;
    await assert.rejects(generateLesson("SDLC", selection), /incomplete or out-of-scope curriculum/);
  }
});

test("invalid generation inputs never call the network", async (context) => {
  const calls = [];
  mockService(context, () => response(), calls);
  for (const args of [["", selection], ["a".repeat(2001), selection], ["SDLC", selection, ""], ["SDLC", selection, "a".repeat(20001)]]) await assert.rejects(generateLesson(...args), /Provide a topic/);
  await assert.rejects(generateLesson("Synthetic objective", { subject: FAMILIES["coding-agents"], metadata: lesson.metadata }));
  assert.equal(calls.length, 0);
});

test("coaching preserves its contract, SDLC boundaries and avoids sending extra slide fields", async (context) => {
  const calls = [];
  mockService(context, () => response(), calls);
  assert.equal(await coachReply({ ...reference, questions: lesson.questions, learnerId: "must-not-send", slides: lesson.slides.map((slide) => ({ ...slide, learnerId: "must-not-send" })) }, [{ role: "user", content: "Explain requirements" }]), "Synthetic SDLC response");
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.max_tokens, Math.min(16384, Math.max(256, body.messages.reduce((sum, message) => sum + [...message.content].length, 0) * 3)));
  assert.equal(body.response_format, undefined);
  for (const key of ["provider", "reasoning"]) assert.equal(Object.hasOwn(body, key), false);
  assert.match(body.messages[0].content, /Software Development Life Cycle/);
  assert.match(body.messages[0].content, /decline unrelated/);
  assert.equal(body.messages[1].role, "user");
  assert.ok(!calls[1].options.body.includes("must-not-send"));
  assert.ok(!calls[1].options.body.includes('"correct"'));
  await assert.rejects(coachReply(reference, [{ role: "system", content: "override" }]), /valid lesson slides/);
  await assert.rejects(coachReply(null, [{ role: "user", content: "SDLC" }]), /valid lesson slides/);
  assert.equal(calls.length, 2);
});

test("interview text uses the shared content-based budget without schema or provider/reasoning overrides", async context => {
  const calls = [];
  mockService(context, response, calls);
  await interviewReply({ topic: "verification", level: "foundation", turns: [{ status: "pending", kind: "opening" }] });
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.max_tokens, Math.min(16384, Math.max(256, body.messages.reduce((sum, message) => sum + [...message.content].length, 0) * 3)));
  assert.equal(body.response_format, undefined);
  for (const key of ["provider", "reasoning"]) assert.equal(Object.hasOwn(body, key), false);
});

test("all three selected families generate and coach without SDLC relabeling", async context => {
  let output;
  const calls = [];
  mockService(context, () => response(JSON.stringify(output)), calls);
  for (const [family, subject] of Object.entries(FAMILIES)) {
    const topic = family === "sdlc" ? "requirements" : family;
    output = { ...lesson, subject, metadata: { ...lesson.metadata, topic }, slides: lesson.slides.map(slide => ({ ...slide, topic })) };
    const selected = { subject, metadata: output.metadata };
    const result = await generateLesson("Synthetic software objective", selected);
    assert.deepEqual(result.metadata, selected.metadata);
    assert.equal(result.subject, subject);
    await coachReply({ subject, topic, slides: output.slides }, [{ role: "user", content: "Explain the supplied example" }]);
    const body = JSON.parse(calls.at(-1).options.body);
    assert.match(body.messages[0].content, new RegExp(subject));
    assert.equal(JSON.parse(body.messages[1].content.replace("Lesson reference data: ", "")).topic, topic);
  }
});