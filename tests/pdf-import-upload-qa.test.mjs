import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { syntheticPdf } from "./pdf-import-browser-harness.mjs";
import { createUploadQa, uploadQaOwner } from "./pdf-import-upload-qa-harness.mjs";
import { load } from "./slide-authoring-harness.mjs";

async function waitForEvents(h, name, count) {
  const deadline = Date.now() + 10_000;
  while (h.events.filter(event => event.name === name).length < count) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${count} ${name} events.`);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function denyRecoveryStorage(page, operation) {
  await page.evaluate(operation => {
    const original = Storage.prototype[operation];
    window.deniedRecoveryOperations = [];
    Storage.prototype[operation] = function (...args) {
      if (this === window.sessionStorage && String(args[0]).startsWith("forge-pdf-import-cleanup:")) {
        window.deniedRecoveryOperations.push(operation);
        throw new DOMException("Synthetic tab storage denial.", "SecurityError");
      }
      return original.apply(this, args);
    };
  }, operation);
}

async function assertRecoveryStorageWarning(page) {
  const alert = page.locator("#pdf-import-error");
  assert.equal(await alert.count(), 1, "Storage denial must produce an upload alert.");
  assert.equal(await alert.getAttribute("role"), "alert");
  assert.equal(await alert.isVisible(), true);
  const text = await alert.innerText();
  assert.match(text, /Tab recovery is unavailable/i);
  assert.match(text, /Reloading can lose a pending cleanup retry/i);
  assert.match(text, /show an old retry again/i);
  assert.match(text, /Keep this page open until cleanup is confirmed/i);
  assert.doesNotMatch(text, /(?:recovery|retry)\s+(?:is|will be)\s+(?:persisted|saved|guaranteed)/i);
  return text;
}

test("server-rendered PDF controls stay locked until tab recovery is checked", () => {
  const { UploadLessonPage } = load("../src/components/create-lesson.tsx", {
    react: React, "react/jsx-runtime": jsx, "lucide-react": {}, "next/navigation": {},
    "@/app/learning/actions": {}, "@/lib/slide-lesson": {}, "@/lib/presentation": {},
    "@/app/presentation/actions": {}, "@/lib/pdf-import": {},
  });
  const html = renderToStaticMarkup(React.createElement(UploadLessonPage, { ownerId: uploadQaOwner }));
  const input = html.match(/<input[^>]*type="file"[^>]*>/)?.[0];
  const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0];
  assert.match(input ?? "", /\bdisabled=""/);
  assert.match(submit ?? "", /\bdisabled=""/);
  assert.match(html, /Checking PDF recovery/);
});

for (const width of [320, 1440]) {
  test(`real PDF-to-Create-lesson mock workflow and keyboard save at ${width}px`, async () => {
    const h = await createUploadQa(width);
    try {
      await h.select(syntheticPdf([{ width: 2, height: 2 }, { blank: true }]));
      await h.submitByKeyboard();
      const title = h.page.getByLabel("Lesson title", { exact: true });
      await title.waitFor();
      assert.equal(await h.page.locator("#pdf-import-error").count(), 0,
        "Available tab storage does not produce a recovery warning.");
      await h.page.waitForFunction(() => document.activeElement === document.querySelector(".presentation-document-bar input"));
      assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(h.events.map(event => event.name), ["begin", "upload", "upload"]);
      assert.deepEqual(h.events.slice(1).map(event => event.payload.name), ["pdf-page-1.png", "pdf-page-2.png"]);
      const draftId = h.events[1].payload.draftId;
      assert.equal(h.events[2].payload.draftId, draftId);
      assert.equal(h.drafts.size, 1);
      await title.fill("Synthetic PDF lesson");
      const save = h.page.getByRole("button", { name: "Save", exact: true });
      await save.focus();
      await h.page.keyboard.press("Enter");
      await h.page.getByRole("status").filter({ hasText: "Version 1" }).waitFor();
      assert.equal(h.saves.length, 1);
      const form = Object.fromEntries(h.saves[0].entries);
      const presentation = JSON.parse(form.content);
      assert.equal(form.intent, "save");
      assert.equal(form.draftId, draftId);
      assert.equal(presentation.document.slides.length, 2);
      for (const [index, slide] of presentation.document.slides.entries()) {
        assert.equal(slide.elements.length, 1);
        const element = slide.elements[0];
        assert.equal(element.type, "image");
        // Fabric flush rounds the active slide to hundredths; untouched slides
        // retain the importer's unrounded centered placement.
        const expectedX = index === 0 ? 0.39 : 0.39473684210526017;
        const expectedW = index === 0 ? 959.21 : 959.2105263157895;
        assert.ok(Math.abs(element.x - expectedX) < 1e-9);
        assert.equal(element.y, 0);
        assert.ok(Math.abs(element.w - expectedW) < 1e-9);
        assert.equal(element.h, 540);
      }
      assert.deepEqual(h.requests, []);
      assert.deepEqual(h.errors, []);
    } finally {
      await h.close();
    }
  });
}

test("real worker failure on page two visibly discards the synthetic private draft, then retries", async () => {
  const h = await createUploadQa();
  try {
    await h.select(syntheticPdf([
      { width: 2, height: 2 }, { width: 2001, height: 2000, background: true },
    ]), "oversized.pdf");
    await h.submitByKeyboard();
    const alert = h.page.getByRole("alert");
    await alert.waitFor();
    await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    assert.match(await alert.innerText(), /4,000,000-pixel source limit/);
    assert.deepEqual(h.events.map(event => event.name), ["begin", "upload", "discard"]);
    assert.equal(h.events[1].payload.draftId, h.events[2].payload);
    assert.equal(h.drafts.size, 0);
    assert.equal(h.saves.length, 0);
    assert.equal(await h.page.getByLabel("Lesson title", { exact: true }).count(), 0);
    await h.select(syntheticPdf([{ blank: true }]), "retry.pdf");
    await h.submitByKeyboard();
    await h.page.getByLabel("Lesson title", { exact: true }).waitFor();
    assert.deepEqual(h.events.map(event => event.name), ["begin", "upload", "discard", "begin", "upload"]);
    assert.equal(h.drafts.size, 1);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

test("a second-page image-storage error discards the draft and allows an explicit retry", async () => {
  const h = await createUploadQa();
  try {
    h.faults.uploadAt = 2;
    await h.select(syntheticPdf([{ blank: true }, { blank: true }]));
    await h.submitByKeyboard();
    const alert = h.page.getByRole("alert");
    await alert.waitFor();
    await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    assert.match(await alert.innerText(), /PDF page 2 could not be stored: Synthetic image storage failure/);
    assert.deepEqual(h.events.map(event => event.name), ["begin", "upload", "upload", "discard"]);
    assert.equal(h.drafts.size, 0);
    assert.equal(h.saves.length, 0);
    h.faults.uploadAt = 0;
    await h.submitByKeyboard();
    await h.page.getByLabel("Lesson title", { exact: true }).waitFor();
    assert.deepEqual(h.events.map(event => event.name),
      ["begin", "upload", "upload", "discard", "begin", "upload", "upload"]);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

test("a refused private draft does not upload pages or attempt nonexistent cleanup", async () => {
  const h = await createUploadQa();
  try {
    h.faults.begin = true;
    await h.select(syntheticPdf([{ blank: true }]));
    await h.submitByKeyboard();
    const alert = h.page.getByRole("alert");
    await alert.waitFor();
    await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    assert.match(await alert.innerText(), /Synthetic private storage unavailable/);
    assert.deepEqual(h.events.map(event => event.name), ["begin"]);
    assert.equal(h.drafts.size, 0);
    assert.equal(h.saves.length, 0);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

for (const width of [320, 1440]) {
  for (const mode of ["error", "throw"]) {
    test(`unconfirmed PDF cleanup (${mode}) stays blocked through explicit retries at ${width}px`, async () => {
      const h = await createUploadQa(width);
      let releaseCleanup;
      try {
        h.faults.discard = mode;
        await h.select(syntheticPdf([
          { width: 2, height: 2 }, { width: 2001, height: 2000, background: true },
        ]), "oversized.pdf");
        await h.submitByKeyboard();
        const file = h.page.getByLabel("PDF file", { exact: true });
        const importer = h.page.getByRole("button", { name: "Import PDF pages", exact: true });
        const retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
        const alert = h.page.getByRole("alert");
        await retry.waitFor();
        await h.page.waitForFunction(() => {
          const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Retry cleanup");
          return button && !button.disabled && document.activeElement === button;
        });
        assert.match(await alert.innerText(), /4,000,000-pixel source limit/);
        assert.match(await alert.innerText(), /cleanup/i);
        assert.match(await alert.innerText(), mode === "error" ? /Synthetic private cleanup failure/ : /Cleanup could not be confirmed/);
        assert.equal(await retry.getAttribute("aria-describedby"), "pdf-import-error");
        assert.equal(await retry.evaluate(button => button.matches(":focus-visible")), true);
        assert.equal(await file.isDisabled(), true);
        assert.equal(await importer.isDisabled(), true);
        assert.equal(await file.evaluate(input => input.files[0]?.name), "oversized.pdf");
        assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const bounds = await retry.boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
        const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
        assert.equal(h.drafts.has(firstDraft), true);

        // Even synthetic late form/input events cannot bypass the pending lock.
        await file.evaluate(input => input.dispatchEvent(new Event("change", { bubbles: true })));
        await h.page.locator("#upload-importer").evaluate(form =>
          form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
        assert.equal(h.events.filter(event => event.name === "begin").length, 1);

        h.faults.discardGate = new Promise(resolve => { releaseCleanup = resolve; });
        await retry.evaluate(button => { button.click(); button.click(); });
        await waitForEvents(h, "discard", 2);
        await h.page.waitForFunction(() => {
          const button = [...document.querySelectorAll("button")].find(item => /cleanup/i.test(item.textContent));
          return button?.disabled;
        });
        assert.equal(h.events.filter(event => event.name === "discard").length, 2);
        assert.equal(await retry.isDisabled(), true);
        assert.match(await h.page.getByRole("status").innerText(), /Cleaning private pages/);
        assert.equal(await file.isDisabled(), true);
        assert.equal(await importer.isDisabled(), true);
        await h.page.locator("#upload-importer").evaluate(form =>
          form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
        assert.equal(h.events.filter(event => event.name === "begin").length, 1);
        h.faults.discardGate = null;
        releaseCleanup();
        releaseCleanup = undefined;
        await h.page.waitForFunction(() => {
          const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Retry cleanup");
          return button && !button.disabled && document.activeElement === button;
        });
        assert.match(await alert.innerText(), mode === "error" ? /Synthetic private cleanup failure/ : /Cleanup could not be confirmed/,
          "A repeated failure remains visible.");
        assert.equal(h.drafts.has(firstDraft), true);
        assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
          [firstDraft, firstDraft]);

        h.faults.discard = false;
        await h.page.keyboard.press("Enter");
        await h.page.waitForFunction(() => {
          const input = document.querySelector('input[type="file"]');
          return input && !input.disabled && document.activeElement === input;
        });
        assert.equal(await retry.count(), 0);
        assert.equal(h.drafts.has(firstDraft), false);
        assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
          [firstDraft, firstDraft, firstDraft]);
        await h.select(syntheticPdf([{ blank: true }]), "retry.pdf");
        await h.submitByKeyboard();
        await h.page.getByLabel("Lesson title", { exact: true }).waitFor();
        assert.equal(h.events.filter(event => event.name === "begin").length, 2);
        assert.deepEqual(h.requests, []);
        assert.deepEqual(h.errors, []);
      } finally {
        releaseCleanup?.();
        await h.close();
      }
    });
  }
}

for (const mode of ["empty", "conflicting"]) {
  test(`${mode === "empty" ? "an" : "a"} ${mode} cleanup response without unambiguous success remains blocked`, async () => {
    const h = await createUploadQa();
    try {
      h.faults.discard = mode;
      await h.select(syntheticPdf([
        { width: 2, height: 2 }, { width: 2001, height: 2000, background: true },
      ]));
      await h.submitByKeyboard();
      const retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
      await retry.waitFor();
      const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
      assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
      assert.equal(h.drafts.has(firstDraft), true);
      h.faults.discard = false;
      await retry.click();
      await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
      assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
        [firstDraft, firstDraft]);
      assert.equal(h.drafts.has(firstDraft), false);
      assert.deepEqual(h.requests, []);
      assert.deepEqual(h.errors, []);
    } finally {
      await h.close();
    }
  });
}

test("a lost cleanup acknowledgement stays blocked even if the mock already removed the pages", async () => {
  const h = await createUploadQa();
  try {
    h.faults.discard = "lost";
    await h.select(syntheticPdf([
      { width: 2, height: 2 }, { width: 2001, height: 2000, background: true },
    ]));
    await h.submitByKeyboard();
    const retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    await waitForEvents(h, "discard", 1);
    const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
    assert.equal(h.drafts.has(firstDraft), false, "The synthetic server completed before its response was lost.");
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
    assert.match(await h.page.getByRole("alert").innerText(), /cleanup.*pending/i);
    h.faults.discard = false;
    await retry.click();
    await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
      [firstDraft, firstDraft]);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

test("pending cleanup survives remount, an in-flight retry and reload for the same owner", async () => {
  const h = await createUploadQa();
  let releaseCleanup;
  try {
    h.faults.discard = "error";
    await h.select(syntheticPdf([
      { width: 2, height: 2 }, { width: 2001, height: 2000, background: true },
    ]));
    await h.submitByKeyboard();
    await h.page.getByRole("button", { name: "Retry cleanup", exact: true }).waitFor();
    await waitForEvents(h, "discard", 1);
    const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
    assert.equal(await h.page.evaluate(owner =>
      sessionStorage.getItem(`forge-pdf-import-cleanup:${owner}`), uploadQaOwner), firstDraft);

    await h.remount("00000000-0000-4000-8000-000000000002");
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isEnabled(), true,
      "A different signed-in owner does not inherit this owner's pending draft.");
    assert.equal(await h.page.getByRole("button", { name: "Retry cleanup", exact: true }).count(), 0);
    await h.remount(uploadQaOwner);
    let retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
    assert.equal(h.events.filter(event => event.name === "discard").length, 1, "Remount does not retry automatically.");

    h.faults.discardGate = new Promise(resolve => { releaseCleanup = resolve; });
    await retry.click();
    await waitForEvents(h, "discard", 2);
    await h.remount();
    retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    assert.equal(await retry.isDisabled(), true);
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
    h.faults.discardGate = null;
    releaseCleanup();
    releaseCleanup = undefined;
    await h.page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Retry cleanup");
      return button && !button.disabled && document.activeElement === button;
    });
    assert.equal(h.events.filter(event => event.name === "discard").length, 2);
    assert.equal(h.drafts.has(firstDraft), true);

    await h.reload();
    retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
    assert.equal(h.events.filter(event => event.name === "discard").length, 2, "Reload does not retry automatically.");
    h.faults.discard = false;
    await retry.click();
    await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
      [firstDraft, firstDraft, firstDraft]);
    assert.equal(h.drafts.has(firstDraft), false);
    assert.equal(await h.page.evaluate(owner =>
      sessionStorage.getItem(`forge-pdf-import-cleanup:${owner}`), uploadQaOwner), null);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    releaseCleanup?.();
    await h.close();
  }
});

test("unmount during an upload waits for it, skips later pages and retains failed cleanup", async () => {
  const h = await createUploadQa();
  let releaseUpload;
  try {
    h.faults.uploadGate = new Promise(resolve => { releaseUpload = resolve; });
    h.faults.discard = "error";
    await h.select(syntheticPdf([{ blank: true }, { blank: true }]));
    await h.submitByKeyboard();
    await waitForEvents(h, "upload", 1);
    const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
    await h.remount();
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
    assert.equal(h.events.filter(event => event.name === "discard").length, 0,
      "The in-flight upload settles before cleanup begins.");
    h.faults.uploadGate = null;
    releaseUpload();
    releaseUpload = undefined;
    const retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    assert.deepEqual(h.events.map(event => event.name), ["begin", "upload", "discard"]);
    assert.equal(h.events[2].payload, firstDraft);
    h.faults.discard = false;
    await retry.click();
    await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
      [firstDraft, firstDraft]);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    releaseUpload?.();
    await h.close();
  }
});

test("storage denial warning on getItem appears before import and survives cleanup", async () => {
  const h = await createUploadQa();
  const owner = "00000000-0000-4000-8000-000000000002";
  try {
    await denyRecoveryStorage(h.page, "getItem");
    // A new owner forces the actual first recovery read rather than the cache.
    await h.remount(owner);
    assert.equal(await h.page.evaluate(() => deniedRecoveryOperations.includes("getItem")), true);
    await assertRecoveryStorageWarning(h.page);
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isEnabled(), true);

    h.faults.uploadAt = 2;
    h.faults.discard = "error";
    await h.select(syntheticPdf([{ blank: true }, { blank: true }]));
    await h.submitByKeyboard();
    let retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    await h.page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Retry cleanup");
      return button && !button.disabled && document.activeElement === button;
    });
    const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
    assert.match(await assertRecoveryStorageWarning(h.page), /Synthetic private cleanup failure/);
    assert.equal(await retry.getAttribute("aria-describedby"), "pdf-import-error");
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);

    await h.remount(owner);
    retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    await assertRecoveryStorageWarning(h.page);
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
    h.faults.discard = false;
    await retry.click();
    await h.page.waitForFunction(() => {
      const input = document.querySelector('input[type="file"]');
      return input && !input.disabled && document.activeElement === input;
    });
    assert.equal(h.drafts.has(firstDraft), false);
    assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
      [firstDraft, firstDraft]);
    assert.match(await h.page.getByRole("status").filter({ hasText: "cleanup confirmed" }).innerText(), /confirmed/i);
    await assertRecoveryStorageWarning(h.page);

    h.faults.uploadAt = 0;
    await h.select(syntheticPdf([{ blank: true }]), "normal.pdf");
    await h.submitByKeyboard();
    await h.page.getByLabel("Lesson title", { exact: true }).waitFor();
    assert.equal(await h.page.locator("#upload-importer").isHidden(), true);
    await assertRecoveryStorageWarning(h.page);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

test("storage denial warning on getItem exposes an unreadable pending retry after reload", async () => {
  const h = await createUploadQa();
  try {
    h.faults.uploadAt = 1;
    h.faults.discard = "error";
    await h.select(syntheticPdf([{ blank: true }]));
    await h.submitByKeyboard();
    await h.page.getByRole("button", { name: "Retry cleanup", exact: true }).waitFor();
    await h.page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Retry cleanup");
      return button && !button.disabled && document.activeElement === button;
    });
    const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
    assert.equal(await h.page.evaluate(owner =>
      sessionStorage.getItem(`forge-pdf-import-cleanup:${owner}`), uploadQaOwner), firstDraft);
    await h.page.addInitScript(() => {
      const original = Storage.prototype.getItem;
      window.originalRecoveryGetItem = original;
      window.deniedRecoveryReads = 0;
      Storage.prototype.getItem = function (key) {
        if (this === window.sessionStorage && String(key).startsWith("forge-pdf-import-cleanup:")) {
          window.deniedRecoveryReads++;
          throw new DOMException("Synthetic tab storage denial.", "SecurityError");
        }
        return original.call(this, key);
      };
    });

    await h.reload();
    assert.ok(await h.page.evaluate(() => deniedRecoveryReads > 0));
    await assertRecoveryStorageWarning(h.page);
    assert.equal(await h.page.evaluate(owner =>
      originalRecoveryGetItem.call(sessionStorage, `forge-pdf-import-cleanup:${owner}`), uploadQaOwner), firstDraft);
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isEnabled(), true);
    assert.equal(await h.page.getByRole("button", { name: "Retry cleanup", exact: true }).count(), 0);
    assert.equal(h.drafts.has(firstDraft), true, "The synthetic pending draft still exists.");
    assert.equal(h.events.filter(event => event.name === "discard").length, 1);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

for (const width of [320, 1440]) {
  test(`storage denial warning on setItem preserves the lock and normal import at ${width}px`, async () => {
    const h = await createUploadQa(width);
    let releaseUpload;
    try {
      await denyRecoveryStorage(h.page, "setItem");
      h.faults.uploadGate = new Promise(resolve => { releaseUpload = resolve; });
      h.faults.uploadAt = 2;
      h.faults.discard = "error";
      await h.select(syntheticPdf([{ blank: true }, { blank: true }]));
      await h.submitByKeyboard();
      await waitForEvents(h, "upload", 1);
      assert.equal(await h.page.evaluate(() => deniedRecoveryOperations.includes("setItem")), true);
      await assertRecoveryStorageWarning(h.page);
      assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
      assert.equal(await h.page.getByRole("button", { name: "Retry cleanup", exact: true }).count(), 0);
      const warning = h.page.locator("#pdf-import-error");
      const bounds = await warning.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
      assert.equal(await h.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.ok((await warning.screenshot()).length > 100, "Capture the synthetic warning without writing a file.");

      h.faults.uploadGate = null;
      releaseUpload();
      releaseUpload = undefined;
      let retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
      await retry.waitFor();
      await h.page.waitForFunction(() => {
        const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Retry cleanup");
        return button && !button.disabled && document.activeElement === button;
      });
      const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
      assert.match(await assertRecoveryStorageWarning(h.page), /Synthetic private cleanup failure/);
      assert.equal(await retry.getAttribute("aria-describedby"), "pdf-import-error");
      assert.equal(await retry.evaluate(button => button.matches(":focus-visible")), true);
      assert.equal(await h.page.evaluate(owner =>
        sessionStorage.getItem(`forge-pdf-import-cleanup:${owner}`), uploadQaOwner), null);

      await h.remount();
      retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
      await retry.waitFor();
      await assertRecoveryStorageWarning(h.page);
      assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
      await retry.click();
      await waitForEvents(h, "discard", 2);
      await h.page.waitForFunction(() => {
        const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Retry cleanup");
        return button && !button.disabled && document.activeElement === button;
      });
      assert.match(await assertRecoveryStorageWarning(h.page), /Synthetic private cleanup failure/);
      assert.equal(h.drafts.has(firstDraft), true);

      h.faults.discard = false;
      await h.page.keyboard.press("Enter");
      await h.page.waitForFunction(() => {
        const input = document.querySelector('input[type="file"]');
        return input && !input.disabled && document.activeElement === input;
      });
      assert.equal(await retry.count(), 0);
      assert.equal(h.drafts.has(firstDraft), false);
      assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
        [firstDraft, firstDraft, firstDraft]);
      assert.match(await h.page.getByRole("status").filter({ hasText: "cleanup confirmed" }).innerText(), /confirmed/i);
      await assertRecoveryStorageWarning(h.page);

      h.faults.uploadAt = 0;
      await h.select(syntheticPdf([{ blank: true }]), "normal.pdf");
      await h.submitByKeyboard();
      await h.page.getByLabel("Lesson title", { exact: true }).waitFor();
      assert.equal(await h.page.locator("#upload-importer").isHidden(), true);
      await assertRecoveryStorageWarning(h.page);
      assert.deepEqual(h.requests, []);
      assert.deepEqual(h.errors, []);
    } finally {
      if (releaseUpload) { h.faults.uploadGate = null; releaseUpload(); }
      await h.close();
    }
  });
}

test("storage denial warning on removeItem preserves confirmed cleanup and warns about stale retries", async () => {
  const h = await createUploadQa();
  try {
    await denyRecoveryStorage(h.page, "removeItem");
    h.faults.uploadAt = 2;
    h.faults.discard = "error";
    await h.select(syntheticPdf([{ blank: true }, { blank: true }]));
    await h.submitByKeyboard();
    let retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    await h.page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Retry cleanup");
      return button && !button.disabled && document.activeElement === button;
    });
    const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
    assert.doesNotMatch(await h.page.getByRole("alert").innerText(), /Tab recovery is unavailable/i);
    assert.equal(await h.page.evaluate(owner =>
      sessionStorage.getItem(`forge-pdf-import-cleanup:${owner}`), uploadQaOwner), firstDraft);

    h.faults.discard = false;
    await retry.click();
    await h.page.waitForFunction(() => {
      const input = document.querySelector('input[type="file"]');
      return input && !input.disabled && document.activeElement === input;
    });
    assert.equal(await h.page.evaluate(() => deniedRecoveryOperations.includes("removeItem")), true);
    assert.doesNotMatch(await assertRecoveryStorageWarning(h.page), /Private page cleanup is pending/i);
    assert.match(await h.page.getByRole("status").filter({ hasText: "cleanup confirmed" }).innerText(), /confirmed/i);
    assert.equal(await retry.count(), 0);
    assert.equal(h.drafts.has(firstDraft), false);
    assert.equal(await h.page.evaluate(owner =>
      sessionStorage.getItem(`forge-pdf-import-cleanup:${owner}`), uploadQaOwner), firstDraft);

    await h.remount();
    await assertRecoveryStorageWarning(h.page);
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isEnabled(), true);
    // The test's storage override is removed by navigation; the undeleted ID
    // can still reappear and be explicitly cleared by an idempotent retry.
    await h.reload();
    retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
    assert.equal(h.drafts.has(firstDraft), false);
    await retry.click();
    await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
      [firstDraft, firstDraft, firstDraft]);
    assert.equal(await h.page.evaluate(owner =>
      sessionStorage.getItem(`forge-pdf-import-cleanup:${owner}`), uploadQaOwner), null);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

test("storage denial warning on removeItem does not block a successful PDF preview or save", async () => {
  const h = await createUploadQa();
  try {
    await denyRecoveryStorage(h.page, "removeItem");
    await h.select(syntheticPdf([{ blank: true }]));
    await h.submitByKeyboard();
    const title = h.page.getByLabel("Lesson title", { exact: true });
    await title.waitFor();
    assert.equal(await h.page.evaluate(() => deniedRecoveryOperations.includes("removeItem")), true);
    assert.doesNotMatch(await assertRecoveryStorageWarning(h.page), /Private page cleanup is pending/i);
    assert.equal(await h.page.locator("#upload-importer").isHidden(), true);
    assert.equal(await h.page.getByRole("button", { name: "Change file", exact: true }).isEnabled(), true);
    const draftId = h.events.find(event => event.name === "upload").payload.draftId;
    assert.equal(await h.page.evaluate(owner =>
      sessionStorage.getItem(`forge-pdf-import-cleanup:${owner}`), uploadQaOwner), draftId);
    assert.deepEqual(h.events.map(event => event.name), ["begin", "upload"]);

    await title.fill("Successful synthetic PDF");
    await h.page.getByRole("button", { name: "Save", exact: true }).click();
    await h.page.getByRole("status").filter({ hasText: "Version 1" }).waitFor();
    assert.equal(h.saves.length, 1);
    assert.equal(Object.fromEntries(h.saves[0].entries).draftId, draftId);
    await assertRecoveryStorageWarning(h.page);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

test("storage denial warning accurately describes a pending retry lost on reload", async () => {
  const h = await createUploadQa();
  try {
    await denyRecoveryStorage(h.page, "setItem");
    h.faults.uploadAt = 1;
    h.faults.discard = "error";
    await h.select(syntheticPdf([{ blank: true }]));
    await h.submitByKeyboard();
    await h.page.getByRole("button", { name: "Retry cleanup", exact: true }).waitFor();
    await h.page.waitForFunction(() => {
      const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Retry cleanup");
      return button && !button.disabled && document.activeElement === button;
    });
    const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
    assert.match(await assertRecoveryStorageWarning(h.page), /Synthetic private cleanup failure/);
    assert.equal(await h.page.evaluate(owner =>
      sessionStorage.getItem(`forge-pdf-import-cleanup:${owner}`), uploadQaOwner), null);
    assert.equal(h.drafts.has(firstDraft), true);

    await h.reload();
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isEnabled(), true);
    assert.equal(await h.page.getByRole("button", { name: "Retry cleanup", exact: true }).count(), 0);
    assert.equal(h.drafts.has(firstDraft), true, "The synthetic draft remains after its in-memory retry is lost.");
    assert.equal(h.events.filter(event => event.name === "discard").length, 1);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

test("memory retains the cleanup lock across remount when tab storage is unavailable", async () => {
  const h = await createUploadQa();
  try {
    await h.page.evaluate(() => {
      Object.defineProperty(window, "sessionStorage", {
        configurable: true, get() { throw new Error("Synthetic storage denied."); },
      });
    });
    h.faults.discard = "error";
    await h.select(syntheticPdf([
      { width: 2, height: 2 }, { width: 2001, height: 2000, background: true },
    ]));
    await h.submitByKeyboard();
    await h.page.getByRole("button", { name: "Retry cleanup", exact: true }).waitFor();
    const firstDraft = h.events.find(event => event.name === "upload").payload.draftId;
    await h.remount();
    const retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
    await assertRecoveryStorageWarning(h.page);
    assert.equal(h.events.filter(event => event.name === "discard").length, 1);
    h.faults.discard = false;
    await retry.click();
    await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
      [firstDraft, firstDraft]);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    await h.close();
  }
});

test("unmount during draft creation blocks a remount and never uploads a stale page", async () => {
  const h = await createUploadQa();
  let releaseBegin;
  try {
    h.faults.beginGate = new Promise(resolve => { releaseBegin = resolve; });
    h.faults.discard = "error";
    await h.select(syntheticPdf([{ blank: true }]));
    await h.submitByKeyboard();
    await waitForEvents(h, "begin", 1);
    await h.remount();
    assert.equal(await h.page.getByLabel("PDF file", { exact: true }).isDisabled(), true);
    await h.page.locator("#upload-importer").evaluate(form =>
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    assert.equal(h.events.filter(event => event.name === "begin").length, 1);
    h.faults.beginGate = null;
    releaseBegin();
    releaseBegin = undefined;
    const retry = h.page.getByRole("button", { name: "Retry cleanup", exact: true });
    await retry.waitFor();
    await waitForEvents(h, "discard", 1);
    assert.equal(h.events.filter(event => event.name === "upload").length, 0);
    const firstDraft = h.events.find(event => event.name === "discard").payload;
    assert.equal(h.drafts.has(firstDraft), true);
    h.faults.discard = false;
    await retry.click();
    await h.page.waitForFunction(() => !document.querySelector('input[type="file"]').disabled);
    assert.deepEqual(h.events.filter(event => event.name === "discard").map(event => event.payload),
      [firstDraft, firstDraft]);
    assert.deepEqual(h.requests, []);
    assert.deepEqual(h.errors, []);
  } finally {
    releaseBegin?.();
    await h.close();
  }
});
