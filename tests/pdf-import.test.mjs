import test from "node:test";
import assert from "node:assert/strict";
import {load} from "./slide-authoring-harness.mjs";

const pdf=load("../src/lib/pdf-import.ts",{"./pdf-worker-url":{pdfWorkerUrl:"https://forge.test/pdf.worker.mjs"}});
const source=()=>new File(["%PDF-1.7\nsynthetic"],"lesson.pdf",{type:"application/pdf"});

test("PDF importer enforces file/page/pixel limits and fits portrait and landscape images",()=>{
  assert.equal(pdf.MAX_PDF_UPLOAD_BYTES,4*1024*1024);
  assert.equal(pdf.MAX_PDF_IMPORT_PAGES,30);
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
  assert.equal(calls[0][1].maxImageSize,pdf.MAX_PDF_PAGE_RENDER_PIXELS);
  assert.equal(calls[0][1].enableXfa,false);
});

test("PDF importer rejects malformed, protected, over-page and unrenderable PDFs clearly",async()=>{
  const invalid=new File(["not pdf"],"wrong.pdf");
  await assert.rejects(pdf.renderPdfPages(invalid,async()=>{},{}),/valid PDF header/);

  const calls=[];
  const mock=(numPages,permissions=null)=>({
    GlobalWorkerOptions:{workerSrc:""},
    getDocument(){
      return {promise:Promise.resolve({
        numPages,async getPermissions(){return permissions;},
        async getPage(){throw new Error("Page should not be read");},
      }),async destroy(){calls.push("destroy");}};
    },
  });
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{}, {loadPdfjs:async()=>mock(31)}),/1–30 pages/);
  assert.deepEqual(calls,["destroy"]);
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{}, {loadPdfjs:async()=>mock(1,[1])}),/Password-protected/);
  await assert.rejects(pdf.renderPdfPages(source(),async()=>{throw new Error("Private upload limit");},{
    loadPdfjs:async()=>mockWithPage(1,612,792),
    createCanvas:()=>({width:0,height:0,getContext:()=>({fillRect(){}}),toBlob:callback=>callback(new Blob(["x"],{type:"image/png"}))}),
  }),/PDF page 1 could not be stored: Private upload limit/);
});

function mockWithPage(numPages,width,height){
  return {
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
