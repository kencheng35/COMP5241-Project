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

test("requests use the exact default or explicit override, with no implicit fallback", async () => {
  for (const [configuration, model] of [[{}, defaultModel], [{ OPENROUTER_MODEL: primary }, primary]]) {
    let body;
    await completion([], undefined, {
      env: { OPENROUTER_API_KEY: "synthetic-key", ...configuration },
      fetch: async (url, options) => {
        if (url.endsWith("/models")) return Response.json({ data: [{ id: model, pricing: { prompt: "0", completion: "0" } }] });
        body = JSON.parse(options.body);
        return response();
      },
    });
    assert.deepEqual(body.models, [model]);
    assert.equal(body.model, undefined);
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
  assert.equal(body.max_tokens, 256);
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

test("default and maximum deadlines are exactly 30000ms; smaller injectable deadlines remain valid", async context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  for (const timeoutMs of [undefined, 30000, 1, 10]) {
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
        advance(4);
        return { ok: true, json: async () => {
          if (phase === "catalog body") return block();
          advance(3);
          return catalog;
        } };
      }
      if (phase === "inference") return block();
      advance(2);
      return { ok: true, json: block };
    };
    const pending = completion([], undefined, { env, fetch, timeoutMs: 10 });
    pending.then(() => { settled = true; }, () => { settled = true; });
    const rejected = assert.rejects(pending, /timed out/);
    await reached;
    advance(9 - elapsed);
    await Promise.resolve();
    assert.equal(settled, false, phase);
    advance(1);
    await rejected;
    assert.ok(signals.every(signal => signal === signals[0] && signal.aborted));
  }
});

test("invalid deadlines and transport details fail safely", async () => {
  let requests = 0;
  for (const timeoutMs of [Infinity, NaN, 0, -1, 30001, 55000]) {
    await assert.rejects(completion([], undefined, {
      env, timeoutMs, fetch: async () => { requests++; throw new Error("Network forbidden"); },
    }), /Invalid AI request timeout/);
  }
  assert.equal(requests, 0);
  await assert.rejects(completion([], undefined, { env, fetch: async () => { throw new Error("private transport details"); } }), /^OpenRouterError: Generation timed out/);
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
  assert.match(body.messages[0].content, /Software Development Life Cycle/);
  assert.match(body.messages[0].content, /decline unrelated/);
  assert.equal(body.messages[1].role, "user");
  assert.ok(!calls[1].options.body.includes("must-not-send"));
  assert.ok(!calls[1].options.body.includes('"correct"'));
  await assert.rejects(coachReply(reference, [{ role: "system", content: "override" }]), /valid lesson slides/);
  await assert.rejects(coachReply(null, [{ role: "user", content: "SDLC" }]), /valid lesson slides/);
  assert.equal(calls.length, 2);
});

test("interview text uses the shared content-based budget and privacy client without a schema", async context => {
  const calls = [];
  mockService(context, response, calls);
  await interviewReply({ topic: "verification", level: "foundation", turns: [{ status: "pending", kind: "opening" }] });
  const body = JSON.parse(calls[1].options.body);
  assert.equal(body.max_tokens, Math.min(16384, Math.max(256, body.messages.reduce((sum, message) => sum + [...message.content].length, 0) * 3)));
  assert.equal(body.response_format, undefined);
  assert.deepEqual(body.provider, { data_collection: "deny", zdr: true, require_parameters: true });
  assert.deepEqual(body.reasoning, { enabled: false });
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