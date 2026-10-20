import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { collectRows, gradeQuiz, lessonSchema, safeDestination } from "../src/lib/learning.ts";
import { canEditLesson, canManageEnrollment, canPublishLessons, isAdmin, isInstructor } from "../src/lib/permissions.ts";

const questions = Array.from({ length: 10 }, () => ({ correct: 0 }));

test("authoritative activity schema retains bounds and rejects a blank second step without normalizing", () => {
  const parse = steps => lessonSchema.shape.activity.parse({ prompt: "Order the work", steps }).steps;
  for (const steps of [["First", "Second", "Third"], ["x".repeat(120), "Second", "Third", "Fourth", "Fifth", "Sixth"]]) {
    assert.deepEqual(parse(steps), steps);
  }
  for (const steps of [[], ["First", "Second"], Array(7).fill("Real step"), ["First", "x".repeat(121), "Third"]]) {
    assert.throws(() => parse(steps), z.ZodError);
  }
  const invalid = lessonSchema.shape.activity.safeParse({ prompt: "Order the work", steps: ["First", "", "Third"] });
  assert.equal(invalid.success, false);
  assert.deepEqual(invalid.error.issues[0].path, ["steps", 1]);
  assert.deepEqual(parse([" First ", "Second", "Third"]), [" First ", "Second", "Third"], "formatting normalization belongs to the editor, not an AI-schema transform");
});

test("OpenRouter lesson JSON schema remains representable with strict activity shape and unchanged step bounds", () => {
  const schema = z.toJSONSchema(lessonSchema);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.activity.additionalProperties, false);
  assert.deepEqual(schema.properties.activity.required, ["prompt", "steps"]);
  assert.deepEqual(schema.properties.activity.properties.steps, {
    type: "array", minItems: 3, maxItems: 6,
    items: { type: "string", minLength: 1, maxLength: 120 },
  });
  assert.deepEqual(schema.properties.activity.properties.prompt, { type: "string", minLength: 1, maxLength: 240 });
  assert.equal(schema.properties.slides.minItems, 4);
  assert.equal(schema.properties.slides.maxItems, 6);
  assert.equal(schema.properties.questions.minItems, 10);
  assert.equal(schema.properties.questions.maxItems, 10);
});

test("instructor permissions are trusted, owner-scoped and preserve private drafts", () => {
  const learner = { id: "owner", app_metadata: {}, user_metadata: { role: "admin" } };
  const instructor = { id: "owner", app_metadata: { role: "instructor" } };
  const admin = { id: "admin", app_metadata: { role: "admin" } };
  const published = { owner_id: "owner", visibility: "public" };
  const privateLesson = { ...published, visibility: "private" };
  assert.equal(isAdmin(learner), false);
  assert.equal(isInstructor(learner), false);
  assert.equal(canPublishLessons(learner), false);
  assert.equal(canPublishLessons(instructor), true);
  assert.equal(canEditLesson(learner, published), false);
  assert.equal(canEditLesson(learner, privateLesson), true);
  assert.equal(canEditLesson(instructor, published), true);
  assert.equal(canEditLesson(instructor, { ...published, owner_id: "someone-else" }), false);
  assert.equal(canEditLesson(admin, privateLesson), false);
  assert.equal(canEditLesson(admin, { ...privateLesson, review_requested: true }), true);
  assert.equal(canManageEnrollment(instructor, published), true);
  assert.equal(canManageEnrollment(instructor, { ...published, owner_id: "someone-else" }), false);
  assert.equal(canManageEnrollment(learner, published), false);
  assert.equal(canManageEnrollment(admin, privateLesson), false);
  assert.equal(canManageEnrollment(admin, published), true);
});

test("six out of ten passes, five fails, and retries remain independent", () => {
  assert.equal(gradeQuiz(questions, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]).passed, false);
  assert.equal(gradeQuiz(questions, [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]).passed, true);
  assert.equal(gradeQuiz(questions, Array(10).fill(0)).score, 10);
});

test("rejects incomplete, oversized and forged answers", () => {
  for (const answers of [Array(9).fill(0), Array(11).fill(0), Array(10).fill(4), Array(10).fill("0")]) {
    assert.throws(() => gradeQuiz(questions, answers));
  }
});

test("redirects remain on the application origin", () => {
  for (const value of ["//example.org", "/\\example.org", "https://example.org", "/%5cexample.org", "/%2f%2fexample.org", "/%252f%252fexample.org", null]) {
    assert.equal(safeDestination(value, "https://forge.example"), "/dashboard");
  }
  assert.equal(safeDestination("/reset-password?source=email", "https://forge.example"), "/reset-password?source=email");
});

test("learning records are not truncated at the database row cap", async () => {
  const records = Array.from({ length: 1050 }, (_, index) => index);
  const pages = [];
  const result = await collectRows(async (start, end) => {
    pages.push([start, end]);
    return { data: records.slice(start, end + 1), error: null };
  });
  assert.deepEqual(result, records);
  assert.equal(pages.length, 3);
  await assert.rejects(collectRows(async () => ({ data: null, error: "unavailable" })), /Could not load complete/);
  await assert.rejects(collectRows(async (start) => start === 0 ? { data: records.slice(0, 500), error: null } : { data: null, error: null }), /Could not load complete/);
  await assert.rejects(collectRows(async (start) => start === 0 ? { data: records.slice(0, 500), error: null } : { data: [], error: "database unavailable" }), /Could not load complete/);
});