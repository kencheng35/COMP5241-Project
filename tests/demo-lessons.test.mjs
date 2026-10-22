import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_LESSON_IDS, DEMO_LESSON_STARTERS, getDemoLessonStarter } from "../src/lib/demo-lessons.ts";
import { lessonSchema, gradeQuiz } from "../src/lib/learning.ts";
import { FAMILIES, validateCurriculumContent } from "../src/lib/curriculum.ts";

test("starter IDs are stable, explicit and reject unknown, repeated and non-string inputs", () => {
  assert.deepEqual(DEMO_LESSON_IDS, ["sdlc-small-change", "coding-agent-4d", "product-tradeoffs"]);
  assert.deepEqual(DEMO_LESSON_STARTERS.map(item => item.id), DEMO_LESSON_IDS);
  assert.deepEqual(new Set(DEMO_LESSON_STARTERS.map(item => item.subject)), new Set(Object.values(FAMILIES)));
  for (const input of [undefined, null, "", "unknown", "constructor", "__proto__", "toString",
    " sdlc-small-change", "SDLC-SMALL-CHANGE", [], ["sdlc-small-change"], ["coding-agent-4d", "product-tradeoffs"],
    1, true, {}, { toString: () => "sdlc-small-change" }]) {
    assert.equal(getDemoLessonStarter(input), null);
  }
  assert.ok(DEMO_LESSON_STARTERS.every(item => !("content" in item) && !("questions" in item)));
});

for (const id of DEMO_LESSON_IDS) {
  test(`${id}: real write schema, metadata, original content shape and review references`, () => {
    const starter = getDemoLessonStarter(id);
    const { content } = starter;
    assert.deepEqual(validateCurriculumContent(lessonSchema.parse(content)), content);
    assert.ok(content.metadata.outcomes.length >= 2);
    assert.ok(content.metadata.prerequisites.length >= 1);
    assert.equal(content.metadata.audience, "learners");
    assert.equal(content.metadata.difficulty, "foundation");
    assert.ok(content.slides.length >= 4 && content.slides.length <= 6);
    assert.ok(content.activity.steps.length >= 3 && content.activity.steps.length <= 6);
    assert.equal(new Set(content.activity.steps).size, content.activity.steps.length);
    assert.equal(content.questions.length, 10);
    assert.equal(new Set(content.questions.map(question => question.prompt)).size, 10);
    assert.equal(new Set(content.questions.map(question => question.explanation)).size, 10);
    const distribution = [0, 0, 0, 0];
    for (const question of content.questions) {
      assert.equal(new Set(question.options).size, 4);
      assert.ok(question.options.every(option => option.length >= 8), "no single-letter filler options");
      assert.ok(question.prompt.length >= 25 && question.explanation.length >= 30);
      distribution[question.correct]++;
    }
    assert.ok(distribution.every(count => count >= 2 && count <= 3), "reasonably balanced answer positions");
    assert.match(content.summary, /Authored starter; owner review pending/);
    assert.match(content.slides.at(-1).body, /Original authored starter; owner content and pedagogical review pending/);
    assert.ok(starter.references.length >= 2);
    const slideText = content.slides.map(slide => `${slide.body} ${slide.example}`).join("\n");
    for (const reference of starter.references) {
      assert.equal(new URL(reference.url).protocol, "https:");
      assert.ok(reference.title.length > 5 && reference.review.length > 30);
      assert.ok(slideText.includes(reference.url), "ordinary lesson content must retain source references");
    }
    assert.deepEqual(lessonSchema.parse(JSON.parse(JSON.stringify(content))), content);
  });

  test(`${id}: actual server grader uses its answer key at the five/six boundary`, () => {
    const { questions } = getDemoLessonStarter(id).content;
    for (const correctCount of [5, 6, 10, 5]) {
      const answers = questions.map((question, index) => index < correctCount ? question.correct : (question.correct + 1) % 4);
      const result = gradeQuiz(questions, answers);
      assert.equal(result.score, correctCount);
      assert.equal(result.total, 10);
      assert.equal(result.passed, correctCount >= 6);
    }
  });
}

test("starter selections are isolated from editor mutation and other families", () => {
  const originals = DEMO_LESSON_IDS.map(id => getDemoLessonStarter(id));
  for (const id of DEMO_LESSON_IDS) {
    const draft = getDemoLessonStarter(id);
    draft.content.title = "Unsaved local edit";
    draft.content.metadata.outcomes[0] = "Changed outcome";
    draft.content.slides[0].body = "Changed slide";
    draft.content.questions[0].options[0] = "Changed option";
    draft.content.activity.steps.reverse();
    draft.references[0].url = "https://invalid.example";
    assert.deepEqual(DEMO_LESSON_IDS.map(value => getDemoLessonStarter(value)), originals);
  }
  assert.match(getDemoLessonStarter("coding-agent-4d").content.activity.prompt, /Apply 4D/);
  assert.deepEqual(getDemoLessonStarter("coding-agent-4d").content.activity.steps.map(step => step.split(":")[0]),
    ["Delegation", "Description", "Discernment", "Diligence"]);
});
