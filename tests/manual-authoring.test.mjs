import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createRequire, registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";
import ts from "typescript";
import { z } from "zod";

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith("@/lib/")) return next(new URL(`../src/lib/${specifier.slice(6)}.ts`, import.meta.url).href, context);
  return next(specifier, context);
} });
const learning = await import("../src/lib/learning.ts");
const recommendations = await import("../src/lib/recommendations.ts");
const permissions = await import("../src/lib/permissions.ts");
const resume = await import("../src/lib/resume.ts");
const curriculum = await import("../src/lib/curriculum.ts");
const eligibility = await import("../src/lib/eligibility.ts");
const providerClient = await import("../src/lib/openrouter-client.ts");
const require = createRequire(import.meta.url);
const transpile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const sources = Object.fromEntries([
  ["react", "react", "react.development.js"], ["react/jsx-runtime", "react", "react-jsx-runtime.development.js"],
  ["react-dom", "react-dom", "react-dom.development.js"], ["react-dom/client", "react-dom", "react-dom-client.development.js"],
  ["scheduler", "scheduler", "scheduler.development.js"],
].map(([name, pkg, file]) => [name, readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "cjs", file), "utf8")]));
sources.editor = transpile("../src/components/learning-controls.tsx");
sources["./lesson-preview"] = transpile("../src/components/lesson-preview.tsx");
sources["./lesson-metadata"] = transpile("../src/components/lesson-metadata.tsx");
sources["@/lib/curriculum"] = transpile("../src/lib/curriculum.ts");
sources.studio = transpile("../src/app/studio/page.tsx");
function bundleCjs(path) {
  if (sources[path]) return path;
  sources[path] = "loading";
  const localRequire = createRequire(path);
  sources[path] = readFileSync(path, "utf8").replace(/require\(["']([^"']+)["']\)/g, (_, name) => `require(${JSON.stringify(bundleCjs(localRequire.resolve(name)))})`);
  return path;
}
sources.zod = `module.exports = require(${JSON.stringify(bundleCjs(require.resolve("zod")))});`;
const fixture = {
  title: "Software requirements", subject: "Software Development Life Cycle", summary: "Capture testable software requirements.",
  metadata: { version: 1, audience: "learners", difficulty: "foundation", topic: "requirements", outcomes: ["Write testable requirements"], prerequisites: [] },
  slides: Array.from({ length: 4 }, () => ({ title: "Requirements", body: "Write testable requirements.", example: "A learner can save a draft." })),
  activity: { prompt: "Order the work", steps: ["Discover", "Describe", "Validate"] },
  questions: Array.from({ length: 10 }, () => ({ prompt: "Which is testable?", options: ["A", "B", "C", "D"], correct: 0, explanation: "A is measurable." })),
};
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8").replace('@import "tailwindcss";', "");

test("mounted real studio: blank manual creation and AI generation persistence contracts", async context => {
  const unexpectedFetches = [];
  context.mock.method(globalThis, "fetch", async url => {
    unexpectedFetches.push(String(url));
    throw new Error("Unexpected fetch: offline lesson tests require an injected synthetic response.");
  });
  const rows = new Map(), calls = [];
  const user = { id: "00000000-0000-4000-8000-000000000001", app_metadata: {} };
  let signedIn = true, failSave = false, gate = null, loseAcknowledgement = false, aiAllowed = true, insertOutcome = null;
  let realGeneration = false, configured = true, profileError = null, insertError = null, quotaError = null, quotaAllowed = true, providerStatus = 200;
  let providerConfigured = true, revokeAfterProvider = false;
  const fetchCalls = [], quotaCalls = [];
  const providerCalls = [];
  const server = {
    ...permissions, currentUser: async () => { if (!signedIn) throw new Error("Please log in again."); return user; },
    accessibleLesson: async (id, account, review = false) => {
      const row = rows.get(id);
      return row && (row.visibility === "public" || row.owner_id === account.id || review && permissions.isAdmin(account) && row.review_requested) ? row : null;
    },
    enrolledLesson: async (id, account) => {
      const row = await server.accessibleLesson(id, account);
      if (!row) throw new Error("Lesson not found or unavailable.");
      return row;
    },
    database: () => {
      if (!configured) throw new Error("Learning services are not configured.");
      return { from(table) {
      if (table === "profiles") {
        const query = { select(columns) { assert.equal(columns, "age"); return query; }, eq(column, id) { assert.equal(column, "id"); assert.equal(id, user.id); return query; },
          maybeSingle: async () => ({ data: { age: 18 }, error: profileError }) };
        return query;
      }
      assert.equal(table, "forge_lessons");
      let values, kind;
      const filters = {};
      const query = {
        insert(input) { kind = "insert"; values = input; return query; },
        update(input) { kind = "update"; values = input; return query; },
        select() { return query; }, eq(key, value) { filters[key] = value; return query; },
        async single() {
          if (gate) await gate;
          if (insertError) return { data: null, error: insertError };
          if (failSave) return { data: null, error: { code: "23514", message: "Synthetic constraint rejection" } };
          const id = `00000000-0000-4000-8000-${String(rows.size + 10).padStart(12, "0")}`;
          calls.push({ kind, id });
          rows.set(id, { ...values, id, version: 1 });
          if (insertOutcome === "throw-after-commit") throw new Error("PRIVATE_DB_ACK lost after commit");
          if (insertOutcome === "returned-error-after-commit") return { data: null, error: { code: "PGRST116", message: "PRIVATE_DB_ACK response unavailable" } };
          if (insertOutcome === "missing-data-after-commit") return { data: null, error: null };
          if (insertOutcome === "malformed-data-after-commit") return { data: { id: "PRIVATE_DB_ACK invalid id" }, error: null };
          return { data: { id }, error: null };
        },
        async maybeSingle() {
          if (failSave) return { data: null, error: {} };
          calls.push({ kind, ...filters });
          const row = rows.get(filters.id);
          if (!row || row.version !== filters.version) return { data: null, error: null };
          rows.set(row.id, { ...row, ...values });
          return { data: { id: row.id }, error: null };
        },
      };
      return query;
    }, async rpc(name, parameters) { quotaCalls.push({ name, parameters }); return { data: quotaAllowed, error: quotaError }; } };
    },
  };
  function loadServer(path, dependencies) {
    const mod = { exports: {} };
    new Function("require", "module", "exports", transpile(path))(
      name => { assert.ok(name in dependencies, name); return dependencies[name]; }, mod, mod.exports);
    return mod.exports;
  }
  const guard = loadServer("../src/lib/ai-eligibility-server.ts", {
    "server-only": {}, "@/lib/learning-server": server, "@/lib/eligibility": eligibility,
  });
  const realProvider = loadServer("../src/lib/openrouter.ts", {
    "server-only": {}, zod: { z }, "@/lib/learning": learning, "@/lib/curriculum": curriculum,
    "@/lib/openrouter-client": { completion: (messages, schema) => providerClient.completion(messages, schema, {
      env: providerConfigured ? { OPENROUTER_API_KEY: "synthetic-only", OPENROUTER_MODEL: "synthetic/model:free" } : {},
      fetch: async (url, options) => {
        fetchCalls.push({ url, options });
        if (url.endsWith("/models")) return Response.json({ data: [{ id: "synthetic/model:free", pricing: { prompt: "0", completion: "0" } }] });
        if (providerStatus !== 200) return new Response("PRIVATE_PROVIDER_ERROR", { status: providerStatus });
        const request = JSON.parse(options.body);
        const selected = JSON.parse(request.messages[1].content);
        if (revokeAfterProvider) aiAllowed = false;
        return Response.json({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({
          ...fixture, subject: selected.subject, metadata: selected.metadata,
          slides: fixture.slides.map(slide => ({ ...slide, topic: selected.metadata.topic })),
        }) } }] });
      },
    }) },
  });
  const dependencies = {
    "next/cache": { revalidatePath() {} }, zod: { z },
    "@/lib/learning-server": server, "@/lib/learning": learning,
    "@/lib/recommendations": recommendations, "@/lib/resume": resume,
    "@/lib/curriculum": curriculum,
    "@/lib/openrouter": { coachReply: async (...args) => { providerCalls.push(args); return "Synthetic coach reply"; },
      generateLesson: async (objective, selection) => { providerCalls.push([objective, selection]); return realGeneration ? realProvider.generateLesson(objective, selection) : { ...fixture, ...selection }; } },
    "@/lib/ai-eligibility-server": { requireAiAccess: async account => { if (!aiAllowed) throw new Error("AI access denied"); if (realGeneration) await guard.requireAiAccess({ ...account, app_metadata: { ai_access: true } }); } },
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", transpile("../src/app/learning/actions.ts"))(
    name => { assert.ok(name in dependencies, name); return dependencies[name]; }, mod, mod.exports);
  const browser = await chromium.launch();
  const browserContext = await browser.newContext({ offline: true, serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  context.after(async () => { await browserContext.close(); await browser.close(); });
  const requests = [], browserErrors = [];
  const screenshots = await mkdtemp(join(tmpdir(), "forge-manual-qa01-"));
  context.diagnostic(`Synthetic studio screenshots captured (inspection reported separately): ${screenshots}; Chromium ${browser.version()}`);
  await browserContext.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  async function mount(initial = fixture, admin = false, persisted = { id: "", version: 1 }, route = null) {
  const page = await browserContext.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", error => browserErrors.push(error.message));
  await page.exposeFunction("invokeAction", async (name, previous, entries) => {
    const form = new FormData();
    for (const [key, value] of entries) form.set(key, value);
    const result = await mod.exports[name](previous, form);
    if (loseAcknowledgement) throw new Error("Synthetic lost acknowledgement");
    return result;
  });
  await page.setContent(`<style>${css}</style><main class="portal-page studio-editor"><div id="root"></div></main>`);
  await page.evaluate(async ({ sources, fixture, admin, persisted, route }) => {
    const modules = {};
    window.manualSettled = 0;
    function load(name) {
      if (name === "@/components/learning-controls") return load("editor");
      if (name === "@/components/lesson-metadata") return load("./lesson-metadata");
      if (name === "@/components/learner-shell") return { LearnerShell: ({ children }) => load("react").createElement("main", {}, children) };
      if (name === "@/lib/learning-server") return { requireUser: async () => ({ id: "synthetic" }), displayName: async () => "Synthetic author", isAdmin: () => false, isInstructor: () => false, canPublishLessons: () => false };
      if (name === "next/navigation") return { notFound() { throw new Error("Not found"); } };
      if (name === "@/app/learning/actions") return new Proxy({}, { get: (_, action) => async (previous, form) => {
        try { return await invokeAction(action, previous, [...form.entries()]); }
        finally { window.manualSettled++; }
      } });
      if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => load("react").createElement("a", props, children) };
      if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
      if (name.endsWith(".module.css")) return { __esModule: true, default: {} };
      if (!modules[name]) {
        if (!sources[name]) throw new Error(`Unexpected module ${name}`);
        const mod = { exports: {} }; modules[name] = mod;
        new Function("require", "module", "exports", "process", sources[name])(load, mod, mod.exports, { env: { NODE_ENV: "development" } });
      }
      return modules[name].exports;
    }
    load("react-dom/client").createRoot(document.getElementById("root")).render(route
      ? await load("studio").default({ searchParams: Promise.resolve(route) })
      : load("react").createElement(load("editor").LessonEditor, {
        ...persisted, initial: fixture, admin, action: load("@/app/learning/actions").createManualLesson,
      }));
  }, { sources, fixture: initial, admin, persisted, route });
  if (route && route.manual !== "1") await page.getByRole("button", { name: "Generate private lesson", exact: true }).waitFor();
  else await page.locator('input[data-editor-ready="true"]').waitFor({ state: "attached" });
  return page;
  }
  const page = await mount();
  await page.getByRole("button", { name: "Save lesson", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Lesson created." }).waitFor();
  await page.getByLabel("Title", { exact: true }).fill("Updated software requirements");
  await page.getByRole("button", { name: "Save lesson", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("fieldset").disabled);
  context.diagnostic(`Actual action writes: ${JSON.stringify(calls)}; rows=${rows.size}`);
  assert.equal(rows.size, 1, "second save must update the created lesson, not insert another");
  assert.deepEqual(calls.map(call => call.kind), ["insert", "update"]);
  assert.equal(calls[1].id, calls[0].id);
  assert.equal(calls[1].version, 1);
  assert.equal(rows.get(calls[0].id).version, 2);
  assert.equal(rows.get(calls[0].id).title, "Updated software requirements");

  await context.test("real blank route reveals incomplete quiz, then keyboard create and same-ID save at 320px/desktop", async () => {
    for (const width of [320, 1440]) {
      const page = await mount(undefined, false, undefined, { manual: "1" });
      await page.setViewportSize({ width, height: 900 });
      await page.getByLabel("Title", { exact: true }).fill(fixture.title);
      await page.locator('select[name="subject"]').selectOption(fixture.subject);
      await page.locator('select[name="curriculumTopic"]').selectOption(fixture.metadata.topic);
      await page.locator('select[name="audience"]').selectOption(fixture.metadata.audience);
      await page.locator('select[name="difficulty"]').selectOption(fixture.metadata.difficulty);
      await page.getByLabel("Learning outcomes", { exact: true }).fill(fixture.metadata.outcomes.join("\n"));
      await page.getByLabel("Summary", { exact: true }).fill(fixture.summary);
      for (let index = 0; index < 4; index++) {
        for (const field of ["title", "body", "example"]) await page.getByRole("group", { name: `Slide ${index + 1}`, exact: true }).getByLabel(field, { exact: true }).fill(fixture.slides[index][field]);
      }
      await page.getByLabel("Prompt", { exact: true }).fill(fixture.activity.prompt);
      await page.getByLabel("Steps in correct order, one per line", { exact: true }).fill(fixture.activity.steps.join("\n"));
      await page.getByRole("button", { name: "Save lesson", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector("details").open);
      assert.equal(await page.locator("details").first().getByLabel("Question", { exact: true }).evaluate(element => element === document.activeElement), true);
      assert.equal(await page.getByRole("alert").count(), 0, "native validation should identify incomplete quiz before a server round trip");
      await page.locator("details").first().getByLabel("Question", { exact: true }).evaluate(element => element.scrollIntoView({ block: "center" }));
      await page.screenshot({ path: join(screenshots, `blank-quiz-${width}.png`) });
      for (let index = 0; index < 10; index++) {
        const question = page.locator("form > fieldset > details").nth(index);
        await question.evaluate(element => { element.open = true; });
        await question.getByLabel("Question", { exact: true }).fill(fixture.questions[index].prompt);
        for (let option = 0; option < 4; option++) await question.getByLabel(`Option ${option + 1}`, { exact: true }).fill(fixture.questions[index].options[option]);
        await question.getByLabel("Explanation", { exact: true }).fill(fixture.questions[index].explanation);
      }
      const before = calls.length;
      aiAllowed = false; // Manual creation must not use the AI gate or provider.
      await page.getByRole("button", { name: "Save lesson", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("status").filter({ hasText: "Lesson created." }).waitFor();
      await page.getByLabel("Title", { exact: true }).fill("Blank route updated lesson");
      await page.getByRole("button", { name: "Save lesson", exact: true }).focus();
      await page.keyboard.press("Enter");
      await page.getByRole("status").filter({ hasText: "Lesson saved." }).waitFor();
      assert.deepEqual(calls.slice(before).map(call => call.kind), ["insert", "update"]);
      assert.equal(calls[before].id, calls[before + 1].id);
      assert.equal(rows.get(calls[before].id).version, 2);
      assert.deepEqual(rows.get(calls[before].id).content.metadata.prerequisites, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: join(screenshots, `blank-saved-${width}.png`) });
      aiAllowed = true;
      await page.close();
    }
  });
  await context.test("all families choose metadata, preview, create and update the confirmed ID", async () => {
    for (const [family, subject] of Object.entries(curriculum.FAMILIES)) {
      const page = await mount({ ...fixture, subject: "", metadata: undefined });
      await page.locator('select[name="subject"]').selectOption(subject);
      await page.locator('select[name="curriculumTopic"]').selectOption(family === "sdlc" ? "testing" : family);
      await page.locator('select[name="audience"]').selectOption("both");
      await page.locator('select[name="difficulty"]').selectOption("intermediate");
      await page.getByLabel("Learning outcomes", { exact: true }).fill("Evaluate a software example");
      await page.getByLabel("Prerequisites", { exact: true }).fill("Read the project brief");
      await page.getByRole("button", { name: "Preview lesson", exact: true }).click();
      const dialog = page.getByRole("dialog");
      assert.ok((await dialog.innerText()).includes(subject));
      assert.ok((await dialog.innerText()).includes("Intermediate"));
      assert.ok(!(await dialog.innerText()).includes("A is measurable."));
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.activeElement?.textContent === "Preview lesson");
      const before = calls.length;
      await page.getByRole("button", { name: "Save lesson", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Lesson created." }).waitFor();
      await page.getByLabel("Title", { exact: true }).fill(`Updated ${family} lesson`);
      await page.getByRole("button", { name: "Save lesson", exact: true }).click();
      await page.getByRole("status").filter({ hasText: "Lesson saved." }).waitFor();
      assert.deepEqual(calls.slice(before).map(call => call.kind), ["insert", "update"]);
      const row = rows.get(calls[before].id);
      assert.equal(row.subject, subject);
      assert.equal(row.content.subject, subject);
      assert.deepEqual(row.content.metadata.prerequisites, ["Read the project brief"]);
      assert.equal(row.content.metadata.audience, "both");
      assert.equal(row.version, 2);
      await page.close();
    }
  });
  async function generationPage(width = 320) {
    const page = await mount(undefined, false, undefined, {});
    await page.setViewportSize({ width, height: 900 });
    await page.locator('select[name="subject"]').selectOption(fixture.subject);
    await page.locator('select[name="curriculumTopic"]').selectOption(fixture.metadata.topic);
    await page.locator('select[name="audience"]').selectOption(fixture.metadata.audience);
    await page.locator('select[name="difficulty"]').selectOption(fixture.metadata.difficulty);
    await page.getByLabel("Learning outcomes", { exact: true }).fill("Write testable requirements\n\nCheck an example\n");
    await page.getByLabel("Learning objective", { exact: true }).fill("Describe testable software requirements");
    return page;
  }
  await context.test("actual AI form -> action -> generator -> client -> save, retained failure and keyboard recovery", async () => {
    realGeneration = true;
    try {
      for (const width of [320, 1440]) {
        const page = await generationPage(width);
        const before = calls.length, beforeQuota = quotaCalls.length;
        providerStatus = 429;
        await page.getByRole("button", { name: "Generate private lesson", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page.getByRole("alert").filter({ hasText: "quota is exhausted" }).waitFor();
        assert.equal(calls.length, before);
        assert.equal(await page.getByRole("status").count(), 0);
        assert.equal(await page.getByRole("alert").evaluate(element => element === document.activeElement), true);
        assert.equal(await page.getByLabel("Learning objective", { exact: true }).inputValue(), "Describe testable software requirements");
        assert.equal(await page.locator('select[name="subject"]').inputValue(), fixture.subject);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: join(screenshots, `ai-error-${width}.png`) });
        providerStatus = 200;
        await page.getByRole("button", { name: "Generate private lesson", exact: true }).focus();
        await page.keyboard.press("Enter");
        await page.getByRole("status").filter({ hasText: "Your private lesson is ready" }).waitFor();
        assert.equal(calls.length, before + 1);
        assert.equal(quotaCalls.length, beforeQuota + 2, "no hidden local quota retries");
        const saved = rows.get(calls.at(-1).id);
        assert.equal(saved.owner_id, user.id);
        assert.equal(saved.visibility, "private");
        assert.equal(await page.getByRole("link", { name: "Open lesson" }).getAttribute("href"), `/courses/${saved.id}`);
        assert.deepEqual(saved.content.metadata.outcomes, ["Write testable requirements", "Check an example"]);
        learning.lessonSchema.parse(saved.content);
        curriculum.validateCurriculumContent(saved.content);
        const request = JSON.parse(fetchCalls.at(-1).options.body);
        const input = JSON.parse(request.messages[1].content);
        assert.equal(input.topic, "Describe testable software requirements");
        assert.equal(input.metadata.topic, "requirements");
        assert.deepEqual(request.provider, { data_collection: "deny", zdr: true, require_parameters: true });
        assert.deepEqual(request.models, ["synthetic/model:free"]);
        assert.ok(!JSON.stringify(request).includes(user.id));
        await page.getByRole("link", { name: "Open lesson" }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(screenshots, `ai-saved-${width}.png`) });
        await page.close();
      }
    } finally { realGeneration = false; providerStatus = 200; }
  });
  await context.test("AI missing config/schema, provider unavailable and revoked grant never return success", async () => {
    realGeneration = true;
    const page = await generationPage();
    const entries = await page.locator("form").evaluate(form => [...new FormData(form).entries()]);
    const form = new FormData(); for (const [key, value] of entries) form.set(key, value);
    try {
      const before = calls.length, beforeFetch = fetchCalls.length, beforeQuota = quotaCalls.length;
      configured = false;
      assert.match((await mod.exports.createLesson({}, form)).error, /AI eligibility could not be checked/);
      const manualForm = new FormData(); manualForm.set("content", JSON.stringify(fixture));
      const manualMissingConfig = await mod.exports.createManualLesson({}, manualForm);
      assert.equal(manualMissingConfig.error, "Learning services are not configured.");
      assert.equal(manualMissingConfig.saveUncertain, undefined);
      configured = true; profileError = { code: "42703", message: "PRIVATE missing age" };
      assert.match((await mod.exports.createLesson({}, form)).error, /AI eligibility could not be checked/);
      profileError = null; quotaError = { code: "PGRST202", message: "PRIVATE missing RPC" };
      assert.equal((await mod.exports.createLesson({}, form)).error, "Generation is unavailable. Check the learning database migration.");
      quotaError = null; quotaAllowed = false;
      assert.match((await mod.exports.createLesson({}, form)).error, /five daily generation/);
      quotaAllowed = true;
      assert.equal(fetchCalls.length, beforeFetch);
      assert.equal(quotaCalls.length, beforeQuota + 2);
      providerConfigured = false;
      assert.equal((await mod.exports.createLesson({}, form)).error, "Lesson generation is not configured.");
      providerConfigured = true; providerStatus = 404;
      assert.match((await mod.exports.createLesson({}, form)).error, /No free AI endpoint currently meets/);
      providerStatus = 200; revokeAfterProvider = true;
      assert.equal((await mod.exports.createLesson({}, form)).error, "AI access denied");
      aiAllowed = true; revokeAfterProvider = false;
      assert.equal(calls.length, before);
      for (const code of ["42P01", "42703", "PGRST204", "PGRST205"]) {
        insertError = { code, message: "PRIVATE missing lesson storage" };
        for (const [action, input] of [["createLesson", form], ["createManualLesson", new FormData()]]) {
          if (action === "createManualLesson") input.set("content", JSON.stringify(fixture));
          const result = await mod.exports[action]({}, input);
          assert.equal(result.error, "Lesson storage is unavailable. Check the learning database migrations and schema cache, then try again. Nothing was saved.");
          assert.equal(result.saveUncertain, undefined);
          assert.equal(result.success, undefined);
        }
      }
      assert.equal(calls.length, before);
    } finally {
      realGeneration = false; configured = true; profileError = null; quotaError = null; quotaAllowed = true;
      providerConfigured = true; providerStatus = 200; revokeAfterProvider = false; aiAllowed = true; insertError = null;
      await page.close();
    }
  });
  for (const outcome of ["throw-after-commit", "returned-error-after-commit", "missing-data-after-commit", "malformed-data-after-commit", "transport-after-action"]) {
    await context.test(`AI ${outcome}: retain form, reconcile canonical ID and block repeat generation`, async () => {
      realGeneration = true;
      const page = await generationPage();
      const before = calls.length, beforeQuota = quotaCalls.length;
      insertOutcome = outcome; loseAcknowledgement = outcome === "transport-after-action";
      try {
        await page.getByRole("button", { name: "Generate private lesson", exact: true }).click();
        await page.getByRole("alert").filter({ hasText: "Save outcome is unknown" }).waitFor();
        assert.equal(await page.getByRole("status").count(), 0);
        assert.equal(await page.getByRole("link", { name: "Open lesson", exact: true }).count(), 0);
        assert.equal(await page.getByRole("button", { name: "Generate private lesson", exact: true }).isDisabled(), true);
        assert.equal(await page.getByLabel("Learning objective", { exact: true }).inputValue(), "Describe testable software requirements");
        const recovery = page.getByRole("link", { name: "Check my private lessons (new tab)", exact: true });
        assert.equal(await recovery.getAttribute("href"), "/catalog?visibility=private");
        assert.equal(await recovery.getAttribute("target"), "_blank");
        await page.locator("form").evaluate(form => form.requestSubmit());
        assert.equal(calls.length, before + 1);
        assert.equal(quotaCalls.length, beforeQuota + 1);
        assert.ok(!(await page.getByRole("alert").innerText()).includes("PRIVATE"));
        if (outcome === "missing-data-after-commit") {
          await recovery.scrollIntoViewIfNeeded();
          await page.screenshot({ path: join(screenshots, "ai-uncertain-320.png") });
          insertOutcome = null;
          const saved = rows.get(calls[before].id);
          const reconciled = await mount(saved.content, false, { id: saved.id, version: saved.version });
          await reconciled.getByLabel("Title", { exact: true }).fill("Reconciled generated lesson");
          await reconciled.getByRole("button", { name: "Save lesson", exact: true }).click();
          await reconciled.getByRole("status").filter({ hasText: "Lesson saved." }).waitFor();
          assert.deepEqual(calls.slice(before).map(call => call.kind), ["insert", "update"]);
          assert.equal(calls.at(-1).id, saved.id);
          assert.equal(rows.get(saved.id).version, 2);
          assert.equal(await page.getByRole("button", { name: "Generate private lesson", exact: true }).isDisabled(), true);
          await reconciled.close();
        }
      } finally { realGeneration = false; insertOutcome = null; loseAcknowledgement = false; await page.close(); }
    });
  }
  await context.test("failed save retains input, focuses error and allows explicit retry; stale version cannot overwrite", async () => {
    const page = await mount();
    failSave = true;
    await page.getByLabel("Title", { exact: true }).fill("Retain this unsaved title");
    await page.getByRole("button", { name: "Save lesson", exact: true }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.getByLabel("Title", { exact: true }).inputValue(), "Retain this unsaved title");
    assert.equal(await page.getByRole("alert").evaluate(element => element === document.activeElement), true);
    failSave = false;
    assert.equal(await page.locator("form").evaluate(form => form.checkValidity()), true);
    await page.getByRole("button", { name: "Save lesson", exact: true }).click();
    await page.getByRole("status").waitFor();
    const id = calls.at(-1).id;
    rows.get(id).version = 3;
    await page.getByLabel("Title", { exact: true }).fill("Stale title retained");
    await page.getByRole("button", { name: "Save lesson", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "changed in another session" }).waitFor();
    assert.equal(rows.get(id).title, "Retain this unsaved title");
    assert.equal(await page.getByLabel("Title", { exact: true }).inputValue(), "Stale title retained");
    await page.close();
  });
  await context.test("pending protection blocks same-tick duplicate submit; uncertain acknowledgement never replays", async () => {
    let release;
    gate = new Promise(resolve => { release = resolve; });
    const page = await mount();
    const before = calls.length;
    await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await page.getByRole("button", { name: "Working..." }).waitFor();
    assert.equal(await page.getByLabel("Title", { exact: true }).isDisabled(), true);
    release(); gate = null;
    await page.getByRole("status").waitFor();
    assert.equal(calls.length, before + 1);
    await page.close();
    const uncertain = await mount();
    loseAcknowledgement = true;
    const count = calls.length;
    await uncertain.getByRole("button", { name: "Save lesson", exact: true }).click();
    await uncertain.getByRole("alert").filter({ hasText: "Save outcome is unknown" }).waitFor();
    assert.equal(await uncertain.getByRole("button", { name: "Save lesson", exact: true }).isDisabled(), true);
    await uncertain.locator("form").evaluate(form => form.requestSubmit());
    assert.equal(calls.length, count + 1);
    assert.equal(await uncertain.getByLabel("Title", { exact: true }).inputValue(), fixture.title);
    assert.equal(await uncertain.getByRole("status").count(), 0);
    assert.equal(await uncertain.getByRole("link", { name: "Check my private lessons (new tab)", exact: true }).getAttribute("href"), "/catalog?visibility=private");
    assert.ok(!(await uncertain.getByRole("alert").innerText()).includes("Synthetic lost acknowledgement"));
    loseAcknowledgement = false;
    await uncertain.close();
  });
  for (const outcome of ["throw-after-commit", "returned-error-after-commit", "missing-data-after-commit", "malformed-data-after-commit"]) {
    await context.test(`QA-MANUAL-01: ${outcome} retains draft and blocks a second create`, async () => {
      const page = await mount();
      const before = calls.length, beforeRows = rows.size;
      insertOutcome = outcome;
      try {
        await page.getByLabel("Title", { exact: true }).fill("Retained acknowledgement-uncertain draft");
        await page.getByRole("button", { name: "Save lesson", exact: true }).click();
        await page.waitForFunction(() => window.manualSettled === 1);
        await page.getByRole("alert").waitFor();
        const enabledRetry = await page.getByRole("button", { name: "Save lesson", exact: true }).isEnabled();
        // Before repair this is a real, explicit UI retry, not two direct action calls.
        if (enabledRetry) {
          await page.getByRole("button", { name: "Save lesson", exact: true }).click();
          await page.waitForFunction(() => window.manualSettled === 2);
        }
        context.diagnostic(`${outcome}: retry enabled=${enabledRetry}, inserts=${calls.length - before}, rows=${rows.size - beforeRows}`);
        assert.equal(rows.size - beforeRows, 1, "ambiguous acknowledgement must not permit another creation");
        assert.equal(enabledRetry, false, "ambiguous creation must remain blocked pending reconciliation");
        assert.equal(await page.locator('input[name="lessonId"]').inputValue(), "");
        assert.equal(await page.getByLabel("Title", { exact: true }).inputValue(), "Retained acknowledgement-uncertain draft");
        assert.equal(await page.getByRole("status").count(), 0);
        assert.ok(!(await page.getByRole("alert").innerText()).includes("PRIVATE_DB_ACK"));
        const recovery = page.getByRole("link", { name: "Check my private lessons (new tab)", exact: true });
        assert.equal(await recovery.getAttribute("href"), "/catalog?visibility=private");
        assert.equal(await recovery.getAttribute("target"), "_blank");
        assert.equal(await page.getByRole("alert").evaluate(element => element === document.activeElement), true);
        await page.evaluate(() => {
          window.confirmations = [];
          window.confirm = message => { window.confirmations.push(message); return false; };
        });
        // Exercise the recovery link's real document-level leave guard without navigating.
        await recovery.evaluate(link => {
          link.addEventListener("click", event => event.preventDefault(), { once: true });
          link.click();
        });
        assert.deepEqual(await page.evaluate(() => window.confirmations), [], "opening recovery in a new tab must not claim unsaved content or discard the draft");
        await page.evaluate(() => {
          const link = document.createElement("a");
          link.href = "/catalog";
          document.body.append(link);
          link.addEventListener("click", event => event.preventDefault());
          link.click();
          link.remove();
        });
        const [leaveNotice] = await page.evaluate(() => window.confirmations);
        assert.match(leaveNotice, /save outcome is unknown/i);
        assert.ok(!leaveNotice.includes("unsaved lesson changes"));
        await page.locator("form").evaluate(form => form.requestSubmit());
        assert.equal(calls.length - before, 1);
        if (outcome === "throw-after-commit") {
          await recovery.scrollIntoViewIfNeeded();
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
          await page.screenshot({ path: join(screenshots, "uncertain-create-mobile.png") });
          await page.setViewportSize({ width: 1280, height: 900 });
          await recovery.scrollIntoViewIfNeeded();
          await page.screenshot({ path: join(screenshots, "uncertain-create-desktop.png") });
          // Explicit reconciliation opens the canonical saved representation in a fresh editor;
          // the unknown editor itself is never unlocked, replayed, or assigned a guessed ID.
          const saved = await server.accessibleLesson(calls[before].id, user);
          insertOutcome = null;
          const reconciled = await mount(saved.content, false, { id: saved.id, version: saved.version });
          await reconciled.getByLabel("Title", { exact: true }).fill("Reconciled saved draft");
          await reconciled.getByRole("button", { name: "Save lesson", exact: true }).click();
          await reconciled.getByRole("status").filter({ hasText: "Lesson saved." }).waitFor();
          assert.equal(rows.size - beforeRows, 1);
          assert.deepEqual(calls.slice(before).map(call => call.kind), ["insert", "update"]);
          assert.equal(calls.at(-1).id, saved.id);
          assert.equal(rows.get(saved.id).version, 2);
          assert.equal(await page.getByRole("button", { name: "Save lesson", exact: true }).isDisabled(), true);
          await reconciled.close();
        }
      } finally {
        insertOutcome = null;
        await page.close();
      }
    });
  }
  const formFor = (content = fixture, extra = {}) => {
    const form = new FormData(); form.set("content", JSON.stringify(content));
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
    return form;
  };
  await context.test("actual create/update actions reject forged metadata, anonymous, foreign ownership and publishing", async () => {
    const before = calls.length;
    for (const content of [{ ...fixture, metadata: undefined }, { ...fixture, subject: "Biology" },
      { ...fixture, metadata: { ...fixture.metadata, topic: "coding-agents" } }, { ...fixture, metadata: { ...fixture.metadata, outcomes: [] } }]) {
      assert.ok((await mod.exports.createManualLesson({}, formFor(content))).error);
    }
    signedIn = false;
    assert.ok((await mod.exports.createManualLesson({}, formFor())).error);
    signedIn = true;
    assert.ok((await mod.exports.createManualLesson({}, formFor(fixture, { publish: "on" }))).error);
    const row = rows.get(calls[0].id);
    row.owner_id = "foreign-owner";
    assert.ok((await mod.exports.updateLesson({}, formFor(fixture, { lessonId: row.id, version: row.version }))).error);
    row.visibility = "public"; user.app_metadata.role = "instructor";
    assert.ok((await mod.exports.updateLesson({}, formFor(fixture, { lessonId: row.id, version: row.version }))).error);
    assert.equal(calls.length, before);
    user.app_metadata.role = "admin"; row.visibility = "private";
    assert.ok((await mod.exports.updateLesson({}, formFor(fixture, { lessonId: row.id, version: row.version }))).error);
    row.review_requested = true;
    assert.ok((await mod.exports.updateLesson({}, formFor(fixture, { lessonId: row.id, version: row.version, publish: "on" }))).success);
    delete user.app_metadata.role;
  });
  await context.test("actual generation/coach actions resolve each family and deny private access, unsupported scope or revoked AI", async () => {
    for (const [family, subject] of Object.entries(curriculum.FAMILIES)) {
      const form = formFor();
      const topic = family === "sdlc" ? "testing" : family;
      for (const [key, value] of Object.entries({ subject, curriculumTopic: topic, audience: "learners", difficulty: "foundation", outcomes: "Apply a software skill", prerequisites: "", topic: "Synthetic objective" })) form.set(key, value);
      const result = await mod.exports.createLesson({}, form);
      assert.ok(result.success);
      assert.ok((await mod.exports.askCoach(result.lessonId, [{ role: "user", content: "Explain the example" }])).reply);
      assert.equal(providerCalls.at(-1)[0].subject, subject);
      assert.equal(providerCalls.at(-1)[0].topic, topic);
      assert.equal("questions" in providerCalls.at(-1)[0], false);
      aiAllowed = false;
      const before = providerCalls.length;
      assert.ok((await mod.exports.createLesson({}, form)).error);
      assert.ok((await mod.exports.askCoach(result.lessonId, [{ role: "user", content: "Explain" }])).error);
      assert.equal(providerCalls.length, before);
      aiAllowed = true;
      rows.get(result.lessonId).owner_id = "foreign-owner";
      assert.ok((await mod.exports.askCoach(result.lessonId, [{ role: "user", content: "Explain" }])).error);
      rows.get(result.lessonId).owner_id = user.id;
      rows.get(result.lessonId).subject = "Biology";
      assert.ok((await mod.exports.askCoach(result.lessonId, [{ role: "user", content: "Explain" }])).error);
      assert.equal(providerCalls.length, before);
    }
  });
  assert.deepEqual(requests, []);
  assert.deepEqual(unexpectedFetches, [], "Node-side provider requests must use synthetic fetch only");
  assert.deepEqual(browserErrors, [], "handled failures must not crash the mounted form");
});
