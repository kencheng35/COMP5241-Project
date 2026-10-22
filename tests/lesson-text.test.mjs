import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "@playwright/test";
import ts from "typescript";
import { DEMO_LESSON_IDS, getDemoLessonStarter } from "../src/lib/demo-lessons.ts";

const require = createRequire(import.meta.url);
const transpile = file => ts.transpileModule(readFileSync(new URL(`../src/components/${file}.tsx`, import.meta.url), "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const preview = { exports: {} };
new Function("require", "module", "exports", transpile("lesson-preview"))(name => {
  if (name === "./lesson-metadata") return { LessonMetadata: () => null };
  return require(name);
}, preview, preview.exports);
const { LessonText } = preview.exports;
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8").replace('@import "tailwindcss";', "");
// ASCII-escaped Unicode avoids Windows stdin/source-encoding fixture ambiguity.
const unicodePairs = [
  ["https://example.org/\u8cc7\u6599", "https://example.org/%E8%B3%87%E6%96%99"],
  ["https://example.org/\ud83d\ude00?q=\u8cc7\u6599%20x%26y%3Dz%2F%3F%23%25#\u7bc0\ud83d\ude00",
    "https://example.org/%F0%9F%98%80?q=%E8%B3%87%E6%96%99%20x%26y%3Dz%2F%3F%23%25#%E7%AF%80%F0%9F%98%80"],
];
const rejectedUtf8 = [
  "%", "%2", "%GG", "%80", "%9F", "%FF", "%E8%B3", "%E2%28%A1",
  "%C0%AF", "%E0%80%AF", "%F0%80%80%AF", "%ED%A0%80", "%F4%90%80%80", "%F5%80%80%80",
  "%00", "%0A", "%0D", "%1F", "%7F", "%C2%80", "%C2%9F", "%C2%AD", "%E2%80%8B",
].map(suffix => `https://example.org/${suffix}https://evil.org`);

test("production LessonText: exact escaped text, conservative HTTPS links and real preview/player parity (offline)", async context => {
  assert.equal(typeof LessonText, "function", "the shared production renderer must be exported");
  const fetches = [];
  context.mock.method(globalThis, "fetch", async url => { fetches.push(String(url)); throw new Error("No network"); });
  const browser = await chromium.launch();
  const bc = await browser.newContext({ offline: true, serviceWorkers: "block" });
  context.after(async () => { await bc.close(); await browser.close(); });
  const requests = [], errors = [];
  await bc.route("**/*", route => { requests.push(route.request().url()); return route.abort(); });
  const page = await bc.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const artifacts = await mkdtemp(join(tmpdir(), "forge-lesson-text-"));
  context.diagnostic(`Reference UI screenshots (inspection reported separately): ${artifacts}; Chromium ${browser.version()}`);
  const sources = Object.fromEntries([
    ["react", "react", "react.development.js"], ["react/jsx-runtime", "react", "react-jsx-runtime.development.js"],
    ["react-dom", "react-dom", "react-dom.development.js"], ["react-dom/client", "react-dom", "react-dom-client.development.js"],
    ["scheduler", "scheduler", "scheduler.development.js"],
  ].map(([name, pkg, file]) => [name, readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "cjs", file), "utf8")]));
  sources["./lesson-preview"] = transpile("lesson-preview");
  sources.player = transpile("learning-controls");
  await page.setContent('<div id="text-root"></div>');
  await page.evaluate(sources => {
    const modules = {};
    function load(name) {
      if (name === "./lesson-metadata") return { LessonMetadata: () => null };
      if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
      if (!modules[name]) {
        if (!sources[name]) throw new Error(`Unexpected dependency ${name}`);
        const mod = { exports: {} }; modules[name] = mod;
        new Function("require", "module", "exports", "process", sources[name])(load, mod, mod.exports, { env: { NODE_ENV: "development" } });
      }
      return modules[name].exports;
    }
    const root = load("react-dom/client").createRoot(document.getElementById("text-root"));
    window.renderLessonText = text => load("react-dom").flushSync(() => root.render(
      load("react").createElement(load("./lesson-preview").LessonText, { text })));
    window.unmountLessonText = () => root.unmount();
  }, sources);

  async function check(text, urls) {
    await page.evaluate(text => window.renderLessonText(text), text);
    assert.equal(await page.locator(".lesson-text").textContent(), text, "no text deletion or normalization");
    assert.deepEqual(await page.locator("a").evaluateAll(links => links.map(link => ({
      text: link.textContent, href: link.getAttribute("href"), target: link.target,
      rel: link.rel, policy: link.referrerPolicy, label: link.getAttribute("aria-label"),
    }))), urls.map(url => ({
      text: url, href: url, target: "_blank", rel: "noopener noreferrer", policy: "no-referrer",
      label: `${url} (external link, opens in a new tab; reference not verified)`,
    })), `Unexpected link shape for ${JSON.stringify(text)}`);
    assert.equal(await page.locator("script,img,iframe").count(), 0);
  }

  await context.test("starter references, multiple URLs, Unicode, query/fragment and sentence delimiters", async () => {
    for (const id of DEMO_LESSON_IDS) {
      const starter = getDemoLessonStarter(id);
      await check(starter.content.slides.at(-1).example, starter.references.map(reference => reference.url));
    }
    await check("  Ordinary < & > text.\n  Indented 😀\n", []);
    await check("prefixhttps://example.org remains plain; customtextlike 'prefixhttps://' too.", []);
    await check("\n See (https://example.org/a_(b)).\nNext: https://例子.香港/資料?q=一&two=2#節;\n ",
      ["https://example.org/a_(b)", "https://例子.香港/資料?q=一&two=2#節"]);
    await check("https://example.org/a_(b(c))?q=x%20y#part! https://example.org:8443/path, https://example.org/end.",
      ["https://example.org/a_(b(c))?q=x%20y#part", "https://example.org:8443/path", "https://example.org/end"]);
    await check("[https://example.org/resource] {https://example.org/other}.", ["https://example.org/resource", "https://example.org/other"]);
    await check("HTTPS://example.org/path https://192.0.2.1/path https://[2001:db8::1]/path",
      ["HTTPS://example.org/path", "https://192.0.2.1/path", "https://[2001:db8::1]/path"]);
  });

  await context.test("complete percent-encoded UTF-8 links without rewriting; invalid sequences and actual controls stay literal", async () => {
    for (const [literal, encoded] of unicodePairs) {
      assert.equal(new URL(literal).href, new URL(encoded).href, "fixtures must represent equivalent URLs");
      await check(`Literal: ${literal}\nEncoded: ${encoded}`, [literal, encoded]);
    }
    for (const text of rejectedUtf8) await check(text, []);
  });

  await context.test("rejected schemes/tokens, credentials, controls, malformed URLs and markup never yield nested anchors", async () => {
    for (const text of [
      "javascript:https://example.org/x", "data:https://example.org", "http://example.org/https://other.org",
      "//example.org/https://other.org", "ftp:https://example.org", "prefixhttps://example.org",
      "https://user:password@example.org", "https://@example.org", "https://example.org@evil.org",
      "https://", "https:///example.org", "https:example.org", "https://localhost", "https://bad_host.org",
      "https://.example.org", "https://example..org", "https://-bad.org", "https://example.org:bad",
      "https://example.org:", "https://example.org:99999", "https://2130706433", "https://127.1",
      "(javascript:https://example.org)", "https://example.org\n.evil.org", "https://example.org\r\n@evil.org",
      "https://example.org\\@evil.org", "https://example.org/%zz", "https://example.org/%0ahttps://evil.org",
      "https://exam\tple.org", "https://exam\nple.org", "https://example.org\t@evil.org",
      "https://example.org\n@evil.org", "https://example.org /@evil.org",
      "https://example.org/\u0000https://evil.org", "https://example.org/\u200bhttps://evil.org",
      '<a href="https://example.org">source</a>', "<script> https://example.org </script>",
      '<img src=x onerror="https://example.org">', 'href="https://example.org"',
    ]) await check(text, []);
  });

  const content = structuredClone(getDemoLessonStarter(DEMO_LESSON_IDS[0]).content);
  const longUrl = `https://example.org/${"long-path-".repeat(35)}?q=資料#reference`;
  content.slides[0].body = `  Reference:\n${longUrl}.\n `;
  content.slides[0].example = "Example: https://example.org/a_(b)?q=1&x=2#part.";
  content.slides[0].title = "Plain heading https://example.org/not-a-link";
  content.questions[0].prompt = "Plain question https://example.org/not-a-link";
  const unicodeUrls = unicodePairs.flat();
  for (const [literal, encoded] of unicodePairs) assert.equal(new URL(literal).href, new URL(encoded).href);
  content.slides[1].body = `  Equivalent references:\n${unicodeUrls.join("\n")}\n `;
  content.slides[1].example = rejectedUtf8.join("\n");
  const actions = [];
  await page.exposeFunction("lessonAction", (name, args) => { actions.push({ name, args }); throw new Error("No action expected"); });
  await page.evaluate(() => window.unmountLessonText());
  await page.setContent(`<style>${css}</style><main class="portal-page"><div id="root"></div></main>`);
  await page.evaluate(({ sources, content }) => {
    const modules = {};
    function load(name) {
      if (name === "./lesson-metadata") return { LessonMetadata: () => null, MetadataFields: () => null };
      if (name === "lucide-react") return new Proxy({}, { get: () => () => null });
      if (name === "next/link") return { __esModule: true, default: ({ children, ...props }) => load("react").createElement("a", props, children) };
      if (name === "@/app/learning/actions") return new Proxy({}, { get: (_, name) => (...args) => window.lessonAction(name, args) });
      if (!modules[name]) {
        if (!sources[name]) throw new Error(`Unexpected dependency ${name}`);
        const mod = { exports: {} }; modules[name] = mod;
        new Function("require", "module", "exports", "process", sources[name])(load, mod, mod.exports, { env: { NODE_ENV: "development" } });
      }
      return modules[name].exports;
    }
    const { questions, ...slides } = content;
    window.lessonRoot = load("react-dom/client").createRoot(document.getElementById("root"));
    lessonRoot.render(load("react").createElement(load("react").Fragment, null,
      load("react").createElement(load("./lesson-preview").LessonPreview, { content }),
      load("react").createElement(load("player").LessonPlayer, {
        id: "offline", version: 1, saved: null, revision: 0, resumeAvailable: false,
        content: { ...slides, questions: questions.map(({ prompt, options }) => ({ prompt, options })) },
      })));
  }, { sources, content });
  await page.locator(".slide-stage").waitFor();
  for (const width of [320, 1440]) {
    await context.test(`mounted preview and player keep identical text/links, keyboard and overflow at ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      const playerText = page.locator(".slide-stage .lesson-text");
      const expectedText = [content.slides[0].body, content.slides[0].example];
      assert.deepEqual(await playerText.allTextContents(), expectedText);
      const playerLinks = await playerText.locator("a").evaluateAll(links => links.map(link => [link.textContent, link.getAttribute("href")]));
      assert.equal(playerLinks.length, 2);
      assert.equal(await page.locator(".slide-stage h2 a").count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await playerText.locator("a").first().focus();
      assert.equal(await page.locator(":focus").getAttribute("href"), longUrl);
      await page.keyboard.press("Tab");
      assert.equal(await playerText.locator("a").nth(1).evaluate(link => link === document.activeElement), true);
      await page.screenshot({ path: join(artifacts, `player-links-${width}.png`), fullPage: true });
      const trigger = page.getByRole("button", { name: "Preview lesson", exact: true });
      await trigger.focus(); await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      assert.deepEqual((await dialog.locator(".lesson-text").allTextContents()).slice(0, 2), expectedText);
      assert.deepEqual(await dialog.locator("section").first().locator("a").evaluateAll(links => links.map(link => [link.textContent, link.getAttribute("href")])), playerLinks);
      assert.equal(await dialog.locator("h3 a,li a").count(), 0, "headings/questions/options remain plain");
      await dialog.locator("section a").first().focus();
      await page.keyboard.press("Tab");
      assert.equal(await dialog.locator("section a").nth(1).evaluate(link => link === document.activeElement), true);
      assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), true);
      await dialog.locator("section").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(artifacts, `preview-links-${width}.png`) });
      await page.keyboard.press("Escape");
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
    });
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("heading", { name: content.slides[1].title, exact: true }).waitFor();
  await context.test("encoded CJK/emoji path/query/fragment parity in actual full preview and learner player", async () => {
    const expectedText = [content.slides[1].body, content.slides[1].example];
    const expectedLinks = unicodeUrls.map(url => [url, url]);
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const playerText = page.locator(".slide-stage .lesson-text");
      assert.deepEqual(await playerText.allTextContents(), expectedText);
      assert.deepEqual(await playerText.locator("a").evaluateAll(links => links.map(link => [link.textContent, link.getAttribute("href")])), expectedLinks);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: join(artifacts, `player-unicode-${width}.png`), fullPage: true });
      await page.getByRole("button", { name: "Preview lesson", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.waitFor();
      const previewText = dialog.locator("section").nth(1).locator(".lesson-text");
      assert.deepEqual(await previewText.allTextContents(), expectedText);
      assert.deepEqual(await previewText.locator("a").evaluateAll(links => links.map(link => [link.textContent, link.getAttribute("href")])), expectedLinks);
      await previewText.first().scrollIntoViewIfNeeded();
      assert.equal(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth), true);
      await page.screenshot({ path: join(artifacts, `preview-unicode-${width}.png`) });
      await page.keyboard.press("Escape");
    }
  });
  assert.deepEqual(actions, [], "display, preview and slide advance must not call actions when resume is unavailable");
  assert.deepEqual(requests, []); assert.deepEqual(fetches, []); assert.deepEqual(errors, []);
});
