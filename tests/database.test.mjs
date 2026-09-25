import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

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