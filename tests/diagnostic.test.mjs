import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticQuestions, diagnosticSummarySchema, scoreDiagnostic, suggestedLevel, explainDiagnostic } from "../src/lib/diagnostic.ts";

test("both draft role rubrics cover every possible answer combination and all thresholds", () => {
  const expectedLevels = ["new", "new", "foundation", "foundation", "intermediate", "intermediate", "advanced"];
  for (const role of ["learner", "instructor"]) {
    assert.equal(diagnosticQuestions[role].length, 6);
    const seen = new Set();
    for (let code = 0; code < 3 ** 6; code++) {
      const answers = Array.from({ length: 6 }, (_, i) => Math.floor(code / 3 ** i) % 3);
      const expected = answers.filter((answer, i) => answer === diagnosticQuestions[role][i].correct).length;
      const summary = scoreDiagnostic(role, answers, new Date("2026-10-15T00:00:00.000Z"));
      assert.equal(summary.score, expected);
      assert.equal(summary.suggested_level, expectedLevels[expected]);
      assert.equal(summary.role, role);
      assert.equal(diagnosticSummarySchema.safeParse(summary).success, true);
      assert.deepEqual(Object.keys(summary).sort(), ["completed_at", "role", "rubric_version", "score", "suggested_level", "total"]);
      assert.match(explainDiagnostic(summary), /chosen level stays unchanged/);
      seen.add(summary.score);
    }
    assert.equal(seen.size, 7);
  }
});

test("diagnostic rejects incomplete, out-of-range and coerced answers and forged summaries", () => {
  for (const answers of [null, [], [0, 1], Array(7).fill(0), Array(6).fill("0"), Array(6).fill(-1), Array(6).fill(3), Array(6).fill(0.5), { score: 6 }]) {
    assert.throws(() => scoreDiagnostic("learner", answers));
  }
  for (const score of [-1, 7, 0.5, NaN, "6"]) assert.throws(() => suggestedLevel(score));
  const summary = scoreDiagnostic("learner", Array(6).fill(0));
  for (const patch of [{ score: 7 }, { rubric_version: "forged" }, { answers: [] }, { suggested_level: "advanced" }, { completed_at: "yesterday" }]) {
    assert.equal(diagnosticSummarySchema.safeParse({ ...summary, ...patch }).success, false);
  }
});
