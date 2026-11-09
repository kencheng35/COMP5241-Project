// Actual presentation action and ownership functions, backed only by local
// JavaScript mocks. No PGlite, Supabase, storage service, or network.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";

function load(path, dependencies) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", source)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected mock dependency ${name}`);
    return dependencies[name];
  }, mod, mod.exports);
  return mod.exports;
}

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const draftId = "00000000-0000-4000-8000-000000000003";
const lessonId = "00000000-0000-4000-8000-000000000004";
const permissions = load("../src/lib/permissions.ts", {});

function fixture() {
  const state = {
    user: { id: owner, app_metadata: {} },
    draft: { id: draftId, owner_id: owner, lesson_id: null, expires_at: "2099-01-01T00:00:00Z" },
    lesson: { id: lessonId, owner_id: owner, visibility: "private", review_requested: false },
    mutations: [], cleanups: 0, sanitized: 0,
  };
  const client = {
    from(table) {
      assert.equal(table, "forge_presentation_drafts");
      const filters = [];
      let update;
      const query = {
        select() { return query; },
        update(value) { update = value; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        async maybeSingle() {
          const matches = filters.every(([key, value]) => state.draft[key] === value);
          return { data: matches ? state.draft : null, error: null };
        },
        then(resolve, reject) {
          state.mutations.push({ table, update, filters });
          return Promise.resolve({ error: null }).then(resolve, reject);
        },
      };
      return query;
    },
    async rpc(name, args) {
      state.mutations.push({ name, args });
      return { data: draftId, error: null };
    },
    storage: { from() { throw new Error("Unexpected synthetic storage access."); } },
  };
  const server = {
    ...permissions,
    currentUser: async () => {
      if (!state.user) throw new Error("Log in again.");
      return state.user;
    },
    database: () => client,
    accessibleLesson: async id => id === lessonId ? state.lesson : null,
  };
  const ownership = load("../src/lib/presentation-assets-server.ts", {
    "server-only": {}, zod: { z }, "./learning-server": server,
    "./presentation": { assetIds: () => [] }, "./learning": { collectRows: async () => [] },
  });
  const actions = load("../src/app/presentation/actions.ts", {
    zod: { z }, "@/lib/learning-server": server,
    "@/lib/presentation-assets-server": {
      ownedPresentationDraft: ownership.ownedPresentationDraft,
      PRESENTATION_BUCKET: "synthetic",
      cleanupPresentationAssets: async () => { state.cleanups++; },
    },
    "@/lib/presentation-images": {
      sanitizePresentationImage: async () => { state.sanitized++; throw new Error("Unexpected sanitization."); },
    },
  });
  const form = new FormData();
  form.set("draftId", draftId);
  form.set("image", new File(["synthetic"], "page.png", { type: "image/png" }));
  return { state, actions, form };
}

test("unauthenticated PDF image actions fail before any mocked write or cleanup", async () => {
  const { state, actions, form } = fixture();
  state.user = null;
  assert.match((await actions.beginPresentationDraft()).error, /Log in/);
  assert.match((await actions.uploadPresentationImage(form)).error, /Log in/);
  assert.match((await actions.discardPresentationDraft(draftId)).error, /Log in/);
  assert.deepEqual(state.mutations, []);
  assert.equal(state.cleanups, 0);
  assert.equal(state.sanitized, 0);
});

test("another user cannot upload to or discard an owner's private image draft", async () => {
  const { state, actions, form } = fixture();
  state.user = { id: other, app_metadata: { role: "instructor" } };
  assert.match((await actions.uploadPresentationImage(form)).error, /unavailable/);
  assert.match((await actions.discardPresentationDraft(draftId)).error, /unavailable/);
  assert.deepEqual(state.mutations, []);
  assert.equal(state.cleanups, 0);
  assert.equal(state.sanitized, 0);
});

test("revoked and self-asserted instructor rights cannot modify a public lesson draft", async () => {
  const { state, actions, form } = fixture();
  state.user = { id: owner, app_metadata: {}, user_metadata: { role: "instructor" } };
  state.lesson.visibility = "public";
  state.draft.lesson_id = lessonId;
  assert.match((await actions.beginPresentationDraft(lessonId)).error, /cannot edit/);
  assert.match((await actions.uploadPresentationImage(form)).error, /cannot edit/);
  assert.match((await actions.discardPresentationDraft(draftId)).error, /cannot edit/);
  assert.deepEqual(state.mutations, []);
  assert.equal(state.cleanups, 0);
  assert.equal(state.sanitized, 0);
});

test("an administrator cannot create an editing draft for an unrequested foreign private lesson", async () => {
  const { state, actions } = fixture();
  state.user = { id: other, app_metadata: { role: "admin" } };
  assert.match((await actions.beginPresentationDraft(lessonId)).error, /cannot edit/);
  assert.deepEqual(state.mutations, []);
});

test("the owner can request cleanup of an expired private draft", async () => {
  const { state, actions, form } = fixture();
  state.draft.expires_at = "2000-01-01T00:00:00Z";
  assert.match((await actions.uploadPresentationImage(form)).error, /expired or unavailable/);
  assert.match((await actions.discardPresentationDraft(draftId)).success, /removed/);
  assert.equal(state.mutations.length, 1);
  assert.equal(state.cleanups, 1);
  assert.equal(state.sanitized, 0);
});
