import { pdfImportWorkerUrl, pdfWorkerUrl } from "./pdf-worker-url";

export const MAX_PDF_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_PDF_IMPORT_PAGES = 30;
export const MAX_PDF_PAGE_RENDER_PIXELS = 1920 * 1080;
export const MAX_PDF_SOURCE_IMAGE_PIXELS = 4_000_000;
export const MAX_PDF_TOTAL_RENDER_PIXELS = 40_000_000;
export const MAX_PDF_RENDER_SIDE = 3840;
const MAX_PDF_RENDER_SCALE = 1.5;
// The worker guard observes this version's internal diagnostic messages.
const SUPPORTED_PDFJS_VERSION = "6.3.289";

export class PdfImportError extends Error {}

type PdfViewport = { width: number; height: number };
type PdfPage = {
  getViewport(options: { scale: number }): PdfViewport;
  render(options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport; background: string }): { promise: Promise<void> };
  cleanup(): void;
};
type PdfDocument = {
  numPages: number;
  getPermissions(): Promise<number[] | null>;
  getPage(pageNumber: number): Promise<PdfPage>;
};
type PdfWorker = { destroy(): void };
type PdfJs = {
  version: string;
  PDFWorker: new (options: { port: Worker; verbosity: number }) => PdfWorker;
  getDocument(options: Record<string, unknown>): { promise: Promise<PdfDocument>; destroy(): Promise<void> };
};
type PdfWorkerGuard = {
  worker: PdfWorker;
  check(): void;
  wait<T>(operation: Promise<T>): Promise<T>;
  close(): void;
};
type PdfImportDependencies = {
  loadPdfjs?: () => Promise<PdfJs>;
  createCanvas?: () => HTMLCanvasElement;
  createWorker?: (pdfjs: PdfJs) => Promise<PdfWorkerGuard>;
};

async function createPdfWorkerGuard(pdfjs: PdfJs): Promise<PdfWorkerGuard> {
  let port: Worker;
  try {
    port = new Worker(pdfImportWorkerUrl, { type: "module" });
  } catch {
    throw new PdfImportError("PDF rendering could not start in this browser. Try a supported browser.");
  }

  let failure: PdfImportError | undefined;
  let rejectFailure!: (error: PdfImportError) => void;
  const failed = new Promise<never>((_, reject) => { rejectFailure = reject; });
  // A warning can arrive between operations; retain it without an unhandled rejection.
  void failed.catch(() => {});
  let resolveReady!: () => void;
  const ready = new Promise<void>(resolve => { resolveReady = resolve; });
  function fail(kind: string) {
    if (failure) return;
    failure = new PdfImportError(kind === "source-limit" ?
      "An embedded PDF image exceeds the 4,000,000-pixel source limit. Reduce the image resolution and export the PDF again." :
      "PDF content could not be rendered reliably. The file may be damaged or use unsupported features; export a standard PDF and try again.");
    rejectFailure(failure);
  }
  port.addEventListener("message", event => {
    const kind = event.data?.forgePdfImport;
    if (kind === "ready") resolveReady();
    else if (kind === "source-limit" || kind === "unreliable" || kind === "worker-error") fail(kind);
  });
  port.addEventListener("error", event => { event.preventDefault(); fail("worker-error"); });
  port.addEventListener("messageerror", () => fail("worker-error"));
  const timer = setTimeout(() => fail("worker-error"), 15_000);
  try {
    port.postMessage({
      forgePdfImport: "initialize",
      workerSrc: new URL(pdfWorkerUrl, globalThis.location.href).href,
      maxImageSize: MAX_PDF_SOURCE_IMAGE_PIXELS,
    });
    await Promise.race([ready, failed]);
    const worker = new pdfjs.PDFWorker({ port, verbosity: 1 });
    return {
      worker,
      check() { if (failure) throw failure; },
      wait<T>(operation: Promise<T>) {
        if (failure) {
          void operation.catch(() => {});
          return Promise.reject(failure);
        }
        return Promise.race([operation, failed]);
      },
      close() { try { worker.destroy(); } finally { port.terminate(); } },
    };
  } catch (error) {
    port.terminate();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function destroyPdfTask(task: ReturnType<PdfJs["getDocument"]>) {
  // A crashed worker may never acknowledge PDF.js's Terminate message.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => task.destroy()).catch(() => {}),
      new Promise<void>(resolve => { timer = setTimeout(resolve, 2_000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export function validatePdfFile(file: Pick<File, "name" | "size">) {
  if (!file.size) throw new PdfImportError("Choose a non-empty PDF file.");
  if (file.size > MAX_PDF_UPLOAD_BYTES) throw new PdfImportError("PDF files must be at most 4 MiB.");
  if (!/\.pdf$/i.test(file.name)) throw new PdfImportError("Only PDF files are supported here.");
}

export function pdfPageRenderPlan(width: number, height: number, renderedPixels = 0) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      width > 1_000_000 || height > 1_000_000 || !Number.isFinite(renderedPixels) || renderedPixels < 0) {
    throw new PdfImportError("This PDF page has invalid or unsupported dimensions.");
  }
  const scale = Math.min(
    MAX_PDF_RENDER_SCALE,
    Math.sqrt(MAX_PDF_PAGE_RENDER_PIXELS / (width * height)),
    MAX_PDF_RENDER_SIDE / width,
    MAX_PDF_RENDER_SIDE / height,
  );
  const pixelWidth = Math.max(1, Math.ceil(width * scale));
  const pixelHeight = Math.max(1, Math.ceil(height * scale));
  const pixels = pixelWidth * pixelHeight;
  if (!Number.isFinite(pixels) || pixelWidth > MAX_PDF_RENDER_SIDE || pixelHeight > MAX_PDF_RENDER_SIDE ||
      pixels > MAX_PDF_PAGE_RENDER_PIXELS || renderedPixels + pixels > MAX_PDF_TOTAL_RENDER_PIXELS) {
    throw new PdfImportError("PDF rendering exceeds the safe pixel limit. Reduce the page dimensions or page count and try again.");
  }
  return { scale, width: pixelWidth, height: pixelHeight, pixels };
}

export function fitPdfPage(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new PdfImportError("This PDF page has invalid dimensions and cannot be fitted to the slide.");
  }
  const ratio = width / height;
  const w = Math.min(960, 540 * ratio);
  const h = w / ratio;
  return { x: (960 - w) / 2, y: (540 - h) / 2, w, h };
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new PdfImportError("The PDF page image could not be created. Try exporting the PDF again."));
  }, "image/png"));
}

export async function renderPdfPages(
  file: File,
  onPage: (pageNumber: number, image: File, width: number, height: number) => Promise<void>,
  dependencies: PdfImportDependencies = {},
) {
  validatePdfFile(file);
  let task: ReturnType<PdfJs["getDocument"]> | undefined;
  let document: PdfDocument | undefined;
  let guard: PdfWorkerGuard | undefined;
  let rendered = false;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length !== file.size || bytes.length > MAX_PDF_UPLOAD_BYTES) {
      throw new PdfImportError("The PDF upload size changed while reading. Choose the file again.");
    }
    if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-")) {
      throw new PdfImportError("This file does not contain a valid PDF header.");
    }
    // PDF.js 6.3.289's declaration incorrectly types PDFWorker's port as null.
    const pdfjs = await (dependencies.loadPdfjs ?? (() => import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as Promise<PdfJs>))();
    if (pdfjs.version !== SUPPORTED_PDFJS_VERSION) {
      throw new PdfImportError("This PDF renderer version is not supported for safe importing. Please contact support.");
    }
    guard = await (dependencies.createWorker ?? createPdfWorkerGuard)(pdfjs);
    task = pdfjs.getDocument({
      data: bytes,
      worker: guard.worker,
      verbosity: 0,
      useWorkerFetch: false,
      useWasm: false,
      enableXfa: false,
      isEvalSupported: false,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      maxImageSize: MAX_PDF_SOURCE_IMAGE_PIXELS,
      canvasMaxAreaInBytes: MAX_PDF_PAGE_RENDER_PIXELS * 4,
      stopAtErrors: true,
    });
    document = await guard.wait(task.promise);
    if (await guard.wait(document.getPermissions()) !== null) {
      throw new PdfImportError("Password-protected PDFs are not supported. Remove the password and export the PDF again.");
    }
    guard.check();
    if (!Number.isInteger(document.numPages) || document.numPages < 1 || document.numPages > MAX_PDF_IMPORT_PAGES) {
      throw new PdfImportError("PDF imports support 1–30 pages. Split the PDF and try again; nothing was saved.");
    }

    let totalPixels = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await guard.wait(document.getPage(pageNumber));
      let canvas: HTMLCanvasElement | undefined;
      try {
        const base = page.getViewport({ scale: 1 });
        const plan = pdfPageRenderPlan(base.width, base.height, totalPixels);
        totalPixels += plan.pixels;
        const viewport = page.getViewport({ scale: plan.scale });
        canvas = dependencies.createCanvas?.() ?? globalThis.document.createElement("canvas");
        canvas.width = plan.width;
        canvas.height = plan.height;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new PdfImportError(`PDF page ${pageNumber} could not be rendered by this browser.`);
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        await guard.wait(page.render({ canvasContext: context, viewport, background: "rgb(255, 255, 255)" }).promise);
        guard.check();
        const blob = await canvasBlob(canvas);
        guard.check();
        const image = new File([blob], `pdf-page-${pageNumber}.png`, { type: "image/png" });
        try {
          await onPage(pageNumber, image, plan.width, plan.height);
        } catch (error) {
          throw new PdfImportError(`PDF page ${pageNumber} could not be stored: ${error instanceof Error ? error.message : "Image upload failed."}`);
        }
        guard.check();
      } finally {
        page.cleanup();
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
    }
    guard.check();
    rendered = true;
    return document.numPages;
  } catch (error) {
    if (error instanceof PdfImportError) throw error;
    if (error instanceof Error && error.name === "PasswordException") {
      throw new PdfImportError("Password-protected PDFs are not supported. Remove the password and export the PDF again.");
    }
    throw new PdfImportError("This PDF could not be rendered. It may be damaged or use unsupported features; export a standard PDF and try again.");
  } finally {
    try {
      if (task) await destroyPdfTask(task);
      // Include diagnostics delivered while PDF.js is finishing its work.
      if (rendered) guard?.check();
    } finally {
      guard?.close();
    }
  }
}
