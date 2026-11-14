// Entirely synthetic, in-memory PDF fixtures; no server or private PDF.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { chromium, firefox, webkit } from "@playwright/test";
import { createPdfBrowserHarness, syntheticPdf } from "./pdf-import-browser-harness.mjs";

for (const browserType of [chromium, firefox, webkit]) {
  const name = browserType.name();
  const skip = existsSync(browserType.executablePath()) ? false : `${name} is not installed; no download attempted`;
  test(`network-blocked ${name}: synthetic color placement, limits, and blank pages`, { skip }, async () => {
    // WebKit's offline flag also blocks in-memory File.arrayBuffer(). Its
    // alternative still aborts every request and disables network APIs.
    const harness = await createPdfBrowserHarness({
      browserType, embeddedResources: true, routeOnly: name === "webkit",
    });
    try {
      const bounded = await harness.importPdf(syntheticPdf([{ width: 2000, height: 2000 }]));
      assert.equal(bounded.error, undefined);
      assert.equal(bounded.count, 1);
      assert.deepEqual(bounded.pages.map(({ width, height }) => [width, height]), [[1080, 608]]);
      assert.ok(bounded.pages[0].nonwhitePixels > 0);

      const rgb = Buffer.alloc(8 * 8 * 3);
      const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const color = colors[(y >= 4 ? 2 : 0) + (x >= 4 ? 1 : 0)];
        for (let channel = 0; channel < 3; channel++) rgb[(y * 8 + x) * 3 + channel] = color[channel];
      }
      const colored = await harness.importPdf(
        syntheticPdf([{ width: 8, height: 8, encoded: deflateSync(rgb) }]),
        { samplePositions: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]] },
      );
      assert.equal(colored.error, undefined);
      assert.equal(colored.count, 1);
      for (let point = 0; point < colors.length; point++) for (let channel = 0; channel < 3; channel++) {
        assert.ok(Math.abs(colored.pages[0].samples[point][channel] - colors[point][channel]) <= 1,
          `Synthetic color mismatch at point ${point}, channel ${channel}`);
      }

      const oversized = await harness.importPdf(syntheticPdf([{ width: 2001, height: 2000, background: true }]));
      assert.match(oversized.error, /4,000,000-pixel source limit/);
      assert.deepEqual(oversized.pages, []);

      const blank = await harness.importPdf(syntheticPdf([{ blank: true }]));
      assert.equal(blank.error, undefined);
      assert.equal(blank.count, 1);
      assert.equal(blank.pages[0].nonwhitePixels, 0);
      const tooMany = await harness.importPdf(syntheticPdf(Array.from({ length: 31 }, () => ({ blank: true }))));
      assert.match(tooMany.error, /1–30 pages/);
      assert.deepEqual(tooMany.pages, []);
      assert.deepEqual(harness.unexpectedRequests, []);
      assert.deepEqual(harness.pageErrors, []);
    } finally {
      await harness.close();
    }
  });
}
