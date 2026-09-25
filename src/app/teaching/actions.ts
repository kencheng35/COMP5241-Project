"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { accessibleLesson, canManageEnrollment, canPublishLessons, currentUser, database } from "@/lib/learning-server";
import { findAccounts, type DirectoryState } from "@/lib/account-directory";
import { requireAiAccess } from "@/lib/ai-eligibility-server";
import { generateLesson } from "@/lib/openrouter";
import { extractTeachingMaterial } from "@/lib/teaching-material";
import type { ActionState } from "@/app/learning/actions";

export async function searchLearners(_previous: DirectoryState, form: FormData): Promise<DirectoryState> {
  try {
    const user = await currentUser();
    const lesson = await accessibleLesson(z.uuid().parse(form.get("lessonId")), user);
    if (!lesson || !canManageEnrollment(user, lesson)) return { error: "You cannot manage enrollment for this lesson." };
    return await findAccounts(user, form.get("query"), form.get("page") ?? 1, true);
  } catch { return { error: "Learner search failed. Check your session and search value, then retry." }; }
}

export async function enrollSelected(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    const id = z.uuid().parse(form.get("lessonId"));
    const lesson = await accessibleLesson(id, user);
    if (!lesson || !canManageEnrollment(user, lesson)) return { error: "You cannot manage enrollment for this lesson." };
    const selected = [...new Set(z.array(z.uuid()).min(1).max(50).parse(form.getAll("learnerId")))];
    const client = database();
    for (let offset = 0; offset < selected.length; offset += 10) {
      const accounts = await Promise.all(selected.slice(offset, offset + 10).map(accountId => client.auth.admin.getUserById(accountId)));
      if (accounts.some(result => result.error || !result.data.user?.email_confirmed_at || canPublishLessons(result.data.user))) {
        return { error: "Select only existing, email-verified learner accounts. No enrollments were changed." };
      }
    }
    const { error } = await client.from("forge_enrollments").upsert(selected.map(accountId => ({
      user_id: accountId, lesson_id: id, enrollment_kind: "public",
    })), { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
    if (error) return { error: "Enrollment failed. Please retry; existing enrollments are preserved." };
    revalidatePath("/teaching"); revalidatePath("/reports"); revalidatePath("/dashboard"); revalidatePath("/catalog");
    return { success: `Enrollment confirmed for ${selected.length} selected learner(s). Existing progress is unchanged.` };
  } catch { return { error: "Choose between 1 and 50 learners and try again." }; }
}

export async function importTeachingMaterial(_previous: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await currentUser();
    if (!canPublishLessons(user)) return { error: "Instructor access required." };
    await requireAiAccess(user);
    if (form.get("consent") !== "on") return { error: "Confirm that the material is permitted to be sent for AI processing." };
    const topic = z.string().trim().min(5).max(500).parse(form.get("topic"));
    const file = form.get("material");
    if (!(file instanceof File)) return { error: "Choose a teaching file." };
    const source = await extractTeachingMaterial(file);
    if (source.length > 20000) return { error: "This material contains more than 20,000 characters. Upload a shorter section; no content was sent to AI." };
    const client = database();
    const { data: allowed, error: quotaError } = await client.rpc("forge_claim_request", { request_user: user.id });
    if (quotaError) return { error: "Generation is unavailable. Check the database migration." };
    if (!allowed) return { error: "Your five daily generation requests have been used." };
    const content = await generateLesson(topic, source);
    const { data, error } = await client.from("forge_lessons").insert({ owner_id: user.id, title: content.title, subject: content.subject, summary: content.summary, content }).select("id").single();
    if (error || !data) return { error: "Could not save the generated draft. Nothing was published." };
    revalidatePath("/teaching"); revalidatePath("/studio");
    return { success: "Editable private draft created. Review its slides and quiz before publication.", lessonId: data.id };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: "Enter an SDLC learning objective between 5 and 500 characters." };
    return { error: error instanceof Error ? error.message : "Material import failed. Try again." };
  }
}