import test from "node:test";
import assert from "node:assert/strict";
import { publicConfig } from "../src/lib/public-config.ts";

const configured = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-test-key",
  NEXT_PUBLIC_SITE_URL: "https://learn.example.org/",
};

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