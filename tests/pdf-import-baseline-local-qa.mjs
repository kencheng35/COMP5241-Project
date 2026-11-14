// Aggregate-only local comparison against the committed importer. Neither the
// supplied PDF nor generated images are written, uploaded, or printed.
import { readFile, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { createPdfBrowserHarness } from "./pdf-import-browser-harness.mjs";

const [pdfPath, git] = process.argv.slice(2);
if (!pdfPath || !git || !isAbsolute(pdfPath) || !isAbsolute(git)) {
  throw new Error("Supply absolute paths to a trusted local PDF and an existing Git executable.");
}
const size = (await stat(pdfPath)).size;
if (size < 1 || size > 4 * 1024 * 1024) throw new Error("The PDF must be non-empty and at most 4 MiB.");
const env = process.platform === "win32" ? {
  SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", PATH: "C:\\Windows\\System32;C:\\Windows",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "NUL", GIT_ATTR_NOSYSTEM: "1", GIT_OPTIONAL_LOCKS: "0",
} : { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_OPTIONAL_LOCKS: "0" };
const show = spawnSync(git, ["--no-pager", "show", "HEAD:src/lib/pdf-import.ts"], {
  env, encoding: "utf8", maxBuffer: 1024 * 1024,
});
if (show.error || show.status !== 0 || !show.stdout.includes("maxImageSize: MAX_PDF_PAGE_RENDER_PIXELS")) {
  throw new Error("Could not read the expected committed baseline.");
}
const source = ts.transpileModule(show.stdout, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const bytes = await readFile(pdfPath);
const harness = await createPdfBrowserHarness();
try {
  const current = await harness.importPdf(bytes);
  await harness.page.evaluate(async baseline => {
    const pdfjs = await import("/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
    const mod = { exports: {} };
    const require = name => {
      if (name === "./pdf-worker-url") return { pdfWorkerUrl: "/pdf.worker.mjs" };
      throw new Error("Unexpected baseline dependency.");
    };
    new Function("require", "module", "exports", baseline)(require, mod, mod.exports);
    globalThis.forgePdfImporter = mod.exports;
  }, source);
  const baseline = await harness.importPdf(bytes);
  const summary = result => ({
    count: result.count ?? null,
    failed: Boolean(result.error),
    pages: result.pages.map(({ number, width, height, nonwhitePixels, pngBytes }) =>
      ({ number, width, height, nonwhitePixels, pngBytes })),
  });
  console.log(JSON.stringify({
    sourceBytes: size, current: summary(current), baseline: summary(baseline),
    unexpectedRequests: harness.unexpectedRequests.length, pageErrors: harness.pageErrors.length,
  }));
  if (current.error || baseline.error || harness.unexpectedRequests.length || harness.pageErrors.length) process.exitCode = 1;
} finally {
  await harness.close();
}
