import "server-only";
import { createClient as createAdminClient, type User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { collectRows, storedLessonSchema, type LessonContent } from "@/lib/learning";
import { z } from "zod";
import { isAdmin } from "@/lib/permissions";
export { isAdmin, isInstructor, canPublishLessons, canEditLesson, canManageEnrollment } from "@/lib/permissions";

export type LessonRow = {
  id: string; owner_id: string; title: string; subject: string; summary: string;
  content: LessonContent; visibility: "private" | "public"; version: number; created_at: string; published_at?: string | null; review_requested: boolean;
  metadata?: unknown;
};
export type AttemptRow = {
  id: string; user_id: string; lesson_id: string | null; original_lesson_id: string; lesson_title: string; lesson_version: number;
  certificate_kind: "private" | "public"; score: number; answers: number[];
  questions: LessonContent["questions"]; completed_at: string;
};

export function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Learning services are not configured.");
  return createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function currentUser() {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error("Please log in again.");
  return user;
}

export async function requireUser() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

export async function lessonCreators(ownerIds: string[]) {
  const ids = [...new Set(ownerIds)];
  const creators = new Map<string, { name: string; role: "Instructor" | "Learner" }>();
  if (!ids.length) return creators;
  const { data } = await database().from("profiles").select("id,display_name").in("id", ids);
  const names = new Map((data ?? []).map(row => [String(row.id), String(row.display_name || "Learner")]));
  await Promise.all(ids.map(async id => {
    const { data: account } = await database().auth.admin.getUserById(id);
    const role = account.user?.app_metadata?.role;
    creators.set(id, { name: names.get(id) ?? "Learner", role: role === "instructor" || role === "admin" ? "Instructor" : "Learner" });
  }));
  return creators;
}

export async function displayName(user: User) {
  const { data } = await database().from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  return String(data?.display_name ?? user.user_metadata?.display_name ?? "Learner");
}

export async function visibleLessons(user: User) {
  const data = await collectRows((start, end) => database().from("forge_lessons")
    .select("id,owner_id,title,subject,summary,visibility,version,created_at,published_at,metadata:content->metadata")
    .or(`visibility.eq.public,owner_id.eq.${user.id}`).order("created_at", { ascending: false }).order("id").range(start, end));
  return data as Omit<LessonRow, "content">[];
}

export async function accessibleLesson(id: string, user: User, adminReview = false) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await database().from("forge_lessons").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load this lesson.");
  if (!data || (data.visibility !== "public" && data.owner_id !== user.id && !(adminReview && isAdmin(user) && data.review_requested))) return null;
  return { ...data, content: storedLessonSchema.parse(data.content) } as LessonRow;
}

export async function enrolledLesson(id: string, user: User) {
  const lesson = await accessibleLesson(id, user);
  if (!lesson) throw new Error("Lesson not found or unavailable.");
  const { data, error } = await database().from("forge_enrollments").select("lesson_id").eq("user_id", user.id).eq("lesson_id", id).maybeSingle();
  if (error || !data) throw new Error("Enroll in this lesson first.");
  return lesson;
}

export function hongKongTime(value: string | undefined) {
  if (!value) return "Not seen yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not seen yet";
  return new Intl.DateTimeFormat("en-HK", {
    timeZone: "Asia/Hong_Kong", year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date) + " HKT";
}

export function hongKongDate(value: string | undefined) {
  if (!value) return "Not seen yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not seen yet";
  return new Intl.DateTimeFormat("en-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "short", day: "2-digit" }).format(date);
}

export async function lessonResumeDates(userId: string) {
  const rows = await collectRows((start, end) => database().from("forge_resume")
    .select("lesson_id,updated_at").eq("user_id", userId).order("lesson_id").range(start, end));
  return new Map(rows.map(row => [String(row.lesson_id), String(row.updated_at)]));
}

export async function userRecords(user: User) {
  const client = database();
  const [enrollments, attempts, bookmarks] = await Promise.all([
    collectRows((start, end) => client.from("forge_enrollments").select("*").eq("user_id", user.id).order("lesson_id").range(start, end)),
    collectRows((start, end) => client.from("forge_attempts").select("*").eq("user_id", user.id).order("completed_at", { ascending: false }).order("id").range(start, end)),
    collectRows((start, end) => client.from("forge_bookmarks").select("lesson_id").eq("user_id", user.id).order("lesson_id").range(start, end)),
  ]);
  return { enrollments, attempts: attempts as AttemptRow[], bookmarks };
}