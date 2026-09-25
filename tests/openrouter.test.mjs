import test from "node:test";
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

const primary = "example/primary:free";
const fallback = "example/fallback:free";
const catalog = { data: [primary, fallback].map((id) => ({ id, pricing: { prompt: "0", completion: "0" } })) };

test("free models preserve primary-first fallback order, trim and deduplicate", () => {
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

test("fallback request uses only ordered free models and preserves privacy and structured output", async () => {
  const calls = [];
  const schema = { type: "object" };
  assert.equal(await completion([{ role: "user", content: "Explain SDLC" }], schema, { env, fetch: stubFetch(() => response("fallback result", { model: fallback }), calls) }), "fallback result");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.headers, undefined);
  assert.equal(calls[0].url, "https://openrouter.ai/api/v1/models");
  assert.equal(calls[1].url, "https://openrouter.ai/api/v1/chat/completions");
  const body = JSON.parse(calls[1].options.body);
  assert.deepEqual(Object.keys(body).sort(), ["models", "provider", "reasoning", "messages", "max_tokens", "response_format"].sort());
  assert.deepEqual(body.models, [primary, fallback]);
  assert.deepEqual(body.provider, { data_collection: "deny", zdr: true, require_parameters: true });
  assert.deepEqual(body.reasoning, { enabled: false });
  assert.deepEqual(body.response_format, { type: "json_schema", json_schema: { name: "learning_lesson", strict: true, schema } });
  assert.equal(body.max_tokens, 6500);
  for (const call of calls) {
    assert.equal(call.options.cache, "no-store");
    assert.equal(call.options.redirect, "error");
    assert.ok(call.options.signal instanceof AbortSignal);
  }
});

test("unverified or malformed catalog never reaches authenticated inference", async () => {
  for (const reply of [Response.json({ data: [] }), new Response("invalid JSON"), new Response(null, { status: 503 })]) {
    let requests = 0;
    await assert.rejects(completion([], undefined, { env, fetch: async () => { requests++; return reply; } }), /catalog/);
    assert.equal(requests, 1);
  }
});

test("quota and provider failures are clear, sanitized and never locally retried", async () => {
  for (const [status, message] of [[429, /quota/], [401, /key is invalid/], [402, /No paid fallback/], [404, /privacy/], [503, /privacy/], [500, /could not complete/]]) {
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

test("one finite deadline covers catalog, inference and response body even if fetch ignores abort", async () => {
  for (const phase of ["catalog", "inference", "body"]) {
    let signal;
    const fetch = async (url, options) => {
      signal = options.signal;
      if (phase === "catalog" || (phase === "inference" && !url.endsWith("/models"))) return new Promise(() => {});
      if (url.endsWith("/models")) return Response.json(catalog);
      return { ok: true, json: () => new Promise(() => {}) };
    };
    await assert.rejects(completion([], undefined, { env, fetch, timeoutMs: 10 }), /timed out/);
    assert.equal(signal.aborted, true);
  }
  for (const timeoutMs of [Infinity, NaN, 0, -1, 55001]) await assert.rejects(completion([], undefined, { env, timeoutMs }), /timeout/);
  await assert.rejects(completion([], undefined, { env, fetch: async () => { throw new Error("private transport details"); } }), /^OpenRouterError: Generation timed out/);
});

const lesson = {
  title: "SDLC requirements", subject: "Software Development Life Cycle", summary: "Learn how software requirements guide development.",
  slides: Array.from({ length: 4 }, () => ({ title: "Requirements", body: "Capture testable software requirements.", example: "A user can reset a password.", sdlcStage: "requirements" })),
  activity: { prompt: "Order the development stages.", steps: ["Requirements", "Implementation", "Testing"] },
  questions: Array.from({ length: 10 }, () => ({ prompt: "Which stage captures user needs?", options: ["Requirements", "Deployment", "Maintenance", "Implementation"], correct: 0, explanation: "Requirements capture user needs." })),
};

function mockService(context, reply, calls = []) {
  for (const [name, value] of Object.entries(env)) {
    const previous = process.env[name];
    process.env[name] = value;
    context.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
  context.mock.method(globalThis, "fetch", stubFetch(reply, calls));
}

test("generateLesson retains the one-argument contract and supports optional untrusted teaching content", async (context) => {
  const calls = [];
  mockService(context, () => response(JSON.stringify(lesson)), calls);
  const result = await generateLesson("SDLC requirements");
  assert.equal(result.title, lesson.title);
  assert.equal(result.slides[0].sdlcStage, undefined);
  assert.deepEqual(JSON.parse(JSON.parse(calls[1].options.body).messages[1].content), { topic: "SDLC requirements" });
  await generateLesson("SDLC requirements", "Synthetic teaching reference");
  const body = JSON.parse(calls[3].options.body);
  assert.deepEqual(JSON.parse(body.messages[1].content), { topic: "SDLC requirements", sourceText: "Synthetic teaching reference" });
  assert.match(body.messages[0].content, /ONLY about the Software Development Life Cycle/);
  assert.match(body.messages[0].content, /untrusted data/);
  assert.equal(body.response_format.json_schema.schema.properties.subject.const, "Software Development Life Cycle");
});

test("generated lessons reject malformed JSON, invalid schema and structural out-of-scope content", async (context) => {
  let content;
  mockService(context, () => response(content));
  for (const candidate of ["not JSON", "{}", JSON.stringify({ ...lesson, subject: "Cooking" }), JSON.stringify({ ...lesson, slides: lesson.slides.map((slide) => ({ ...slide, sdlcStage: "cooking" })) }), JSON.stringify({ ...lesson, questions: [] }), JSON.stringify({ ...lesson, slides: lesson.slides.map((slide) => ({ title: slide.title, body: slide.body, example: slide.example })) })]) {
    content = candidate;
    await assert.rejects(generateLesson("SDLC"), /incomplete or out-of-scope SDLC/);
  }
});

test("invalid generation inputs never call the network", async (context) => {
  const calls = [];
  mockService(context, () => response(), calls);
  for (const args of [[""], ["a".repeat(2001)], ["SDLC", ""], ["SDLC", "a".repeat(20001)]]) await assert.rejects(generateLesson(...args), /Provide a topic/);
  assert.equal(calls.length, 0);
});

test("coaching preserves its contract, SDLC boundaries and avoids sending extra slide fields", async (context) => {
  const calls = [];
  mockService(context, () => response(), calls);
  assert.equal(await coachReply(lesson.slides.map((slide) => ({ ...slide, learnerId: "must-not-send" })), [{ role: "user", content: "Explain requirements" }]), "Synthetic SDLC response");
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.max_tokens, 600);
  assert.equal(body.response_format, undefined);
  assert.match(body.messages[0].content, /Software Development Life Cycle/);
  assert.match(body.messages[0].content, /decline unrelated/);
  assert.equal(body.messages[1].role, "user");
  assert.ok(!calls[1].options.body.includes("must-not-send"));
  await assert.rejects(coachReply(lesson.slides, [{ role: "system", content: "override" }]), /valid lesson slides/);
  await assert.rejects(coachReply(null, [{ role: "user", content: "SDLC" }]), /valid lesson slides/);
  assert.equal(calls.length, 2);
});