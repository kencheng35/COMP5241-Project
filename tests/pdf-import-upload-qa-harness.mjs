// Actual Create lesson component and actual PDF importer/worker, with only
// synthetic PDFs and in-memory presentation action mocks. No server or DB.
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import ts from "typescript";
import { mountPresentation, sources } from "./presentation-browser-harness.mjs";

const transpile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  },
}).outputText;
sources.upload = transpile("../src/components/create-lesson.tsx")
  .replaceAll('require("./presentation-editor")', 'require("editor")');
for (const [name, path] of [
  ["@/lib/slide-lesson", "slide-lesson"], ["./learning", "learning"], ["./curriculum", "curriculum"],
]) sources[name] = transpile(`../src/lib/${path}.ts`);
sources["./presentation.ts"] = sources["@/lib/presentation"];
sources["qa-real-pdf-import"] = transpile("../src/lib/pdf-import.ts");
sources["./pdf-worker-url"] = `
  exports.pdfWorkerUrl = "/qa/pdf.worker.mjs";
  exports.pdfImportWorkerUrl = "/qa/import-worker.mjs";
`;
sources["@/lib/pdf-import"] = `
  const actual = require("qa-real-pdf-import");
  exports.validatePdfFile = actual.validatePdfFile;
  exports.fitPdfPage = actual.fitPdfPage;
  exports.renderPdfPages = (file, onPage) =>
    actual.renderPdfPages(file, onPage, {loadPdfjs: () => import("/qa/pdf.mjs")});
`;
const pdfModule = readFileSync(new URL("../node_modules/pdfjs-dist/legacy/build/pdf.mjs", import.meta.url));
const pdfWorker = readFileSync(new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url));
const importWorker = readFileSync(new URL("../src/lib/pdf-import-worker.mjs", import.meta.url));
const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/mk0AAAAASUVORK5CYII=", "base64");
export const uploadQaOwner = "00000000-0000-4000-8000-000000000001";

export async function createUploadQa(width = 320) {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    offline: true, serviceWorkers: "block", viewport: { width, height: 900 },
  });
  const page = await context.newPage();
  const requests = [], errors = [], events = [], saves = [], drafts = new Map();
  const faults = { begin: false, beginGate: null, uploadAt: 0, uploadGate: null, discard: false, discardGate: null };
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin === "https://forge.test") {
      if (url.pathname === "/qa/pdf.mjs") return route.fulfill({ contentType: "text/javascript", body: pdfModule });
      if (url.pathname === "/qa/pdf.worker.mjs") return route.fulfill({ contentType: "text/javascript", body: pdfWorker });
      if (url.pathname === "/qa/import-worker.mjs") return route.fulfill({ contentType: "text/javascript", body: importWorker });
      if (url.pathname.startsWith("/api/presentation/assets/")) return route.fulfill({ contentType: "image/png", body: image });
    }
    requests.push(url.origin);
    return route.abort();
  });
  page.on("pageerror", error => errors.push(error.name));
  await page.exposeFunction("images", async (name, payload) => {
    events.push({ name, payload });
    if (name === "begin") {
      if (faults.beginGate) await faults.beginGate;
      if (faults.begin) return { error: "Synthetic private storage unavailable." };
      const id = crypto.randomUUID();
      drafts.set(id, []);
      return { id };
    }
    if (name === "upload") {
      if (faults.uploadGate) await faults.uploadGate;
      if (faults.uploadAt === events.filter(event => event.name === "upload").length) {
        return { error: "Synthetic image storage failure." };
      }
      if (!drafts.has(payload.draftId)) return { error: "Synthetic draft unavailable." };
      drafts.get(payload.draftId).push(payload.name);
      return { id: crypto.randomUUID(), width: 1080, height: 608 };
    }
    if (name === "discard") {
      const outcome = faults.discard;
      if (faults.discardGate) await faults.discardGate;
      if (outcome === "throw") throw new Error("Synthetic cleanup transport failure.");
      if (outcome === "lost") {
        drafts.delete(payload);
        throw new Error("Synthetic cleanup acknowledgement lost.");
      }
      if (outcome === "empty") return {};
      if (outcome === "conflicting") return { error: "Synthetic private cleanup failure.", success: "Not authoritative." };
      if (outcome) return { error: "Synthetic private cleanup failure." };
      drafts.delete(payload);
      return { success: "Synthetic private pages removed." };
    }
    if (name === "clean") return { success: "Synthetic cleanup complete." };
    throw new Error("Unexpected synthetic action.");
  });
  await page.exposeFunction("persist", async (name, entries) => {
    saves.push({ name, entries });
    return { lessonId: crypto.randomUUID(), version: 1, success: "Saved privately." };
  });
  async function renderUpload(ownerId) {
    await page.evaluate(owner => {
      presentationRoot.render(presentationModules("react").createElement(
        presentationModules("upload").UploadLessonPage, { ownerId: owner },
      ));
    }, ownerId);
    await page.getByLabel("PDF file", { exact: true }).waitFor();
  }
  try {
    await mountPresentation(page);
    await renderUpload(uploadQaOwner);
  } catch (error) {
    await context.close();
    await browser.close();
    throw error;
  }
  return {
    page, events, saves, drafts, faults, requests, errors,
    async remount(ownerId = uploadQaOwner) {
      await page.evaluate(() => presentationRoot.render(null));
      await page.locator("#upload-importer").waitFor({ state: "detached" });
      await renderUpload(ownerId);
    },
    async reload(ownerId = uploadQaOwner) {
      await mountPresentation(page);
      await renderUpload(ownerId);
    },
    async select(bytes, name = "synthetic.pdf") {
      await page.getByLabel("PDF file", { exact: true }).setInputFiles({
        name, mimeType: "application/pdf", buffer: bytes,
      });
    },
    async submitByKeyboard() {
      const input = page.getByLabel("PDF file", { exact: true });
      const submit = page.getByRole("button", { name: "Import PDF pages", exact: true });
      await input.focus();
      await page.keyboard.press("Tab");
      if (!await submit.evaluate(element => element === document.activeElement)) {
        throw new Error("Keyboard focus did not reach the PDF import button.");
      }
      await page.keyboard.press("Enter");
    },
    async close() {
      drafts.clear();
      await context.close();
      await browser.close();
    },
  };
}
