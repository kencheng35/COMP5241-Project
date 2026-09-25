import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
import { z } from "zod";
import { ageRangeFor, isAiEligible, isDemoAge } from "../src/lib/eligibility.ts";

test("demo ages start at 13 and require a valid numeric integer", () => {
  for (const age of [undefined, null, "", "18", 12, 12.9, 17.5, NaN, Infinity, -1, 121, {}, true]) {
    assert.equal(isDemoAge(age), false);
    assert.equal(isAiEligible(age, { app_metadata: { ai_access: true } }), false);
  }
  for (const age of [13, 17, 18, 35, 120]) assert.equal(isDemoAge(age), true);
});

test("external AI requires an adult profile age and a trusted boolean grant", () => {
  for (const age of [12, 13, 17]) assert.equal(isAiEligible(age, { app_metadata: { ai_access: true } }), false);
  for (const age of [18, 24, 35, 120]) {
    assert.equal(isAiEligible(age, { app_metadata: { ai_access: true } }), true);
    for (const ai_access of [undefined, false, "true", 1, {}, []]) {
      assert.equal(isAiEligible(age, { app_metadata: { ai_access } }), false);
    }
    assert.equal(isAiEligible(age, {}), false);
    assert.equal(isAiEligible(age, { user_metadata: { ai_access: true, age: 18 } }), false);
  }
});

test("editable metadata cannot override the profile age or trusted grant", () => {
  const forged = { user_metadata: { age: 18, age_range: "18-24", ai_access: true, app_metadata: { ai_access: true } } };
  assert.equal(isAiEligible(undefined, { ...forged, app_metadata: { ai_access: true } }), false);
  assert.equal(isAiEligible(17, { ...forged, app_metadata: { ai_access: true } }), false);
  assert.equal(isAiEligible(18, { ...forged, app_metadata: { ai_access: false } }), false);
  assert.equal(isAiEligible(18, forged), false);
});

test("age bands are derived only from valid numeric ages", () => {
  for (const [age, band] of [[13, "13-17"], [17, "13-17"], [18, "18-24"], [24, "18-24"], [25, "25-34"], [34, "25-34"], [35, "35-plus"]]) {
    assert.equal(ageRangeFor(age), band);
  }
  assert.throws(() => ageRangeFor(12));
});

async function loadServerModule(path, dependencies) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, {
    exports, FormData, File,
    process: { env: {} },
    require(name) {
      if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("server AI guard checks the database profile and fails closed on lookup failure", async () => {
  const user = { id: "synthetic-user", app_metadata: { ai_access: true } };
  let result = { data: { age: 18 }, error: null };
  let unavailable = false;
  const { requireAiAccess } = await loadServerModule("../src/lib/ai-eligibility-server.ts", {
    "server-only": {},
    "@/lib/eligibility": { isAiEligible },
    "@/lib/learning-server": { database() {
      if (unavailable) throw new Error("Synthetic database failure");
      return { from(table) {
        assert.equal(table, "profiles");
        return { select(columns) {
          assert.equal(columns, "age");
          return { eq(column, id) {
            assert.equal(column, "id");
            assert.equal(id, user.id);
            return { async maybeSingle() { return result; } };
          } };
        } };
      } };
    } },
  });
  assert.equal(await requireAiAccess(user), undefined);
  await assert.rejects(requireAiAccess({ ...user, app_metadata: {}, user_metadata: { ai_access: true } }), /External AI requires/);
  for (const age of [undefined, null, 12, 13, 17, "18"]) {
    result = { data: { age }, error: null };
    await assert.rejects(requireAiAccess(user), /External AI requires/);
  }
  for (const lookup of [{ data: null, error: null }, { data: { age: 18 }, error: new Error("Synthetic query failure") }]) {
    result = lookup;
    await assert.rejects(requireAiAccess(user), /External AI requires/);
  }
  unavailable = true;
  await assert.rejects(requireAiAccess(user), /External AI requires/);
});

test("signup validates numeric age and never writes a trusted AI grant or guardian consent", async () => {
  let signup;
  const { signUp } = await loadServerModule("../src/app/auth/actions.ts", {
    "next/navigation": { redirect() { throw new Error("Synthetic redirect"); } },
    zod: { z },
    "@/lib/eligibility": { isDemoAge, ageRangeFor },
    "@/lib/public-config": { publicConfig: () => ({ siteOrigin: "https://example.test" }) },
    "@/lib/supabase/server": { async createClient() { return { auth: { async signUp(value) { signup = value; return { error: null }; } } }; } },
  });
  function signupForm(age) {
    const form = new FormData();
    for (const [name, value] of Object.entries({ name: "Demo Learner", email: "demo@example.test", password: "Synthetic1", ai_access: "true", consent: "on", ageRange: "18-24" })) form.set(name, value);
    if (age !== undefined) form.set("age", age);
    return form;
  }
  for (const age of [undefined, "", "12", "13.5", "invalid", "121"]) {
    const result = await signUp({}, signupForm(age));
    assert.ok(result.fieldErrors.age);
    assert.equal(signup, undefined);
  }
  for (const age of [13, 17, 18]) {
    await assert.rejects(signUp({}, signupForm(String(age))), /Synthetic redirect/);
    assert.equal(signup.options.data.age, age);
    assert.equal(signup.options.data.age_range, ageRangeFor(age));
    assert.equal(signup.options.data.ai_access, undefined);
    assert.equal(signup.options.data.guardian_consent_self_attested, undefined);
    assert.equal(signup.app_metadata, undefined);
  }
});

test("profile saves enforce age and cannot grant AI access or silently promote known underage accounts", async () => {
  let saved;
  let existing = { age: null, age_range: "18-24" };
  let profileError = null;
  const { updateProfile } = await loadServerModule("../src/app/profile/actions.ts", {
    "next/navigation": { redirect() { throw new Error("Synthetic redirect"); } },
    "next/cache": { revalidatePath() {} },
    zod: { z }, sharp: {}, "@supabase/supabase-js": {}, "@/lib/public-config": {},
    "@/lib/eligibility": { isDemoAge, ageRangeFor },
    "@/lib/supabase/server": { async createClient() { return {
      auth: { async getUser() { return { data: { user: { id: "synthetic-user" } } }; } },
      from() { return {
        select() { return { eq() { return { async maybeSingle() { return { data: existing, error: profileError }; } }; } }; },
        async upsert(value) { saved = value; return { error: null }; },
      }; },
    }; } },
  });
  function profileForm(age) {
    const form = new FormData();
    for (const [name, value] of Object.entries({ displayName: "Demo Learner", level: "foundation", subjects: "", goals: "", ai_access: "true" })) form.set(name, value);
    if (age !== undefined) form.set("age", age);
    return form;
  }
  for (const age of [undefined, "", "12", "17.5", "invalid"]) {
    assert.ok((await updateProfile({}, profileForm(age))).fieldErrors.age);
    assert.equal(saved, undefined);
  }
  for (const legacy of [{ age: null, age_range: "under-13" }, { age: 12, age_range: "18-24" }]) {
    existing = legacy;
    assert.match((await updateProfile({}, profileForm("18"))).error, /administrator review/);
    assert.equal(saved, undefined);
  }
  existing = { age: 17, age_range: "13-17" };
  profileError = new Error("Synthetic lookup failure");
  assert.match((await updateProfile({}, profileForm("18"))).error, /Could not verify/);
  assert.equal(saved, undefined);
  profileError = null;
  for (const age of [13, 17, 18]) {
    await assert.rejects(updateProfile({}, profileForm(String(age))), /Synthetic redirect/);
    assert.equal(saved.age, age);
    assert.equal(saved.age_range, ageRangeFor(age));
    assert.equal(saved.ai_access, undefined);
    assert.equal(saved.app_metadata, undefined);
  }
});

test("age migration rejects invalid direct signups and new profile writes while preserving legacy rows for review", async () => {
  const database = new PGlite();
  try {
    await database.exec(`create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql as 'select null::uuid';`);
    await database.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    const legacy = "00000000-0000-4000-8000-000000000001";
    const adultLegacy = "00000000-0000-4000-8000-000000000002";
    const candidate = "00000000-0000-4000-8000-000000000003";
    await database.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [legacy, JSON.stringify({ age_range: "under-13" })]);
    await database.query("insert into auth.users(id) values($1)", [adultLegacy]);
    await database.exec(await readFile(new URL("../supabase/migrations/20260929_age_eligibility.sql", import.meta.url), "utf8"));
    const legacyProfiles = (await database.query("select age from profiles where id in ($1,$2)", [legacy, adultLegacy])).rows;
    assert.equal(legacyProfiles.length, 2);
    assert.ok(legacyProfiles.every(profile => profile.age === null));
    const constraints = (await database.query("select convalidated from pg_constraint where conname in ('profiles_age_eligibility','profiles_age_range_consistent')")).rows;
    assert.equal(constraints.length, 2);
    assert.ok(constraints.every(constraint => constraint.convalidated === false));
    await assert.rejects(database.query("update profiles set display_name='Demo Learner' where id=$1", [legacy]), /profiles_age_eligibility/);
    for (const metadata of [null, {}, { age_range: "18-24" }, { age: null }, { age: "18" }, { age: true }, { age: [] }, { age: {} }, { age: 12, guardian_consent_self_attested: true }, { age: 17.5 }, { age: 121 }]) {
      await assert.rejects(database.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [candidate, JSON.stringify(metadata)]), /whole-number age/);
      assert.equal((await database.query("select count(*)::integer as count from auth.users where id=$1", [candidate])).rows[0].count, 0);
    }
    for (const age of [13, 17, 18, 35, 120]) {
      await database.query("insert into auth.users(id,raw_user_meta_data) values($1,$2)", [candidate, JSON.stringify({ age, age_range: "under-13", ai_access: true })]);
      const profile = (await database.query("select age,age_range from profiles where id=$1", [candidate])).rows[0];
      assert.deepEqual(profile, { age, age_range: ageRangeFor(age) });
      for (const invalid of [null, 12, 121]) {
        await assert.rejects(database.query("update profiles set age=$2 where id=$1", [candidate, invalid]), /profiles_age_eligibility/);
      }
      await assert.rejects(database.query("update profiles set age_range='under-13' where id=$1", [candidate]), /profiles_age_range_consistent/);
      await database.query("delete from profiles where id=$1", [candidate]);
      await assert.rejects(database.query("insert into profiles(id,display_name,age_range) values($1,'Demo Learner','18-24')", [candidate]), /profiles_age_eligibility/);
      await database.query("delete from auth.users where id=$1", [candidate]);
    }
  } finally { await database.close(); }
});