// Narrow PDF upload follow-up: real importer component/editor/CSS in the
// offline portal harness; PDF rendering and storage actions are synthetic.
import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {chromium} from "@playwright/test";
import {transpile} from "./slide-authoring-harness.mjs";
import {mountPresentation,sources} from "./presentation-browser-harness.mjs";

sources["upload"]=transpile("../src/components/create-lesson.tsx")
  .replaceAll('require("./presentation-editor")','require("editor")');
for(const [name,path] of [
  ["@/lib/slide-lesson","slide-lesson"],["./learning","learning"],["./curriculum","curriculum"],
])sources[name]=transpile(`../src/lib/${path}.ts`);
sources["./presentation.ts"]=sources["@/lib/presentation"];
const file=(name="synthetic.pdf")=>({name,mimeType:"application/pdf",buffer:Buffer.from("%PDF-1.7 synthetic upload fixture")});
const pageResult={pages:[[120,60],[60,120]]};
const imageDraftIds=[];
const title=page=>page.getByLabel("Lesson title",{exact:true});
const button=(page,name)=>page.getByRole("button",{name,exact:true});
async function mountUpload(page,readResult=()=>pageResult,events=[],discardResult={success:"Unused private pages removed."}){
  let uploaded=0;
  await page.exposeFunction("images",async(name,payload)=>{
    events.push({name,payload});
    if(name==="begin"){const id=crypto.randomUUID();imageDraftIds.push(id);return {id};}
    if(name==="upload"){
      uploaded++;
      const match=/pdf-page-(\d+)\.png/.exec(payload.name??"");
      const [width,height]=pageResult.pages[(Number(match?.[1]??uploaded)-1)%pageResult.pages.length];
      return {id:crypto.randomUUID(),width,height};
    }
    if(name==="discard")return discardResult;
    return {success:"Synthetic cleanup complete."};
  });

  await page.exposeFunction("readPdfResult",readResult);
  await mountPresentation(page);
  await page.evaluate(()=>{
    document.querySelector(".portal-heading h1").textContent="Upload a file.";
    presentationRoot.render(presentationModules("react").createElement(presentationModules("upload").UploadLessonPage,
      {ownerId:"00000000-0000-4000-8000-000000000001"}));
  });
  await page.getByLabel("PDF file",{exact:true}).waitFor();
}
async function preview(page,name="synthetic.pdf"){
  await page.getByLabel("PDF file",{exact:true}).setInputFiles(file(name));
  await button(page,"Import PDF pages").click();
  await page.waitForFunction(()=>document.activeElement===document.querySelector(".presentation-document-bar input"));
  await page.waitForFunction(()=>document.querySelector(".canvas-container")&&editCanvas.getObjects().length===1);
  await page.waitForTimeout(100);
}
async function geometry(page){
  return page.evaluate(()=>{
    const r=selector=>{
      const b=document.querySelector(selector).getBoundingClientRect();
      return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom,right:b.right};
    };
    return {editor:r(".presentation-editor"),canvas:r(".canvas-container"),
      importer:r(".presentation-import-bar"),scrollY,overflow:document.documentElement.scrollWidth>innerWidth};
  });
}

test("PDF safety guidance wraps and keeps controls reachable at mobile and desktop widths",async()=>{
  const browser=await chromium.launch(),context=await browser.newContext({offline:true,serviceWorkers:"block"});
  const artifacts=await mkdtemp(join(tmpdir(),"forge-pdf-guidance-")),requests=[];
  try{
    await context.route("**/*",route=>{requests.push(route.request().url());return route.abort();});
    for(const width of [320,1440]){
      const page=await context.newPage();
      await page.setViewportSize({width,height:900});
      await mountUpload(page);
      const guidance=page.locator("#upload-importer p").filter({hasText:"PDF only."});
      assert.match(await guidance.innerText(),/4,000,000 pixels/);
      assert.match(await guidance.innerText(),/not a hard safety guarantee/);
      const bounds=await guidance.boundingBox();
      assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=width);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:join(artifacts,`guidance-${width}.png`),fullPage:true});
      await page.getByLabel("PDF file",{exact:true}).focus();
      await page.keyboard.press("Tab");
      assert.equal(await button(page,"Import PDF pages").evaluate(el=>el===document.activeElement),true);
      await page.close();
    }
    console.log("Synthetic PDF guidance screenshots:",artifacts);
    assert.deepEqual(requests,[]);
  }finally{await context.close();await browser.close();}
});

test("a later PDF image failure shows an alert and discards the incomplete private draft",async()=>{
  const browser=await chromium.launch(),context=await browser.newContext({offline:true,serviceWorkers:"block",viewport:{width:320,height:900}});
  const page=await context.newPage(),events=[],requests=[];
  const message="An embedded PDF image exceeds the 4,000,000-pixel source limit. Reduce the image resolution and export the PDF again.";
  try{
    await context.route("**/*",route=>{requests.push(route.request().url());return route.abort();});
    await mountUpload(page,()=>({pages:pageResult.pages,failAfter:1,failMessage:message}),events);
    await page.getByLabel("PDF file",{exact:true}).setInputFiles(file("oversized.pdf"));
    await button(page,"Import PDF pages").click();
    assert.equal(await page.getByRole("alert").innerText(),message);
    await page.waitForFunction(()=>!document.querySelector('input[type="file"]').disabled);
    const steps=events.filter(event=>["begin","upload","discard"].includes(event.name));
    assert.deepEqual(steps.map(event=>event.name),["begin","upload","discard"]);
    assert.equal(steps[1].payload.draftId,steps[2].payload);
    assert.equal(await title(page).count(),0);
    assert.equal(await page.getByLabel("PDF file",{exact:true}).evaluate(el=>el.files[0].name),"oversized.pdf");
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(requests,[]);
  }finally{await context.close();await browser.close();}
});

test("an unconfirmed private draft cleanup remains visible after a PDF image failure",async()=>{
  const browser=await chromium.launch(),context=await browser.newContext({offline:true,serviceWorkers:"block",viewport:{width:320,height:900}});
  const page=await context.newPage(),events=[],requests=[];
  try{
    await context.route("**/*",route=>{requests.push(route.request().url());return route.abort();});
    await mountUpload(page,()=>({pages:pageResult.pages,failAfter:1,failMessage:"PDF image exceeds the source limit."}),events,{error:"Cleanup failed."});
    await page.getByLabel("PDF file",{exact:true}).setInputFiles(file("oversized.pdf"));
    await button(page,"Import PDF pages").click();
    const retry=button(page,"Retry cleanup");await retry.waitFor();
    await page.waitForFunction(()=>!document.querySelector('button[aria-describedby="pdf-import-error"]').disabled);
    assert.match(await page.getByRole("alert").innerText(),/PDF image exceeds the source limit\. Private page cleanup is pending/);
    assert.deepEqual(events.filter(event=>["begin","upload","discard"].includes(event.name)).map(event=>event.name),["begin","upload","discard"]);
    assert.equal(await page.getByLabel("PDF file",{exact:true}).isDisabled(),true);
    assert.equal(await button(page,"Import PDF pages").isDisabled(),true);
    assert.equal(await title(page).count(),0);
    assert.deepEqual(requests,[]);
  }finally{await context.close();await browser.close();}
});

test("uploaded workspace fits desktop shell; 320px importer, primary controls and canvas remain reachable",async()=>{
  const browser=await chromium.launch(),context=await browser.newContext({offline:true,serviceWorkers:"block"});
  const errors=[],requests=[],artifacts=await mkdtemp(join(tmpdir(),"forge-upload-followup-"));
  try{
    await context.route("**/*",route=>{
      if(route.request().url().includes("/api/presentation/assets/"))return route.fulfill({contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/mk0AAAAASUVORK5CYII=","base64")});
      requests.push(route.request().url());return route.abort();
    });
    for(const [width,height,minCanvas] of [[1366,768,540],[1440,900,600],[1910,1080,600],[1920,1080,600],[320,900,260]]){
      const page=await context.newPage();page.on("pageerror",error=>errors.push(error.message));
      await page.setViewportSize({width,height});
      await mountUpload(page);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,"Expanded initial importer must fit.");
      await preview(page);
      assert.equal(await title(page).evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.locator("#upload-importer").isVisible(),false);
      assert.equal(await button(page,"Change file").getAttribute("aria-expanded"),"false");
      assert.match(await page.locator(".presentation-import-bar").innerText(),/synthetic\.pdf · 2 PDF pages/);
      assert.equal(await page.getByRole("radio").count(),0,"Text-only/PPT modes are not exposed in PDF upload.");
      const placement=await page.evaluate(()=>({x:editCanvas.getObjects()[0].left,y:editCanvas.getObjects()[0].top,
        w:editCanvas.getObjects()[0].getScaledWidth(),h:editCanvas.getObjects()[0].getScaledHeight()}));
      assert.ok(Math.abs(placement.x)<1&&Math.abs(placement.y-30)<2&&Math.abs(placement.w-960)<2&&Math.abs(placement.h-480)<2,
        `Landscape PDF page is fitted and centered: ${JSON.stringify(placement)}`);
      const measured=await geometry(page),actions={};
      assert.equal(measured.overflow,false);
      assert.ok(measured.canvas.w>=minCanvas);
      assert.ok(Math.abs(measured.canvas.w/measured.canvas.h-16/9)<.01);
      if(width>=1200){
        assert.equal(measured.scrollY,0,"Do not scroll to obtain passing bounds.");
        assert.ok(measured.editor.bottom<=height,JSON.stringify(measured));
        assert.ok(measured.canvas.y>=0&&measured.canvas.bottom<=height,JSON.stringify(measured));
        for(const name of ["Change file","Save","Save & request approval","Undo","Redo","Add text","Add slide","Fullscreen preview","Export editable PPTX","Lesson settings","Quiz","Help"]){
          const control=button(page,name),bounds=await control.boundingBox();actions[name]=bounds;
          assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=height,`${width}: ${name}`);
          assert.equal(await control.evaluate(el=>{
            const r=el.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
            return at===el||el.contains(at);
          }),true,`${width}: ${name} covered`);
        }
      }
      // Capture the initial layout, without forcing a scroll position.
      await page.screenshot({path:join(artifacts,`upload-${width}.png`),fullPage:true});
      if(width===320){
        await title(page).fill("Retain my uploaded edits");
        await button(page,"Change file").focus();await page.keyboard.press("Enter");
        assert.equal(await page.locator("#upload-importer").isVisible(),true);
        assert.equal(await page.getByLabel("PDF file",{exact:true}).evaluate(el=>el.files[0].name),"synthetic.pdf");
        await page.getByLabel("PDF file",{exact:true}).focus();
        assert.equal(await page.getByLabel("PDF file",{exact:true}).evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.screenshot({path:join(artifacts,"importer-expanded-320.png"),fullPage:true});
        await button(page,"Close importer").focus();await page.keyboard.press("Enter");
        assert.equal(await title(page).inputValue(),"Retain my uploaded edits");
        for(const name of ["Save","Save & request approval","Add text","Fullscreen preview","Export editable PPTX"]){
          const control=button(page,name);await control.focus();await control.scrollIntoViewIfNeeded();
          const bounds=await control.boundingBox();actions[name]=bounds;
          assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=320);
          assert.ok(bounds.y>=0&&bounds.y+bounds.height<=900);
        }
        await page.locator(".presentation-slides > summary").focus();await page.keyboard.press("Enter");
        await button(page,"Add slide").focus();await button(page,"Add slide").scrollIntoViewIfNeeded();
        const add=await button(page,"Add slide").boundingBox();actions["Add slide"]=add;
        assert.ok(add&&add.x>=0&&add.x+add.width<=320&&add.y>=0&&add.y+add.height<=900);
        assert.equal(await button(page,"Add slide").isVisible(),true);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      }
      console.log(`Upload follow-up ${width}x${height}: ${JSON.stringify({geometry:measured,actions})}`);
      await page.close();
    }
    console.log("Upload follow-up screenshots:",artifacts);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  }finally{await context.close();await browser.close();}
});

test("PDF importer retains edits/file; retry, stale rendering and pending/unknown-save locks survive collapse",async()=>{
  const browser=await chromium.launch(),context=await browser.newContext({offline:true,serviceWorkers:"block",viewport:{width:1366,height:768}});
  const page=await context.newPage(),errors=[],requests=[],imports=[],saves=[];
  let importResult=pageResult,releaseSave,saveGate=null;
  page.on("pageerror",error=>errors.push(error.message));
  try{
    await context.route("**/*",route=>{
      if(route.request().url().includes("/api/presentation/assets/"))return route.fulfill({contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/mk0AAAAASUVORK5CYII=","base64")});
      requests.push(route.request().url());return route.abort();
    });
    await page.exposeFunction("persist",async(name,entries)=>{
      saves.push({name,entries});if(saveGate)await saveGate;
      return {saveUncertain:true,error:"Save outcome is unknown. Keep this input and check Your created lessons."};
    });
    await mountUpload(page,async name=>{imports.push(name);return typeof importResult==="function"?await importResult():importResult;});await preview(page);
    await title(page).fill("Keep unsaved work");
    const contents=await page.evaluate(()=>JSON.stringify(editCanvas.getObjects().map(o=>({text:o.text,left:o.left,top:o.top}))));
    await button(page,"Change file").focus();await page.keyboard.press("Enter");
    assert.equal(await button(page,"Close importer").getAttribute("aria-expanded"),"true");
    await button(page,"Close importer").focus();await page.keyboard.press("Enter");
    assert.equal(await title(page).inputValue(),"Keep unsaved work");
    assert.equal(await page.evaluate(()=>JSON.stringify(editCanvas.getObjects().map(o=>({text:o.text,left:o.left,top:o.top})))),contents);
    assert.equal(imports.length,1,"Opening/closing must not reimport or autosave.");assert.equal(saves.length,0);
    await button(page,"Change file").click();
    assert.equal(await title(page).count(),1,"Opening the importer does not replace the current preview.");
    importResult={error:"Could not render this PDF."};
    await button(page,"Import PDF pages").click();await page.getByRole("alert").waitFor();
    assert.equal(await page.locator("#upload-importer").isVisible(),true);
    assert.equal(await page.getByLabel("PDF file",{exact:true}).evaluate(el=>el.files[0].name),"synthetic.pdf");
    importResult=pageResult;
    await button(page,"Import PDF pages").click();
    await page.waitForFunction(()=>document.activeElement===document.querySelector(".presentation-document-bar input"));
    await button(page,"Change file").click();
    await page.getByLabel("PDF file",{exact:true}).setInputFiles(file("changed.pdf"));
    assert.equal(await title(page).count(),0,"File changes still invalidate the old preview.");
    // Queue an older extraction, then a late input event. Disabled controls do
    // not normally emit this; epoch protection must still reject the old result.
    let releaseImport;
    importResult=()=>new Promise(resolve=>{releaseImport=resolve;});
    const before=imports.length;
    await page.locator("#upload-importer").evaluate(form=>{
      form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
      form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
    });
    await page.waitForFunction(()=>document.querySelector('input[type="file"]').disabled);
    assert.equal(imports.length,before+1,"Same-tick import submissions stay guarded.");
    await page.getByLabel("PDF file",{exact:true}).evaluate(el=>el.dispatchEvent(new Event("change",{bubbles:true})));
    await new Promise(resolve=>{const wait=()=>releaseImport?resolve():setTimeout(wait,10);wait();});
    releaseImport({pages:[[120,60]]});
    await button(page,"Import PDF pages").waitFor();
    await page.waitForFunction(()=>!document.querySelector('input[type="file"]').disabled);
    assert.equal(await title(page).count(),0,"A late old result cannot resurrect a preview.");
    importResult=pageResult;await button(page,"Import PDF pages").click();
    await page.waitForFunction(()=>document.activeElement===document.querySelector(".presentation-document-bar input"));
    assert.match(await page.locator(".presentation-import-bar").innerText(),/changed\.pdf · 2 PDF pages/);
    await title(page).fill("Keep uncertain uploaded lesson");
    saveGate=new Promise(resolve=>{releaseSave=resolve;});
    await button(page,"Save").click();
    await page.waitForFunction(()=>document.querySelector(".presentation-import-bar button").disabled);
    assert.equal(await button(page,"Change file").isDisabled(),true);
    assert.equal(await page.getByLabel("PDF file",{exact:true}).isDisabled(),true);
    const reads=imports.length;
    await page.locator("#upload-importer").evaluate(form=>form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    assert.equal(imports.length,reads,"A late hidden-form submit cannot bypass the save lock.");
    releaseSave();
    await page.getByRole("alert").filter({hasText:/Save outcome is unknown/}).waitFor();
    assert.equal(await button(page,"Change file").isDisabled(),true);
    assert.equal(await button(page,"Save").isDisabled(),true);
    assert.equal(await title(page).inputValue(),"Keep uncertain uploaded lesson");
    assert.equal(saves.length,1);assert.deepEqual(imports,["synthetic.pdf","synthetic.pdf","synthetic.pdf","changed.pdf","changed.pdf"]);
    assert.ok(Array.isArray(saves[0].entries),`Persist payload was ${typeof saves[0].entries} for ${saves[0].name}`);
    const saved=Object.fromEntries(saves[0].entries),content=JSON.parse(saved.content);
    assert.equal(saved.format,"presentation");assert.equal(saved.draftId,imageDraftIds.at(-1));
    assert.equal(content.document.slides.length,2);
    assert.deepEqual(content.document.slides.map(slide=>slide.elements[0].type),["image","image"]);
    assert.deepEqual(content.document.slides.map(slide=>[slide.elements[0].x,slide.elements[0].y,slide.elements[0].w,slide.elements[0].h]),
      [[0,30,960,480],[345,0,270,540]]);
    assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  }finally{releaseSave?.();await context.close();await browser.close();}
});
