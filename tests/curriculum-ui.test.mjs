import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";
import ts from "typescript";

// Offline mounts of the real async route functions and client components. No app server,
// environment files, database, provider, mail, or image requests are permitted.
const require = createRequire(import.meta.url);
const sources = Object.fromEntries([
  ["react", "react", "react.development.js"], ["react/jsx-runtime", "react", "react-jsx-runtime.development.js"],
  ["react-dom", "react-dom", "react-dom.development.js"], ["react-dom/client", "react-dom", "react-dom-client.development.js"],
  ["scheduler", "scheduler", "scheduler.development.js"],
].map(([name, pkg, file]) => [name, readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "cjs", file), "utf8")]));
function add(name, file) {
  sources[name] = ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
}
for (const name of ["learning", "curriculum", "recommendations", "resume"]) add(`@/lib/${name}`, `lib/${name}.ts`);
for (const name of ["learning-controls", "lesson-metadata", "lesson-preview", "catalog-search", "learning-path"]) {
  add(`@/components/${name}`, `components/${name}.tsx`);
  sources[`./${name}`] = sources[`@/components/${name}`];
}
for (const [name, file] of Object.entries({ catalog: "catalog/page.tsx", overview: "courses/[slug]/page.tsx", player: "courses/[slug]/lessons/[lesson]/page.tsx", paths: "paths/page.tsx", studio: "studio/page.tsx", teaching: "teaching/page.tsx" })) add(name, `app/${file}`);
function bundleCjs(path) {
  if (sources[path]) return path;
  sources[path] = "loading";
  const localRequire = createRequire(path);
  sources[path] = readFileSync(path, "utf8").replace(/require\(["']([^"']+)["']\)/g, (_, name) => `require(${JSON.stringify(bundleCjs(localRequire.resolve(name)))})`);
  return path;
}
sources.zod = `module.exports = require(${JSON.stringify(bundleCjs(require.resolve("zod")))});`;
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8").replace('@import "tailwindcss";', "") +
  readFileSync(new URL("../src/components/lesson-metadata.module.css", import.meta.url), "utf8");

test("real curriculum routes and components: combined filters, legacy, player, paths and mobile keyboard", async context => {
  const browser = await chromium.launch();
  const browserContext = await browser.newContext({ offline: true, serviceWorkers: "block", viewport: { width: 390, height: 844 } });
  context.after(async () => { await browserContext.close(); await browser.close(); });
  const requests = [], errors = [];
  await browserContext.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  const page = await browserContext.newPage();
  page.setDefaultTimeout(5000);
  page.on("pageerror", error => errors.push(error.message));
  const screenshots = await mkdtemp(join(tmpdir(), "forge-tracker08-"));
  context.diagnostic(`Captured synthetic screenshots (not visual approval): ${screenshots}; Chromium ${browser.version()}`);
  await page.setContent(`<style>${css}</style><div id="root"></div>`);
  await page.evaluate(async sources => {
    const modules = {};
    let renderRoute, rows, currentRoute = 0;
    const user = { id: "synthetic-owner", app_metadata: { role: "instructor" } };
    const server = {
      requireUser: async () => user, displayName: async () => "Synthetic instructor",
      isAdmin: () => false, isInstructor: () => true, canPublishLessons: () => true,
      canEditLesson: (_, row) => row.owner_id === user.id, canManageEnrollment: () => true,
      visibleLessons: async () => rows.map(({ content, ...row }) => ({ ...row, metadata: content.metadata })),
      accessibleLesson: async id => structuredClone(rows.find(row => row.id === id)),
      userRecords: async () => ({ enrollments: [], bookmarks: [], attempts: [] }),
      database: () => ({ from(table) {
        const query = { select() { return query; }, eq() { return query; }, gte() { return query; }, order() { return query; }, or() { return query; },
          range: async () => ({ data: [], error: null }),
          maybeSingle: async () => ({ data: table === "profiles" ? { display_name: "Synthetic", learning_level: "intermediate" } : table === "forge_enrollments" ? { lesson_id: "enrolled" } : null, error: null }) };
        return query;
      } }),
    };
    const actions = new Proxy({}, { get: (_, name) => async () => {
      if (name === "saveResume") return { revision: 1 };
      if (name === "attend") return { success: "Attendance recorded." };
      return { error: "Synthetic unavailable service. Input is retained." };
    } });
    function load(name) {
      if (name.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
      if (name === "@/lib/learning-server") return server;
      if (name === "@/lib/ai-eligibility-server") return { requireAiAccess: async () => {} };
      if (name === "@/components/learner-shell") return { LearnerShell: ({ children }) => load("react").createElement("main", {}, children) };
      if (name === "@/components/learner-import" || name === "@/components/lesson-coach") return new Proxy({}, { get: () => () => null });
      if (name.endsWith("/actions") || name === "./actions") return actions;
      if (name === "next/navigation") return { notFound() { throw new Error("Not found"); }, redirect(path) { throw new Error(`Redirect ${path}`); } };
      if (name === "next/image") return { __esModule: true, default: () => null };
      if (name === "next/link") return { __esModule: true, default: ({ children, href, ...props }) => load("react").createElement("a", { ...props, href, onClick(event) { event.preventDefault(); if (href === "/catalog") void renderRoute("catalog"); } }, children) };
      if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
      if (!modules[name]) {
        if (!sources[name]) throw new Error(`Unexpected offline dependency ${name}`);
        const mod = { exports: {} }; modules[name] = mod;
        new Function("require", "module", "exports", "process", sources[name])(load, mod, mod.exports, { env: { NODE_ENV: "development" } });
      }
      return modules[name].exports;
    }
    const { FAMILIES } = load("@/lib/curriculum");
    rows = Object.entries(FAMILIES).map(([family, subject], index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, owner_id: user.id,
      title: `Synthetic ${family} lesson`, subject, summary: "Practice a useful software-development skill", visibility: index === 1 ? "private" : "public", version: 1,
      content: { title: `Synthetic ${family} lesson`, subject, summary: "Practice a useful software-development skill",
        metadata: { version: 1, audience: "both", difficulty: "intermediate", topic: family === "sdlc" ? "testing" : family, outcomes: [`Apply ${family} concepts`], prerequisites: [] },
        slides: Array(4).fill({ title: "Synthetic slide", body: "Explain the software example.", example: "Review a proposed change." }),
        activity: { prompt: "Order the work", steps: ["Plan", "Act", "Review"] },
        questions: Array(10).fill({ prompt: "Which option fits?", options: ["A", "B", "C", "D"], correct: 2, explanation: "SECRET_ANSWER_KEY" }),
      },
    }));
    rows.push({ ...structuredClone(rows[0]), id: "00000000-0000-4000-8000-000000000004", title: "Legacy lesson", subject: "SDLC" });
    delete rows[3].content.metadata;
    const root = load("react-dom/client").createRoot(document.getElementById("root"));
    const React = load("react");
    renderRoute = async (name, filters = {}, index = 0) => {
      const element = await load(name).default({ searchParams: Promise.resolve(filters), params: Promise.resolve({ slug: rows[index].id, lesson: "1" }) });
      if (name === "player") {
        const collect = node => {
          if (!node || typeof node !== "object") return;
          if (node.type === load("@/components/learning-controls").LessonPlayer) window.lastPlayerProps = structuredClone(node.props);
          React.Children.forEach(node.props?.children, collect);
        };
        collect(element);
      }
      // Resolving an async route does not mean React has committed root.render().
      // Complete the offline render before callers assert against the next page.
      load("react-dom").flushSync(() => root.render(React.createElement(React.Fragment, { key: ++currentRoute }, element)));
    };
    document.addEventListener("submit", event => {
      const form = event.target;
      if (form.getAttribute("action") === "/catalog") {
        event.preventDefault();
        void renderRoute("catalog", Object.fromEntries(new FormData(form)));
      }
    });
    window.curriculumUi = { renderRoute, rows, load, root, async pathWithCompleted() {
      load("react-dom").flushSync(() => root.render(React.createElement(load("@/components/learning-path").LearningPath, {
        catalog: rows.map(row => ({ ...row, metadata: row.content.metadata })), completedIds: [rows[0].id],
        initialPreferences: load("@/lib/recommendations").derivePreferences({ level: "intermediate" }), aiAvailable: false,
      })));
    } };
    await renderRoute("catalog");
  }, sources);
  const cards = page.locator(".catalog-card");
  await cards.nth(3).waitFor();
  assert.equal(await cards.count(), 4);
  assert.ok((await cards.nth(3).innerText()).includes("Not specified"));
  assert.ok(!(await cards.nth(3).innerText()).includes("None specified by author"));
  await page.keyboard.press("/");
  assert.equal(await page.locator('input[name="q"]').evaluate(element => document.activeElement === element), true);
  await page.locator('input[name="q"]').fill("Synthetic");
  await page.locator('select[name="subject"]').selectOption("AI Coding-Agent Skills");
  await page.locator('select[name="audience"]').selectOption("instructors");
  await page.locator('select[name="difficulty"]').selectOption("intermediate");
  await page.locator('select[name="visibility"]').selectOption("private");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll(".catalog-card").length === 1);
  assert.ok((await cards.innerText()).includes("coding-agents"));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(screenshots, "catalog-mobile-filtered.png"), fullPage: true });
  await page.locator('select[name="difficulty"]').selectOption("advanced");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("heading", { name: "No matching lessons." }).waitFor();
  await page.getByRole("link", { name: "Clear all filters", exact: true }).click();
  await cards.nth(3).waitFor();
  for (let index = 0; index < 3; index++) {
    await page.evaluate(index => curriculumUi.renderRoute("overview", {}, index), index);
    await page.locator(".course-banner").waitFor();
    assert.equal(await cards.count(), 0);
    await page.getByRole("heading", { name: "Learning information" }).waitFor();
    assert.ok((await page.locator("main").innerText()).includes("Intermediate"));
    assert.ok(!(await page.locator("main").innerText()).includes("SECRET_ANSWER_KEY"));
    await page.evaluate(index => curriculumUi.renderRoute("player", {}, index), index);
    await page.getByRole("button", { name: "Next", exact: true }).waitFor();
    const props = await page.evaluate(() => lastPlayerProps);
    assert.equal(props.content.metadata.version, 1);
    for (const question of props.content.questions) assert.deepEqual(Object.keys(question).sort(), ["options", "prompt"]);
    assert.ok(!JSON.stringify(props).includes("SECRET_ANSWER_KEY"));
  }
  await page.evaluate(() => curriculumUi.renderRoute("paths"));
  await page.getByRole("heading", { name: "Local recommendations" }).waitFor();
  assert.ok((await page.locator("main").innerText()).includes("coding-agents"));
  assert.ok((await page.locator("main").innerText()).includes("soft-product"));
  await page.evaluate(() => curriculumUi.pathWithCompleted());
  await page.getByText("administrator-approved AI access", { exact: false }).waitFor();
  assert.equal(await page.locator('a[href="/courses/00000000-0000-4000-8000-000000000001"]').count(), 0);
  assert.equal(await page.getByRole("button", { name: "Generate AI path" }).isDisabled(), true);
  for (const route of ["studio", "teaching"]) {
    await page.evaluate(route => curriculumUi.renderRoute(route), route);
    await page.locator('select[name="subject"]').waitFor();
    assert.equal(await page.locator('select[name="subject"] option').count(), 4);
    assert.equal(await page.locator('select[name="difficulty"]').inputValue(), "");
    await page.locator('select[name="subject"]').selectOption("AI Coding-Agent Skills");
    await page.locator('select[name="curriculumTopic"]').selectOption("coding-agents");
    await page.locator('select[name="audience"]').selectOption("learners");
    await page.locator('select[name="difficulty"]').selectOption("foundation");
    await page.locator('textarea[name="outcomes"]').fill("Evaluate a proposed change");
    await page.locator('textarea[name="topic"]').fill("Explain a synthetic software change");
    if (route === "teaching") {
      await page.locator('input[name="material"]').setInputFiles({ name: "synthetic.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF synthetic offline boundary") });
      await page.locator('input[name="consent"]').check();
    }
    await page.getByRole("button", { name: route === "studio" ? "Generate private lesson" : "Generate editable draft" }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(await page.locator('select[name="subject"]').inputValue(), "AI Coding-Agent Skills");
    assert.equal(await page.locator('textarea[name="topic"]').inputValue(), "Explain a synthetic software change");
    assert.equal(await page.getByRole("alert").evaluate(element => element === document.activeElement), true);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => curriculumUi.renderRoute("catalog"));
  await cards.nth(3).waitFor();
  await page.screenshot({ path: join(screenshots, "catalog-desktop.png"), fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(requests, []);
});
