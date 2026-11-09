// Let the bundler emit the matching PDF.js worker with this application build.
export const pdfWorkerUrl = new URL("../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
// The import-only wrapper observes PDF.js failures without changing its worker.
export const pdfImportWorkerUrl = new URL("./pdf-import-worker.mjs", import.meta.url).toString();
