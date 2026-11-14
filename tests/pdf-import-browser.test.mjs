import test from "node:test";
import assert from "node:assert/strict";
import { createPdfBrowserHarness, syntheticPdf } from "./pdf-import-browser-harness.mjs";

test("real PDF.js worker preserves bounded images and rejects omitted image content", async t => {
  const harness = await createPdfBrowserHarness();
  try {
    await t.test("images just below and exactly at the source cap render within output bounds", async () => {
      for (const width of [1999, 2000]) {
        const result = await harness.importPdf(syntheticPdf([{ width, height: 2000 }]));
        assert.equal(result.error, undefined);
        assert.equal(result.count, 1);
        assert.deepEqual(result.pages.map(({ width, height }) => [width, height]), [[1080, 608]]);
        assert.ok(result.pages[0].nonwhitePixels > 0);
        assert.ok(result.pages[0].pngBytes <= 4 * 1024 * 1024);
      }
    });
    await t.test("oversized image fails even when other visible content remains", async () => {
      const result = await harness.importPdf(syntheticPdf([{ width: 2001, height: 2000, background: true }]));
      assert.match(result.error, /4,000,000-pixel source limit/);
      assert.deepEqual(result.pages, []);
    });
    await t.test("oversized inline and nested form images fail instead of being omitted", async () => {
      for (const placement of ["inline", "form"]) {
        const result = await harness.importPdf(syntheticPdf([{ width: 2001, height: 2000, [placement]: true }]));
        assert.match(result.error, /4,000,000-pixel source limit/, placement);
        assert.deepEqual(result.pages, []);
      }
    });
    await t.test("an oversized annotation appearance is not silently discarded", async () => {
      const result = await harness.importPdf(syntheticPdf([{ width: 2001, height: 2000, annotation: true, background: true }]));
      assert.match(result.error, /4,000,000-pixel source limit/);
      assert.deepEqual(result.pages, []);
    });
    await t.test("an oversized decoded soft mask is rejected", async () => {
      const result = await harness.importPdf(syntheticPdf([{ width: 2, height: 2, mask: { width: 2001, height: 2000 } }]));
      assert.match(result.error, /4,000,000-pixel source limit/);
      assert.deepEqual(result.pages, []);
    });
    await t.test("damaged image data fails instead of producing an incomplete slide", async () => {
      for (const defect of ["broken", "missingWidth"]) {
        const result = await harness.importPdf(syntheticPdf([{ width: 100, height: 100, [defect]: true }]));
        assert.match(result.error, /could not be rendered reliably/, defect);
        assert.deepEqual(result.pages, []);
      }
    });
    await t.test("legitimate blank and white-image pages are accepted", async () => {
      const result = await harness.importPdf(syntheticPdf([{ blank: true }, { width: 3, height: 3, white: true }]));
      assert.equal(result.error, undefined);
      assert.equal(result.count, 2);
      assert.deepEqual(result.pages.map(page => page.nonwhitePixels), [0, 0]);
    });
    await t.test("a later-page failure never uploads that page", async () => {
      const result = await harness.importPdf(syntheticPdf([
        { width: 2, height: 2 },
        { width: 2001, height: 2000, background: true },
      ]));
      assert.match(result.error, /4,000,000-pixel source limit/);
      assert.deepEqual(result.pages.map(page => page.number), [1]);
    });
    await t.test("worker warning signals never expose their text", async () => {
      const signals = await harness.page.evaluate(async () => {
        const worker = new Worker("/import-worker.mjs", { type: "module" });
        const messages = [];
        try {
          return await new Promise((resolve, reject) => {
            worker.addEventListener("message", event => {
              messages.push(event.data);
              if (event.data?.forgePdfImport === "worker-error") resolve(messages);
            });
            worker.addEventListener("error", reject);
            worker.postMessage({ forgePdfImport: "initialize", workerSrc: new URL("/warning-worker.mjs", location.href).href, maxImageSize: 4_000_000 });
          });
        } finally {
          worker.terminate();
        }
      });
      assert.deepEqual(signals.map(signal => signal.forgePdfImport), ["unreliable", "worker-error"]);
      assert.doesNotMatch(JSON.stringify(signals), /synthetic-private-warning-marker/);
    });
    await t.test("the worker bridge reports stream errors and blocks failed or oversized image transfers", async () => {
      const messages = await harness.page.evaluate(async () => {
        const worker = new Worker("/import-worker.mjs", { type: "module" });
        const messages = [];
        try {
          return await new Promise((resolve, reject) => {
            worker.addEventListener("message", event => {
              messages.push(event.data);
              if (event.data?.forgePdfImport === "ready") resolve(messages);
            });
            worker.addEventListener("error", reject);
            worker.postMessage({ forgePdfImport: "initialize", workerSrc: new URL("/protocol-worker.mjs", location.href).href, maxImageSize: 4_000_000 });
          });
        } finally {
          worker.terminate();
        }
      });
      assert.deepEqual(messages.filter(message => message.forgePdfImport).map(message => message.forgePdfImport),
        ["source-limit", "unreliable", "unreliable", "source-limit", "ready"]);
      assert.equal(messages.filter(message => message.stream === 5).length, 1);
      assert.deepEqual(messages.filter(message => message.action === "obj").map(message => message.data[0]), ["valid"]);
      assert.equal(messages.filter(message => message.action === "commonobj").length, 0);
    });
    assert.deepEqual(harness.unexpectedRequests, []);
    assert.deepEqual(harness.pageErrors, []);
  } finally {
    await harness.close();
  }
});

test("an unavailable import worker fails closed", async () => {
  const harness = await createPdfBrowserHarness({ importWorker: 'throw new Error("synthetic worker startup failure");' });
  try {
    const result = await harness.importPdf(syntheticPdf([{ blank: true }]));
    assert.match(result.error, /could not be rendered reliably/);
    assert.deepEqual(result.pages, []);
    assert.deepEqual(harness.unexpectedRequests, []);
  } finally {
    await harness.close();
  }
});
