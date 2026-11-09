// A deliberately small, synthetic adversarial fixture. This is an explicit
// unresolved security gate, not a passing regression: PDF.js can trust the
// image dictionary even when the JPEG's own dimensions are larger.
import sharp from "sharp";
import { createPdfBrowserHarness, syntheticPdf } from "./pdf-import-browser-harness.mjs";

const encoded = await sharp({
  create: { width: 2001, height: 2000, channels: 3, background: { r: 0, g: 0, b: 0 } },
}).jpeg({ quality: 30 }).toBuffer();
const pdf = syntheticPdf([{ width: 10, height: 10, encoded, filter: "DCTDecode" }]);
const harness = await createPdfBrowserHarness();
try {
  const result = await harness.importPdf(pdf);
  if (result.count === 1) {
    console.error("UNRESOLVED: PDF.js accepted a JPEG with 4,002,000 encoded pixels declared as 100 pixels.");
    process.exitCode = 1;
  } else if (result.error) {
    console.log("The synthetic mismatched JPEG was rejected:", result.error);
  } else {
    throw new Error("The synthetic mismatch diagnostic produced no conclusive result.");
  }
  if (harness.unexpectedRequests.length || harness.pageErrors.length) {
    throw new Error("The offline browser diagnostic had unexpected requests or page errors.");
  }
} finally {
  await harness.close();
}
