"use server";

import { z } from "zod";
import { database, requireUser, visibleLessons } from "@/lib/learning-server";
import { requireAiAccess } from "@/lib/ai-eligibility-server";
import { collectRows } from "@/lib/learning";
import { completion, OpenRouterError } from "@/lib/openrouter-client";
import { buildPathRequest, derivePreferences, GOALS, TOPICS, validatePathResponse, type Recommendation } from "@/lib/recommendations";

export type PathState = { error?: string; path?: Recommendation[]; selectionKey?: string };

async function passedLessonIds(userId: string) {
  const client = database();
  const rows = await collectRows((start, end) => client.from("forge_attempts").select("original_lesson_id")
    .eq("user_id", userId).gte("score", 6).order("id").range(start, end));
  return rows.map(row => String(row.original_lesson_id));
}

export async function generateLearningPath(_previous: PathState, form: FormData): Promise<PathState> {
  const user = await requireUser();
  try { await requireAiAccess(user); }
  catch { return { error: "External AI requires a recorded adult age (18+) and administrator-approved AI access. Local recommendations remain available." }; }
  try {
    const topic = z.enum(["profile", ...TOPICS]).parse(form.get("topic"));
    const goal = z.enum(["profile", ...GOALS]).parse(form.get("goal"));
    if (form.get("shareCourseContent") !== "on") return { error: "Confirm sharing course titles and coarse SDLC preferences before generating a path." };
    const client = database();
    const [profileResult, catalog, completedIds] = await Promise.all([
      client.from("profiles").select("learning_level,preferred_subjects,learning_goals").eq("id", user.id).maybeSingle(),
      visibleLessons(user),
      passedLessonIds(user.id),
    ]);
    if (profileResult.error) return { error: "Could not load your learning preferences. Try again later." };
    const profile = profileResult.data;
    const preferences = derivePreferences({ level: profile?.learning_level, subjects: Array.isArray(profile?.preferred_subjects) ? profile.preferred_subjects.join(", ") : "", goals: profile?.learning_goals }, { topic, goal });
    const request = buildPathRequest(catalog, preferences, completedIds);
    const { data: allowed, error } = await client.rpc("forge_claim_request", { request_user: user.id });
    if (error || allowed !== true) return { error: "AI generation is unavailable or your shared daily generation allowance has been used. Local recommendations remain available." };
    const text = await completion(request.messages, request.schema);
    await requireAiAccess(user);
    const [currentCatalog, currentCompletedIds] = await Promise.all([visibleLessons(user), passedLessonIds(user.id)]);
    const path = validatePathResponse(text, request.candidates, currentCatalog, currentCompletedIds);
    return { path, selectionKey: `${topic}:${goal}` };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Choose a listed SDLC topic and learning goal." };
    if (error instanceof OpenRouterError) return { error: error.message };
    return { error: "No AI path was accepted. Lessons may be unavailable, completed, or outside SDLC, or the response could not be validated. Local recommendations remain available." };
  }
}