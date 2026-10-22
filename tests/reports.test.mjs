import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";
import * as learning from "../src/lib/learning.ts";

const mod = { exports: {} };
const text = readFileSync(new URL("../src/lib/reporting.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
new Function("require", "module", "exports", compiled)(name => {
  if (name === "zod") return { z };
  assert.equal(name, "@/lib/learning");
  return learning;
}, mod, mod.exports);
const { reportRows, buildLessonReport } = mod.exports;
const stamp = "2026-10-22T00:00:00Z";
const lesson = { id: "lesson", title: "Current public title", version: 2 };
const enrollment = (user_id, progress_evidence = {}) => ({
  user_id, lesson_id: lesson.id, enrollment_kind: "public", attended_at: stamp, progress_evidence,
});
const attempt = (user_id, lesson_version = 2, score = 6, extra = {}) => ({
  id: `${user_id}-${lesson_version}-${score}`, user_id, lesson_id: lesson.id, original_lesson_id: lesson.id,
  lesson_title: "Historical saved title", lesson_version, score, certificate_kind: "public",
  completed_at: stamp, answers: Array(10).fill(0),
  questions: Array.from({ length: 10 }, () => ({
    prompt: "Saved question?", options: ["One", "Two", "Three", "Four"], correct: 0, explanation: "Synthetic answer.",
  })), ...extra,
});

test("report aggregation reuses independent canonical version evidence, never a progress funnel", () => {
  const enrollments = reportRows.enrollments.parse([
    enrollment("review", { 2: { reviewed_at: stamp } }),
    enrollment("quiz", { 2: { attended_at: stamp } }),
    enrollment("fail"), enrollment("pass"), enrollment("old", { 1: { reviewed_at: stamp, attended_at: stamp } }),
    enrollment("empty"), enrollment("private-only"),
  ]);
  const attempts = reportRows.attempts.parse([
    attempt("fail", 2, 5), attempt("pass"), attempt("pass", 2, 10),
    attempt("old", 1, 10), attempt("removed", 2, 10),
    attempt("empty", 2, 10, { lesson_id: "different", original_lesson_id: "different" }),
  ]);
  const report = buildLessonReport(lesson, enrollments, attempts);
  assert.deepEqual([report.roster.length, report.reviewed, report.attended, report.passed], [7, 1, 1, 1]);
  for (const row of report.roster) {
    const stored = enrollments.find(record => record.user_id === row.userId);
    assert.deepEqual(row.evidence, learning.lessonProgress(stored, attempts.filter(a => a.user_id === row.userId), lesson.id, lesson.version));
  }
  assert.deepEqual(report.roster.find(row => row.userId === "pass").evidence,
    { version: 2, reviewedAt: null, attendedAt: null, passed: true });
  assert.equal(report.history.length, 5, "removed learner and both independent passing snapshots retained");
  assert.equal(report.history.filter(row => row.user_id === "pass").length, 2);
  assert.deepEqual([buildLessonReport({ ...lesson, version: 3 }, enrollments, attempts).reviewed,
    buildLessonReport({ ...lesson, version: 3 }, enrollments, attempts).passed], [0, 0]);
});

test("public-only aggregation and validation cannot turn private or wrong-version attempts into a current pass", () => {
  const rows = [attempt("learner", 1, 10), attempt("learner", 2, 5),
    attempt("learner", 2, 10, { certificate_kind: "private" })];
  const report = buildLessonReport(lesson, [enrollment("learner"),
    { ...enrollment("private"), enrollment_kind: "private" }], rows);
  assert.equal(report.passed, 0);
  assert.equal(report.roster.length, 1);
  assert.equal(report.history.length, 2);
  assert.equal(buildLessonReport(lesson, [enrollment("learner")], [attempt("learner", 2, 11)]).passed, 0);
  assert.equal(reportRows.attempts.safeParse(rows).success, false);
});

test("new report rows reject missing migration columns, malformed evidence and invalid saved result shapes", () => {
  for (const row of [
    { user_id: "learner", lesson_id: "lesson", enrollment_kind: "public", attended_at: null },
    enrollment("learner", null), enrollment("learner", []),
    enrollment("learner", { 2: { reviewed_at: "not-a-time" } }),
    enrollment("learner", { 2: { attended_at: 1 } }),
    enrollment("learner", { 2: { reviewed_at: null } }),
    enrollment("learner", { bogus: {} }),
    { ...enrollment("learner"), attended_at: "unknown" },
  ]) assert.equal(reportRows.enrollments.safeParse([row]).success, false);
  for (const extra of [
    { score: 11 }, { score: -1 }, { score: 6.5 }, { lesson_version: undefined },
    { lesson_version: 0 }, { original_lesson_id: "different" }, { completed_at: "bad" },
    { answers: [0] }, { answers: Array(10).fill(4) }, { questions: [{}] },
  ]) assert.equal(reportRows.attempts.safeParse([attempt("learner", 2, 6, extra)]).success, false);
  assert.equal(reportRows.lessons.safeParse([{ id: "lesson", title: "Missing version" }]).success, false);
  assert.equal(reportRows.grants.safeParse([{}]).success, false);
  assert.equal(reportRows.enrollments.parse([enrollment("learner")]).length, 1, "legacy timestamp plus empty evidence is valid, not backfilled");
});
