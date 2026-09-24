import test from "node:test";
import assert from "node:assert/strict";
import { resumeSchema } from "../src/lib/resume.ts";

const progress = { stage: "quiz", slide: 2, ordering: [2, 1, 0], answers: Array(10).fill(-1) };

test("resume accepts unfinished answers without storing an answer key", () => {
  assert.deepEqual(resumeSchema.parse({ ...progress, answers: [0, 3, ...Array(8).fill(-1)] }), { ...progress, answers: [0, 3, ...Array(8).fill(-1)] });
  assert.equal("questions" in resumeSchema.parse({ ...progress, questions: [{ correct: 0 }] }), false);
});

test("resume rejects invalid position and answer payloads", () => {
  for (const invalid of [
    { ...progress, stage: "passed" },
    { ...progress, slide: -1 },
    { ...progress, answers: Array(10).fill(4) },
    { ...progress, answers: Array(9).fill(-1) },
    { ...progress, ordering: Array(100).fill(0) },
  ]) assert.equal(resumeSchema.safeParse(invalid).success, false);
});