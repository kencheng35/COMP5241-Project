// Execute the real action with local mocks only; unexpected dependencies/writes fail.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { z } from "zod";

const source = ts.transpileModule(readFileSync(new URL("../src/app/presentation/actions.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const owner = "00000000-0000-4000-8000-000000000001";
const draft = "00000000-0000-4000-8000-000000000002";
const lesson = "00000000-0000-4000-8000-000000000003";
const privateText = `private-error credential-marker ${owner}`;

function fixture(options = {}) {
  const calls = [], logs = [];
  const fail = () => { throw new Error("Unexpected storage, cleanup or dependency access"); };
  const dependencies = {
    zod: { z },
    "@/lib/learning-server": {
      currentUser: async () => {
        calls.push("auth");
        if ("authError" in options) throw options.authError;
        return { id: owner };
      },
      accessibleLesson: async (...args) => {
        calls.push(["lesson", ...args]);
        if ("lessonError" in options) throw options.lessonError;
        return options.missingLesson ? null : { id: lesson };
      },
      canEditLesson: () => options.editable !== false,
      database: () => {
        calls.push("database");
        if ("databaseError" in options) throw options.databaseError;
        return {
          rpc: async (...args) => {
            calls.push(["rpc", ...args]);
            if ("thrown" in options) throw options.thrown;
            return "response" in options ? options.response : { data: draft, error: null };
          },
          from: fail, storage: { from: fail },
        };
      },
      isAdmin: fail,
    },
    "@/lib/presentation-assets-server": {
      cleanupPresentationAssets: fail, ownedPresentationDraft: fail, PRESENTATION_BUCKET: "unused",
    },
    "@/lib/presentation-images": { sanitizePresentationImage: fail },
  };
  const mod = { exports: {} };
  new Function("require", "module", "exports", "console", source)(name => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  }, mod, mod.exports, {
    error: value => {
      logs.push(JSON.parse(value));
      if (options.logThrows) throw new Error(privateText);
    },
  });
  return { begin: mod.exports.beginPresentationDraft, calls, logs };
}

function failure(result, h, category, code, message, rpcCount = 1) {
  assert.deepEqual(Object.keys(result), ["error"]);
  assert.match(result.error, message);
  assert.deepEqual(h.logs, [{ event: "presentation_draft_start_failed", category, code }]);
  assert.equal(h.calls.filter(call => Array.isArray(call) && call[0] === "rpc").length, rpcCount,
    "never retry an ambiguous create");
  for (const secret of [privateText, owner, "credential-marker"]) {
    assert.ok(!JSON.stringify([result, h.logs]).includes(secret), "no raw error or identity leakage");
  }
}

for (const lessonId of [undefined, lesson]) {
  test(`successful UUID is returned unchanged (${lessonId ? "editable lesson" : "new import"})`, async () => {
    const h = fixture();
    assert.deepEqual(await h.begin(lessonId), { id: draft });
    assert.deepEqual(h.logs, []);
    assert.deepEqual(h.calls.filter(call => Array.isArray(call) && call[0] === "rpc"), [
      ["rpc", "forge_begin_presentation_draft", { request_owner: owner, request_lesson: lessonId ?? null }],
    ]);
    assert.equal(h.calls[0], "auth");
    if (lessonId) assert.deepEqual(h.calls[1], ["lesson", lesson, { id: owner }, true]);
  });
}

test("only the exact known P0001 draft-limit signature gives quota recovery", async () => {
  const h = fixture({ response: { data: null, error: { code: "P0001", message: "draft limit", details: privateText } } });
  failure(await h.begin(), h, "draft_limit", "P0001", /10 active.*Discard only.*expire/);
});

for (const [code, message] of [
  ["P0001", privateText], ["P0001", "draft limit exceeded"], ["P0001", "draft limit\n"],
  ["42501", "draft limit"], ["unknown-secret-code", "draft limit"], [undefined, "draft limit"],
]) {
  test(`draft-limit lookalike is not treated as quota: ${code}/${message === privateText ? "private" : JSON.stringify(message)}`, async () => {
    const h = fixture({ response: { data: null, error: { code, message, hint: privateText } } });
    const permission = code === "42501";
    failure(await h.begin(), h, permission ? "permission_config" : "unexpected",
      ["P0001", "42501"].includes(code) ? code : null,
      permission ? /administrator.*permissions.*same Supabase project/ : /may have been created.*before trying again/);
  });
}

for (const code of ["PGRST202", "PGRST205", "42883", "42P01", "3F000"]) {
  test(`missing function/schema category: ${code}`, async () => {
    const h = fixture({ response: { data: null, error: { code, message: privateText, details: privateText } } });
    failure(await h.begin(), h, "missing_schema", code, /administrator.*presentation migration.*schema cache/);
  });
}

for (const code of ["42501", "28000", "28P01", "PGRST301", "PGRST302", "PGRST303", "PGRST106"]) {
  test(`permission/config category: ${code}`, async () => {
    const h = fixture({ response: { data: null, error: { code, message: privateText } } });
    failure(await h.begin(), h, "permission_config", code, /administrator.*permissions.*same Supabase project/);
  });
}

for (const status of [401, 403, 0, 408, 429, 502, 503, 504]) {
  test(`HTTP status fallback without trusting error text: ${status}`, async () => {
    const h = fixture({ response: { data: null, status, error: { message: privateText } } });
    const permission = status === 401 || status === 403;
    failure(await h.begin(), h, permission ? "permission_config" : "transient", null,
      permission ? /same Supabase project/ : /may have been created.*before trying again/);
  });
}

for (const code of ["08006", "53300", "57P01", "57014", "40001", "40P01", "PGRST000", "PGRST001", "PGRST002", "PGRST003"]) {
  test(`transient category: ${code}`, async () => {
    const h = fixture({ response: { data: null, error: { code, message: privateText } } });
    failure(await h.begin(), h, "transient", code, /may have been created.*before trying again/);
  });
}

for (const data of [null, undefined, "", "not-a-uuid", 42, [draft], { id: draft }]) {
  test(`invalid UUID acknowledgment: ${JSON.stringify(data)}`, async () => {
    const h = fixture({ response: { data, error: null } });
    failure(await h.begin(), h, "invalid_acknowledgment", null, /valid draft ID.*may have been created.*before trying again/);
  });
}

for (const response of [null, undefined, {}, "malformed"]) {
  test(`malformed RPC envelope: ${JSON.stringify(response)}`, async () => {
    const h = fixture({ response });
    failure(await h.begin(), h, "invalid_acknowledgment", null, /valid draft ID.*before trying again/);
  });
}

for (const thrown of [new Error(privateText), new TypeError(privateText), privateText, null, { code: privateText, message: privateText }]) {
  test("thrown unknown errors are sanitized and never retried", async () => {
    const h = fixture({ thrown });
    failure(await h.begin(), h, "unexpected", null, /may have been created.*before trying again/);
  });
}

test("thrown coded transport error and failed log sink preserve sanitized outcome", async () => {
  const h = fixture({ thrown: { code: "08006", message: privateText }, logThrows: true });
  failure(await h.begin(), h, "transient", "08006", /before trying again/);
});

test("known missing service configuration is actionable before RPC", async () => {
  const h = fixture({ databaseError: new Error("Learning services are not configured.") });
  failure(await h.begin(), h, "permission_config", null, /same Supabase project/, 0);
});

test("known public auth-client configuration failure is not misreported as a login failure", async () => {
  const h = fixture({ authError: new Error("Learning service configuration is unavailable. Check the public Supabase URL, anon key and site origin.") });
  failure(await h.begin(), h, "permission_config", null, /same Supabase project/, 0);
  assert.deepEqual(h.calls, ["auth"]);
});

test("unexpected client construction failure does not leak or call RPC", async () => {
  const h = fixture({ databaseError: new Error(privateText) });
  failure(await h.begin(), h, "unexpected", null, /administrator/, 0);
});

test("denied authentication is sanitized and cannot reach database", async () => {
  const h = fixture({ authError: new Error(privateText) });
  failure(await h.begin(), h, "auth_required", null, /Log in again/, 0);
  assert.deepEqual(h.calls, ["auth"]);
});

test("invalid lesson ID cannot reach lesson lookup or RPC", async () => {
  const h = fixture();
  failure(await h.begin(privateText), h, "invalid_lesson", null, /valid lesson/, 0);
  assert.deepEqual(h.calls, ["auth"]);
});

for (const options of [{ editable: false }, { missingLesson: true }]) {
  test("denied lesson authorization cannot reach draft creation", async () => {
    const h = fixture(options);
    failure(await h.begin(lesson), h, "forbidden", null, /cannot edit/, 0);
    assert.equal(h.calls.includes("database"), false);
  });
}

test("thrown lesson lookup error is sanitized before any create", async () => {
  const h = fixture({ lessonError: new Error(privateText) });
  failure(await h.begin(lesson), h, "unexpected", null, /administrator/, 0);
  assert.equal(h.calls.includes("database"), false);
});

test("RPC error takes precedence over a valid-looking UUID", async () => {
  const h = fixture({ response: { data: draft, error: { code: "P0001", message: "draft limit" } } });
  failure(await h.begin(), h, "draft_limit", "P0001", /10 active/);
});
