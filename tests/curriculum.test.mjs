import test from "node:test";
import assert from "node:assert/strict";
import { FAMILIES, TOPICS, subjectSelection, readMetadata, metadataSchema, curriculumSelectionSchema, filterLessons } from "../src/lib/curriculum.ts";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import * as permissions from "../src/lib/permissions.ts";
import * as curriculum from "../src/lib/curriculum.ts";
import * as learning from "../src/lib/learning.ts";
const { lessonSchema } = learning;
const parseWrite = content => curriculum.validateCurriculumContent(lessonSchema.parse(content));
function loadReal(file, dependencies, process = { env: {} }) {
  const mod = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  new Function("require", "module", "exports", "process", source)(
    name => { assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; }, mod, mod.exports, process);
  return mod.exports;
}
const lessonFixture = {
  title: "Synthetic lesson", subject: FAMILIES.sdlc, summary: "Synthetic curriculum lesson",
  slides: Array(4).fill({ title: "Slide", body: "Body", example: "Example" }),
  activity: { prompt: "Order", steps: ["A", "B", "C"] },
  questions: Array(10).fill({ prompt: "Question", options: ["A", "B", "C", "D"], correct: 0, explanation: "PRIVATE_ANSWER" }),
};

const metadata = { version: 1, audience: "learners", difficulty: "foundation", topic: "testing", outcomes: ["Write a test"], prerequisites: [] };
test("canonical registry preserves explicit SDLC aliases but never incidental keywords", () => {
  assert.equal(TOPICS.length, 9);
  for (const subject of ["SDLC", "Software engineering", "Software Testing", "SDLC: testing", "DevOps"]) assert.equal(subjectSelection(subject).family, "sdlc");
  for (const subject of ["testing", "Biology testing", "SDLC cooking", "AI coding-agent gardening", "constructor", "__proto__"]) assert.equal(subjectSelection(subject), null);
  for (const [family, subject] of Object.entries(FAMILIES)) assert.equal(subjectSelection(subject).family, family);
});
test("metadata bounds and subject/topic consistency fail closed; legacy stays unspecified", () => {
  assert.deepEqual(readMetadata(FAMILIES.sdlc, metadata), metadata);
  for (const value of [undefined, null, {}, { ...metadata, version: 2 }, { ...metadata, outcomes: [] }, { ...metadata, outcomes: Array(9).fill("x") },
    { ...metadata, outcomes: ["<script>"] }, { ...metadata, prerequisites: ["x".repeat(241)] }, { ...metadata, audience: "everyone" }]) {
    assert.equal(readMetadata(FAMILIES.sdlc, value), null);
  }
  assert.equal(readMetadata(FAMILIES["coding-agents"], metadata), null);
  assert.equal(curriculumSelectionSchema.safeParse({ subject: "Biology", metadata }).success, false);
  assert.equal(metadataSchema.safeParse({ ...metadata, extra: "ignore" }).success, false);
});
test("combined filters retain legacy only without specific metadata filters", () => {
  const lessons = [
    { title: "Test work", summary: "Practical", subject: FAMILIES.sdlc, metadata, visibility: "private" },
    { title: "Legacy", summary: "Practical", subject: "Software Testing", visibility: "public" },
    { title: "Agents", summary: "Practical", subject: FAMILIES["coding-agents"], metadata: { ...metadata, topic: "coding-agents", audience: "both" }, visibility: "public" },
  ];
  assert.equal(filterLessons(lessons, {}).length, 3);
  assert.equal(filterLessons(lessons, { subject: FAMILIES.sdlc }).length, 2);
  assert.deepEqual(filterLessons(lessons, { q: "test", subject: FAMILIES.sdlc, audience: "learners", difficulty: "foundation", visibility: "private" }), [lessons[0]]);
  assert.deepEqual(filterLessons(lessons, { audience: "instructors" }), [lessons[2]]);
  assert.equal(filterLessons(lessons, { difficulty: "advanced" }).length, 0);
});
test("read/save/export JSON preserves metadata and keeps legacy reading separate from writes", () => {
  const content = { title: "Synthetic lesson", subject: FAMILIES.sdlc, summary: "Synthetic curriculum lesson",
    slides: Array(4).fill({ title: "Slide", body: "Body", example: "Example" }),
    activity: { prompt: "Order", steps: ["A", "B", "C"] },
    questions: Array(10).fill({ prompt: "Question", options: ["A", "B", "C", "D"], correct: 0, explanation: "Reason" }) };
  assert.ok(lessonSchema.safeParse(content).success);
  assert.throws(() => parseWrite(content));
  for (const [family, subject] of Object.entries(FAMILIES)) {
    const saved = parseWrite({ ...content, subject, metadata: { ...metadata, topic: family === "sdlc" ? "testing" : family } });
    assert.deepEqual(lessonSchema.parse(JSON.parse(JSON.stringify(saved))).metadata, saved.metadata);
  }
});

test("actual lesson loader projects metadata only and preserves public/owner and submitted-review boundaries", async () => {
  const user = { id: "00000000-0000-4000-8000-000000000001", app_metadata: {} };
  const rows = ["private", "public", "private"].map((visibility, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`, owner_id: index === 0 ? user.id : "foreign",
    visibility, title: "Synthetic", subject: FAMILIES.sdlc, summary: "Synthetic", version: 1, content: { ...lessonFixture, metadata },
  }));
  const calls = [];
  let signedIn = true;
  const database = { from(table) {
    assert.equal(table, "forge_lessons");
    let columns, filter, selected;
    const query = {
      select(value) { columns = value; calls.push(["select", value]); return query; },
      or(value) { filter = value; calls.push(["or", value]); return query; },
      order() { return query; }, eq(key, value) { assert.equal(key, "id"); selected = value; return query; },
      range: async () => {
        assert.equal(filter, `visibility.eq.public,owner_id.eq.${user.id}`);
        assert.equal(columns, "id,owner_id,title,subject,summary,visibility,version,created_at,metadata:content->metadata");
        return { data: rows.filter(row => row.visibility === "public" || row.owner_id === user.id).map(({ content, ...row }) => ({ ...row, metadata: content.metadata })), error: null };
      },
      maybeSingle: async () => ({ data: rows.find(row => row.id === selected), error: null }),
    };
    return query;
  } };
  const server = loadReal("lib/learning-server.ts", {
    "server-only": {}, "@supabase/supabase-js": { createClient: () => database }, "next/navigation": { redirect() { throw new Error("Redirect"); } },
    "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? user : null }, error: null }) } }) },
    "@/lib/learning": learning, zod: { z }, "@/lib/permissions": permissions,
  }, { env: { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic-only" } });
  const visible = await server.visibleLessons(user);
  assert.equal(visible.length, 2);
  assert.ok(visible.every(row => !("content" in row)));
  assert.ok(!JSON.stringify(visible).includes("PRIVATE_ANSWER"));
  assert.deepEqual(visible[0].metadata, metadata);
  assert.ok(await server.accessibleLesson(rows[0].id, user));
  assert.ok(await server.accessibleLesson(rows[1].id, user));
  assert.equal(await server.accessibleLesson(rows[2].id, user), null);
  assert.equal(await server.accessibleLesson("invalid-id", user), null);
  const admin = { id: "admin", app_metadata: { role: "admin" } };
  assert.equal(await server.accessibleLesson(rows[2].id, admin, true), null);
  rows[2].review_requested = true;
  assert.ok(await server.accessibleLesson(rows[2].id, admin, true));
  assert.equal(await server.accessibleLesson(rows[2].id, admin), null);
  signedIn = false;
  await assert.rejects(server.currentUser(), /log in/);
  await assert.rejects(server.requireUser(), /Redirect/);
});

test("actual teaching import validates every family before extraction; saves only a private generated representation", async () => {
  const user = { id: "synthetic-instructor", app_metadata: { role: "instructor" } };
  const saves = [], calls = [];
  let aiAllowed = true, revokeAfterGeneration = false;
  const database = {
    rpc: async () => { calls.push("quota"); return { data: true, error: null }; },
    from(table) {
      assert.equal(table, "forge_lessons");
      return { insert(value) { saves.push(value); return { select: () => ({ single: async () => ({ data: { id: "synthetic-draft" }, error: null }) }) }; } };
    },
  };
  const actions = loadReal("app/teaching/actions.ts", {
    "next/cache": { revalidatePath() {} }, zod: { z },
    "@/lib/learning-server": { ...permissions, currentUser: async () => user, database: () => database },
    "@/lib/account-directory": {}, "@/lib/curriculum": curriculum,
    "@/lib/ai-eligibility-server": { requireAiAccess: async () => { if (!aiAllowed) throw new Error("AI access denied"); } },
    "@/lib/teaching-material": { extractTeachingMaterial: async file => { calls.push("extract"); assert.equal(file.name, "synthetic.pdf"); return "Synthetic extracted software content"; } },
    "@/lib/openrouter": { generateLesson: async (objective, selection, source) => {
      calls.push("generate");
      assert.equal(objective, "Synthetic curriculum objective");
      assert.equal(source, "Synthetic extracted software content");
      if (revokeAfterGeneration) aiAllowed = false;
      return parseWrite({ ...lessonFixture, ...selection });
    } },
  });
  const formFor = (family, subject) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ consent: "on", topic: "Synthetic curriculum objective", subject, audience: "instructors",
      difficulty: "intermediate", curriculumTopic: family === "sdlc" ? "requirements" : family, outcomes: "Apply a software skill", prerequisites: "" })) form.set(key, value);
    form.set("material", new File(["synthetic file bytes"], "synthetic.pdf", { type: "application/pdf" }));
    return form;
  };
  for (const [family, subject] of Object.entries(FAMILIES)) {
    const form = formFor(family, subject);
    assert.ok((await actions.importTeachingMaterial({}, form)).success);
    const saved = saves.at(-1);
    assert.equal(saved.subject, subject);
    assert.equal(saved.content.metadata.audience, "instructors");
    assert.equal(saved.visibility, undefined); // existing database default remains private
    assert.equal(saved.owner_id, user.id);
    assert.ok(!JSON.stringify(saved).includes("synthetic file bytes"));
    assert.ok(!JSON.stringify(saved).includes("Synthetic extracted software content"));
  }
  for (const variant of ["topic", "metadata", "role", "consent", "revoked"]) {
    const form = formFor("sdlc", FAMILIES.sdlc);
    const before = calls.length;
    if (variant === "topic") form.set("curriculumTopic", "coding-agents");
    if (variant === "metadata") form.delete("audience");
    if (variant === "role") user.app_metadata.role = "learner";
    if (variant === "consent") form.delete("consent");
    if (variant === "revoked") aiAllowed = false;
    assert.ok((await actions.importTeachingMaterial({}, form)).error);
    assert.equal(calls.length, before);
    user.app_metadata.role = "instructor"; aiAllowed = true;
  }
  revokeAfterGeneration = true;
  const before = saves.length;
  assert.ok((await actions.importTeachingMaterial({}, formFor("sdlc", FAMILIES.sdlc))).error);
  assert.equal(saves.length, before);
});
