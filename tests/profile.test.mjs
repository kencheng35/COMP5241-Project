import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const compile = path => ts.transpileModule(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const actionSource = compile("src/app/profile/actions.ts"), pageSource = compile("src/app/profile/page.tsx");
const user = { id: "owner", email: "owner@example.test", user_metadata: { display_name: "Owner" }, app_metadata: {} };
function fixture(options = {}) {
  const calls = [];
  const client = {
    auth: {
      async getUser() { calls.push("auth"); if (options.authThrows) throw new Error("private auth"); return options.auth ?? { data: { user }, error: null }; },
      async updateUser(...args) { calls.push(["email", ...args]); if (options.emailThrows) throw new Error("lost ack"); return options.emailResult ?? { data: { user }, error: null }; },
    },
    from(table) { calls.push(["from", table]); let patch; const filters = []; return {
      select() { return this; }, eq(...filter) { filters.push(filter); return this; },
      update(value) { patch = value; return this; },
      async maybeSingle() {
        if (patch) {
          calls.push(["profile", patch, filters]);
          if (options.saveThrows) throw new Error("lost ack");
          return options.save ?? { error: null, data: { id: user.id } };
        }
        if (options.readThrows) throw new Error("private database");
        return options.read ?? { data: { age: 22, age_range: "18-24", display_name: "Owner", learning_level: "advanced", learning_goals: "Existing goals", preferred_subjects: ["Testing"], avatar_url: null, learning_setup_revision: 0 }, error: null };
      },
    }; },
  };
  const deps = {
    "next/navigation": { redirect(path) { throw new Error(`REDIRECT:${path}`); } },
    "next/cache": { revalidatePath() {} }, zod: require("zod"), sharp: require("sharp"),
    "@supabase/supabase-js": { createClient() { throw new Error("No admin calls in profile tests"); } },
    "@/lib/supabase/server": { async createClient() { if (options.clientThrows) throw new Error("private config"); return client; } },
    "@/lib/public-config": { publicConfig: () => options.noConfig ? null : { siteOrigin: "https://app.invalid" } },
    "@/lib/eligibility": { isDemoAge: value => Number.isInteger(value) && value >= 13 && value <= 120, ageRangeFor: age => age < 18 ? "13-17" : age < 25 ? "18-24" : age < 35 ? "25-34" : "35-plus" },
    "react/jsx-runtime": require("react/jsx-runtime"), "next/link": { __esModule: true, default: "a" },
    "lucide-react": { ShieldCheck: () => null, Trash2: () => null },
    "@/components/learner-shell": { LearnerShell: ({ children }) => children },
    "@/components/profile-form": { ProfileForm: ({ initial, notice }) => require("react").createElement("form", { "data-saveable": true }, JSON.stringify({ initial, notice })) },
    "@/components/email-change-form": { EmailChangeForm: () => require("react").createElement("form", { "aria-label": "Change email" }) },
    "@/components/export-button": { ExportButton: () => require("react").createElement("button", {}, "Export my data") },
    "@/lib/learning-server": { isAdmin: () => false, isInstructor: () => false },
  };
  function load(source) {
    const exports = {};
    runInNewContext(source, { exports, require(name) { if (!deps[name]) throw new Error(name); return deps[name]; }, FormData, File, Buffer, process: { env: {} } });
    return exports;
  }
  return { actions: load(actionSource), page: load(pageSource).default, calls };
}
const profileData = () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ displayName: "Changed name", age: "22", level: "new", subjects: "Testing", goals: "Keep this text", setupRevision: "0" })) data.set(name, value);
  return data;
};
const emailData = () => { const data = new FormData(); data.set("email", "new@example.test"); return data; };

test("profile and email reject user-plus-error and malformed/absent authentication before mutation", async () => {
  for (const options of [{ clientThrows: true }, { authThrows: true }, { auth: { data: { user }, error: { status: 500 } } },
    { auth: { data: { user }, error: { status: 401 } } }, { auth: { data: { user } } }, { auth: { data: { user: null }, error: null } }]) {
    const f = fixture(options);
    const profile = await f.actions.updateProfile({}, profileData());
    assert.ok(profile.error); assert.equal(profile.fields.goals, "Keep this text");
    const email = await f.actions.changeEmail(null, emailData());
    assert.ok(["auth", "unavailable"].includes(email.code)); assert.equal(email.email, "new@example.test");
    assert.equal(f.calls.filter(call => Array.isArray(call) && ["profile", "email"].includes(call[0])).length, 0);
  }
});

test("email action catches operational failures, retains address, distinguishes rejection and lost acknowledgement", async () => {
  for (const [options, expected] of [[{ clientThrows: true }, "unavailable"], [{ authThrows: true }, "unavailable"],
    [{ noConfig: true }, "unavailable"], [{ emailThrows: true }, "unknown"],
    [{ emailResult: { error: { status: 422 } } }, "rejected"], [{ emailResult: { error: { status: 503 } } }, "unknown"],
    [{ emailResult: { data: { user } } }, "unknown"], [{ emailResult: { error: null, data: {} } }, "unknown"], [{}, "sent"]]) {
    const f = fixture(options);
    const result = await f.actions.changeEmail(null, emailData());
    assert.equal(result.code, expected); assert.equal(result.email, "new@example.test");
    assert.doesNotMatch(result.message, /private config|private auth|lost ack/);
    assert.ok(f.calls.filter(call => Array.isArray(call) && call[0] === "email").length <= 1);
    if (expected === "sent") assert.match(result.message, /current and new email inboxes/);
    if (expected === "unknown") assert.match(result.message, /not be automatically replayed/);
  }
  const f = fixture(); const data = emailData(); data.set("email", "invalid");
  assert.equal((await f.actions.changeEmail(null, data)).code, "invalid"); assert.equal(f.calls.length, 0);
});

test("profile actual validation/read/write failures preserve text; avatar retry/removal payload remains deliberate", async () => {
  const invalid = profileData(); invalid.set("age", "12");
  assert.ok((await fixture().actions.updateProfile({}, invalid)).fieldErrors.age);
  for (const options of [{ readThrows: true }, { read: { data: null, error: null } }, { read: { data: null, error: { code: "42703" } } },
    { saveThrows: true }, { save: { error: { code: "23514" } } }]) {
    const f = fixture(options), result = await f.actions.updateProfile({}, profileData());
    assert.ok(result.error); assert.equal(result.fields.goals, "Keep this text");
  }
  const image = await require("sharp")({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
  const data = profileData(); data.set("avatar", new File([image], "synthetic.png", { type: "image/png" }));
  const f = fixture({ save: { error: { code: "23514" } } });
  await f.actions.updateProfile({}, data); await f.actions.updateProfile({}, data);
  const writes = f.calls.filter(call => call[0] === "profile");
  assert.ok(writes.every(([, patch]) => patch.avatar_url.startsWith("data:image/jpeg;base64,")));
  assert.equal(writes[0][1].avatar_url, writes[1][1].avatar_url);
  data.set("removeAvatar", "on");
  await f.actions.updateProfile({}, data);
  assert.equal(f.calls.filter(call => call[0] === "profile").at(-1)[1].avatar_url, null);
  data.delete("avatar"); data.delete("removeAvatar");
  await f.actions.updateProfile({}, data);
  assert.equal(Object.hasOwn(f.calls.filter(call => call[0] === "profile").at(-1)[1], "avatar_url"), false);
});

test("profile page load failures override success query, never offer fallback fields, and retain privacy controls", async () => {
  const { renderToStaticMarkup } = require("react-dom/server");
  for (const options of [{ clientThrows: true }, { authThrows: true }, { readThrows: true },
    { auth: { data: { user }, error: { status: 500 } } }, { read: { data: null, error: { code: "42703" } } }, { read: { data: null, error: null } }]) {
    const f = fixture(options);
    const html = renderToStaticMarkup(await f.page({ searchParams: Promise.resolve({ success: "Saved successfully" }) }));
    assert.doesNotMatch(html, /data-saveable|Saved successfully|Foundation/);
    assert.match(html, /Retry loading/); assert.match(html, /Export my data/); assert.match(html, /\/profile\/delete/);
    assert.match(html, options.read?.data === null && options.read.error === null ? /profile is missing/ : /Could not/);
  }
  const f = fixture();
  const html = renderToStaticMarkup(await f.page({ searchParams: Promise.resolve({}) }));
  assert.match(html, /data-saveable/); assert.match(html, /Existing goals/); assert.match(html, /advanced/);
});

test("ordinary profile saves reject stale setup revisions and use owner-scoped atomic compare-and-swap", async () => {
  const stale = fixture({ read: { data: { age: 22, age_range: "18-24", learning_setup_revision: 1 }, error: null } });
  assert.match((await stale.actions.updateProfile({}, profileData())).error, /newer profile or diagnostic/);
  assert.equal(stale.calls.filter(call => call[0] === "profile").length, 0);
  const raced = fixture({ save: { data: null, error: null } });
  assert.match((await raced.actions.updateProfile({}, profileData())).error, /newer profile or diagnostic/);
  assert.deepEqual(Array.from(raced.calls.find(call => call[0] === "profile")[2], filter => Array.from(filter)), [["id", "owner"], ["learning_setup_revision", 0]]);
  const missing = fixture(); const data = profileData(); data.delete("setupRevision");
  assert.ok((await missing.actions.updateProfile({}, data)).error);
  assert.equal(missing.calls.length, 0);
});

test("profile page missing setup schema blocks editing but not privacy controls", async () => {
  const f = fixture({ read: { data: { age: 22, age_range: "18-24", display_name: "Owner" }, error: null } });
  const html = require("react-dom/server").renderToStaticMarkup(await f.page({ searchParams: Promise.resolve({ success: "Old success" }) }));
  assert.match(html, /schema upgrade/); assert.match(html, /Export my data/);
  assert.doesNotMatch(html, /data-saveable|Old success/);
});
