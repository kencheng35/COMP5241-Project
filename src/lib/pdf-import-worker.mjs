// This module runs in a dedicated worker for one PDF import. PDF.js 6.3.289
// can resolve render() after a worker stream error, and can warn and omit an
// image or annotation instead of rejecting. Send only a category, never PDF
// data or warning text, before forwarding PDF.js's own messages.
const send = self.postMessage.bind(self);
const signal = kind => send({ forgePdfImport: kind });

self.addEventListener("message", async function initialize(event) {
  if (event.data?.forgePdfImport !== "initialize") return;
  self.removeEventListener("message", initialize);
  const { workerSrc, maxImageSize } = event.data;
  if (typeof workerSrc !== "string" || !Number.isInteger(maxImageSize) || maxImageSize < 1) {
    signal("worker-error");
    return;
  }

  self.postMessage = (message, ...options) => {
    if (message?.stream === 5) {
      signal(String(message.reason?.message).includes("Image exceeded maximum allowed size") ? "source-limit" : "unreliable");
    }
    const data = message?.data;
    const image = message?.action === "obj" && data?.[2] === "Image" ? data[3] :
      message?.action === "commonobj" && data?.[1] === "Image" ? data[2] : undefined;
    if (image === null) {
      signal("unreliable");
      return;
    }
    if (image !== undefined) {
      if (!Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width <= 0 || image.height <= 0) {
        signal("unreliable");
        image.bitmap?.close();
        return;
      }
      if (image.width * image.height > maxImageSize) {
        signal("source-limit");
        image.bitmap?.close();
        return;
      }
    }
    return send(message, ...options);
  };
  // Fail closed on all worker warnings: some omissions are reported only
  // here, including errors caught while rendering annotation appearances.
  // Suppress their text, which can contain information from the source PDF.
  console.warn = (...args) => {
    signal(args.some(value => typeof value === "string" && value.includes("Image exceeded maximum allowed size")) ?
      "source-limit" : "unreliable");
    // Stop work immediately rather than allowing a warned-about decode to
    // continue while the main thread is preparing to cancel the import.
    throw new Error("PDF import stopped after a worker warning.");
  };

  try {
    await import(/* webpackIgnore: true */ workerSrc);
    signal("ready");
  } catch {
    signal("worker-error");
  }
});
