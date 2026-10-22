import test from "node:test";
import assert from "node:assert/strict";
import { publicConfig } from "../src/lib/public-config.ts";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const configured = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
  NEXT_PUBLIC_SITE_URL: "https://learn.example.org/",
};

test("actual middleware protects reflections and nested paths, including unavailable configuration", async () => {
  const { NextRequest, NextResponse } = createRequire(import.meta.url)("next/server");
  const source = await readFile(new URL("../src/lib/supabase/middleware.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const env of [{}, configured]) {
    let reads = 0;
    const exports = {};
    runInNewContext(output, { exports, URL, process: { env }, require(name) {
      if (name === "next/server") return { NextResponse };
      if (name === "../public-config") return { publicConfig };
      if (name === "@supabase/ssr") return { createServerClient() { return { auth: { async getUser() { reads++; return { data: { user: null }, error: null }; } } }; } };
      throw new Error(`Unexpected middleware dependency ${name}`);
    } });
    for (const path of ["/reflections", "/reflections/anything"]) {
      const response = await exports.updateSession(new NextRequest(`https://learn.example.org${path}`));
      assert.equal(response.status, env === configured ? 307 : 503);
      if (env === configured) assert.equal(new URL(response.headers.get("location")).pathname, "/login");
      else assert.equal(response.headers.get("cache-control"), "no-store");
    }
    assert.equal(reads, env === configured ? 2 : 0);
  }
});

test("accepts hosted and loopback application origins", () => {
  assert.deepEqual(publicConfig(configured), {
    supabaseUrl: "https://example.supabase.co/",
    anonKey: "public-test-key",
    siteOrigin: "https://learn.example.org",
  });
  assert.equal(publicConfig({ ...configured, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })?.siteOrigin, "http://localhost:3000");
});

test("fails closed for missing, partial and malformed public settings", () => {
  for (const env of [
    {},
    ...Object.keys(configured).map(key => ({ ...configured, [key]: undefined })),
    { ...configured, NEXT_PUBLIC_SUPABASE_ANON_KEY: "  " },
    { ...configured, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" },
    { ...configured, NEXT_PUBLIC_SUPABASE_URL: "http://example.supabase.co" },
    { ...configured, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co/other" },
    { ...configured, NEXT_PUBLIC_SITE_URL: "http://learn.example.org" },
    { ...configured, NEXT_PUBLIC_SITE_URL: "https://other.example/a" },
    { ...configured, NEXT_PUBLIC_SITE_URL: "https://user:pass@learn.example.org" },
    { ...configured, NEXT_PUBLIC_SITE_URL: "https://learn.example.org?next=bad" },
  ]) assert.equal(publicConfig(env), null);
});