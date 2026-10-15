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

const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const sources = Object.fromEntries([
  ["react", "react", "react.development.js"], ["react/jsx-runtime", "react", "react-jsx-runtime.development.js"],
  ["react-dom", "react-dom", "react-dom.development.js"], ["react-dom/client", "react-dom", "react-dom-client.development.js"],
  ["scheduler", "scheduler", "scheduler.development.js"],
].map(([name, pkg, file]) => [name, readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "cjs", file), "utf8")]));
sources["lucide-react"] = readFileSync(require.resolve("lucide-react"), "utf8");
for (const name of ["profile-form", "email-change-form", "submit-button", "learner-shell"]) sources[name] = compile(`src/components/${name}.tsx`);
const actionSource = compile("src/app/profile/actions.ts");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8").replace('@import "tailwindcss";', "");

test("mounted profile/email real actions retain files and text, avoid replay and fit mobile/desktop", async context => {
  const user = { id: "owner", email: "owner@example.test" };
  let saveMode = "reject", emailMode = "reject", releaseEmail, authError = null;
  const writes = [], payloads = [], redirects = [], emailCalls = [];
  let completedProfileActions = 0;
  const client = { auth: {
    getUser: async () => ({ data: { user }, error: authError }),
    async updateUser(...args) {
      emailCalls.push(args);
      if (emailMode === "defer") await new Promise(resolve => { releaseEmail = resolve; });
      if (emailMode === "throw") throw new Error("synthetic acknowledgement loss");
      return emailMode === "reject" ? { error: { status: 422 }, data: null } : { error: null, data: { user } };
    },
  }, from: () => {
    let patch;
    return {
      select() { return this; }, eq() { return this; }, update(value) { patch = value; return this; },
      async maybeSingle() {
        if (!patch) return { error: null, data: { age: 22, age_range: "18-24", learning_setup_revision: 0 } };
        writes.push(patch);
        return saveMode === "reject" ? { error: { code: "23514" } } : { error: null, data: { id: "owner" } };
      },
    };
  } };
  const deps = {
    "next/navigation": { redirect(path) { redirects.push(path); throw new Error("TEST_REDIRECT"); } },
    "next/cache": { revalidatePath() {} }, zod: require("zod"), sharp: require("sharp"),
    "@supabase/supabase-js": { createClient() { throw new Error("No privileged client allowed"); } },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/lib/public-config": { publicConfig: () => ({ siteOrigin: "https://app.invalid" }) },
    "@/lib/eligibility": { isDemoAge: value => Number.isInteger(value) && value >= 13 && value <= 120, ageRangeFor: age => age < 18 ? "13-17" : "18-24" },
  };
  const actions = {};
  runInNewContext(actionSource, { exports: actions, require(name) { if (!deps[name]) throw new Error(name); return deps[name]; }, FormData, File, Buffer, process: { env: {} } });
  const image = await require("sharp")({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
  const initial = { displayName: "Synthetic Owner", email: "owner@example.test", age: 22, ageRange: "18-24", level: "advanced", subjects: "Testing", goals: "Existing goals", avatar: `data:image/jpeg;base64,${(await require("sharp")(image).jpeg().toBuffer()).toString("base64")}`, initials: "SO", setupRevision: 0 };
  const browser = await chromium.launch();
  const browserContext = await browser.newContext({ offline: true, serviceWorkers: "block", viewport: { width: 320, height: 844 } });
  context.after(async () => { await browserContext.close(); await browser.close(); });
  const requests = [], errors = [];
  await browserContext.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  const page = await browserContext.newPage(); page.setDefaultTimeout(5000);
  page.on("pageerror", error => errors.push(error.message));
  const screenshots = await mkdtemp(join(tmpdir(), "forge-profile-ui-"));
  context.diagnostic(`Screenshots captured (inspection reported separately): ${screenshots}; Chromium ${browser.version()}`);
  await page.exposeFunction("profileAction", async (name, previous, entries) => {
    const form = new FormData();
    for (const [key, value] of entries) form.append(key, typeof value === "object" ? new File([new Uint8Array(value.bytes)], value.name, { type: value.type }) : value);
    payloads.push({ name, entries });
    try { return await actions[name](previous, form); }
    catch (error) { if (error.message === "TEST_REDIRECT") return {}; throw error; }
    finally { if (name === "updateProfile") completedProfileActions++; }
  });
  await page.setContent(`<style>${css}</style><div id="root"></div>`);
  await page.evaluate(({ sources, initial }) => {
    const modules = {};
    async function invoke(name, previous, form) {
      const entries = [];
      for (const [key, value] of form) entries.push([key, value instanceof File ? { name: value.name, type: value.type, bytes: [...new Uint8Array(await value.arrayBuffer())] } : value]);
      return window.profileAction(name, previous, entries);
    }
    function load(name) {
      if (name === "@/app/profile/actions") return { updateProfile: (previous, form) => invoke("updateProfile", previous, form), changeEmail: (previous, form) => invoke("changeEmail", previous, form) };
      if (name === "@/app/auth/actions") return { logOut: async () => {} };
      if (name === "./submit-button") name = "submit-button";
      if (name === "next/image") return { __esModule: true, default: ({ unoptimized, ...props }) => { void unoptimized; return load("react").createElement("img", props); } };
      if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => load("react").createElement("a", { ...props, onClick: event => event.preventDefault() }, children) };
      if (!modules[name]) {
        if (!sources[name]) throw new Error(`Unexpected browser dependency ${name}`);
        const mod = { exports: {} }; modules[name] = mod;
        new Function("require", "module", "exports", "process", sources[name])(load, mod, mod.exports, { env: { NODE_ENV: "development" } });
      }
      return modules[name].exports;
    }
    const React = load("react"), root = load("react-dom/client").createRoot(document.getElementById("root"));
    let key = 0;
    window.mountProfile = notice => root.render(React.createElement(load("learner-shell").LearnerShell, { active: "/profile" },
      React.createElement("div", { className: "portal-page profile-page" },
        React.createElement("header", { className: "portal-heading" }, React.createElement("h1", {}, "Profile & settings.")),
        React.createElement("section", { key: ++key, className: "settings-layout" },
          React.createElement(load("profile-form").ProfileForm, { initial, notice }),
          React.createElement("aside", { className: "privacy-panel" }, React.createElement("h2", {}, "Privacy controls"), React.createElement(load("email-change-form").EmailChangeForm))))));
  }, { sources, initial });
  async function mount(notice = null) {
    await page.evaluate(notice => window.mountProfile(notice), notice);
    await expect(page.getByRole("button", { name: "Save profile", exact: true })).toBeVisible();
  }
  const profile = () => page.locator("form.settings-panel");
  async function submit() {
    const before = completedProfileActions;
    await profile().evaluate(form => { form.noValidate = true; form.requestSubmit(); });
    await expect.poll(() => completedProfileActions).toBe(before + 1);
    await expect(page.getByRole("button", { name: "Save profile", exact: true })).toBeEnabled();
  }
  async function noOverflow() { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); }
  const lastFile = () => payloads.filter(payload => payload.name === "updateProfile").at(-1).entries.find(([key]) => key === "avatar")?.[1];

  await context.test("initial notice is focused; validation failure retains real File for the next submitted payload", async () => {
    await mount({ message: "Initial profile notice", isError: true });
    await expect(profile().getByRole("status")).toBeFocused();
    await page.locator('input[name="avatar"]').setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: image });
    await page.locator('input[name="displayName"]').fill("Draft name");
    await page.locator('textarea[name="goals"]').fill("Keep this draft text");
    await page.locator('input[name="age"]').fill("12");
    await submit();
    await expect(profile().getByRole("status")).toContainText("highlighted");
    await expect(page.locator('input[name="age"]')).toBeFocused();
    assert.equal(await page.locator('input[name="avatar"]').evaluate(input => input.files.length), 1);
    await expect(page.getByAltText("Selected profile picture preview")).toBeVisible();
    await expect(page.getByText("Selected image retained for retry: synthetic.png")).toBeVisible();
    await expect(page.locator('textarea[name="goals"]')).toHaveValue("Keep this draft text");
    await page.locator('input[name="age"]').fill("22"); await submit();
    await expect(profile().getByRole("status")).toContainText("Could not confirm");
    assert.equal(lastFile().bytes.length, image.length);
    assert.match(writes.at(-1).avatar_url, /^data:image\/jpeg;base64,/);
    await expect(page.locator('input[name="displayName"]')).toHaveValue("Draft name");
    await expect(profile().getByRole("status")).toBeFocused();
    await noOverflow();
    await page.screenshot({ path: join(screenshots, "profile-file-retry-320.png"), fullPage: true });
  });

  await context.test("database failure retry keeps avatar bytes; remove and cancel have distinct deliberate payloads", async () => {
    await submit(); await expect(profile().getByRole("status")).toContainText("Could not confirm");
    assert.equal(lastFile().bytes.length, image.length);
    const lastWrites = writes.slice(-2); assert.equal(lastWrites[0].avatar_url, lastWrites[1].avatar_url);
    await page.getByRole("checkbox", { name: "Remove picture" }).check(); await submit();
    await expect(profile().getByRole("status")).toContainText("Could not confirm");
    assert.equal(writes.at(-1).avatar_url, null);
    await expect(page.getByRole("checkbox", { name: "Remove picture" })).toBeChecked();
    await page.getByRole("button", { name: "Cancel picture change" }).click();
    await expect(page.getByRole("checkbox", { name: "Remove picture" })).not.toBeChecked();
    await submit(); await expect(profile().getByRole("status")).toContainText("Could not confirm");
    assert.equal(Object.hasOwn(writes.at(-1), "avatar_url"), false);
    await expect(page.locator('textarea[name="goals"]')).toHaveValue("Keep this draft text");
    saveMode = "ok"; await submit(); await expect.poll(() => redirects.length).toBe(1);
    assert.match(redirects[0], /success=Profile/);
  });

  await context.test("email returned failure preserves address; lost acknowledgement blocks replay with explicit recovery", async () => {
    await mount(); emailMode = "reject";
    const form = page.getByRole("form", { name: "Change email" });
    await form.getByRole("textbox").fill("new@example.test");
    await form.getByRole("button", { name: "Request email change", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("not accepted");
    await expect(form.getByRole("status")).toBeFocused();
    await expect(form.getByRole("textbox")).toHaveValue("new@example.test");
    assert.equal(page.url(), "about:blank");
    emailMode = "throw";
    await form.getByRole("button", { name: "Request email change", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Could not confirm");
    await expect(form.getByRole("button", { name: "Request email change", exact: true })).toBeDisabled();
    const count = emailCalls.length;
    await form.evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    assert.equal(emailCalls.length, count);
    await expect(form.getByRole("textbox")).toHaveValue("new@example.test");
    await noOverflow();
    await page.screenshot({ path: join(screenshots, "profile-email-uncertain-320.png"), fullPage: true });
    await form.getByRole("button", { name: /I checked my inboxes/ }).click();
    emailMode = "ok";
    await form.getByRole("button", { name: "Request email change", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("current and new email inboxes");
  });

  await context.test("email same-tick duplicates are serialized and user-plus-error sends nothing", async () => {
    await mount(); emailMode = "defer";
    const form = page.getByRole("form", { name: "Change email" });
    await form.getByRole("textbox").fill("another@example.test");
    const before = emailCalls.length;
    await form.evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await expect.poll(() => emailCalls.length).toBe(before + 1);
    await expect(form.getByRole("button", { name: "Requesting…" })).toBeDisabled();
    emailMode = "ok"; releaseEmail();
    await expect(form.getByRole("status")).toContainText("current and new email inboxes");
    await form.getByRole("button", { name: /I checked my inboxes/ }).click();
    authError = { status: 401 };
    await form.getByRole("button", { name: "Request email change", exact: true }).click();
    await expect(form.getByRole("status")).toContainText("Log in again");
    assert.equal(emailCalls.length, before + 1); authError = null;
  });

  for (const [width, height] of [[320, 844], [1440, 1000]]) await context.test(`QA-FOCUS-02 keyboard picture cancellation restores chooser focus and retains retry semantics at ${width}px`, async () => {
    await page.setViewportSize({ width, height }); await mount(); saveMode = "reject";
    const chooser = page.locator('input[name="avatar"]');
    const removal = page.getByRole("checkbox", { name: "Remove picture", exact: true });
    const cancel = page.getByRole("button", { name: "Cancel picture change", exact: true });
    await page.locator('input[name="displayName"]').fill("Retained focus draft");
    await page.locator('textarea[name="goals"]').fill("Retain this text after cancellation");
    for (const failureFirst of [false, true]) {
      await chooser.setInputFiles({ name: "synthetic.png", mimeType: "image/png", buffer: image });
      if (failureFirst) {
        await submit(); await expect(profile().getByRole("status")).toContainText("Could not confirm");
        await submit(); await expect(profile().getByRole("status")).toContainText("Could not confirm");
        assert.equal(lastFile().bytes.length, image.length, "Failed-save retry must still submit the actual File");
      }
      const writeCount = writes.length, actionCount = payloads.length;
      await chooser.focus(); await page.keyboard.press("Tab");
      await expect(removal).toBeFocused();
      await page.keyboard.press("Tab"); await expect(cancel).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(cancel).toHaveCount(0);
      await expect(chooser).toBeFocused();
      await expect(chooser).toBeInViewport();
      assert.equal(await chooser.evaluate(input => input.files.length), 0);
      await expect(page.getByAltText("Selected profile picture preview")).toHaveCount(0);
      await expect(page.getByAltText("Your profile")).toBeVisible();
      await expect(removal).not.toBeChecked();
      await expect(page.locator('input[name="displayName"]')).toHaveValue("Retained focus draft");
      await expect(page.locator('textarea[name="goals"]')).toHaveValue("Retain this text after cancellation");
      assert.equal(writes.length, writeCount, "Picture cancellation must not write");
      assert.equal(payloads.length, actionCount, "Picture cancellation must not call a server action");
    }
    // Cancelling removal is distinct from submitting removal, and restores the
    // same persistent control without changing the stored picture.
    const actionCount = payloads.length;
    await page.keyboard.press("Tab"); await expect(removal).toBeFocused();
    await page.keyboard.press("Space"); await expect(removal).toBeChecked();
    await page.keyboard.press("Tab"); await expect(cancel).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(chooser).toBeFocused(); await expect(removal).not.toBeChecked();
    assert.equal(payloads.length, actionCount);
    assert.equal(await chooser.evaluate(input => getComputedStyle(input).outlineStyle), "solid");
    await noOverflow();
    await page.screenshot({ path: join(screenshots, `profile-cancel-focus-${width}.png`), fullPage: true });
  });

  await context.test("actual CSS at 320px and desktop supports file controls, wrapping and keyboard navigation", async () => {
    await page.setViewportSize({ width: 320, height: 844 });
    await mount();
    await page.locator('input[name="avatar"]').focus(); await page.keyboard.press("Tab");
    await expect(page.getByRole("checkbox", { name: "Remove picture" })).toBeFocused();
    await page.keyboard.press("Space"); await expect(page.getByRole("checkbox", { name: "Remove picture" })).toBeChecked();
    await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Cancel picture change" })).toBeFocused();
    await page.keyboard.press("Enter"); await expect(page.getByRole("checkbox", { name: "Remove picture" })).not.toBeChecked();
    await noOverflow(); await page.screenshot({ path: join(screenshots, "profile-mobile-320.png"), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 }); await noOverflow();
    await page.locator('input[name="displayName"]').focus(); await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email address", { exact: false }).first()).toBeFocused();
    await page.screenshot({ path: join(screenshots, "profile-desktop.png"), fullPage: true });
  });
  assert.deepEqual(requests, []); assert.deepEqual(errors, []);
});
