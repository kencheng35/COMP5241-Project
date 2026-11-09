// Opt-in local diagnostic. It prints only aggregate dimensions and whether
// each rendered page contains any non-white pixels; it never uploads or saves
// the source PDF or generated page images.
import { readFile, stat } from "node:fs/promises";
import { createPdfBrowserHarness } from "./pdf-import-browser-harness.mjs";

const path = process.argv[2];
if (!path) throw new Error("Supply the path to a trusted local PDF.");
const size = (await stat(path)).size;
if (size < 1 || size > 4 * 1024 * 1024) throw new Error("The local PDF must be non-empty and at most 4 MiB.");
const bytes = await readFile(path);
const harness = await createPdfBrowserHarness();
try {
  const result = await harness.importPdf(bytes);
  console.log(JSON.stringify({
    bytes: bytes.length,
    pageCount: result.count ?? null,
    error: result.error ?? null,
    pages: result.pages.map(({ width, height, nonwhitePixels, pngBytes }) => ({
      width, height, nonwhite: nonwhitePixels > 0, withinImageUploadLimit: pngBytes <= 4 * 1024 * 1024,
    })),
    unexpectedRequestCount: harness.unexpectedRequests.length,
    pageErrorCount: harness.pageErrors.length,
  }));
  if (result.error || result.pages.some(page => page.pngBytes > 4 * 1024 * 1024) ||
      harness.unexpectedRequests.length || harness.pageErrors.length) process.exitCode = 1;
} finally {
  await harness.close();
}
