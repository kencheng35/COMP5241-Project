import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { chromium } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import ts from "typescript";
import { z } from "zod";
import { ageRangeFor, isDemoAge } from "../src/lib/eligibility.ts";

async function loadServerModule(path, dependencies, globals = {}) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, {
    exports, FormData, process: { env: {} }, ...globals,
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

async function loadActions(overrides = {}) {
  const calls = [];
  const logs = [];
  const auth = Object.fromEntries(["updateUser", "signOut", "signUp"].map(method => [method, async value => {
    calls.push([method, JSON.parse(JSON.stringify(value))]);
    return overrides[method] ? overrides[method](value) : { error: null };
  }]));
  const dependencies = {
    "node:crypto": { randomUUID },
    "next/navigation": { redirect(location) { throw Object.assign(new Error("Synthetic redirect"), { location }); } },
    zod: { z },
    "@/lib/eligibility": { isDemoAge, ageRangeFor },
    "@/lib/public-config": { publicConfig: overrides.publicConfig ?? (() => ({ siteOrigin: "https://example.test" })) },
    "@/lib/supabase/server": { async createClient(options) {
      if (options) assert.equal(options.requireCookieWrites, true);
      if (overrides.unavailable) throw new Error("Private configuration detail");
      if (overrides.createClient) return overrides.createClient(options);
      return { auth };
    } },
  };
  const exports = await loadServerModule("../src/app/auth/actions.ts", dependencies, {
    console: overrides.console ?? Object.fromEntries(["info", "warn", "error"].map(level => [level, value => {
      assert.equal(typeof value, "string");
      logs.push({ level, ...JSON.parse(value) });
    }])),
  });
  return { ...exports, calls, logs };
}

function signupForm(overrides = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: "Private Learner", email: "private@example.test", age: "17", password: "PrivateSecret1", ...overrides,
  })) form.set(key, value);
  return form;
}

function assertSignupLogs(actions, terminal, level, stage) {
  assert.equal(actions.logs.length, 2);
  const [started, finished] = actions.logs;
  assert.equal(started.event, "auth_signup_started");
  assert.equal(started.level, "info");
  assert.equal(started.stage, "validation");
  assert.match(started.diagnostic_id, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/);
  assert.equal(finished.diagnostic_id, started.diagnostic_id);
  assert.equal(finished.event, terminal);
  assert.equal(finished.level, level);
  assert.equal(finished.stage, stage);
  for (const entry of actions.logs) {
    assert.equal(Number.isInteger(entry.elapsed_ms) && entry.elapsed_ms >= 0, true);
  }
  assert.doesNotMatch(JSON.stringify(actions.logs), /Private|private@example|Secret|synthetic-token|synthetic-user|https:|stack/);
  return finished;
}

test("signup logs invalid field names without submitted values or provider calls", async () => {
  const actions = await loadActions();
  const state = await actions.signUp({}, signupForm({ email: "Private invalid email", age: "12", password: "short" }));
  assert.equal(state.error, "Check the highlighted fields.");
  assert.deepEqual(actions.calls, []);
  const log = assertSignupLogs(actions, "auth_signup_validation_failed", "warn", "validation");
  assert.deepEqual(log.invalid_fields.sort(), ["age", "email", "password"]);
});

test("signup logs completion once and preserves the verification redirect and provider payload", async () => {
  const actions = await loadActions({ signUp: async () => ({
    error: null, data: { user: { id: "synthetic-user" }, session: { access_token: "synthetic-token" } },
  }) });
  await assert.rejects(actions.signUp({}, signupForm()), error => {
    const location = new URL(error.location, "https://example.test");
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("email"), "private@example.test");
    assert.equal(location.searchParams.get("success"), "Account created. Check your inbox and verify your email before logging in.");
    return true;
  });
  assert.deepEqual(actions.calls, [["signUp", {
    email: "private@example.test", password: "PrivateSecret1",
    options: {
      emailRedirectTo: "https://example.test/auth/confirm?next=%2Fdashboard",
      data: { display_name: "Private Learner", age: 17, age_range: "13-17" },
    },
  }]]);
  const log = assertSignupLogs(actions, "auth_signup_completed", "info", "provider");
  assert.deepEqual(Object.keys(log).sort(), ["diagnostic_id", "elapsed_ms", "event", "level", "stage"]);
});

for (const failure of ["returned", "thrown"]) {
  for (const [code, status, message, reason] of [
    ["unexpected_failure", 500, "Database error saving new user: Private Learner", "database"],
    ["unexpected_failure", 500, "Error sending confirmation email to private@example.test", "email_delivery"],
    ["over_email_send_rate_limit", 429, "Private provider response", "unknown"],
    ["signup_disabled", 422, "Private provider response", "unknown"],
    ["weak_password", 422, "PrivateSecret1", "unknown"],
    [undefined, 0, "fetch failed", "network"],
    ["private@example.test", 999, "Private provider response", "unknown"],
    ["PrivateSecret1", "500", "Private provider response", "unknown"],
  ]) {
    test(`signup ${failure} ${reason}/${code ?? "no code"} failure logs only safe diagnostics`, async () => {
      const providerError = Object.assign(new Error(message), { code, status, body: "synthetic-token" });
      const actions = await loadActions({ signUp: async () => {
        if (failure === "thrown") throw providerError;
        return { error: providerError };
      } });
      const state = await actions.signUp({}, signupForm());
      assert.equal(state.error, "Could not create the account. Please try again later.");
      assert.deepEqual(JSON.parse(JSON.stringify(state.fields)), { name: "Private Learner", email: "private@example.test", age: "17" });
      assert.equal(state.fields.password, undefined);
      const log = assertSignupLogs(actions, "auth_signup_failed", "error", "provider");
      assert.equal(log.failure_type, failure);
      assert.equal(log.error_code, ["private@example.test", "PrivateSecret1", undefined].includes(code) ? null : code);
      assert.equal(log.http_status, typeof status === "number" && status >= 100 && status <= 599 ? status : null);
      assert.equal(log.reason, reason);
      assert.deepEqual(Object.keys(log).sort(), ["diagnostic_id", "elapsed_ms", "error_code", "event", "failure_type", "http_status", "level", "reason", "stage"]);
    });
  }
}

test("signup distinguishes configuration and client failures without contacting Auth", async () => {
  for (const [overrides, stage] of [
    [{ publicConfig: () => null }, "configuration"],
    [{ unavailable: true }, "client"],
  ]) {
    const actions = await loadActions(overrides);
    const state = await actions.signUp({}, signupForm());
    assert.equal(state.error, "Could not create the account. Please try again later.");
    assert.deepEqual(actions.calls, []);
    const log = assertSignupLogs(actions, "auth_signup_failed", "error", stage);
    assert.equal(log.failure_type, "thrown");
  }
});

test("signup assigns independent diagnostic IDs to repeated attempts", async () => {
  const actions = await loadActions({ signUp: async () => ({ error: { code: "unexpected_failure" } }) });
  await actions.signUp({}, signupForm());
  await actions.signUp({}, signupForm());
  assert.notEqual(actions.logs[0].diagnostic_id, actions.logs[2].diagnostic_id);
  assert.equal(actions.logs[0].diagnostic_id, actions.logs[1].diagnostic_id);
  assert.equal(actions.logs[2].diagnostic_id, actions.logs[3].diagnostic_id);
});

test("a failing signup log sink cannot block registration or replace its failure", async () => {
  const console = Object.fromEntries(["info", "warn", "error"].map(level => [level, () => { throw new Error("Private log sink failure"); }]));
  const success = await loadActions({ console });
  await assert.rejects(success.signUp({}, signupForm()), /Synthetic redirect/);
  assert.equal(success.calls.length, 1);
  const failure = await loadActions({ console, signUp: async () => ({ error: new Error("Private provider response") }) });
  assert.equal((await failure.signUp({}, signupForm())).error, "Could not create the account. Please try again later.");
});

function passwordForm(password = "Synthetic1") {
  const form = new FormData();
  form.set("password", password);
  return form;
}

async function redirected(action, pathname, parameter, message) {
  await assert.rejects(action, error => {
    assert.equal(error.message, "Synthetic redirect");
    const location = new URL(error.location, "https://example.test");
    assert.equal(location.pathname, pathname);
    assert.equal(location.searchParams.get(parameter), message);
    assert.equal(location.searchParams.size, parameter ? 1 : 0);
    assert.doesNotMatch(location.href, /Private|Synthetic1/);
    return true;
  });
}

test("password reset validates before contacting the provider", async () => {
  const actions = await loadActions();
  await redirected(() => actions.resetPassword(passwordForm("short")), "/reset-password", "error", "Use at least 8 characters.");
  assert.deepEqual(actions.calls, []);
});

test("password reset saves then signs out globally before reporting success", async () => {
  const actions = await loadActions();
  await redirected(() => actions.resetPassword(passwordForm()), "/login", "success", "Password updated. You can log in now.");
  assert.deepEqual(actions.calls, [["updateUser", { password: "Synthetic1" }], ["signOut", { scope: "global" }]]);
});

for (const failure of ["returned", "thrown"]) {
  const fail = async () => {
    const error = new Error("Private provider or cookie detail");
    if (failure === "thrown") throw error;
    return { error };
  };
  test(`password reset ${failure} update failure never signs out or claims success`, async () => {
    const actions = await loadActions({ updateUser: fail });
    await redirected(() => actions.resetPassword(passwordForm()), "/reset-password", "error", "Could not confirm the password update. Request a new link or try again later.");
    assert.deepEqual(actions.calls, [["updateUser", { password: "Synthetic1" }]]);
  });
  test(`password reset ${failure} logout failure acknowledges the saved password`, async () => {
    const actions = await loadActions({ signOut: fail });
    await redirected(() => actions.resetPassword(passwordForm()), "/login", "error", "Your password was updated, but we could not confirm logout. Log in with your new password if asked, then try Log out again.");
    assert.deepEqual(actions.calls, [["updateUser", { password: "Synthetic1" }], ["signOut", { scope: "global" }]]);
  });
  test(`logout ${failure} failure offers retry without claiming success`, async () => {
    const actions = await loadActions({ signOut: fail });
    await redirected(() => actions.logOut(), "/profile", "error", "Could not log out. Please try again.");
    assert.deepEqual(actions.calls, [["signOut", { scope: "global" }]]);
  });
}

test("logout explicitly preserves its global session scope", async () => {
  const actions = await loadActions();
  await redirected(() => actions.logOut(), "/login", "", null);
  assert.deepEqual(actions.calls, [["signOut", { scope: "global" }]]);
});

test("unavailable configuration fails reset and logout without provider calls", async () => {
  const actions = await loadActions({ unavailable: true });
  await redirected(() => actions.resetPassword(passwordForm()), "/reset-password", "error", "Could not confirm the password update. Request a new link or try again later.");
  await redirected(() => actions.logOut(), "/profile", "error", "Could not log out. Please try again.");
  assert.deepEqual(actions.calls, []);
});

async function cookieClient(failAt = -1) {
  const writes = [];
  const existing = [{ name: "synthetic-session", value: "synthetic-value" }];
  const cookieError = new Error("Private cookie storage failure");
  const actions = [];
  const { createClient } = await loadServerModule("../src/lib/supabase/server.ts", {
    "next/headers": { cookies: async () => ({
      getAll: () => existing,
      set(...args) {
        writes.push(args);
        if (writes.length === failAt) throw cookieError;
      },
    }) },
    "../public-config": { publicConfig: () => ({ supabaseUrl: "https://example.test", anonKey: "synthetic-public-key" }) },
    "@supabase/ssr": { createServerClient(_url, _key, options) {
      return { cookies: options.cookies, auth: {
        async updateUser() { actions.push("update"); return { error: null }; },
        async signOut({ scope }) {
          assert.equal(scope, "global");
          actions.push("signOut");
          options.cookies.setAll(existing.map(cookie => ({ ...cookie, value: "", options: { maxAge: 0 } })));
          return { error: null };
        },
      } };
    } },
  });
  return { createClient, writes, existing, cookieError, actions };
}

test("read-only server clients retain their cookie-write tolerance", async () => {
  const fixture = await cookieClient(1);
  const client = await fixture.createClient();
  assert.deepEqual(client.cookies.getAll(), fixture.existing);
  assert.doesNotThrow(() => client.cookies.setAll([{ name: "synthetic-session", value: "", options: { maxAge: 0 } }]));
  assert.equal(fixture.writes.length, 1);
});

test("strict action clients write all cookie chunks and propagate partial failures", async () => {
  const items = [0, 1].map(index => ({ name: `synthetic-session.${index}`, value: "", options: { maxAge: 0, httpOnly: true } }));
  for (const failAt of [-1, 1, 2]) {
    const fixture = await cookieClient(failAt);
    const client = await fixture.createClient({ requireCookieWrites: true });
    if (failAt > 0) assert.throws(() => client.cookies.setAll(items), error => error === fixture.cookieError);
    else client.cookies.setAll(items);
    assert.deepEqual(fixture.writes, items.slice(0, failAt > 0 ? failAt : 2).map(({ name, value, options }) => [name, value, options]));
  }
});

test("logout cookie cleanup failure reaches the action's retry notice", async () => {
  const fixture = await cookieClient(1);
  const actions = await loadActions({ createClient: fixture.createClient });
  await redirected(() => actions.logOut(), "/profile", "error", "Could not log out. Please try again.");
  assert.deepEqual(fixture.actions, ["signOut"]);
  assert.equal(fixture.writes.length, 1);
});

test("reset cookie cleanup failure does not invite another password update", async () => {
  const fixture = await cookieClient(1);
  const actions = await loadActions({ createClient: fixture.createClient });
  await redirected(() => actions.resetPassword(passwordForm()), "/login", "error", "Your password was updated, but we could not confirm logout. Log in with your new password if asked, then try Log out again.");
  assert.deepEqual(fixture.actions, ["update", "signOut"]);
  assert.equal(fixture.writes.length, 1);
});

test("mounted authentication recovery and notices (offline Chromium)", async context => {
  const require = createRequire(import.meta.url);
  const sources = Object.fromEntries([
    ["react", "react", "react.development.js"],
    ["react/jsx-runtime", "react", "react-jsx-runtime.development.js"],
    ["react-dom", "react-dom", "react-dom.development.js"],
    ["react-dom/client", "react-dom", "react-dom-client.development.js"],
    ["scheduler", "scheduler", "scheduler.development.js"],
  ].map(([name, packageName, file]) => [name, readFileSync(join(dirname(require.resolve(`${packageName}/package.json`)), "cjs", file), "utf8")]));
  sources["lucide-react"] = readFileSync(require.resolve("lucide-react"), "utf8");
  for (const [name, file] of [["form", "auth-form"], ["./submit-button", "submit-button"], ["./brand", "brand"]]) {
    sources[name] = ts.transpileModule(await readFile(new URL(`../src/components/${file}.tsx`, import.meta.url), "utf8"), {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
  }
  const browser = await chromium.launch();
  const browserContext = await browser.newContext({ offline: true, serviceWorkers: "block" });
  const requests = [];
  await browserContext.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  try {
    async function mount(props) {
      const page = await browserContext.newPage();
      context.after(() => page.close());
      await page.setContent('<div id="root"></div>');
      await page.evaluate(async ({ sources, props }) => {
        const modules = {};
        const calls = [];
        const pending = [];
        const actions = { requestReset: (_previous, form) => new Promise(resolve => {
          calls.push(Object.fromEntries(form));
          pending.push(resolve);
        }) };
        function load(name) {
          if (name === "@/app/auth/actions") return actions;
          if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => load("react").createElement("a", props, children) };
          if (!modules[name]) {
            if (!sources[name]) throw new Error(`Unexpected offline module: ${name}`);
            const loadedModule = { exports: {} };
            modules[name] = loadedModule;
            new Function("require", "module", "exports", "process", sources[name])(load, loadedModule, loadedModule.exports, { env: { NODE_ENV: "development" } });
          }
          return modules[name].exports;
        }
        const React = load("react");
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        const root = load("react-dom/client").createRoot(document.getElementById("root"));
        const render = nextProps => React.act(async () => { root.render(React.createElement(load("form").AuthForm, nextProps)); });
        globalThis.authTest = { calls, pending, render, act: React.act };
        await render(props);
      }, { sources, props });
      return page;
    }

    await context.test("redirect errors focus the alert on initial render and navigation", async () => {
      const page = await mount({ mode: "reset", error: "Could not confirm the password update. Request a new link or try again later." });
      assert.equal(await page.getByRole("alert").evaluate(element => element === document.activeElement), true);
      await page.keyboard.press("Tab");
      assert.equal(await page.getByLabel("Password", { exact: true }).evaluate(element => element === document.activeElement), true);
      await page.evaluate(() => authTest.render({ mode: "login", error: "Your password was updated, but we could not confirm logout. Log in with your new password if asked, then try Log out again." }));
      assert.equal(await page.getByRole("alert").evaluate(element => element === document.activeElement), true);
      assert.equal(await page.getByLabel("Password", { exact: true }).inputValue(), "");
    });

    await context.test("ambiguous query notices prefer errors without success decoration or HTML execution", async () => {
      const notice = '<img src=x onerror="window.injected=true">';
      const page = await mount({ mode: "login", error: notice, success: "Synthetic success" });
      assert.equal(await page.getByRole("alert").textContent(), notice);
      assert.equal(await page.locator(".form-notice svg").count(), 0);
      assert.equal(await page.locator("img").count(), 0);
      assert.equal(await page.evaluate(() => window.injected), undefined);
      await page.evaluate(() => authTest.render({ mode: "login", error: ["invalid"], success: ["invalid"], message: ["invalid"], email: ["invalid"], verification: ["required"] }));
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.equal(await page.getByRole("status").count(), 0);
      assert.equal(await page.getByLabel("Email address").inputValue(), "");
    });

    await context.test("slow recovery disables duplicate submission and failure preserves email with accessible retry", async () => {
      const page = await mount({ mode: "forgot" });
      await page.getByLabel("Email address").fill("demo@example.test");
      await page.getByRole("button", { name: "Send reset link" }).evaluate(button => authTest.act(async () => { button.click(); }));
      assert.equal(await page.getByRole("button", { name: "Working..." }).isDisabled(), true);
      assert.deepEqual(await page.evaluate(() => authTest.calls), [{ email: "demo@example.test" }]);
      await page.evaluate(() => authTest.act(async () => { authTest.pending.shift()({ error: "Could not send the reset email. Please try again later.", fields: { name: "", email: "demo@example.test", age: "" } }); }));
      assert.equal(await page.getByRole("alert").evaluate(element => element === document.activeElement), true);
      assert.equal(await page.getByLabel("Email address").inputValue(), "demo@example.test");
      assert.equal(await page.getByRole("button", { name: "Send reset link" }).isEnabled(), true);
      await page.getByRole("button", { name: "Send reset link" }).evaluate(button => authTest.act(async () => { button.click(); }));
      assert.equal((await page.evaluate(() => authTest.calls)).length, 2);
      await page.evaluate(() => authTest.act(async () => { authTest.pending.shift()({ error: "Check the highlighted fields.", fieldErrors: { email: "Enter a valid email address." }, fields: { name: "", email: "demo@example.test", age: "" } }); }));
      assert.equal(await page.getByLabel("Email address").evaluate(element => element === document.activeElement), true);
      assert.equal(await page.getByLabel("Email address").getAttribute("aria-describedby"), "email-error");
    });

    await context.test("success notices keep status semantics without taking keyboard focus", async () => {
      const page = await mount({ mode: "login", success: "Password updated. You can log in now." });
      assert.equal(await page.getByRole("status").count(), 1);
      assert.equal(await page.getByRole("alert").count(), 0);
      assert.equal(await page.getByRole("status").evaluate(element => element === document.activeElement), false);
    });

    await context.test("long logout warning fits desktop, mobile and landscape with reachable controls", async () => {
      const stylesheet = new URL("../src/app/globals.css", import.meta.url);
      const { css } = await postcss([tailwindcss()]).process(await readFile(stylesheet, "utf8"), { from: fileURLToPath(stylesheet) });
      const screenshots = await mkdtemp(join(tmpdir(), "forge-auth-"));
      const page = await mount({ mode: "login", error: "Your password was updated, but we could not confirm logout. Log in with your new password if asked, then try Log out again." });
      await page.addStyleTag({ content: css });
      for (const [width, height] of [[1440, 900], [390, 844], [320, 740], [844, 390]]) {
        await page.setViewportSize({ width, height });
        const layout = await page.evaluate(() => {
          const notice = document.querySelector('[role="alert"]');
          const form = document.querySelector(".auth-fields");
          const noticeRect = notice.getBoundingClientRect();
          const formRect = form.getBoundingClientRect();
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            noticeOverflow: notice.scrollWidth > notice.clientWidth || notice.scrollHeight > notice.clientHeight,
            noticeInWidth: noticeRect.left >= 0 && noticeRect.right <= innerWidth,
            overlapsForm: noticeRect.bottom > formRect.top,
          };
        });
        assert.deepEqual(layout, { overflow: false, noticeOverflow: false, noticeInWidth: true, overlapsForm: false }, `${width}x${height}`);
        const button = page.getByRole("button", { name: "Log in", exact: true });
        await button.scrollIntoViewIfNeeded();
        await button.click({ trial: true });
        await page.screenshot({ path: join(screenshots, `login-error-${width}x${height}.png`), fullPage: true });
      }
      context.diagnostic(`Synthetic auth screenshots: ${screenshots}`);
    });
    assert.deepEqual(requests, []);
  } finally { await browser.close(); }
});