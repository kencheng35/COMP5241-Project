import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("daily reflections migration: bounded Unicode text, unique dates, browser denial, service CRUD and owner cascade", async () => {
  const database = new PGlite();
  try {
    await database.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);`);
    await database.exec(await readFile(new URL("../supabase/migrations/20261022_daily_reflections_ran.sql", import.meta.url), "utf8"));
    const owner = "00000000-0000-4000-8000-000000000061", other = "00000000-0000-4000-8000-000000000062";
    await database.query("insert into auth.users values($1),($2)", [owner, other]);
    const insert = (id, text = "not used today", date = "2024-02-29") => database.query("insert into forge_reflections(owner_id,date,delegation,description,discernment,diligence) values($1,$2,$3,$3,$3,$3)", [id, date, text]);
    assert.equal((await database.query("select relrowsecurity from pg_class where relname='forge_reflections'")).rows[0].relrowsecurity, true);
    assert.equal((await database.query("select * from pg_policies where tablename='forge_reflections'")).rows.length, 0);
    for (const role of ["anon", "authenticated"]) {
      await database.exec(`set role ${role}`);
      for (const sql of ["select * from forge_reflections", "delete from forge_reflections", "update forge_reflections set revision=2"]) await assert.rejects(database.exec(sql), /permission denied/);
      await assert.rejects(insert(owner), /permission denied/);
      await database.exec("reset role");
    }
    await database.exec("set role service_role");
    await insert(owner, "😀".repeat(2000));
    await insert(other);
    await assert.rejects(insert(owner), /unique constraint/);
    for (const value of ["", " \t\n", "\u2003\uFEFF", "a".repeat(2001), "😀".repeat(2001)]) await assert.rejects(insert(owner, value, "2026-10-22"), /check constraint/);
    await assert.rejects(insert(owner, "valid", "2026-02-29"), /out of range/);
    await insert(owner, "early", "0001-01-01");
    await assert.rejects(database.query("update forge_reflections set revision=0 where owner_id=$1", [owner]), /check constraint/);
    assert.equal((await database.query("update forge_reflections set revision=2 where owner_id=$1 and date='2024-02-29' and revision=1 returning id", [owner])).rows.length, 1);
    assert.equal((await database.query("delete from forge_reflections where owner_id=$1 and date='2024-02-29' and revision=1 returning id", [owner])).rows.length, 0);
    await database.query("delete from forge_reflections where owner_id=$1 and date='0001-01-01'", [owner]);
    await database.exec("reset role");
    await database.query("delete from auth.users where id=$1", [owner]);
    const retained = (await database.query("select owner_id from forge_reflections")).rows;
    assert.deepEqual(retained, [{ owner_id: other }]);
  } finally { await database.close(); }
});

test("migrations enforce private storage, quotas and durable certificate snapshots", async () => {
  const database = new PGlite();
  try {
    await database.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql as 'select null::uuid';`);
    await database.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    const migrations = new URL("../supabase/migrations/", import.meta.url);
    for (const filename of (await readdir(migrations)).filter(name => name.endsWith(".sql")).sort()) {
      await database.exec(await readFile(new URL(filename, migrations), "utf8"));
    }
    const author = "00000000-0000-4000-8000-000000000001";
    const learner = "00000000-0000-4000-8000-000000000002";
    await database.query("insert into auth.users(id,raw_user_meta_data) values ($1,'{\"age\":22,\"age_range\":\"18-24\"}'),($2,'{\"age\":22,\"age_range\":\"18-24\"}')", [author, learner]);
    for (const [column, value] of [
      ["display_name", "X".repeat(101)],
      ["learning_level", "unsupported"],
      ["preferred_subjects", ["S".repeat(301)]],
      ["learning_goals", "G".repeat(801)],
    ]) await assert.rejects(database.query(`update profiles set ${column}=$2 where id=$1`, [learner, value]), /violates check constraint/);
    const content = JSON.stringify({ questions: Array.from({ length: 10 }, () => ({ correct: 0 })) });
    const { rows: lessons } = await database.query("insert into forge_lessons(owner_id,title,subject,summary,content) values($1,'Example lesson','Testing','Test summary',$2) returning id", [author, content]);
    const lesson = lessons[0].id;
    await database.exec("set role authenticated");
    await assert.rejects(database.query("select content from forge_lessons"), /permission denied/);
    await assert.rejects(database.query("select forge_claim_request($1)", [learner]), /permission denied/);
    await database.exec("reset role");
    for (let index = 0; index < 6; index++) {
      const result = await database.query("select forge_claim_request($1) as allowed", [learner]);
      assert.equal(result.rows[0].allowed, index < 5);
    }
    for (let index = 0; index < 16; index++) {
      const result = await database.query("select forge_claim_coach_request($1) as allowed", [learner]);
      assert.equal(result.rows[0].allowed, index < 15);
    }
    await database.query("insert into forge_enrollments(user_id,lesson_id) values($1,$2)", [learner, lesson]);
    assert.equal((await database.query("select attended_at from forge_enrollments")).rows[0].attended_at, null);
    await database.exec("set role authenticated");
    await assert.rejects(database.query("select * from forge_resume"), /permission denied/);
    await database.exec("reset role");
    await database.exec("set role service_role");
    await database.query("insert into forge_resume(user_id,lesson_id,lesson_version,stage,slide,ordering,answers) values($1,$2,1,'slides',0,$3,$4)", [learner, lesson, [2, 1, 0], Array(10).fill(-1)]);
    await database.exec("reset role");
    assert.equal((await database.query("select revision from forge_resume where user_id=$1", [learner])).rows[0].revision, 1);
    const firstSave = await database.query("update forge_resume set revision=2,slide=1 where user_id=$1 and lesson_id=$2 and revision=1 returning revision", [learner, lesson]);
    assert.equal(firstSave.rows[0].revision, 2);
    const staleSave = await database.query("update forge_resume set revision=2,slide=2 where user_id=$1 and lesson_id=$2 and revision=1 returning revision", [learner, lesson]);
    assert.equal(staleSave.rows.length, 0);
    assert.equal((await database.query("select slide from forge_resume where user_id=$1", [learner])).rows[0].slide, 1);
    await database.query("update forge_resume set revision=3,lesson_version=2,stage='slides',slide=0,answers=$2 where user_id=$1 and revision=2", [learner, Array(10).fill(-1)]);
    assert.equal((await database.query("select lesson_version from forge_resume where user_id=$1", [learner])).rows[0].lesson_version, 2);
    const answers = JSON.stringify(Array(10).fill(0));
    await database.query("insert into forge_attempts(user_id,lesson_id,original_lesson_id,lesson_title,lesson_version,certificate_kind,answers,questions,score) values($1,$2,$2,'Example lesson',1,'private',$3,$4,6)", [learner, lesson, answers, JSON.stringify(JSON.parse(content).questions)]);
    await database.query("update forge_lessons set visibility='public', version=2 where id=$1", [lesson]);
    const attempt = (await database.query("select * from forge_attempts")).rows[0];
    assert.equal(attempt.lesson_version, 1);
    assert.equal(attempt.certificate_kind, "private");
    await database.query("delete from auth.users where id=$1", [author]);
    const retained = (await database.query("select * from forge_attempts")).rows;
    assert.equal(retained.length, 1);
    assert.equal(retained[0].lesson_id, null);
    assert.equal(retained[0].original_lesson_id, lesson);
    assert.equal(retained[0].score, 6);
    await database.query("delete from auth.users where id=$1", [learner]);
    assert.equal((await database.query("select * from forge_attempts")).rows.length, 0);
    assert.equal((await database.query("select * from forge_resume")).rows.length, 0);
  } finally { await database.close(); }
});

test("onboarding migration preserves historical unknowns, private owner access, CAS and auth-user cascade", async () => {
  const database = new PGlite();
  try {
    await database.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
    await database.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    const historical = "00000000-0000-4000-8000-000000000051", owner = "00000000-0000-4000-8000-000000000052", other = "00000000-0000-4000-8000-000000000053";
    await database.query("insert into auth.users(id,raw_user_meta_data) values ($1,'{}')", [historical]);
    await database.query("update profiles set learning_level=null, learning_goals='Historical goals' where id=$1", [historical]);
    // Reproduce Supabase's broad legacy table grants; migration must narrow writes.
    await database.exec("grant all on profiles to authenticated; grant select on profiles to anon;");
    const migrations = new URL("../supabase/migrations/", import.meta.url);
    for (const filename of (await readdir(migrations)).filter(name => name.endsWith(".sql")).sort()) {
      await database.exec(await readFile(new URL(filename, migrations), "utf8"));
    }
    const old = (await database.query("select * from profiles where id=$1", [historical])).rows[0];
    assert.equal(old.age, null); assert.equal(old.learning_level, null); assert.equal(old.learning_goals, "Historical goals");
    for (const key of ["onboarding_completed_at", "onboarding_background", "diagnostic_summary"]) assert.equal(old[key], null);
    assert.equal(old.learning_setup_revision, 0);
    await database.query("insert into auth.users(id,raw_user_meta_data) values ($1,'{\"age\":22}'),($2,'{\"age\":22}')", [owner, other]);
    const background = { version: 1, role: "learner", experience: "coursework", goals: ["sdlc"] };
    const summary = { rubric_version: "draft-2026-10-v1", role: "learner", score: 4, total: 6, suggested_level: "intermediate", completed_at: "2026-10-15T00:00:00.000Z" };
    await database.exec("set role service_role");
    await database.query("update profiles set onboarding_completed_at=now(),onboarding_background=$2,diagnostic_summary=$3 where id=$1", [owner, background, summary]);
    const saved = (await database.query("select * from profiles where id=$1", [owner])).rows[0];
    assert.equal(saved.learning_setup_revision, 1); assert.equal(saved.learning_level, "foundation");
    assert.equal((await database.query("update profiles set learning_level='advanced' where id=$1 and learning_setup_revision=0 returning id", [owner])).rows.length, 0);
    for (const bad of [{ ...summary, answers: [1] }, { ...summary, score: 7 }, { ...summary, suggested_level: "advanced" },
      ...Object.keys(summary).map(key => ({ ...summary, [key]: null }))]) {
      await assert.rejects(database.query("update profiles set diagnostic_summary=$2 where id=$1", [owner, bad]), /check constraint/);
    }
    for (const bad of [{ ...background, goals: [] }, { ...background, goals: ["sdlc", "sdlc"] }, { ...background, role: "instructor" },
      ...Object.keys(background).map(key => ({ ...background, [key]: null }))]) {
      await assert.rejects(database.query("update profiles set onboarding_background=$2 where id=$1", [owner, bad]), /check constraint/);
    }
    await database.exec("reset role");
    await database.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
    await database.exec("set role authenticated");
    assert.equal((await database.query("select id from profiles")).rows.length, 1);
    assert.deepEqual((await database.query("select diagnostic_summary from profiles")).rows[0].diagnostic_summary, summary);
    await assert.rejects(database.query("update profiles set diagnostic_summary=null where id=$1", [owner]), /permission denied/);
    await assert.rejects(database.query("update profiles set onboarding_completed_at=null where id=$1", [owner]), /permission denied/);
    await assert.rejects(database.query("update profiles set learning_setup_revision=42 where id=$1", [owner]), /permission denied/);
    await database.query("update profiles set learning_level='new',learning_goals='Own goals' where id=$1", [owner]);
    assert.equal((await database.query("select learning_setup_revision from profiles")).rows[0].learning_setup_revision, 2);
    assert.equal((await database.query("update profiles set learning_level='new' where id=$1 returning id", [other])).rows.length, 0);
    await database.exec("reset role");
    await database.query("delete from auth.users where id=$1", [owner]);
    assert.equal((await database.query("select * from profiles where id=$1", [owner])).rows.length, 0);
    assert.equal((await database.query("select * from profiles where id=$1", [other])).rows.length, 1);
  } finally { await database.close(); }
});