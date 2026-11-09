// Opt-in local QA. The supplied PDF and page images stay in process memory;
// this script writes no fixtures or images and prints only aggregate metrics.
// The independent reference is the locally installed PyMuPDF renderer.
import { readFile, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { sanitizePresentationImage } from "../src/lib/presentation-images.ts";
import { createPdfBrowserHarness } from "./pdf-import-browser-harness.mjs";

const [pdfPath, python] = process.argv.slice(2);
if (!pdfPath || !python || !isAbsolute(pdfPath) || !isAbsolute(python)) {
  throw new Error("Supply absolute paths to a trusted local PDF and an existing Python executable.");
}
const size = (await stat(pdfPath)).size;
if (size < 1 || size > 4 * 1024 * 1024) throw new Error("The PDF must be non-empty and at most 4 MiB.");

// No clipping or resizing is performed. Both renderers use the complete
// page and exactly the importer's scale; size disagreements are failures.
const referenceScript = String.raw`
import io, json, math, sys
import numpy as np
import pymupdf
from PIL import Image

with pymupdf.open(sys.argv[1]) as doc:
    page = doc[int(sys.argv[2]) - 1]
    width, height = page.rect.width, page.rect.height
    scale = min(1.5, math.sqrt(2073600 / (width * height)), 3840 / width, 3840 / height)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale),
                          colorspace=pymupdf.csRGB, alpha=False, annots=True)
    output = np.asarray(Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB"))
    reference = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
    result = {
        "documentPages": len(doc), "pagePoints": [width, height], "rotation": page.rotation,
        "scale": scale, "referenceSize": [pix.width, pix.height],
        "outputSize": [int(output.shape[1]), int(output.shape[0])]
    }
    if output.shape == reference.shape:
        delta = np.abs(output.astype(np.int16) - reference.astype(np.int16))
        maximum = delta.max(axis=2)
        total = int(maximum.size)
        referenceInk = np.any(reference < 245, axis=2)
        outputInk = np.any(output < 245, axis=2)
        ys, xs = np.nonzero(maximum > 32)
        tileErrors = [
            float(delta[y:y+32, x:x+32].mean())
            for y in range(0, pix.height, 32) for x in range(0, pix.width, 32)
        ]
        result.update({
            "pixels": total,
            "exactPixels": int(np.count_nonzero(maximum == 0)),
            "differentPixels": int(np.count_nonzero(maximum != 0)),
            "over16": int(np.count_nonzero(maximum > 16)),
            "over32": int(np.count_nonzero(maximum > 32)),
            "over64": int(np.count_nonzero(maximum > 64)),
            "meanAbsoluteChannelError": round(float(delta.mean()), 6),
            "maximumChannelError": int(delta.max()),
            "referenceInkPixels": int(np.count_nonzero(referenceInk)),
            "outputInkPixels": int(np.count_nonzero(outputInk)),
            "referenceInkMissingInOutput": int(np.count_nonzero(referenceInk & ~outputInk)),
            "outputInkAbsentInReference": int(np.count_nonzero(outputInk & ~referenceInk)),
            "lastRowOutputWhitePixels": int(np.count_nonzero(np.all(output[-1] >= 245, axis=1))),
            "lastRowReferenceWhitePixels": int(np.count_nonzero(np.all(reference[-1] >= 245, axis=1))),
            "lastRowOver32": int(np.count_nonzero(maximum[-1] > 32)),
            "over32ExcludingLastRow": int(np.count_nonzero(maximum[:-1] > 32)),
            "tiles32": len(tileErrors),
            "tiles32MeanErrorOver10": sum(error > 10 for error in tileErrors),
            "tiles32MeanErrorOver32": sum(error > 32 for error in tileErrors),
            "maximumTile32MeanError": round(max(tileErrors), 6),
            "over32BoundingBox": None if not len(xs) else [
                int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
            ]
        })
    print(json.dumps(result, separators=(",", ":")))
`;

const harness = await createPdfBrowserHarness();
try {
  const bytes = await readFile(pdfPath);
  const result = await harness.page.evaluate(async base64 => {
    const pdfjs = await import("/pdf.mjs");
    const data = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
    const file = new File([data], "local-test.pdf", { type: "application/pdf" });
    const pages = [];
    try {
      const count = await globalThis.forgePdfImporter.renderPdfPages(file, async (number, image, width, height) => {
        const encoded = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error("Could not read the generated image."));
          reader.readAsDataURL(image);
        });
        pages.push({
          number, width, height, pngBytes: image.size, encoded,
          placement: globalThis.forgePdfImporter.fitPdfPage(width, height),
        });
      }, { loadPdfjs: async () => pdfjs });
      return { count, pages };
    } catch {
      return { failed: true, pages };
    }
  }, bytes.toString("base64"));
  if (result.failed || result.count !== result.pages.length || harness.unexpectedRequests.length || harness.pageErrors.length) {
    throw new Error("The local import did not complete cleanly; no document data is printed.");
  }

  const comparisons = [];
  for (const page of result.pages) {
    const original = Buffer.from(page.encoded, "base64");
    delete page.encoded;
    const sanitized = await sanitizePresentationImage(original);
    const before = await sharp(original).removeAlpha().raw().toBuffer();
    const after = await sharp(sanitized.data).removeAlpha().raw().toBuffer();
    let changedChannels = 0;
    if (before.length === after.length) {
      for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) changedChannels++;
    } else {
      changedChannels = -1;
    }
    const run = spawnSync(python, ["-I", "-c", referenceScript, pdfPath, String(page.number)], {
      input: sanitized.data,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
      timeout: 60_000,
      // The child receives only fixed OS defaults, never the caller's environment.
      env: process.platform === "win32" ? { SystemRoot: "C:\\Windows", WINDIR: "C:\\Windows" } : {},
    });
    if (run.error || run.status !== 0) throw new Error("The offline reference renderer failed.");
    const reference = JSON.parse(run.stdout);
    if (reference.documentPages !== result.count || reference.outputSize[0] !== reference.referenceSize[0] ||
        reference.outputSize[1] !== reference.referenceSize[1] || !("exactPixels" in reference) ||
        sanitized.width !== page.width || sanitized.height !== page.height || changedChannels < 0) {
      throw new Error("Page count or full-page image dimensions did not match.");
    }
    comparisons.push({
      ...page, sanitizedBytes: sanitized.data.length, sanitizerChangedChannels: changedChannels, reference,
    });
  }
  console.log(JSON.stringify({
    sourceBytes: size, pageCount: result.count, comparisons,
    unexpectedRequests: harness.unexpectedRequests.length, pageErrors: harness.pageErrors.length,
    note: "Full-page, same-scale RGB metrics only; no completeness or visual-acceptance threshold is claimed.",
  }));
} finally {
  await harness.close();
}
