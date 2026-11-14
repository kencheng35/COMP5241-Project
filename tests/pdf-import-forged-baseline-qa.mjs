// Opt-in synthetic diagnostic; compares the current importer with the
// committed pre-fix importer. The largest fixture is only 2001 x 2000.
import { isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import ts from "typescript";
import { createPdfBrowserHarness, syntheticPdf } from "./pdf-import-browser-harness.mjs";

const git = process.argv[2];
if (!git || !isAbsolute(git)) throw new Error("Supply the absolute path to the existing Git executable.");
const env = process.platform === "win32" ? {
  SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", PATH: "C:\\Windows\\System32;C:\\Windows",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "NUL", GIT_ATTR_NOSYSTEM: "1", GIT_OPTIONAL_LOCKS: "0",
} : { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_OPTIONAL_LOCKS: "0" };
function gitOutput(args) {
  const result = spawnSync(git, ["--no-pager", ...args], { env, encoding: "utf8", maxBuffer: 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error("Could not read the committed local importer.");
  return result.stdout.trim();
}
const baseline = gitOutput(["show", "HEAD:src/lib/pdf-import.ts"]);
const revision = gitOutput(["rev-parse", "--short", "HEAD"]);
if (!baseline.includes("maxImageSize: MAX_PDF_PAGE_RENDER_PIXELS")) {
  throw new Error("The committed baseline no longer has the expected pre-fix limit.");
}
const baselineJs = ts.transpileModule(baseline, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2001" height="2000">
  <rect x="0" y="0" width="1000" height="1000" fill="#ff0000"/>
  <rect x="1000" y="0" width="1001" height="1000" fill="#00ff00"/>
  <rect x="0" y="1000" width="1000" height="1000" fill="#0000ff"/>
  <rect x="1000" y="1000" width="1001" height="1000" fill="#ffff00"/>
</svg>`);
const jpeg = await sharp(svg).jpeg({ quality: 80 }).toBuffer();
const meta = await sharp(jpeg).metadata();
if (meta.width !== 2001 || meta.height !== 2000) throw new Error("Unexpected synthetic JPEG dimensions.");
const pdf = syntheticPdf([{ width: 10, height: 10, encoded: jpeg, filter: "DCTDecode" }]);
const harness = await createPdfBrowserHarness();
try {
  async function measure() {
    return harness.page.evaluate(async base64 => {
      const pdfjs = await import("/pdf.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.mjs";
      const data = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
      const file = new File([data], "synthetic.pdf", { type: "application/pdf" });
      const pages = [];
      try {
        const count = await globalThis.forgePdfImporter.renderPdfPages(file, async (number, image, width, height) => {
          const bitmap = await createImageBitmap(image);
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          const context = canvas.getContext("2d");
          context.drawImage(bitmap, 0, 0);
          const samples = [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]].map(([x, y]) =>
            Array.from(context.getImageData(Math.floor(width * x), Math.floor(height * y), 1, 1).data).slice(0, 3));
          pages.push({ number, width, height, samples });
          bitmap.close(); canvas.width = 0; canvas.height = 0;
        }, { loadPdfjs: async () => pdfjs });
        return { count, pages };
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Import failed.", pages };
      }
    }, pdf.toString("base64"));
  }
  const current = await measure();
  await harness.page.evaluate(source => {
    const mod = { exports: {} };
    const require = name => {
      if (name === "./pdf-worker-url") return { pdfWorkerUrl: "/pdf.worker.mjs" };
      throw new Error("Unexpected baseline dependency.");
    };
    new Function("require", "module", "exports", source)(require, mod, mod.exports);
    globalThis.forgePdfImporter = mod.exports;
  }, baselineJs);
  const previous = await measure();
  if (harness.unexpectedRequests.length || harness.pageErrors.length) throw new Error("Unexpected browser activity.");
  console.log(JSON.stringify({
    revision, encodedDimensions: [meta.width, meta.height], declaredDimensions: [10, 10],
    currentSourceCap: 4_000_000, baselineSourceCap: 2_073_600,
    current, baseline: previous, unexpectedRequests: 0, pageErrors: 0,
  }));
  if (previous.count !== 1) throw new Error("The committed baseline no longer reproduces the mismatch.");
  if (current.count === 1) {
    console.error("UNRESOLVED: the current importer accepts the understated synthetic JPEG dimensions.");
    process.exitCode = 1;
  } else if (!current.error) {
    throw new Error("The current synthetic mismatch result is inconclusive.");
  }
} finally {
  await harness.close();
}
