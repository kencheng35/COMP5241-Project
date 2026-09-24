import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { publicConfig } from "../src/lib/public-config.ts";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

let failures = 0;
function report(label, ready, detail = "") {
  console.log(`${ready ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!ready) failures++;
}

async function checkDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicReady = Boolean(publicConfig(process.env));
  report("Public application configuration", publicReady, publicReady ? "Supabase endpoint, anon key and site origin are valid." : "Check Supabase endpoint, anon key and canonical site origin.");
  if (!publicReady || !key) {
    report("Database configuration", false, "Valid public Supabase URL, anon key, site origin and service-role key are required.");
    return;
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  });
  const tables = [
    ["profiles", "id,display_name,age_range,avatar_url,learning_level,preferred_subjects,learning_goals", "schema.sql"],
    ["forge_lessons", "id,owner_id,title,subject,summary,content,visibility,version,created_at,published_at,review_requested", "learning and review-privacy migrations"],
    ["forge_enrollments", "user_id,lesson_id,enrolled_at,attended_at,enrollment_kind,attendance_kind", "learning and record-integrity migrations"],
    ["forge_attempts", "id,user_id,lesson_id,original_lesson_id,lesson_title,lesson_version,certificate_kind,answers,questions,score,completed_at", "learning and record-integrity migrations"],
    ["forge_bookmarks", "user_id,lesson_id,created_at", "learning migration"],
    ["forge_requests", "user_id,day,count,coach_count", "learning and coach migrations"],
    ["forge_reviewers", "user_id,lesson_id", "learning migration"],
    ["forge_resume", "user_id,lesson_id,lesson_version,revision,stage,slide,ordering,answers", "resume migration"],
  ];
  for (const [table, columns, migration] of tables) {
    const { data, error } = await client.from(table).select(columns).limit(0);
    const ready = !error && Array.isArray(data);
    report(table, ready, ready ? "Required columns available." : `Unavailable; check ${migration} and database access.`);
  }
}

async function checkAI(probe) {
  const key = process.env.OPENROUTER_API_KEY ?? process.env.OPEN_ROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL ?? "qwen/qwen3.8-27b:free";
  report("OpenRouter key configured", Boolean(key));
  const free = model.endsWith(":free");
  report("Free-only model configuration", free);
  if (!probe || !key || !free) return;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(55000),
    body: JSON.stringify({
      model,
      provider: { data_collection: "deny", zdr: true, require_parameters: true },
      reasoning: { enabled: false },
      messages: [{ role: "user", content: "Synthetic connectivity test. Return a JSON object with ok set to true." }],
      max_tokens: 300,
      response_format: { type: "json_schema", json_schema: {
        name: "setup_probe", strict: true,
        schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
      } },
    }),
  });
  if (!response.ok) {
    report("Synthetic AI inference", false, `HTTP ${response.status}; no paid fallback or privacy relaxation attempted.`);
    return;
  }
  let valid = false;
  try {
    const data = await response.json();
    const output = JSON.parse(data.choices?.[0]?.message?.content);
    valid = output?.ok === true && Object.keys(output).length === 1;
  } catch { valid = false; }
  report("Synthetic AI inference", valid, valid ? "Structured response received; full lesson generation remains unverified." : "Response did not match the test schema.");
}

const args = process.argv.slice(2);
if (args.some(argument => argument !== "--ai")) {
  console.error("Usage: npm run check:setup -- [--ai]");
  process.exitCode = 1;
} else {
  for (const [label, check] of [["Database checks", checkDatabase], ["AI checks", () => checkAI(args.includes("--ai"))]]) {
    try { await check(); }
    catch { report(label, false, "Check could not complete. Verify configuration and network availability."); }
  }
  if (!args.includes("--ai")) console.log("SKIP Live AI inference (use --ai to make one synthetic request that consumes provider quota).");
  console.log("This check does not apply migrations, inspect learner records, verify grants/RPCs, or establish provider eligibility.");
  process.exitCode = failures ? 1 : 0;
}