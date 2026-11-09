import { readFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { chromium } from "@playwright/test";
import ts from "typescript";

// Generate only synthetic PDFs; no fixture, source PDF or rendered image is
// written to disk. Compressed solid-color images keep the inputs small.
export function syntheticPdf(pages) {
  const objects = [null];
  const reserve = () => { objects.push(null); return objects.length - 1; };
  const stream = (dictionary, bytes) => Buffer.concat([
    Buffer.from(`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`),
    bytes,
    Buffer.from("\nendstream"),
  ]);
  const catalog = reserve(), pageTree = reserve(), pageIds = [];
  for (const spec of pages) {
    const page = reserve(), contents = reserve();
    pageIds.push(page);
    let resources = "", annotations = "", drawing = Buffer.alloc(0);
    if (!spec.blank) {
      const { width, height } = spec;
      const samples = spec.encoded ?? (spec.broken ? Buffer.from([1, 2, 3, 4]) :
        deflateSync(Buffer.alloc(width * height * 3, spec.white ? 255 : 0)));
      const draw = Buffer.from("q 720 0 0 405 0 0 cm /Im0 Do Q\n");
      if (spec.inline) {
        drawing = Buffer.concat([
          Buffer.from(`q 720 0 0 405 0 0 cm\nBI /W ${width} /H ${height} /BPC 8 /CS /RGB /F /Fl ID\n`),
          samples,
          Buffer.from("\nEI\nQ\n"),
        ]);
      } else {
        let maskRef = "";
        if (spec.mask) {
          const mask = reserve();
          const maskData = deflateSync(Buffer.alloc(spec.mask.width * spec.mask.height, 255));
          objects[mask] = stream(`/Type /XObject /Subtype /Image /Width ${spec.mask.width} /Height ${spec.mask.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, maskData);
          maskRef = `/SMask ${mask} 0 R`;
        }
        const image = reserve();
        objects[image] = stream(`/Type /XObject /Subtype /Image ${spec.missingWidth ? "" : `/Width ${width}`} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${spec.filter ?? "FlateDecode"} ${maskRef}`, samples);
        const imageResources = `/XObject << /Im0 ${image} 0 R >>`;
        if (spec.form || spec.annotation) {
          const form = reserve();
          objects[form] = stream(`/Type /XObject /Subtype /Form /BBox [0 0 720 405] /Resources << ${imageResources} >>`, draw);
          if (spec.annotation) {
            const annotation = reserve();
            objects[annotation] = `<< /Type /Annot /Subtype /Stamp /Rect [0 0 720 405] /F 4 /AP << /N ${form} 0 R >> >>`;
            annotations = `/Annots [${annotation} 0 R]`;
          } else {
            resources = `/XObject << /Fm0 ${form} 0 R >>`;
            drawing = Buffer.from("/Fm0 Do\n");
          }
        } else {
          resources = imageResources;
          drawing = draw;
        }
      }
    }
    const background = spec.background ? Buffer.from("q 1 0 0 rg 0 0 720 405 re f Q\n") : Buffer.alloc(0);
    objects[contents] = stream("", Buffer.concat([background, drawing]));
    objects[page] = `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 720 405] /Resources << ${resources} >> /Contents ${contents} 0 R ${annotations} >>`;
  }
  objects[catalog] = `<< /Type /Catalog /Pages ${pageTree} 0 R >>`;
  objects[pageTree] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  const chunks = [Buffer.from("%PDF-1.7\n")], offsets = [0];
  let length = chunks[0].length;
  for (let id = 1; id < objects.length; id++) {
    offsets.push(length);
    const body = Buffer.isBuffer(objects[id]) ? objects[id] : Buffer.from(objects[id]);
    const object = Buffer.concat([Buffer.from(`${id} 0 obj\n`), body, Buffer.from("\nendobj\n")]);
    chunks.push(object);
    length += object.length;
  }
  const entries = offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  chunks.push(Buffer.from(`xref\n0 ${objects.length}\n0000000000 65535 f \n${entries}trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R >>\nstartxref\n${length}\n%%EOF`));
  return Buffer.concat(chunks);
}

export async function createPdfBrowserHarness({
  importWorker, pdfWorker: emittedPdfWorker, browserType = chromium, embeddedResources = false, routeOnly = false,
} = {}) {
  if (routeOnly && !embeddedResources) throw new Error("Route-only mode requires in-memory resources.");
  const browser = await browserType.launch();
  const context = await browser.newContext({ offline: !routeOnly, serviceWorkers: "block" });
  const page = await context.newPage();
  const unexpectedRequests = [], pageErrors = [];
  const pdfModule = readFileSync(new URL("../node_modules/pdfjs-dist/legacy/build/pdf.mjs", import.meta.url));
  const pdfWorker = emittedPdfWorker ?? readFileSync(new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url));
  const wrapper = importWorker ?? readFileSync(new URL("../src/lib/pdf-import-worker.mjs", import.meta.url));
  const source = ts.transpileModule(readFileSync(new URL("../src/lib/pdf-import.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (!embeddedResources && url.origin === "http://forge-pdf.test") {
      if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Offline PDF test</title>" });
      if (url.pathname === "/pdf.mjs") return route.fulfill({ contentType: "text/javascript", body: pdfModule });
      if (url.pathname === "/pdf.worker.mjs") return route.fulfill({ contentType: "text/javascript", body: pdfWorker });
      if (url.pathname === "/import-worker.mjs") return route.fulfill({ contentType: "text/javascript", body: wrapper });
      if (url.pathname === "/warning-worker.mjs") return route.fulfill({ contentType: "text/javascript", body: 'console.warn("synthetic-private-warning-marker");' });
      if (url.pathname === "/protocol-worker.mjs") return route.fulfill({ contentType: "text/javascript", body: `
        self.postMessage({stream:5,reason:{message:"Image exceeded maximum allowed size and was removed."}});
        self.postMessage({action:"obj",data:["local",0,"Image",null]});
        self.postMessage({action:"commonobj",data:["shared","Image",null]});
        self.postMessage({action:"obj",data:["large",0,"Image",{width:2001,height:2000}]});
        self.postMessage({action:"obj",data:["valid",0,"Image",{width:2000,height:2000}]});
      ` });
    }
    unexpectedRequests.push(url.origin);
    return route.abort();
  });
  page.on("pageerror", error => pageErrors.push(error.name));
  try {
    if (embeddedResources) {
      // Some engines reject fulfilled navigations or opaque-origin blob
      // workers while offline. Data modules need no navigation or socket.
      await page.setContent("<!doctype html><title>Offline PDF test</title>");
      const denyNetwork = `
        const forgeDenyNetwork = () => { throw new Error("Synthetic test forbids network access."); };
        self.fetch = forgeDenyNetwork;
        self.XMLHttpRequest = class { constructor() { forgeDenyNetwork(); } };
        self.WebSocket = class { constructor() { forgeDenyNetwork(); } };
        self.EventSource = class { constructor() { forgeDenyNetwork(); } };
      `;
      await page.evaluate(({ module, worker, wrapper }) => {
        const url = text => `data:text/javascript;base64,${text}`;
        globalThis.forgePdfUrls = { module: url(module), worker: url(worker), wrapper: url(wrapper) };
      }, {
        module: pdfModule.toString("base64"), worker: pdfWorker.toString("base64"),
        wrapper: Buffer.concat([Buffer.from(denyNetwork), Buffer.from(wrapper)]).toString("base64"),
      });
      if (routeOnly) {
        await page.evaluate(() => {
          const deny = () => { throw new Error("Synthetic test forbids network access."); };
          globalThis.fetch = deny;
          globalThis.XMLHttpRequest = class { constructor() { deny(); } };
          globalThis.WebSocket = class { constructor() { deny(); } };
          globalThis.EventSource = class { constructor() { deny(); } };
        });
      }
    } else {
      await page.goto("http://forge-pdf.test/");
    }
    await page.evaluate(sourceCode => {
      const mod = { exports: {} };
      const require = name => {
        if (name === "./pdf-worker-url") return {
          pdfWorkerUrl: globalThis.forgePdfUrls?.worker ?? "/pdf.worker.mjs",
          pdfImportWorkerUrl: globalThis.forgePdfUrls?.wrapper ?? "/import-worker.mjs",
        };
        throw new Error(`Unexpected importer dependency: ${name}`);
      };
      new Function("require", "module", "exports", sourceCode)(require, mod, mod.exports);
      globalThis.forgePdfImporter = mod.exports;
    }, source);
  } catch (error) {
    await context.close();
    await browser.close();
    throw error;
  }
  return {
    page,
    unexpectedRequests,
    pageErrors,
    async importPdf(bytes, { samplePositions = [] } = {}) {
      return page.evaluate(async ({ base64, samplePositions }) => {
        const pdfjs = await import(globalThis.forgePdfUrls?.module ?? "/pdf.mjs");
        const data = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
        const file = new File([data], "local-test.pdf", { type: "application/pdf" });
        const pages = [];
        try {
          const count = await globalThis.forgePdfImporter.renderPdfPages(file, async (number, image, width, height) => {
            const bitmap = await createImageBitmap(image);
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext("2d");
            context.drawImage(bitmap, 0, 0);
            const pixels = context.getImageData(0, 0, width, height).data;
            let nonwhitePixels = 0;
            for (let i = 0; i < pixels.length; i += 4) {
              if (pixels[i] < 250 || pixels[i + 1] < 250 || pixels[i + 2] < 250) nonwhitePixels++;
            }
            const samples = samplePositions.map(([x, y]) => {
              const column = Math.max(0, Math.min(width - 1, Math.floor(width * x)));
              const row = Math.max(0, Math.min(height - 1, Math.floor(height * y)));
              const offset = (row * width + column) * 4;
              return Array.from(pixels.slice(offset, offset + 3));
            });
            bitmap.close();
            canvas.width = 0;
            canvas.height = 0;
            pages.push({
              number, width, height, nonwhitePixels, pngBytes: image.size,
              ...(samplePositions.length ? { samples } : {}),
            });
          }, { loadPdfjs: async () => pdfjs });
          return { count, pages };
        } catch (error) {
          return { error: error instanceof Error ? error.message : "Unknown import error", pages };
        }
      }, { base64: bytes.toString("base64"), samplePositions });
    },
    async close() {
      await context.close();
      await browser.close();
    },
  };
}
