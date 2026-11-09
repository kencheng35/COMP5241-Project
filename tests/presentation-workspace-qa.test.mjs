// Bounded independent UI acceptance. Synthetic route data/extraction only;
// no Next server, environment loader, real upload parser or connected service.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {mkdtemp} from "node:fs/promises";
import {createRequire} from "node:module";
import {dirname,join} from "node:path";
import {tmpdir} from "node:os";
import {chromium} from "@playwright/test";
import {load,transpile,presentation,learning,slides,draft} from "./slide-authoring-harness.mjs";
import {mountPresentation,sources} from "./presentation-browser-harness.mjs";

const require=createRequire(import.meta.url);
const React=require("react"),jsx=require("react/jsx-runtime");
const {renderToStaticMarkup}=require("react-dom/server");
const preflight=readFileSync(join(dirname(require.resolve("tailwindcss/package.json")),"preflight.css"),"utf8");
const css=`@layer base {${preflight}}\n${readFileSync("src/app/globals.css","utf8").replace('@import "tailwindcss";',"")}`;

test("QA actual Studio route selection and rendered width isolation, including denied edits",async()=>{
  const permissions=load("../src/lib/permissions.ts",{});
  const user={id:crypto.randomUUID(),app_metadata:{}};
  let lesson=null,historyReads=0;
  const marker=kind=>function Marker(){return React.createElement("p",{"data-qa":kind},kind);};
  const Studio=load("../src/app/studio/page.tsx",{
    "react/jsx-runtime":jsx,
    "next/navigation":{notFound(){throw new Error("QA not found");}},
    "@/components/learner-shell":{LearnerShell:({children})=>React.createElement("div",{className:"portal-shell"},
      React.createElement("aside",{className:"portal-sidebar"},"Synthetic sidebar"),
      React.createElement("div",{className:"portal-workspace"},
        React.createElement("header",{className:"portal-topbar"},"Synthetic topbar"),children))},
    "@/components/learning-controls":{ActionForm:marker("action"),LessonEditor:marker("standard")},
    "@/components/create-lesson":{UploadLessonPage:marker("upload")},
    "@/components/presentation-editor":{PresentationLessonEditor:marker("presentation")},
    "@/lib/slide-lesson":slides,
    "@/lib/learning":{...learning,collectRows:async()=>{historyReads++;return [];}},
    "@/app/learning/actions":{},
    "@/lib/learning-server":{...permissions,requireUser:async()=>user,accessibleLesson:async()=>lesson,
      displayName:async()=>"Synthetic QA"},
  }).default;
  const browser=await chromium.launch();
  const context=await browser.newContext({offline:true,serviceWorkers:"block",viewport:{width:1440,height:900}});
  const requests=[],page=await context.newPage();
  try{
    await context.route("**/*",route=>{requests.push(route.request().url());return route.abort();});
    const record=content=>({id:crypto.randomUUID(),owner_id:user.id,visibility:"private",version:1,content});
    for(const [name,params,recordValue,wide,kind] of [
      ["history",{},null,false,null],
      ["manual",{manual:"1"},null,true,"presentation"],
      ["upload",{upload:"1"},null,true,"upload"],
      ["presentation edit",{edit:"synthetic"},record(slides.toPresentationLesson({...presentation.blankPresentation(),title:"QA presentation"})),true,"presentation"],
      ["legacy slide edit",{edit:"synthetic"},record(slides.toStoredLesson(draft())),true,"presentation"],
      ["standard edit",{edit:"synthetic"},record({template:"standard"}),false,"standard"],
    ]){
      lesson=recordValue;
      const before=historyReads;
      const html=renderToStaticMarkup(await Studio({searchParams:Promise.resolve(params)}));
      assert.equal(historyReads-before,name==="history"?1:0);
      await page.setContent(`<style>${css}</style>${html}`);
      assert.equal(await page.locator(".presentation-studio").count(),wide?1:0,name);
      if(kind)assert.equal(await page.locator(`[data-qa="${kind}"]`).count(),1,name);
      for(const width of [1440,1920]){
        await page.setViewportSize({width,height:900});
        const geometry=await page.locator(".portal-page").evaluate(el=>({
          width:el.getBoundingClientRect().width,sidebar:getComputedStyle(el.parentElement).marginLeft,
          topbar:document.querySelector(".portal-topbar").getBoundingClientRect().height,
          overflow:document.documentElement.scrollWidth>innerWidth,
        }));
        assert.equal(geometry.width,wide?width-242:850,`${name} ${width}`);
        assert.equal(geometry.sidebar,"242px");assert.equal(geometry.topbar,66);assert.equal(geometry.overflow,false);
        console.log(`QA scope ${name} ${width}: ${JSON.stringify(geometry)}`);
      }
    }
    lesson={...lesson,owner_id:crypto.randomUUID()};
    await assert.rejects(()=>Studio({searchParams:Promise.resolve({edit:"foreign"})}),/QA not found/);
    lesson=null;
    await assert.rejects(()=>Studio({searchParams:Promise.resolve({edit:"missing"})}),/QA not found/);
    await page.setContent(`<style>${css}</style><div class="portal-workspace"><main class="portal-page">Other portal page control</main></div>`);
    assert.equal(await page.locator(".portal-page").evaluate(el=>el.getBoundingClientRect().width),1180);
    assert.deepEqual(requests,[]);
  }finally{await context.close();await browser.close();}
});

test("QA real PDF upload-to-presentation placement retains desktop canvas and initial primary actions",async()=>{
  // Extend the in-memory module harness. Rendering/storage are synthetic;
  // original PDF-only UploadLessonPage JSX/state and editor placement run.
  sources["qa-upload"]=transpile("../src/components/create-lesson.tsx")
    .replaceAll('require("./presentation-editor")','require("editor")');
  sources["@/lib/slide-lesson"]=transpile("../src/lib/slide-lesson.ts");
  sources["./learning"]=transpile("../src/lib/learning.ts");
  sources["./curriculum"]=transpile("../src/lib/curriculum.ts");
  sources["./presentation.ts"]=sources["@/lib/presentation"];
  const browser=await chromium.launch();
  const context=await browser.newContext({offline:true,serviceWorkers:"block"});
  const artifacts=await mkdtemp(join(tmpdir(),"forge-workspace-qa-"));
  const requests=[],errors=[],failures=[];
  try{
    await context.route("**/*",route=>{
      if(route.request().url().includes("/api/presentation/assets/"))return route.fulfill({contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/mk0AAAAASUVORK5CYII=","base64")});
      requests.push(route.request().url());return route.abort();
    });
    for(const [width,height,minCanvas] of [[1440,900,600],[1366,768,540],[1920,1080,600]]){
      const page=await context.newPage();
      page.on("pageerror",error=>errors.push(error.message));
      await page.setViewportSize({width,height});
      await page.exposeFunction("readPdfResult",()=>({pages:[[120,60],[60,120]]}));
      await page.exposeFunction("images",async name=>{
        if(name==="begin")return {id:crypto.randomUUID()};
        if(name==="upload")return {id:crypto.randomUUID(),width:120,height:60};
        if(name==="discard")return {success:"Unused private pages removed."};
        return {success:"Synthetic cleanup complete."};
      });
      await mountPresentation(page);
      await page.evaluate(()=>{
        document.querySelector(".portal-heading h1").textContent="Upload a PDF.";
        presentationRoot.render(presentationModules("react").createElement(presentationModules("qa-upload").UploadLessonPage));
      });
      await page.getByLabel("PDF file",{exact:true}).setInputFiles({
        name:"synthetic.pdf",mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7 synthetic upload fixture"),
      });
      await page.getByRole("button",{name:"Import PDF pages",exact:true}).click();
      await page.getByLabel("Lesson title",{exact:true}).waitFor();
      await page.waitForFunction(()=>document.querySelector(".canvas-container")&&editCanvas.getObjects().length===1);
      assert.equal(await page.getByRole("radio").count(),0);
      await page.waitForTimeout(150);
      const geometry=await page.evaluate(()=>{
        const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom};};
        return {editor:r(".presentation-editor"),canvas:r(".canvas-container"),scrollY,overflow:document.documentElement.scrollWidth>innerWidth};
      });
      const actions={};
      for(const name of ["Save","Save & request approval","Undo","Redo","Add text","Add slide","Fullscreen preview","Export editable PPTX"]){
        const bounds=await page.getByRole("button",{name,exact:true}).boundingBox();
        actions[name]=bounds;
        if(!bounds||bounds.y<0||bounds.y+bounds.height>height)failures.push(`${width}x${height}: ${name} outside initial viewport ${JSON.stringify(bounds)}`);
      }
      if(geometry.editor.w<1100&&width===1440)failures.push(`${width}: editor below 1100px`);
      if(geometry.canvas.w<minCanvas)failures.push(`${width}: canvas ${geometry.canvas.w} below ${minCanvas}px`);
      assert.equal(geometry.overflow,false);
      assert.ok(Math.abs(geometry.canvas.w/geometry.canvas.h-16/9)<.01);
      console.log(`QA upload ${width}x${height}: ${JSON.stringify({geometry,actions})}`);
      await page.screenshot({path:join(artifacts,`upload-${width}.png`),fullPage:true});
      await page.close();
    }
    console.log("QA upload screenshots:",artifacts);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    assert.deepEqual(failures,[],"Uploaded presentations must retain the approved initial-viewport primary controls.");
  }finally{await context.close();await browser.close();}
});
