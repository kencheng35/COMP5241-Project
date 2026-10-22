import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { publicConfig } from "../src/lib/public-config.ts";
import { completion, configuredFreeModels, OpenRouterError } from "../src/lib/openrouter-client.ts";

let failures = 0;
const probeSchema = z.object({ ok: z.literal(true) }).strict();
function report(label, ready, detail = "") {
  console.log(`${ready ? "PASS" : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`);
  if (!ready) failures++;
}

async function checkDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicReady = Boolean(publicConfig(process.env));
  report("Public application configuration", publicReady, publicReady ? "Supabase endpoint, anon key and site origin are valid." : "Check Supabase endpoint, anon key and canonical site origin.");
  if (!publicReady || !key?.trim()) {
    report("Database configuration", false, "Valid public Supabase URL, anon key, site origin and service-role key are required.");
    return;
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15000) }) },
  });
  const tables = [
    ["profiles", "id,display_name,age,age_range,avatar_url,learning_level,preferred_subjects,learning_goals,onboarding_completed_at,onboarding_background,diagnostic_summary,learning_setup_revision", "schema.sql, age-eligibility and 20261015_onboarding_diagnostic_ran.sql migrations"],
    ["forge_lessons", "id,owner_id,title,subject,summary,content,visibility,version,created_at,published_at,review_requested", "learning and review-privacy migrations"],
    ["forge_enrollments", "user_id,lesson_id,enrolled_at,attended_at,enrollment_kind,attendance_kind,progress_evidence", "learning, record-integrity and 20261021_progress_evidence_ran.sql migrations"],
    ["forge_attempts", "id,user_id,lesson_id,original_lesson_id,lesson_title,lesson_version,certificate_kind,answers,questions,score,completed_at", "learning and record-integrity migrations"],
    ["forge_bookmarks", "user_id,lesson_id,created_at", "learning migration"],
    ["forge_requests", "user_id,day,count,coach_count", "learning and coach migrations"],
    ["forge_reviewers", "user_id,lesson_id", "learning migration"],
    ["forge_resume", "user_id,lesson_id,lesson_version,revision,stage,slide,ordering,answers", "resume migration"],
    ["forge_interviews", "id,owner_id,schema_version,topic,level,state,revision,created_at,updated_at,completed_at", "20261015_interviews_ran.sql (verify application before feature/export queries; filename is not proof of application)"],
    ["forge_lesson_generations", "id,owner_id,kind,objective,selection,source_text,parts,part_count,attempts,revision,lesson_id,created_at,deleted_at", "20261020_lesson_generation_ran.sql (application unverified by this work; filename is not proof)"],
    ["forge_reflections", "id,owner_id,date,delegation,description,discernment,diligence,revision,created_at,updated_at", "20261022_daily_reflections_ran.sql (application unverified by this work; filename is not proof)"],
  ];
  for (const [table, columns, migration] of tables) {
    const { data, error } = await client.from(table).select(columns).limit(0);
    const ready = !error && Array.isArray(data);
    report(table, ready, ready ? "Required columns available." : `Unavailable; check ${migration} and database access.`);
  }
}

async function checkAI(probe) {
  const key = process.env.OPENROUTER_API_KEY ?? process.env.OPEN_ROUTER_API_KEY;
  report("OpenRouter key configured", Boolean(key?.trim()));
  let models;
  try {
    models = configuredFreeModels(process.env);
    report("Free-only model configuration", true, `${models.length} configured model(s); live catalog verification requires --ai.`);
  } catch {
    report("Free-only model configuration", false, "Configure only explicit free model IDs (at most ten).");
  }
  if (!probe) return;
  if (failures) {
    console.log("SKIP Live AI inference: resolve failed configuration/database checks first.");
    return;
  }
  try {
    const text = await completion([
      { role: "user", content: 'Return only the JSON object {"ok":true} for this synthetic connectivity test.' },
    ], z.toJSONSchema(probeSchema));
    const valid = probeSchema.safeParse(JSON.parse(text)).success;
    report("Synthetic AI inference", valid, valid ? "Structured response validated; full lesson generation remains unverified." : "Response did not match the test schema.");
  } catch (error) {
    report("Synthetic AI inference", false, error instanceof OpenRouterError
      ? `${error.status ? `HTTP ${error.status}; ` : ""}Shared-client request failed; no paid fallback or policy change attempted.`
      : "Response did not match the test schema.");
  }
}

const args = process.argv.slice(2);
if (args.some(argument => argument !== "--ai")) {
  console.error("Usage: npm run check:setup -- [--ai]");
  process.exitCode = 1;
} else {
  try { nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} }); }
  catch { report("Environment configuration", false, "Local configuration could not be loaded."); }
  if (!failures) {
    for (const [label, check] of [["Database checks", checkDatabase], ["AI checks", () => checkAI(args.includes("--ai"))]]) {
      try { await check(); }
      catch { report(label, false, "Check could not complete. Verify configuration and network availability."); }
    }
  }
  if (!args.includes("--ai")) console.log("SKIP Live AI inference (use --ai to make one synthetic request that consumes provider quota).");
  console.log("This check does not apply migrations, inspect learner records, verify grants/RPCs, or establish provider eligibility.");
  process.exitCode = failures ? 1 : 0;
}