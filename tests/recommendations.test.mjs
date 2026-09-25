import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { buildPathRequest, derivePreferences, lessonTopic, MAX_AI_CANDIDATES, MAX_PATH_LESSONS, recommendLessons, validatePathResponse } from "../src/lib/recommendations.ts";

const id = number => `11111111-1111-4111-8111-${String(number).padStart(12, "0")}`;
const lesson = (number, title, subject = "SDLC") => ({ id: id(number), title, subject, summary: "A practical lesson." });
const catalog = [lesson(1, "Requirements basics"), lesson(2, "Software testing"), lesson(3, "Deployment basics"), lesson(4, "Biology testing", "Biology")];

test("ranking is deterministic, topic-sensitive, and limited to supplied SDLC lessons", () => {
  const preferences = derivePreferences({ level: "new" }, { topic: "testing" });
  const result = recommendLessons(catalog, preferences);
  assert.equal(result[0].id, id(2));
  assert.match(result[0].reason, /testing preference/);
  assert.deepEqual(result, recommendLessons([...catalog].reverse(), preferences));
  assert.ok(!result.some(item => item.id === id(4)));
  assert.deepEqual(recommendLessons([catalog[0]], preferences).map(item => item.id), [id(1)]);
});

test("completed lessons are omitted", () => {
  const result = recommendLessons(catalog, derivePreferences({}, { topic: "testing" }), [id(2)]);
  assert.ok(!result.some(item => item.id === id(2)));
});

test("selected topics and goals override profile-derived preferences", () => {
  const profile = { level: "foundation", subjects: "Software requirements", goals: "Improve software testing quality" };
  assert.equal(derivePreferences(profile).goal, "quality");
  assert.deepEqual(derivePreferences(profile).topics, ["requirements", "testing"]);
  assert.equal(recommendLessons(catalog, derivePreferences({}, { topic: "requirements" }))[0].id, id(1));
  assert.equal(recommendLessons(catalog, derivePreferences(profile, { topic: "deployment", goal: "delivery" }))[0].id, id(3));
  assert.equal(recommendLessons(catalog, derivePreferences({}, { goal: "quality" }))[0].id, id(2));
  assert.equal(recommendLessons(catalog, derivePreferences({}, { goal: "delivery" }))[0].id, id(3));
});

test("background level prioritizes titles conservatively and explains the inference", () => {
  const levels = [lesson(5, "Advanced software design"), lesson(6, "Software design basics")];
  assert.equal(recommendLessons(levels, derivePreferences({ level: "new" }))[0].id, id(6));
  const advanced = recommendLessons(levels, derivePreferences({ level: "advanced" }));
  assert.equal(advanced[0].id, id(5));
  assert.match(advanced[0].reason, /Title indicates/);
  assert.equal(derivePreferences({ level: "arbitrary personal data" }).level, "new");
});

test("scope depends on an explicit SDLC subject, not incidental keywords in unrelated material", () => {
  for (const subject of ["Biology", "Testing", "Fashion design", "Project management", "Gardening", "SDLC cooking"]) {
    assert.equal(lessonTopic(lesson(7, "Requirements, design, testing and deployment", subject)), null);
  }
  assert.equal(lessonTopic(lesson(7, "Unit testing", "Software Testing")), "testing");
  assert.equal(lessonTopic(lesson(7, "Release automation", "SDLC: Deployment")), "deployment");
});

test("specific subjects and titles take precedence over incidental summary stage mentions", () => {
  assert.equal(lessonTopic({ ...lesson(7, "Unit testing"), summary: "Validate requirements and design through automated tests." }), "testing");
  assert.equal(lessonTopic({ ...lesson(7, "Requirements validation", "Software Testing"), summary: "Software design and implementation." }), "testing");
});

test("ranking and AI candidates are bounded, deduplicated, and contain only supplied accessible IDs", () => {
  const many = Array.from({ length: 50 }, (_, index) => lesson(index + 10, "SDLC overview"));
  const preferences = derivePreferences({});
  assert.equal(recommendLessons(many, preferences).length, MAX_PATH_LESSONS);
  assert.equal(buildPathRequest(many, preferences).candidates.length, MAX_AI_CANDIDATES);
  assert.equal(recommendLessons(many, preferences, [], Infinity).length, MAX_PATH_LESSONS);
  assert.equal(recommendLessons(many, preferences, [], 0).length, 0);
  assert.equal(recommendLessons([catalog[0], catalog[0], { ...catalog[0], id: "../../admin" }], preferences).length, 1);
  assert.throws(() => buildPathRequest([], preferences));
  assert.throws(() => buildPathRequest([catalog[0]], preferences, [id(1)]));
});

test("external payload contains only allowed coarse preferences and course metadata", () => {
  const preferences = derivePreferences({ level: "advanced", subjects: "Software testing", goals: "I am Private Name, private@example.com, user-secret-123. Improve testing." });
  const request = buildPathRequest(catalog.map(item => ({ ...item, owner_id: "owner-secret", questions: ["answer-secret"], score: 2, summary: "summary-secret" })), preferences);
  const payload = JSON.parse(request.messages[1].content);
  assert.deepEqual(Object.keys(payload).sort(), ["lessons", "preferences"]);
  for (const entry of payload.lessons) assert.deepEqual(Object.keys(entry).sort(), ["id", "title", "topic"]);
  const serialized = JSON.stringify(request.messages);
  for (const secret of ["Private Name", "private@example.com", "user-secret", "owner-secret", "answer-secret", "summary-secret", "score"]) assert.ok(!serialized.includes(secret));
  assert.throws(() => buildPathRequest(catalog, { ...preferences, email: "private@example.com" }));
  assert.throws(() => buildPathRequest(catalog, { ...preferences, topics: ["cooking"] }));
});

test("valid AI ordering uses only local titles and reasons", () => {
  const request = buildPathRequest(catalog, derivePreferences({}));
  const path = validatePathResponse(JSON.stringify({ lessonIds: [id(3), id(1)] }), request.candidates, catalog);
  assert.deepEqual(path.map(item => item.id), [id(3), id(1)]);
  assert.equal(path[0].title, catalog[2].title);
  assert.match(path[0].reason, /Not yet completed/);
});

test("rejects malicious, duplicate, missing, inaccessible, completed, and excessive model IDs", () => {
  const request = buildPathRequest(catalog, derivePreferences({}));
  const invalid = [null, {}, { lessonIds: [] }, { lessonIds: [null] }, { lessonIds: ["javascript:alert(1)"] },
    { lessonIds: ["../../admin"] }, { lessonIds: [id(1), id(1)] }, { lessonIds: [id(99)] },
    { lessonIds: [id(4)] }, { lessonIds: [id(1)], reason: "model-controlled reason" },
    { lessonIds: Array.from({ length: MAX_PATH_LESSONS + 1 }, (_, index) => id(index + 1)) }];
  for (const response of invalid) assert.throws(() => validatePathResponse(JSON.stringify(response), request.candidates, catalog));
  for (const response of ["not JSON", "```json\n{}\n```", " ".repeat(4097)]) assert.throws(() => validatePathResponse(response, request.candidates, catalog));
  const response = JSON.stringify({ lessonIds: [id(1)] });
  assert.throws(() => validatePathResponse(response, request.candidates, catalog.slice(1)));
  assert.throws(() => validatePathResponse(response, request.candidates, catalog, [id(1)]));
  assert.throws(() => validatePathResponse(response, request.candidates, [{ ...catalog[0], subject: "Biology" }]));
  assert.throws(() => validatePathResponse(response, request.candidates, [{ ...catalog[0], title: "Changed title" }]));
  assert.throws(() => validatePathResponse(response, [], catalog));
});

test("server action gates AI, minimizes data, and rechecks current catalog and completions without enrollment", async context => {
  const key = Symbol.for("forge.recommendations.test");
  const hooks = registerHooks({
    resolve(specifier, resolveContext, nextResolve) {
      if (specifier === "server-only") return { url: "data:text/javascript,export{}", shortCircuit: true };
      if (specifier === "@/lib/learning-server") return { url: `data:text/javascript,${encodeURIComponent(`
        const state = () => globalThis[Symbol.for("forge.recommendations.test")];
        export const requireUser = async () => state().user;
        export const database = () => state().database;
        export const visibleLessons = async () => state().catalog;
      `)}`, shortCircuit: true };
      if (specifier === "@/lib/openrouter-client") return { url: `data:text/javascript,${encodeURIComponent(`
        export class OpenRouterError extends Error {}
        export const completion = (...args) => globalThis[Symbol.for("forge.recommendations.test")].completion(...args);
      `)}`, shortCircuit: true };
      if (specifier.startsWith("@/lib/")) return nextResolve(new URL(`../src/lib/${specifier.slice(6)}.ts`, import.meta.url).href, resolveContext);
      return nextResolve(specifier, resolveContext);
    },
  });
  let generateLearningPath;
  try { ({ generateLearningPath } = await import("../src/app/paths/actions.ts")); }
  finally { hooks.deregister(); }

  function setup(overrides = {}) {
    const calls = [];
    const state = {
      user: { id: "user-private-id", app_metadata: { ai_access: true } },
      profile: { age: 18, learning_level: "new", preferred_subjects: ["Software testing"], learning_goals: "Private Name private@example.com wants testing" },
      catalog: [...catalog], passed: [], allowed: true, profileError: false,
      ...overrides,
    };
    state.database = {
      from(table) {
        assert.ok(["profiles", "forge_attempts"].includes(table));
        let columns;
        const query = {
          select(value) { columns = value; calls.push(["select", table, value]); return query; },
          eq(column, value) { assert.equal(column, table === "profiles" ? "id" : "user_id"); assert.equal(value, state.user.id); return query; },
          gte(column, value) { assert.equal(column, "score"); assert.equal(value, 6); return query; },
          order() { return query; },
          async range() { return { data: state.passed.map(original_lesson_id => ({ original_lesson_id })), error: null }; },
          async maybeSingle() { return { data: state.profile, error: state.profileError && columns !== "age" ? new Error("private db detail") : null }; },
        };
        return query;
      },
      async rpc(name, args) { assert.equal(name, "forge_claim_request"); assert.deepEqual(args, { request_user: state.user.id }); calls.push(["quota"]); return { data: state.allowed, error: null }; },
    };
    state.completion = async (messages, schema) => {
      calls.push(["completion", messages, schema]);
      if (state.afterCompletion) state.afterCompletion();
      return state.response ?? JSON.stringify({ lessonIds: [id(2)] });
    };
    globalThis[key] = state;
    const form = new FormData();
    form.set("topic", "profile"); form.set("goal", "profile"); form.set("shareCourseContent", "on");
    return { state, form, calls };
  }

  try {
    await context.test("minor, unknown age, and unapproved adult cannot call external AI", async () => {
      for (const [age, approved] of [[17, true], [null, true], [18, false]]) {
        const { state, form, calls } = setup();
        state.profile.age = age; state.user.app_metadata.ai_access = approved;
        const result = await generateLearningPath({ path: [{ id: id(99) }] }, form);
        assert.match(result.error, /18\+/);
        assert.equal(result.path, undefined);
        assert.ok(!calls.some(call => ["quota", "completion"].includes(call[0])));
        assert.ok(recommendLessons(state.catalog, derivePreferences({})).length > 0);
      }
    });
    await context.test("eligible adult receives validated non-persisted path with no personal fields sent", async () => {
      const { form, calls } = setup();
      const result = await generateLearningPath({}, form);
      assert.equal(result.path[0].id, id(2));
      assert.equal(result.selectionKey, "profile:profile");
      const external = JSON.stringify(calls.find(call => call[0] === "completion").slice(1));
      for (const secret of ["user-private-id", "Private Name", "private@example.com", "learning_goals", "score", "answers"]) assert.ok(!external.includes(secret));
      assert.ok(calls.some(call => call[0] === "select" && call[2] === "original_lesson_id"));
    });
    await context.test("invalid input, missing sharing consent, failed profile read, quota, or empty catalog never calls AI", async () => {
      for (const variant of ["invalid", "consent", "profile", "quota", "empty"]) {
        const { state, form, calls } = setup();
        if (variant === "invalid") form.set("topic", "cooking");
        if (variant === "consent") form.delete("shareCourseContent");
        if (variant === "profile") state.profileError = true;
        if (variant === "quota") state.allowed = false;
        if (variant === "empty") state.catalog = [];
        assert.ok((await generateLearningPath({}, form)).error);
        assert.ok(!calls.some(call => call[0] === "completion"));
      }
    });
    await context.test("revoked visibility, newly passed lessons, revoked eligibility, and malicious outputs reject the entire path", async () => {
      for (const variant of ["visibility", "passed", "eligibility", "malicious"]) {
        const { state, form } = setup();
        state.afterCompletion = () => {
          if (variant === "visibility") state.catalog = [catalog[0]];
          if (variant === "passed") state.passed = [id(2)];
          if (variant === "eligibility") state.profile.age = 17;
        };
        if (variant === "malicious") state.response = JSON.stringify({ lessonIds: [id(2), id(99)] });
        const result = await generateLearningPath({}, form);
        assert.ok(result.error);
        assert.equal(result.path, undefined);
      }
    });
  } finally { delete globalThis[key]; }
});

test("learning-path initial UI exposes local links but requires explicit eligible AI sharing", async () => {
  const key = Symbol.for("forge.recommendations.ui.test");
  globalThis[key] = createElement;
  const componentUrl = new URL("../src/components/learning-path.tsx", import.meta.url).href;
  const hooks = registerHooks({
    resolve(specifier, resolveContext, nextResolve) {
      if (specifier === "next/link") return { url: `data:text/javascript,${encodeURIComponent('export default function Link({children, ...props}) { return globalThis[Symbol.for("forge.recommendations.ui.test")]("a", props, children); }')}`, shortCircuit: true };
      if (specifier === "@/app/paths/actions") return { url: "data:text/javascript,export async function generateLearningPath(){throw new Error('No automatic AI generation allowed')}", shortCircuit: true };
      if (specifier === "@/lib/recommendations") return nextResolve(new URL("../src/lib/recommendations.ts", import.meta.url).href, resolveContext);
      return nextResolve(specifier, resolveContext);
    },
    load(url, loadContext, nextLoad) {
      if (url === componentUrl) return {
        format: "module", shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText,
      };
      return nextLoad(url, loadContext);
    },
  });
  try {
    const { LearningPath } = await import(componentUrl);
    const props = { catalog, completedIds: [id(1)], initialPreferences: derivePreferences({}), aiAvailable: false };
    const minor = renderToStaticMarkup(createElement(LearningPath, props));
    assert.match(minor, /Local recommendations/);
    assert.match(minor, new RegExp(`/courses/${id(2)}`));
    assert.ok(!minor.includes(`/courses/${id(1)}`));
    assert.ok(!minor.includes(`/courses/${id(4)}`));
    assert.match(minor, /administrator-approved AI access/);
    assert.match(minor, /<select name="topic"/);
    assert.match(minor, /<button[^>]*disabled=""/);
    assert.match(minor, /not saved/);
    const adult = renderToStaticMarkup(createElement(LearningPath, { ...props, aiAvailable: true }));
    assert.ok(!adult.includes("administrator-approved AI access"));
    assert.match(adult, /name="shareCourseContent"/);
    assert.match(adult, /<button[^>]*disabled=""/);
    const empty = renderToStaticMarkup(createElement(LearningPath, { ...props, catalog: [] }));
    assert.match(empty, /No uncompleted SDLC lessons/);
  } finally { hooks.deregister(); delete globalThis[key]; }
});