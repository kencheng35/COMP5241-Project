import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import ts from "typescript";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as icons from "lucide-react";
import { chromium } from "@playwright/test";
import { z } from "zod";
import * as learning from "../src/lib/learning.ts";
import * as permissions from "../src/lib/permissions.ts";

const source = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const transpile = file => ts.transpileModule(source(file), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
function load(file, dependencies) {
  const mod = { exports: {} };
  new Function("require", "module", "exports", "process", transpile(file))(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected offline dependency: ${name}`);
    return dependencies[name];
  }, mod, mod.exports, { env: { NEXT_PUBLIC_SUPABASE_URL: "https://offline.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic" } });
  return mod.exports;
}
const stamp = "2026-10-22T00:00:00Z";
const questions = Array.from({ length: 10 }, (_, i) => ({
  prompt: `Saved public question ${i + 1}`, options: ["First", "Second", "Third", "Fourth"], correct: 0, explanation: "Synthetic explanation.",
}));
const attempt = (id, user_id, lesson_id = "owned", lesson_version = 2, score = 6) => ({
  id, user_id, lesson_id, original_lesson_id: lesson_id, lesson_version, score,
  certificate_kind: "public", lesson_title: "Saved snapshot title", completed_at: stamp, questions, answers: Array(10).fill(1),
});
const enrollment = (user_id, progress_evidence = {}, extra = {}) => ({
  user_id, lesson_id: "owned", enrollment_kind: "public", attended_at: null, progress_evidence, ...extra,
});

function harness() {
  const state = {
    user: { id: "teacher", app_metadata: { role: "instructor" }, user_metadata: {} }, authError: null,
    dbCalls: 0, reads: [], fail: null, corrupt: null, configFailure: false,
    tables: {
      forge_lessons: [
        { id: "owned", owner_id: "teacher", title: "Owned published title", version: 2, visibility: "public" },
        { id: "other", owner_id: "elsewhere", title: "Other published title", version: 1, visibility: "public" },
        { id: "private", owner_id: "teacher", title: "PRIVATE DRAFT SENTINEL", version: 1, visibility: "private", review_requested: true },
      ],
      forge_reviewers: [{ user_id: "reviewer", lesson_id: "other" }, { user_id: "reviewer", lesson_id: "private" }],
      forge_enrollments: [enrollment("review-only", { 2: { reviewed_at: stamp } }),
        enrollment("attended", { 2: { attended_at: stamp } }), enrollment("failed"),
        enrollment("passed-no-ack", {}, { attended_at: stamp }), enrollment("old-pass", { 1: { reviewed_at: stamp, attended_at: stamp } }),
        enrollment("private-result"), enrollment("PRIVATE ROSTER SENTINEL", {}, { enrollment_kind: "private" })],
      forge_attempts: [attempt("fail", "failed", "owned", 2, 5), attempt("pass", "passed-no-ack"),
        attempt("retry", "passed-no-ack", "owned", 2, 10), attempt("old", "old-pass", "owned", 1, 10),
        attempt("removed", "REMOVED LEARNER"), { ...attempt("secret", "private-result"), certificate_kind: "private", lesson_title: "PRIVATE ATTEMPT SENTINEL" },
        attempt("other-attempt", "other-student", "other", 1), attempt("private-attempt", "private-student", "private", 1)],
    },
  };
  const client = { from(table) {
    assert.ok(table === "profiles" || Object.hasOwn(state.tables, table), `Forbidden table: ${table}`);
    const filters = [], orders = [];
    let columns, start = 0, end = 499, single = false;
    const query = {
      select(value) { columns = value; return query; },
      eq(key, value) { filters.push([key, value]); return query; },
      in(key, value) { filters.push([key, value]); return query; },
      order(key, options) { orders.push([key, options?.ascending !== false]); return query; },
      range(a, b) { start = a; end = b; return query; },
      maybeSingle() { single = true; return query; },
      async then(resolve, reject) {
        try {
          const read = { table, columns, filters, orders, start, end };
          state.reads.push(read);
          if (table === "profiles") {
            assert.deepEqual(filters, [["id", state.user.id]], "No profile directory");
            return resolve({ data: { display_name: "Synthetic teacher" }, error: null });
          }
          if (state.fail?.(read)) return resolve({ data: null, error: { message: "SENSITIVE TRANSPORT SENTINEL" } });
          let rows = structuredClone(state.tables[table]).filter(row => filters.every(([key, value]) =>
            Array.isArray(value) ? value.includes(row[key]) : row[key] === value));
          rows.sort((a, b) => {
            for (const [key, ascending] of orders) {
              const order = String(a[key]).localeCompare(String(b[key]));
              if (order) return ascending ? order : -order;
            }
            return 0;
          });
          rows = rows.slice(start, end + 1);
          if (columns !== "*") rows = rows.map(row => Object.fromEntries(columns.split(",").map(key => [key, row[key]])));
          if (state.corrupt) rows = state.corrupt(read, rows);
          resolve({ data: single ? rows[0] ?? null : rows, error: null });
        } catch (error) { reject(error); }
      },
    };
    return query;
  } };
  const navigation = { redirect(path) { throw new Error(`Redirect ${path}`); } };
  const auth = { createClient: async () => {
    if (state.configFailure) throw new Error("Learning service configuration is unavailable.");
    return { auth: { getUser: async () => ({ data: { user: state.user }, error: state.authError }) } };
  } };
  const server = load("src/lib/learning-server.ts", {
    "server-only": {}, "@supabase/supabase-js": { createClient() { state.dbCalls++; return client; } },
    "next/navigation": navigation, "@/lib/supabase/server": auth, "@/lib/learning": learning, "@/lib/permissions": permissions, zod: { z },
  });
  const shell = load("src/components/learner-shell.tsx", {
    react: React, "react/jsx-runtime": jsx, "lucide-react": icons,
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
    "@/app/auth/actions": { logOut() { throw new Error("No writes"); } },
  });
  const dependencies = {
    "react/jsx-runtime": jsx, "@/components/learner-shell": shell, "@/lib/learning-server": server,
    "@/lib/learning": learning, "@/lib/supabase/server": auth, "next/navigation": navigation,
  };
  // Resolve the actual leaf only when the route starts consuming it.
  const routeSource = source("src/app/reports/page.tsx");
  if (routeSource.includes("@/lib/reporting")) dependencies["@/lib/reporting"] = load("src/lib/reporting.ts", {
    zod: { z }, "@/lib/learning": learning,
  });
  const route = load("src/app/reports/page.tsx", dependencies).default;
  return { state, route, server, html: async () => renderToStaticMarkup(await route()) };
}

test("fresh failed auth, including user plus error, never creates a service database", async () => {
  for (const [user, error] of [[null, null], [null, {}], [{ id: "teacher", app_metadata: { role: "admin" } }, {}]]) {
    const h = harness(); h.state.user = user; h.state.authError = error;
    await assert.rejects(h.server.currentUser(), /Please log in again/);
    await assert.rejects(h.route(), /Redirect \/login/);
    assert.equal(h.state.dbCalls, 0);
  }
  const h = harness(); h.state.configFailure = true;
  await assert.rejects(h.route(), /Learning service configuration is unavailable/);
  assert.equal(h.state.dbCalls, 0);
});

test("actual reports SSR separates current version roster from saved all-version history", async () => {
  const h = harness(), html = await h.html();
  assert.match(html, /Current lesson version 2/);
  assert.match(html, /CURRENT PUBLIC ENROLLMENT ROSTER/);
  assert.match(html, /6 learners · 1 reviewed · 1 attended · 1 passed/);
  assert.match(html, /Public attempt history \(all versions\)/);
  assert.match(html, /Version 1/);
  assert.match(html, /REMOVED LEARNER/);
  assert.doesNotMatch(html, /PRIVATE (DRAFT|ROSTER|ATTEMPT) SENTINEL|private-student|Other published title/);
  const node = await h.route();
  const content = renderToStaticMarkup(node.props.children);
  const roster = content.slice(content.indexOf('<ul class="report-roster">'), content.indexOf("</ul>") + 5);
  const passRow = roster.slice(roster.indexOf("<h4>passed-no-ack"), roster.indexOf("<h4>private-result"));
  assert.match(passRow, /Public saved pass/);
  assert.match(passRow, /No review record/);
  assert.match(passRow, /No quiz-reached record/);
  assert.doesNotMatch(roster, /REMOVED LEARNER/);
  assert.match(content, /Saved snapshot title/);
  assert.match(content, /Selected: Second/);
  assert.match(content, /Correct: First/);
  assert.match(content, /5 saved public attempts/);
  assert.match(content, /not a funnel or proof of comprehension/);
  assert.match(content, /Review is optional/);
});

test("actual trusted permissions enforce instructor ownership, admin published scope and explicit reviewer grants", async () => {
  const h = harness();
  assert.match(await h.html(), /Owned published title/);
  const lessonRead = h.state.reads.find(row => row.table === "forge_lessons");
  assert.deepEqual(lessonRead.filters, [["visibility", "public"], ["owner_id", "teacher"]]);
  h.state.user = { id: "admin", app_metadata: { role: "admin" }, user_metadata: {} };
  let html = await h.html();
  assert.match(html, /Owned published title/); assert.match(html, /Other published title/);
  assert.doesNotMatch(html, /PRIVATE DRAFT SENTINEL|private-student/);
  h.state.user = { id: "reviewer", app_metadata: {}, user_metadata: { role: "admin" } };
  html = await h.html();
  assert.match(html, /Other published title/);
  assert.doesNotMatch(html, /Owned published title|PRIVATE DRAFT SENTINEL|passed-no-ack/);
  h.state.user = { id: "teacher", app_metadata: {}, user_metadata: { role: "instructor" } };
  html = renderToStaticMarkup(await h.route({ searchParams: Promise.resolve({ owner_id: "teacher", role: "admin" }) }));
  assert.match(html, /No published lessons have been granted/);
  assert.doesNotMatch(html, /Owned published title|Other published title|Saved public question/);
  assert.ok(h.state.reads.every(row => ["profiles", "forge_lessons", "forge_reviewers", "forge_enrollments", "forge_attempts"].includes(row.table)));
  for (const row of h.state.reads.filter(row => ["forge_attempts", "forge_enrollments"].includes(row.table))) {
    assert.ok(row.filters.some(([key, value]) => key === (row.table === "forge_attempts" ? "certificate_kind" : "enrollment_kind") && value === "public"));
    assert.ok(row.filters.some(([key, value]) => key === "lesson_id" && Array.isArray(value) && !value.includes("private")));
  }
  assert.ok(h.state.reads.filter(row => row.table === "forge_lessons").every(row => row.columns === "id,title,version"));
});

test("next-request role/grant revocation and unpublishing remove report content without cross-user caching", async () => {
  const h = harness();
  assert.match(await h.html(), /Owned published title/);
  h.state.user.app_metadata = {};
  assert.doesNotMatch(await h.html(), /Owned published title|Saved public question/);
  h.state.user = { id: "reviewer", app_metadata: {} };
  assert.match(await h.html(), /Other published title/);
  h.state.tables.forge_reviewers = [];
  assert.doesNotMatch(await h.html(), /Other published title|other-student/);
  h.state.user = { id: "admin", app_metadata: { role: "admin" } };
  h.state.tables.forge_lessons.forEach(row => { row.visibility = "private"; });
  assert.doesNotMatch(await h.html(), /Owned published title|Other published title|Saved public question/);
});

function populate(h, table, count = 1051) {
  const rows = {
    forge_reviewers: index => ({ user_id: h.state.user.id, lesson_id: `grant-${String(index).padStart(4, "0")}` }),
    forge_lessons: index => ({ id: `lesson-${String(index).padStart(4, "0")}`, title: `Published ${index}`, owner_id: "teacher", visibility: "public", version: 2 }),
    forge_enrollments: index => enrollment(`learner-${String(index).padStart(4, "0")}`, { 2: { reviewed_at: stamp } }),
    forge_attempts: index => attempt(`attempt-${String(index).padStart(4, "0")}`, "passed-no-ack"),
  };
  h.state.tables[table] = Array.from({ length: count }, (_, index) => rows[table](index));
  if (table === "forge_lessons") h.state.tables[table][0] = { id: "owned", title: "Owned published title", owner_id: "teacher", visibility: "public", version: 2 };
}

test("every report query paginates beyond 1000 with stable ordering and complete history/roster", async () => {
  const h = harness();
  h.state.user = { id: "admin", app_metadata: { role: "admin" } };
  for (const table of Object.keys(h.state.tables)) populate(h, table);
  const html = await h.html();
  assert.match(html, /1051 learners · 1051 reviewed · 0 attended · 0 passed/);
  assert.match(html, /1051 saved public attempts/);
  assert.match(html, /Published 1050/);
  assert.match(html, /learner-1050/);
  for (const [table, orders] of [
    ["forge_reviewers", [["lesson_id", true]]], ["forge_lessons", [["id", true]]],
    ["forge_enrollments", [["lesson_id", true], ["user_id", true]]],
    ["forge_attempts", [["completed_at", false], ["id", true]]],
  ]) {
    const reads = h.state.reads.filter(row => row.table === table);
    assert.deepEqual(reads.map(row => [row.start, row.end]), [[0, 499], [500, 999], [1000, 1499]]);
    assert.ok(reads.every(row => JSON.stringify(row.orders) === JSON.stringify(orders)));
  }
});

test("any first/later query failure rejects the entire report, not partial counts, no-grants or raw errors", async () => {
  for (const table of ["forge_reviewers", "forge_lessons", "forge_attempts", "forge_enrollments"]) {
    for (const offset of [0, 500, 1000]) {
      const h = harness(); populate(h, table);
      h.state.fail = read => read.table === table && read.start === offset;
      await assert.rejects(h.html(), error => {
        assert.match(error.message, /Reports are unavailable/);
        assert.doesNotMatch(error.message, /SENSITIVE|0 learners|No published lessons/);
        return true;
      });
    }
  }
  const boundary = load("src/app/error.tsx", {
    "react/jsx-runtime": jsx,
    "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
  }).default;
  const html = renderToStaticMarkup(React.createElement(boundary, { reset() {} }));
  assert.match(html, /Could not load this page/);
  assert.match(html, /database migration/);
  assert.doesNotMatch(html, /0 learners|No published lessons|SENSITIVE/);
});

test("missing version/progress columns and malformed rows fail explicitly rather than silently becoming zero", async () => {
  for (const [table, mutation] of [
    ["forge_reviewers", row => { delete row.lesson_id; }],
    ["forge_lessons", row => { delete row.version; }],
    ["forge_enrollments", row => { delete row.progress_evidence; }],
    ["forge_enrollments", row => { row.progress_evidence = null; }],
    ["forge_enrollments", row => { row.progress_evidence = { 2: { reviewed_at: "SENSITIVE BAD TIME" } }; }],
    ["forge_attempts", row => { delete row.lesson_version; }],
    ["forge_attempts", row => { row.score = 11; }],
    ["forge_attempts", row => { row.questions = [{ prompt: "PRIVATE CONTENT SENTINEL" }]; }],
  ]) {
    const h = harness();
    // Ensure a grant row is read even for the instructor.
    h.state.tables.forge_reviewers.push({ user_id: "teacher", lesson_id: "owned" });
    h.state.corrupt = (read, rows) => { if (read.table === table && rows.length) mutation(rows[0]); return rows; };
    await assert.rejects(h.html(), error => {
      assert.match(error.message, /Reports are unavailable/); assert.doesNotMatch(error.message, /SENSITIVE|PRIVATE CONTENT/);
      return true;
    });
  }
});

test("offline mounted actual shell and report HTML: 320/1440 wrapping, native details and keyboard focus", async context => {
  const h = harness();
  const longId = `learner-${"long-identifier-".repeat(18)}`;
  h.state.tables.forge_enrollments.find(row => row.user_id === "passed-no-ack").user_id = longId;
  h.state.tables.forge_attempts.filter(row => row.user_id === "passed-no-ack").forEach(row => { row.user_id = longId; });
  const route = await h.route();
  const props = { ...route.props, children: undefined };
  const content = renderToStaticMarkup(route.props.children);
  const require = createRequire(import.meta.url);
  const sources = Object.fromEntries([
    ["react", "react", "react.development.js"], ["react/jsx-runtime", "react", "react-jsx-runtime.development.js"],
    ["react-dom", "react-dom", "react-dom.development.js"], ["react-dom/client", "react-dom", "react-dom-client.development.js"],
    ["scheduler", "scheduler", "scheduler.development.js"],
  ].map(([name, pkg, file]) => [name, readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "cjs", file), "utf8")]));
  sources["lucide-react"] = readFileSync(require.resolve("lucide-react"), "utf8");
  sources.shell = transpile("src/components/learner-shell.tsx");
  const css = source("src/app/globals.css").replace('@import "tailwindcss";', "");
  const network = [], errors = [];
  context.mock.method(globalThis, "fetch", async () => { throw new Error("Network forbidden"); });
  const browser = await chromium.launch();
  const browserContext = await browser.newContext({ offline: true, serviceWorkers: "block" });
  context.after(async () => { await browserContext.close(); await browser.close(); });
  await browserContext.route("**/*", route => { network.push(route.request().url()); return route.abort(); });
  const page = await browserContext.newPage(); page.setDefaultTimeout(5000);
  page.on("pageerror", error => errors.push(error.message));
  const artifacts = await mkdtemp(join(tmpdir(), "forge-reports-"));
  context.diagnostic(`Synthetic report screenshots (not independent visual approval): ${artifacts}; Chromium ${browser.version()}`);
  await page.setContent(`<style>${css}</style><div id="root"></div>`);
  await page.evaluate(({ sources, props, content }) => {
    const modules = {};
    function load(name) {
      if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => load("react").createElement("a", props, children) };
      if (name === "@/app/auth/actions") return { logOut() { throw new Error("No writes"); } };
      if (!modules[name]) {
        if (!sources[name]) throw new Error(`Unexpected browser dependency ${name}`);
        const mod = { exports: {} }; modules[name] = mod;
        new Function("require", "module", "exports", "process", sources[name])(load, mod, mod.exports, { env: { NODE_ENV: "development" } });
      }
      return modules[name].exports;
    }
    load("react-dom/client").createRoot(document.getElementById("root")).render(load("react").createElement(load("shell").LearnerShell, props,
      load("react").createElement("div", { style: { display: "contents" }, dangerouslySetInnerHTML: { __html: content } })));
  }, { sources, props, content });
  await page.getByRole("heading", { name: "Participation & results." }).waitFor();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(mobile => document.getElementById("learner-navigation").inert === mobile, width === 320);
    await page.getByRole("heading", { name: "CURRENT PUBLIC ENROLLMENT ROSTER" }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Page overflow at ${width}`);
    const row = page.locator(".report-roster li").filter({ has: page.getByRole("heading", { name: longId, exact: true }) });
    assert.match(await row.innerText(), /No review record[\s\S]*No quiz-reached record[\s\S]*Public saved pass/);
    assert.match(await page.locator(".report-section").innerText(), /6 learners · 1 reviewed · 1 attended · 1 passed/);
    const old = page.locator("summary").filter({ hasText: "old-pass · Version 1" });
    await old.focus(); await page.keyboard.press("Enter");
    assert.equal(await old.evaluate(node => node.parentElement.open), true);
    await old.locator("..").getByText("Selected: Second", { exact: true }).first().waitFor();
    assert.equal(await old.evaluate(node => getComputedStyle(node).outlineStyle !== "none"), true);
    // Focus scrolls to the old attempt. Capture the full page from the top and
    // finish responsive CSS transitions so a closing sidebar is not misleading.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(artifacts, `reports-${width}.png`), fullPage: true, animations: "disabled" });
    await page.keyboard.press("Space");
    assert.equal(await old.evaluate(node => node.parentElement.open), false);
    await old.focus(); await page.keyboard.press("Tab");
    assert.equal(await page.locator("summary:focus").count(), 1, "Next saved attempt remains keyboard reachable");
    if (width === 320) {
      const menu = page.getByRole("button", { name: "Open navigation", exact: true });
      await menu.focus(); await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Close navigation", exact: true }).waitFor();
      await page.keyboard.press("Escape");
      assert.equal(await menu.evaluate(node => node === document.activeElement), true);
    }
  }
  assert.deepEqual(network, []); assert.deepEqual(errors, []);
});
