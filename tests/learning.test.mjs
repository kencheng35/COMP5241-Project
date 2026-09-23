import test from "node:test";
import assert from "node:assert/strict";
import { collectRows, gradeQuiz, safeDestination } from "../src/lib/learning.ts";

const questions = Array.from({ length: 10 }, () => ({ correct: 0 }));

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
  for (const value of ["//example.org", "/\\example.org", "https://example.org", null]) {
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
});