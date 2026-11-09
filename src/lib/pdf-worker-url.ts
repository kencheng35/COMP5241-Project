// Let the bundler emit the matching PDF.js worker with this application build.
export const pdfWorkerUrl = new URL("../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
