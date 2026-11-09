import test from "node:test";
import assert from "node:assert/strict";
import {load} from "./slide-authoring-harness.mjs";

const pdf=load("../src/lib/pdf-import.ts",{"./pdf-worker-url":{pdfWorkerUrl:"https://forge.test/pdf.worker.mjs",pdfImportWorkerUrl:"https://forge.test/import-worker.mjs"}});
const source=()=>new File(["%PDF-1.7\nsynthetic"],"lesson.pdf",{type:"application/pdf"});
const createWorker=async()=>({worker:{},check(){},wait:operation=>operation,close(){}});

test("PDF importer enforces file/page/pixel limits and fits portrait and landscape images",()=>{
  assert.equal(pdf.MAX_PDF_UPLOAD_BYTES,4*1024*1024);
  assert.equal(pdf.MAX_PDF_IMPORT_PAGES,30);
  assert.equal(pdf.MAX_PDF_SOURCE_IMAGE_PIXELS,4_000_000);
  assert.equal(pdf.MAX_PDF_PAGE_RENDER_PIXELS,1920*1080);
  assert.equal(pdf.MAX_PDF_TOTAL_RENDER_PIXELS,40_000_000);
  assert.equal(pdf.MAX_PDF_RENDER_SIDE,3840);
  assert.doesNotThrow(()=>pdf.validatePdfFile({name:"lesson.PDF",size:4*1024*1024}));
  assert.throws(()=>pdf.validatePdfFile({name:"lesson.pptx",size:12}),/Only PDF/);
  assert.throws(()=>pdf.validatePdfFile({name:"lesson.pdf",size:4*1024*1024+1}),/4 MiB/);
  const landscape=pdf.fitPdfPage(1920,1080);
  assert.deepEqual(landscape,{x:0,y:0,w:960,h:540});
  const portrait=pdf.fitPdfPage(600,1200);
  assert.equal(portrait.x,345);assert.equal(portrait.y,0);
  assert.equal(portrait.w/portrait.h,.5);
  const landscapePlan=pdf.pdfPageRenderPlan(960,540);
  assert.deepEqual(landscapePlan,{scale:1.5,width:1440,height:810,pixels:1440*810});
  assert.throws(()=>pdf.pdfPageRenderPlan(1_000_001,540),/dimensions/);
  assert.throws(()=>pdf.pdfPageRenderPlan(1920,1080,pdf.MAX_PDF_TOTAL_RENDER_PIXELS),/pixel limit/);
});

test("PDF importer rasterizes pages sequentially, applies render bounds and releases canvas/task",async()=>{
  const calls=[],canvases=[],rendered=[];
  const dimensions=[[960,540],[600,1200]];
  const pdfjs={
    version:"6.3.289",
    GlobalWorkerOptions:{workerSrc:""},
    getDocument(options){
      calls.push(["load",options]);
      return {
        promise:Promise.resolve({
          numPages:dimensions.length,
          async getPermissions(){return null;},
          async getPage(number){
            const [width,height]=dimensions[number-1];
            return {
              getViewport({scale}){return {width:width*scale,height:height*scale};},
              render({canvasContext,viewport,background}){
                assert.equal(background,"rgb(255, 255, 255)");
                assert.ok(canvasContext);rendered.push({number,width:viewport.width,height:viewport.height});
                return {promise:Promise.resolve()};
              },
              cleanup(){calls.push(["page-cleanup",number]);},
            };
          },
        }),
        async destroy(){calls.push(["destroy"]);},
      };
    },
  };
  const result=await pdf.renderPdfPages(source(),async(number,image,width,height)=>{
    calls.push(["upload",number,image.type,image.name,width,height]);
  },{
    loadPdfjs:async()=>pdfjs,
    createWorker,
    createCanvas(){
      const canvas={
        width:0,height:0,
        getContext(){return {fillStyle:"",fillRect(){}};},
        toBlob(callback,type){callback(new Blob(["synthetic PNG"],{type}));},
      };
      canvases.push(canvas);return canvas;
    },
  });
  assert.equal(result,2);
  assert.deepEqual(calls.filter(call=>call[0]==="upload"),[
    ["upload",1,"image/png","pdf-page-1.png",1440,810],
    ["upload",2,"image/png","pdf-page-2.png",900,1800],
  ]);
  assert.deepEqual(rendered.map(({number})=>number),[1,2]);
  assert.ok(rendered.every(({width,height})=>width*height<=pdf.MAX_PDF_PAGE_RENDER_PIXELS));
  assert.ok(canvases.every(canvas=>canvas.width===0&&canvas.height===0));
  assert.equal(calls.filter(call=>call[0]==="page-cleanup").length,2);
  assert.equal(calls.at(-1)[0],"destroy");
  assert.equal(calls[0][1].maxImageSize,pdf.MAX_PDF_SOURCE_IMAGE_PIXELS);
  assert.equal(calls[0][1].canvasMaxAreaInBytes,pdf.MAX_PDF_PAGE_RENDER_PIXELS*4);
  assert.equal(calls[0][1].stopAtErrors,true);
  assert.equal(calls[0][1].enableXfa,false);
  assert.equal(calls[0][1].isEvalSupported,false);
  assert.equal(calls[0][1].isOffscreenCanvasSupported,false);
  assert.equal(calls[0][1].isImageDecoderSupported,false);
  assert.equal(calls[0][1].useWorkerFetch,false);
  assert.equal(calls[0][1].useWasm,false);
});

test("PDF importer rejects malformed, protected, over-page and unrenderable PDFs clearly",async()=>{
  const invalid=new File(["not pdf"],"wrong.pdf");
  await assert.rejects(pdf.renderPdfPages(invalid,async()=>{},{}),/valid PDF header/);

  const calls=[];
  const mock=(numPages,permissions=null)=>({
    version:"6.3.289",
    GlobalWorkerOptions:{workerSrc:""},
    getDocument(){
      return {promise:Promise.resolve({
        numPages,async getPermissions(){return permissions;},
        async getPage(){throw new Error("Page should not be read");},
      }),async destroy(){calls.push("destroy");}};
    },
  });
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{}, {loadPdfjs:async()=>mock(31),createWorker}),/1–30 pages/);
  assert.deepEqual(calls,["destroy"]);
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{}, {loadPdfjs:async()=>mock(1,[1]),createWorker}),/Password-protected/);
  let started=false;
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{}, {
    loadPdfjs:async()=>({...mock(1),version:"99.0.0"}),
    createWorker:async()=>{started=true;return createWorker();},
  }),/renderer version is not supported/);
  assert.equal(started,false,"An unreviewed worker protocol must not start.");
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{throw new Error("Private upload limit");},{
    loadPdfjs:async()=>mockWithPage(1,612,792),
    createWorker,
    createCanvas:()=>({width:0,height:0,getContext:()=>({fillRect(){}}),toBlob:callback=>callback(new Blob(["x"],{type:"image/png"}))}),
  }),/PDF page 1 could not be stored: Private upload limit/);
});

test("a worker safety failure rejects before upload and releases page, canvas and worker",async()=>{
  const calls=[];
  let waits=0,uploads=0;
  const canvas={width:0,height:0,getContext:()=>({fillRect(){}}),toBlob:callback=>callback(new Blob(["x"]))};
  const pdfjs={
    version:"6.3.289",
    getDocument(){return {promise:Promise.resolve({
      numPages:1,async getPermissions(){return null;},
      async getPage(){return {
        getViewport({scale}){return {width:720*scale,height:405*scale};},
        render(){return {promise:Promise.resolve()};},
        cleanup(){calls.push("page-cleanup");},
      };},
    }),async destroy(){calls.push("destroy");}};},
  };
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{uploads++;},{
    loadPdfjs:async()=>pdfjs,
    createCanvas:()=>canvas,
    createWorker:async()=>({
      worker:{},check(){},
      wait(operation){return ++waits===4 ? Promise.reject(new pdf.PdfImportError("Source image limit")) : operation;},
      close(){calls.push("worker-close");},
    }),
  }),/Source image limit/);
  assert.equal(uploads,0);
  assert.equal(canvas.width,0);assert.equal(canvas.height,0);
  assert.deepEqual(calls,["page-cleanup","destroy","worker-close"]);
});

test("a worker failure during a page upload cannot produce a successful import",async()=>{
  let failed=false,uploads=0,closed=false;
  const canvas={width:0,height:0,getContext:()=>({fillRect(){}}),toBlob:callback=>callback(new Blob(["x"]))};
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{uploads++;failed=true;},{
    loadPdfjs:async()=>mockWithPage(2,720,405),
    createCanvas:()=>canvas,
    createWorker:async()=>({
      worker:{},
      check(){if(failed)throw new pdf.PdfImportError("Worker reported incomplete content");},
      wait:operation=>operation,
      close(){closed=true;},
    }),
  }),/Worker reported incomplete content/);
  assert.equal(uploads,1);
  assert.equal(closed,true);
});

test("a worker failure during final cleanup cannot produce a successful import",async()=>{
  let failed=false,uploads=0,closed=false;
  const base=mockWithPage(1,720,405);
  const pdfjs={...base,getDocument(options){
    const task=base.getDocument(options);
    return {...task,async destroy(){failed=true;}};
  }};
  const canvas={width:0,height:0,getContext:()=>({fillRect(){}}),toBlob:callback=>callback(new Blob(["x"]))};
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{uploads++;},{
    loadPdfjs:async()=>pdfjs,
    createCanvas:()=>canvas,
    createWorker:async()=>({
      worker:{},
      check(){if(failed)throw new pdf.PdfImportError("Late worker failure");},
      wait:operation=>operation,
      close(){closed=true;},
    }),
  }),/Late worker failure/);
  assert.equal(uploads,1);
  assert.equal(closed,true);
});

function mockWithPage(numPages,width,height){
  return {
    version:"6.3.289",
    GlobalWorkerOptions:{workerSrc:""},
    getDocument(){return {promise:Promise.resolve({
      numPages,async getPermissions(){return null;},
      async getPage(){return {
        getViewport({scale}){return {width:width*scale,height:height*scale};},
        render(){return {promise:Promise.resolve()};},cleanup(){},
      };},
    }),async destroy(){}};},
  };
}
