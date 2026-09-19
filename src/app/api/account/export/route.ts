import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const [profile, enrollments, lessonProgress, quizResults, bookmarks, achievements] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(), supabase.from("enrollments").select("*").eq("user_id", user.id), supabase.from("lesson_progress").select("*").eq("user_id", user.id), supabase.from("quiz_results").select("*").eq("user_id", user.id), supabase.from("bookmarks").select("*").eq("user_id", user.id), supabase.from("achievements").select("*").eq("user_id", user.id),
    ]);
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), account: { email: user.email, createdAt: user.created_at }, profile: profile.data, enrollments: enrollments.data, lessonProgress: lessonProgress.data, quizResults: quizResults.data, bookmarks: bookmarks.data, achievements: achievements.data }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=forge-learning-data.json" } });
  } catch { return NextResponse.json({ error: "Data export requires a configured account." }, { status: 503 }); }
}