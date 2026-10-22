import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sources = await Promise.all([
  "../scripts/check-setup.mjs", "../src/lib/openrouter-client.ts", "../src/lib/public-config.ts",
].map(path => readFile(new URL(path, import.meta.url), "utf8")));
const [cli, clientSource, publicSource] = sources.map(source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, allowJs: true },
}).outputText);
const sentinel = "SECRET_SENTINEL_DO_NOT_PRINT";
const primary = "example/primary:free";
const fallback = "example/fallback:free";
const environment = {
  NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: `${sentinel}-anon`,
  NEXT_PUBLIC_SITE_URL: "https://synthetic.example.org",
  SUPABASE_SERVICE_ROLE_KEY: `${sentinel}-service`,
  OPENROUTER_API_KEY: `${sentinel}-ai`,
};
const catalog = models => ({ data: models.map(id => ({ id, pricing: { prompt: "0", completion: "0", request: "0" } })) });
const response = (content = '{"ok":true}') => Response.json({ choices: [{ message: { content }, finish_reason: "stop" }] });

// Execute full production modules, not canned completion/configuration helpers.
// Only process/console/nextEnv/Supabase and HTTP are adapted. No host env or real
// client creation is reachable; unexpected imports and URLs fail closed.
async function setup({ args = [], env = {}, reply = response, catalogReply, missing, envThrows = false, databaseThrows = false, fetchThrows = false } = {}) {
  const state = { envLoads: 0, databases: 0, queries: [], requests: [], output: [], exitCode: 0 };
  const process = { env: { ...environment, ...env }, argv: ["node", "check-setup.mjs", ...args], cwd: () => "synthetic-cwd", exitCode: 0 };
  const console = Object.fromEntries(["log", "error", "warn"].map(method => [method, (...args) => state.output.push(args.join(" "))]));
  let actualModels;
  const context = {
    process, console, URL, AbortSignal, AbortController, setTimeout, clearTimeout, performance, TextDecoder,
    Uint8Array,
    fetch: async (url, options) => {
      state.requests.push({ url, options });
      if (fetchThrows) throw new Error(`${sentinel}-transport-https://secret.example/?token=secret-query`);
      if (url === "https://openrouter.ai/api/v1/models") return catalogReply ? catalogReply() : Response.json(catalog(actualModels));
      if (url === "https://openrouter.ai/api/v1/chat/completions") return reply();
      throw new Error("Unexpected network forbidden");
    },
  };
  function load(source, dependencies) {
    const exports = {};
    runInNewContext(source, { ...context, exports, require(name) {
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error("Unexpected module forbidden");
    } });
    return exports;
  }
  const client = load(clientSource, { "node:crypto": require("node:crypto"), zod: require("zod") });
  // Use the actual configured helper to build the synthetic catalog too.
  try { actualModels = client.configuredFreeModels(process.env); } catch { actualModels = []; }
  const publicConfig = load(publicSource, {});
  await runInNewContext(`(async () => { ${cli}\n })()`, {
    ...context, exports: {}, require(name) {
      if (name === "@next/env") return { default: { loadEnvConfig() {
        state.envLoads++;
        if (envThrows) throw new Error(`${sentinel}-env`);
      } } };
      if (name === "zod") return require("zod");
      if (name === "../src/lib/openrouter-client.ts") return client;
      if (name === "../src/lib/public-config.ts") return publicConfig;
      if (name === "@supabase/supabase-js") return { createClient() {
        state.databases++;
        if (databaseThrows) throw new Error(`${sentinel}-database`);
        return { from(table) { return { select(columns) { return { async limit(limit) {
          state.queries.push({ table, columns, limit });
          const unavailable = missing && table === missing.table && (!missing.column || columns.split(",").includes(missing.column));
          return unavailable ? { data: null, error: { message: `${sentinel}-database-body` } } : { data: [], error: null };
        } }; } }; } };
      } };
      throw new Error("Unexpected CLI module forbidden");
    },
  });
  state.exitCode = process.exitCode;
  state.text = state.output.join("\n");
  assert.doesNotMatch(state.text, /SECRET_SENTINEL|secret-query|secret\.example|upstream-private|Synthetic connectivity|Return only|Error:|stack/i);
  return state;
}

test("setup rejects invalid CLI before environment loading, database creation or network", async () => {
  for (const args of [["--bad"], ["--ai=false"], ["--ai", "--bad"]]) {
    const state = await setup({ args });
    assert.equal(state.exitCode, 1);
    assert.match(state.text, /Usage:/);
    assert.equal(state.envLoads, 0);
    assert.equal(state.databases, 0);
    assert.equal(state.requests.length, 0);
    assert.equal(state.queries.length, 0);
  }
});

test("setup default checks required columns with zero-row reads and makes no AI requests", async () => {
  const state = await setup();
  assert.equal(state.exitCode, 0);
  assert.equal(state.envLoads, 1);
  assert.equal(state.databases, 1);
  assert.equal(state.requests.length, 0);
  assert.ok(state.queries.every(query => query.limit === 0 && !query.columns.includes("*")));
  assert.ok(state.queries.find(query => query.table === "forge_enrollments").columns.split(",").includes("progress_evidence"));
  const generation = state.queries.find(query => query.table === "forge_lesson_generations");
  assert.ok(generation, "saved generation storage must be checked");
  assert.deepEqual(generation.columns.split(",").sort(), [
    "id", "owner_id", "kind", "objective", "selection", "source_text", "parts", "part_count",
    "attempts", "revision", "lesson_id", "created_at", "deleted_at",
  ].sort());
  assert.match(state.text, /SKIP Live AI inference/);
  assert.match(state.text, /does not apply migrations.*verify grants\/RPCs.*provider eligibility/);
});

test("setup --ai uses actual configured default, override, key alias and ordered fallbacks in ONE catalog-verified POST", async () => {
  for (const env of [
    {}, { OPENROUTER_MODEL: primary },
    { OPENROUTER_MODEL: primary, OPENROUTER_FALLBACK_MODELS: ` ${fallback},${primary},${fallback}` },
    { OPENROUTER_API_KEY: undefined, OPEN_ROUTER_API_KEY: `${sentinel}-alias`, OPENROUTER_MODEL: primary },
  ]) {
    const state = await setup({ args: ["--ai"], env });
    assert.equal(state.exitCode, 0);
    assert.equal(state.requests.length, 2);
    const [get, post] = state.requests;
    assert.equal(get.url, "https://openrouter.ai/api/v1/models");
    assert.equal(get.options.headers, undefined);
    assert.equal(post.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(post.options.method, "POST");
    for (const request of state.requests) {
      assert.equal(request.options.redirect, "error");
      assert.equal(request.options.cache, "no-store");
      assert.ok(request.options.signal instanceof AbortSignal);
    }
    const body = JSON.parse(post.options.body);
    assert.equal(Object.hasOwn(body, "provider"), false);
    assert.equal(Object.hasOwn(body, "reasoning"), false);
    assert.deepEqual(Object.keys(body).sort(), ["messages", "max_tokens", "response_format", env.OPENROUTER_FALLBACK_MODELS ? "models" : "model"].sort());
    if (env.OPENROUTER_FALLBACK_MODELS) assert.deepEqual(body.models, [primary, fallback]);
    else assert.equal(body.model, env.OPENROUTER_MODEL ?? "nvidia/nemotron-3-ultra-550b-a55b:free");
    assert.equal(post.options.headers.Authorization, `Bearer ${env.OPEN_ROUTER_API_KEY ?? environment.OPENROUTER_API_KEY}`);
    const characters = body.messages.reduce((count, message) => count + [...message.content].length, 0);
    assert.equal(body.max_tokens, Math.min(16384, Math.max(256, characters * 3)));
    assert.equal(body.response_format.type, "json_schema");
    assert.equal(body.response_format.json_schema.strict, true);
    assert.equal(body.response_format.json_schema.schema.additionalProperties, false);
    assert.match(state.text, /PASS Synthetic AI inference/);
    assert.doesNotMatch(state.text, /\{"ok":true\}/);
  }
});

test("setup missing or invalid local configuration fails before any AI fetch", async () => {
  for (const env of [
    { OPENROUTER_API_KEY: undefined, OPEN_ROUTER_API_KEY: undefined },
    { OPENROUTER_MODEL: "example/paid" },
    { OPENROUTER_FALLBACK_MODELS: "example/paid" },
    { OPENROUTER_MODEL: `${sentinel}?invalid` },
    { NEXT_PUBLIC_SUPABASE_URL: `https://secret.example/?token=${sentinel}` },
    { NEXT_PUBLIC_SUPABASE_ANON_KEY: "" }, { NEXT_PUBLIC_SITE_URL: "" },
    { SUPABASE_SERVICE_ROLE_KEY: "" },
  ]) {
    for (const args of [[], ["--ai"]]) {
      const state = await setup({ args, env });
      assert.equal(state.exitCode, 1);
      assert.equal(state.requests.length, 0);
      assert.match(state.text, /FAIL/);
    }
  }
});

test("setup rejects unverified, absent and nonzero-priced free catalog entries before completion", async () => {
  for (const data of [
    [], [{ id: primary }], [{ id: primary, pricing: { prompt: "0", completion: "1" } }],
    [{ id: primary, pricing: { prompt: "0", completion: "0", request: "0.01" } }],
    catalog([primary]).data,
  ]) {
    const state = await setup({ args: ["--ai"], env: { OPENROUTER_MODEL: primary, OPENROUTER_FALLBACK_MODELS: fallback }, catalogReply: () => Response.json({ data }) });
    assert.equal(state.exitCode, 1);
    assert.equal(state.requests.length, 1);
    assert.match(state.text, /FAIL Synthetic AI inference/);
  }
});

test("setup fails sanitised on HTTP 429, 404 and 401 without retry or provider-policy relaxation", async () => {
  for (const phase of ["catalog", "completion"]) {
    for (const status of [429, 404, 401]) {
      const failure = () => Response.json({ error: { message: `${sentinel}-upstream-private`, metadata: { account: sentinel } } }, { status, headers: { "retry-after": "12" } });
      const state = await setup({ args: ["--ai"], ...(phase === "catalog" ? { catalogReply: failure } : { reply: failure }) });
      assert.equal(state.exitCode, 1);
      assert.equal(state.requests.length, phase === "catalog" ? 1 : 2);
      assert.match(state.text, /FAIL Synthetic AI inference/);
      assert.match(state.text, new RegExp(`HTTP ${status}`));
    }
  }
});

test("setup strict local validation rejects malformed, false, wrong and extra output without printing it", async () => {
  for (const output of ['{"ok":false}', '{"ok":"true"}', '{"ok":true,"extra":"SECRET_SENTINEL"}', "not JSON upstream-private", "null", "[]", "{}"]) {
    const state = await setup({ args: ["--ai"], reply: () => response(output) });
    assert.equal(state.exitCode, 1);
    assert.equal(state.requests.length, 2);
    assert.match(state.text, /FAIL Synthetic AI inference/);
    assert.match(state.text, /schema/);
  }
  for (const reply of [() => new Response(`upstream-private ${sentinel}`), () => Response.json({ choices: [] }), () => Response.json({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "length" }] })]) {
    const state = await setup({ args: ["--ai"], reply });
    assert.equal(state.exitCode, 1);
    assert.match(state.text, /FAIL Synthetic AI inference/);
  }
});

test("setup missing generation, progress and reflection columns fail readiness, with no inference", async () => {
  for (const missing of [
    { table: "forge_lesson_generations" },
    ...["id", "owner_id", "kind", "objective", "selection", "source_text", "parts", "part_count", "attempts", "revision", "lesson_id", "created_at", "deleted_at"].map(column => ({ table: "forge_lesson_generations", column })),
    { table: "forge_enrollments", column: "progress_evidence" },
    ...["id", "owner_id", "date", "delegation", "description", "discernment", "diligence", "revision", "created_at", "updated_at"].map(column => ({ table: "forge_reflections", column })),
  ]) {
    const state = await setup({ args: ["--ai"], missing });
    assert.equal(state.exitCode, 1, `missing ${missing.table}.${missing.column ?? "*"}`);
    assert.equal(state.requests.length, 0);
    assert.match(state.text, new RegExp(`FAIL ${missing.table}`));
  }
});

test("setup infrastructure exceptions remain fixed/sanitised and nonzero", async () => {
  for (const options of [{ envThrows: true }, { databaseThrows: true }, { fetchThrows: true }]) {
    const state = await setup({ args: ["--ai"], ...options });
    assert.equal(state.exitCode, 1);
    assert.match(state.text, /FAIL/);
  }
});
