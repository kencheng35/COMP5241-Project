// Small, valid, synthetic JPEG-2000 compatibility reproducer. No files are
// written; the independent local renderer and the browser consume memory.
import { isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";
import { createPdfBrowserHarness, syntheticPdf } from "./pdf-import-browser-harness.mjs";

const [python, git] = process.argv.slice(2);
if (!python || !git || !isAbsolute(python) || !isAbsolute(git)) {
  throw new Error("Supply absolute paths to the existing Python and Git executables.");
}
const env = process.platform === "win32" ? {
  SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows", PATH: "C:\\Windows\\System32;C:\\Windows",
  GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "NUL", GIT_OPTIONAL_LOCKS: "0",
} : { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_OPTIONAL_LOCKS: "0" };
const generator = `
import io, sys
from PIL import Image
out = io.BytesIO()
Image.new("RGB", (16, 16), (255, 0, 0)).save(out, format="JPEG2000")
sys.stdout.buffer.write(out.getvalue())
`;
const generated = spawnSync(python, ["-I", "-c", generator], { env, maxBuffer: 1024 * 1024 });
if (generated.error || generated.status !== 0) throw new Error("The local JPEG-2000 encoder is unavailable.");
const pdf = syntheticPdf([{ width: 16, height: 16, encoded: generated.stdout, filter: "JPXDecode" }]);
const referenceScript = `
import json, sys, pymupdf
with pymupdf.open(stream=sys.stdin.buffer.read(), filetype="pdf") as doc:
    pix = doc[0].get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), colorspace=pymupdf.csRGB, alpha=False)
    index = ((pix.height // 2) * pix.width + pix.width // 2) * 3
    print(json.dumps({"pages": len(doc), "size": [pix.width, pix.height], "centerRGB": list(pix.samples[index:index+3])}))
`;
const ref = spawnSync(python, ["-I", "-c", referenceScript], {
  env, input: pdf, encoding: "utf8", maxBuffer: 1024 * 1024,
});
if (ref.error || ref.status !== 0) throw new Error("The local reference renderer failed.");
const reference = JSON.parse(ref.stdout);
const show = spawnSync(git, ["--no-pager", "show", "HEAD:src/lib/pdf-import.ts"], {
  env, encoding: "utf8", maxBuffer: 1024 * 1024,
});
if (show.error || show.status !== 0 || !show.stdout.includes("maxImageSize: MAX_PDF_PAGE_RENDER_PIXELS")) {
  throw new Error("Could not read the expected committed baseline.");
}
const source = ts.transpileModule(show.stdout, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const harness = await createPdfBrowserHarness();
try {
  const current = await harness.importPdf(pdf, { samplePositions: [[0.5, 0.5]] });
  await harness.page.waitForTimeout(300);
  const currentPageErrors = harness.pageErrors.length;
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
  const baseline = await harness.importPdf(pdf, { samplePositions: [[0.5, 0.5]] });
  console.log(JSON.stringify({
    encodedBytes: generated.stdout.length, reference, current, baseline,
    currentPageErrors, unexpectedRequests: harness.unexpectedRequests.length,
  }));
  if (reference.pages === 1 && reference.centerRGB.join(",") === "255,0,0" &&
      /could not be rendered reliably/.test(current.error ?? "") && current.pages.length === 0 &&
      baseline.count === 1 && baseline.pages[0].samples[0].join(",") === "255,255,255" &&
      !harness.unexpectedRequests.length) {
    console.error("FAIL: the valid JPEG-2000 page is rejected; the committed importer silently produced white.");
    process.exitCode = 1;
  } else {
    throw new Error("The synthetic JPEG-2000 scenario changed; review its assertions.");
  }
} finally {
  await harness.close();
}
