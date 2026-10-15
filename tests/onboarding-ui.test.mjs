import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { chromium, expect } from "@playwright/test";
import ts from "typescript";
import { diagnosticQuestions, levels, levelLabels, explainDiagnostic } from "../src/lib/diagnostic.ts";

const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const browserSources = Object.fromEntries([
  ["react", "react", "react.development.js"], ["react/jsx-runtime", "react", "react-jsx-runtime.development.js"],
  ["react-dom", "react-dom", "react-dom.development.js"], ["react-dom/client", "react-dom", "react-dom-client.development.js"],
  ["scheduler", "scheduler", "scheduler.development.js"],
].map(([name, pkg, file]) => [name, readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "cjs", file), "utf8")]));
browserSources["lucide-react"] = readFileSync(require.resolve("lucide-react"), "utf8");
for (const name of ["onboarding-form", "diagnostic-form", "learner-shell"]) browserSources[name] = compile(`src/components/${name}.tsx`);
const serverSources = Object.fromEntries([
  ["@/lib/diagnostic", "src/lib/diagnostic.ts"], ["@/lib/onboarding", "src/lib/onboarding.ts"],
  ["@/lib/onboarding-server", "src/lib/onboarding-server.ts"], ["onboarding", "src/app/onboarding/actions.ts"],
  ["diagnostic", "src/app/diagnostic/actions.ts"],
].map(([name, path]) => [name, compile(path)]));
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8").replace('@import "tailwindcss";', "") +
  readFileSync(new URL("../src/components/onboarding.module.css", import.meta.url), "utf8");
const copy = value => JSON.parse(JSON.stringify(value));

test("network-blocked mounted onboarding/diagnostic use actual server actions and local adapters", async context => {
  let row, role, writeMode, throwBridge, release, readMode;
  let calls = [];
  const cache = {};
  function load(name) {
    if (name === "./diagnostic") name = "@/lib/diagnostic";
    if (name === "zod") return require("zod");
    if (name === "server-only") return {};
    if (name === "@/lib/supabase/server") return { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: "owner", app_metadata: { role } } }, error: null }) },
    }) };
    if (name === "@/lib/learning-server") return { database: () => ({ from: () => {
      const filters = []; let patch;
      return {
        select() { return this; }, eq(...filter) { filters.push(filter); return this; }, update(value) { patch = copy(value); return this; },
        async maybeSingle() {
          if (!patch) return readMode === "fail" ? { data: null, error: { code: "500" } } : { data: copy(row), error: null };
          if (writeMode === "defer") await new Promise(resolve => { release = resolve; });
          if (writeMode === "schema") return { data: null, error: { code: "42703" } };
          if (writeMode === "reject") return { data: null, error: { code: "23514" } };
          if (!filters.every(([key, value]) => row[key] === value)) return { data: null, error: null };
          row = { ...row, ...patch };
          if (writeMode === "lost") throw new Error("synthetic lost acknowledgement");
          return { data: copy(row), error: null };
        },
      };
    } }) };
    if (!cache[name]) {
      assert.ok(serverSources[name], name);
      cache[name] = {};
      runInNewContext(serverSources[name], { exports: cache[name], require: load, Date, JSON });
    }
    return cache[name];
  }
  const constants = load("@/lib/onboarding");
  const browser = await chromium.launch();
  const browserContext = await browser.newContext({ offline: true, serviceWorkers: "block", viewport: { width: 320, height: 844 } });
  context.after(async () => { await browserContext.close(); await browser.close(); });
  const requests = [], errors = [];
  await browserContext.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  const page = await browserContext.newPage(); page.setDefaultTimeout(5000);
  page.on("pageerror", error => errors.push(error.message));
  const screenshots = await mkdtemp(join(tmpdir(), "forge-onboarding-ui-"));
  context.diagnostic(`Screenshots captured (inspection reported separately): ${screenshots}; Chromium ${browser.version()}`);
  await page.exposeFunction("serverAction", async (name, input) => {
    calls.push({ name, input });
    if (throwBridge) throw new Error("synthetic bridge loss");
    return (name === "runDiagnostic" || name === "chooseDiagnosticLevel" ? load("diagnostic") : load("onboarding"))[name](input);
  });
  await page.setContent(`<style>${css}</style><div id="root"></div>`);
  await page.evaluate(({ sources, backgroundChoices, goalChoices, setupMessages, diagnosticQuestions, levels, levelLabels, explainSource }) => {
    const modules = {};
    function load(name) {
      if (name === "@/app/onboarding/actions") return {
        saveOnboarding: input => window.serverAction("saveOnboarding", input),
        reloadLearningSetup: () => window.serverAction("reloadLearningSetup"),
      };
      if (name === "@/app/diagnostic/actions") return {
        runDiagnostic: input => window.serverAction("runDiagnostic", input),
        chooseDiagnosticLevel: input => window.serverAction("chooseDiagnosticLevel", input),
      };
      if (name === "@/lib/onboarding") return { backgroundChoices, goalChoices, setupFailure: code => ({ code, message: setupMessages[code] }) };
      if (name === "@/lib/diagnostic") return { diagnosticQuestions, levels, levelLabels, explainDiagnostic: new Function("levelLabels", `return (${explainSource})`)(levelLabels) };
      if (name === "./onboarding.module.css") return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
      if (name === "@/app/auth/actions") return { logOut: async () => {} };
      if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => load("react").createElement("a", { ...props, onClick: event => event.preventDefault() }, children) };
      if (!modules[name]) {
        if (!sources[name]) throw new Error(`Unexpected browser dependency: ${name}`);
        const mod = { exports: {} }; modules[name] = mod;
        new Function("require", "module", "exports", "process", sources[name])(load, mod, mod.exports, { env: { NODE_ENV: "development" } });
      }
      return modules[name].exports;
    }
    const React = load("react"), root = load("react-dom/client").createRoot(document.getElementById("root"));
    let mount = 0;
    window.mount = (kind, initial, role) => root.render(React.createElement(load("learner-shell").LearnerShell, { active: "/profile", instructor: role === "instructor" },
      React.createElement("div", { className: "portal-page" }, React.createElement(kind === "onboarding" ? load("onboarding-form").OnboardingForm : load("diagnostic-form").DiagnosticForm, { key: ++mount, initial, role }))));
  }, { sources: browserSources, backgroundChoices: constants.backgroundChoices, goalChoices: constants.goalChoices,
    setupMessages: constants.setupMessages, diagnosticQuestions, levels, levelLabels, explainSource: explainDiagnostic.toString() });

  async function mount(kind = "onboarding", selectedRole = "learner", reset = true) {
    role = selectedRole; writeMode = null; readMode = null; throwBridge = false; calls = [];
    if (reset) row = { id: "owner", learning_level: "foundation", learning_setup_revision: 0, onboarding_completed_at: null, onboarding_background: null, diagnostic_summary: null };
    await page.evaluate(({ kind, row, role }) => window.mount(kind, row, role), { kind, row, role });
    await expect(page.getByRole("form", { name: kind === "onboarding" ? "Background and goals" : "Local diagnostic" })).toBeVisible();
  }
  async function background(selectedRole) {
    await page.getByLabel("Background", { exact: true }).selectOption(selectedRole === "learner" ? "coursework" : "teaching");
    await page.getByRole("checkbox").first().check();
    await page.getByLabel("Your chosen learning level", { exact: false }).selectOption("intermediate");
  }
  async function answers() {
    for (const question of diagnosticQuestions[role]) await page.getByRole("radio", { name: question.choices[question.correct], exact: true }).check();
  }
  async function noOverflow() {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }

  for (const selectedRole of ["learner", "instructor"]) await context.test(`${selectedRole} onboarding → separate diagnostic → adopt → override → retake`, async () => {
    await mount("onboarding", selectedRole);
    await background(selectedRole);
    await page.getByRole("button", { name: "Save and complete onboarding" }).click();
    await expect(page.getByRole("status")).toContainText("are saved");
    await expect(page.getByRole("status")).toBeFocused();
    assert.ok(row.onboarding_completed_at); assert.equal(row.diagnostic_summary, null);
    await noOverflow();
    await page.screenshot({ path: join(screenshots, `${selectedRole}-onboarding-320.png`), fullPage: true });
    await mount("diagnostic", selectedRole, false);
    await answers();
    await page.getByRole("button", { name: "Check and save latest summary" }).click();
    await expect(page.getByRole("status")).toContainText("chosen level has not changed");
    assert.equal(row.learning_level, "intermediate"); assert.equal(row.diagnostic_summary.score, 6);
    await page.getByRole("button", { name: "Adopt Advanced", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("explicitly chosen level is saved");
    assert.equal(row.learning_level, "advanced");
    await page.getByLabel("Override with your own level").selectOption("new");
    await page.getByRole("button", { name: "Save my override" }).click();
    await expect(page.getByText("Chosen level: New to the subject", { exact: false })).toBeVisible();
    assert.equal(row.learning_level, "new");
    await page.getByRole("button", { name: "Retake diagnostic" }).click();
    await expect(page.getByRole("heading", { name: "Your starting point" })).toBeFocused();
    await answers(); await page.getByRole("button", { name: "Check and save latest summary" }).click();
    await expect(page.getByRole("status")).toContainText("chosen level has not changed");
    assert.equal(row.learning_level, "new"); assert.equal(Object.hasOwn(row.diagnostic_summary, "answers"), false);
    await noOverflow();
    await page.screenshot({ path: join(screenshots, `${selectedRole}-diagnostic-320.png`), fullPage: true });
  });

  await context.test("validation, missing schema and rejected writes retain onboarding choices and focus notices", async () => {
    await mount(); await page.getByLabel("Background", { exact: true }).selectOption("coursework");
    await page.getByRole("button", { name: "Save and complete onboarding" }).click();
    await expect(page.getByRole("status")).toContainText("at least one goal");
    assert.equal(calls.length, 0);
    await page.getByRole("checkbox").first().check();
    for (const mode of ["schema", "reject"]) {
      writeMode = mode;
      await page.getByRole("button", { name: "Save and complete onboarding" }).click();
      await expect(page.getByRole("status")).toContainText(mode === "schema" ? "migration" : "rejected");
      await expect(page.getByRole("status")).toBeFocused();
      await expect(page.getByLabel("Background", { exact: true })).toHaveValue("coursework");
      await expect(page.getByRole("checkbox").first()).toBeChecked();
      assert.equal(row.onboarding_completed_at, null);
    }
  });

  await context.test("lost acknowledgement is not replayed; explicit reload keeps draft and compares saved version", async () => {
    await mount(); await background("learner"); writeMode = "lost";
    await page.getByRole("button", { name: "Save and complete onboarding" }).click();
    await expect(page.getByRole("status")).toContainText("Could not confirm");
    await expect(page.getByRole("button", { name: "Save and complete onboarding" })).toBeDisabled();
    assert.equal(calls.filter(call => call.name === "saveOnboarding").length, 1);
    assert.ok(row.onboarding_completed_at);
    readMode = "fail";
    await page.getByRole("button", { name: "Reload saved version" }).click();
    await expect(page.getByRole("status")).toContainText("Could not load");
    await expect(page.getByRole("button", { name: "Save and complete onboarding" })).toBeDisabled();
    readMode = null; writeMode = null;
    await page.getByRole("button", { name: "Reload saved version" }).click();
    await expect(page.getByRole("status")).toContainText("draft choices are still shown");
    await expect(page.getByRole("button", { name: "Save background changes" })).toBeEnabled();
    await expect(page.getByLabel("Background", { exact: true })).toHaveValue("coursework");
    assert.equal(calls.filter(call => call.name === "saveOnboarding").length, 1);
  });

  await context.test("same-tick duplicate submits and reload are serialized; stale role cannot be saved", async () => {
    await mount(); await background("learner"); writeMode = "defer";
    await page.getByRole("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect.poll(() => calls.length).toBe(1);
    await expect(page.getByRole("button", { name: "Reload saved version" })).toBeDisabled();
    await expect.poll(() => typeof release).toBe("function");
    writeMode = null; release();
    await expect(page.getByRole("status")).toContainText("are saved");
    role = "instructor";
    await page.getByRole("button", { name: "Reload saved version" }).click();
    await expect(page.getByRole("status")).toContainText("trusted account role changed");
    await expect(page.getByRole("button", { name: "Save background changes" })).toBeDisabled();
  });

  await context.test("diagnostic conflict/transport loss preserve answers and block replay until reconciled", async () => {
    await mount("diagnostic"); await answers();
    row.learning_setup_revision = 1; row.learning_level = "new";
    await page.getByRole("button", { name: "Check and save latest summary" }).click();
    await expect(page.getByRole("status")).toContainText("newer profile");
    await expect(page.getByRole("button", { name: "Check and save latest summary" })).toBeDisabled();
    await expect(page.getByRole("radio", { name: diagnosticQuestions.learner[0].choices[1], exact: true })).toBeChecked();
    await page.getByRole("button", { name: "Reload saved version" }).click();
    await expect(page.getByRole("status")).toContainText("reloaded");
    throwBridge = true;
    await page.getByRole("button", { name: "Check and save latest summary" }).click();
    await expect(page.getByRole("status")).toContainText("Could not confirm");
    await expect(page.getByRole("button", { name: "Check and save latest summary" })).toBeDisabled();
    assert.equal(row.diagnostic_summary, null);
  });

  for (const [width, height] of [[320, 844], [1440, 1000]]) await context.test(`QA-FOCUS-01 keyboard cancel retake restores saved-result focus without mutation at ${width}px`, async () => {
    await page.setViewportSize({ width, height });
    await mount("diagnostic"); await answers();
    await page.getByRole("button", { name: "Check and save latest summary" }).click();
    await expect(page.getByRole("status")).toContainText("chosen level has not changed");
    const savedBefore = copy(row), callCount = calls.length;
    const savedHeading = page.getByRole("heading", { name: "Latest saved suggestion", exact: true });
    await page.getByRole("button", { name: "Retake diagnostic", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Your starting point", exact: true })).toBeFocused();
    await page.keyboard.press("Tab"); await page.keyboard.press("Space");
    const cancel = page.getByRole("button", { name: "Cancel retake — keep saved result", exact: true });
    for (let step = 0; step < 10 && !(await cancel.evaluate(button => button === document.activeElement)); step++) await page.keyboard.press("Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(cancel).toHaveCount(0);
    await expect(savedHeading).toBeFocused();
    await expect(savedHeading).toBeInViewport();
    await expect(page.getByText("Chosen level: Foundation", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retake diagnostic", exact: true })).toBeEnabled();
    assert.deepEqual(row, savedBefore);
    assert.equal(calls.length, callCount, "Cancelling a retake must not call a server action");
    assert.equal(await savedHeading.evaluate(heading => getComputedStyle(heading).outlineStyle), "solid");
    await noOverflow();
    await page.screenshot({ path: join(screenshots, `diagnostic-cancel-focus-${width}.png`), fullPage: true });
  });

  await context.test("320px and desktop keyboard controls and real scoped CSS remain usable", async () => {
    await page.setViewportSize({ width: 320, height: 844 });
    await mount();
    await page.getByLabel("Background", { exact: true }).focus();
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Tab");
    await expect(page.getByRole("checkbox").first()).toBeFocused();
    await page.keyboard.press("Space"); await expect(page.getByRole("checkbox").first()).toBeChecked();
    await noOverflow();
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await expect(page.getByRole("button", { name: "Close navigation", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open navigation", exact: true })).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await noOverflow();
    await page.getByLabel("Background", { exact: true }).focus(); await page.keyboard.press("Tab");
    await expect(page.getByRole("checkbox").first()).toBeFocused();
    await page.screenshot({ path: join(screenshots, "onboarding-desktop.png"), fullPage: true });
  });
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
});
