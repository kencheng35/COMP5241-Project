import { cp, mkdtemp, symlink, unlink, rm, readdir, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../",import.meta.url));
const snapshot = await mkdtemp(join(tmpdir(),"forge-slide-build-"));
let linked = false;
try {
  for (const name of ["src","package.json","package-lock.json","tsconfig.json","next-env.d.ts","next.config.ts","postcss.config.mjs","eslint.config.mjs"]) {
    await cp(join(root,name),join(snapshot,name),{recursive:true,filter:path=>!/^\.env/i.test(path.split(/[/\\]/).at(-1))});
  }
  if ((await readdir(snapshot)).some(name=>name.startsWith(".env"))) throw new Error("Snapshot is not environment-file-free");
  if(process.argv.includes("--presentation-gate")){
    await mkdir(join(snapshot,"src/app/presentation-packaging"),{recursive:true});
    await cp(join(root,"tests/presentation-packaging.tsx"),join(snapshot,"src/app/presentation-packaging/page.tsx"));
  }
  await symlink(join(root,"node_modules"),join(snapshot,"node_modules"),"junction"); linked = true;
  const os = {};
  for (const key of ["SystemRoot","WINDIR","TEMP","TMP","USERPROFILE","LOCALAPPDATA","APPDATA","COMSPEC","PATHEXT"]) if(process.env[key]) os[key]=process.env[key];
  const env = {
    ...os, PATH:`${dirname(process.execPath)};${os.SystemRoot}\\System32;${os.SystemRoot}`, NEXT_TELEMETRY_DISABLED:"1", CI:"1",
    NODE_OPTIONS:`--disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import="${new URL("./offline-build-guard.mjs",import.meta.url).href}"`,
  };
  let completed = true;
  for (const args of [
    [join(root,"node_modules","next","dist","bin","next"),"typegen"],
    [join(root,"node_modules","typescript","bin","tsc"),"--noEmit","--incremental","false"],
    [join(root,"node_modules","next","dist","bin","next"),"build","--webpack"],
  ]) {
    console.log("Isolated command:",args.slice(1).join(" "));
    const result = spawnSync(process.execPath,args,{cwd:snapshot,env,stdio:"inherit"});
    if(result.error) throw result.error;
    if(result.status !== 0){process.exitCode = result.status ?? 1;completed = false;break;}
  }
  if(completed && process.argv.includes("--pdf-import-worker-gate")){
    const media = join(snapshot,".next/static/media");
    const files = await readdir(media);
    const wrappers = files.filter(name=>/^pdf-import-worker\..+\.mjs$/.test(name));
    const workers = files.filter(name=>/^pdf\.worker\..+\.mjs$/.test(name));
    if(wrappers.length!==1 || workers.length!==1) throw new Error("The PDF import worker assets were not emitted.");
    const remaining = new Set([...wrappers,...workers]), directories = [join(snapshot,".next/static/chunks")];
    while(directories.length && remaining.size){
      const directory = directories.pop();
      for(const entry of await readdir(directory,{withFileTypes:true})){
        const path = join(directory,entry.name);
        if(entry.isDirectory()) directories.push(path);
        else if(entry.name.endsWith(".js")){
          const chunk = await readFile(path,"utf8");
          for(const asset of remaining) if(chunk.includes(asset)) remaining.delete(asset);
        }
      }
    }
    if(remaining.size) throw new Error("The PDF import worker assets are not referenced by the client bundle.");
    const {createPdfBrowserHarness,syntheticPdf} = await import("./pdf-import-browser-harness.mjs");
    const harness = await createPdfBrowserHarness({
      importWorker:await readFile(join(media,wrappers[0])),
      pdfWorker:await readFile(join(media,workers[0])),
    });
    try {
      const bounded = await harness.importPdf(syntheticPdf([{width:2000,height:2000}]));
      const oversized = await harness.importPdf(syntheticPdf([{width:2001,height:2000}]));
      const blank = await harness.importPdf(syntheticPdf([{blank:true}]));
      if(bounded.count!==1 || !bounded.pages[0].nonwhitePixels ||
        !oversized.error?.includes("4,000,000-pixel source limit") || oversized.pages.length ||
        blank.count!==1 || blank.pages[0].nonwhitePixels ||
        harness.unexpectedRequests.length || harness.pageErrors.length) {
        throw new Error("The emitted PDF import worker failed its offline browser checks.");
      }
    } finally { await harness.close(); }
    console.log("PDF import worker assets emitted:",wrappers[0],workers[0]);
  }
} finally {
  if(linked) await unlink(join(snapshot,"node_modules"));
  await rm(snapshot,{recursive:true,force:true});
  console.log("Removed owned build snapshot and dependency junction:",snapshot);
}
