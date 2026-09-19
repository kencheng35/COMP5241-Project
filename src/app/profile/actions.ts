"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const result = z.object({ displayName: z.string().trim().min(2), ageRange: z.string().min(1), level: z.string().min(1), subjects: z.string().max(300), goals: z.string().max(800) }).safeParse(Object.fromEntries(formData));
  if (!result.success) redirect("/profile?error=Please%20check%20the%20highlighted%20profile%20fields.");
  try { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) redirect("/login"); const { error } = await supabase.from("profiles").upsert({ id: user.id, display_name: result.data.displayName, age_range: result.data.ageRange, learning_level: result.data.level, preferred_subjects: result.data.subjects.split(",").map((item) => item.trim()).filter(Boolean), learning_goals: result.data.goals, updated_at: new Date().toISOString() }); if (error) throw error; } catch (error) { if (process.env.NEXT_PUBLIC_SUPABASE_URL) redirect(`/profile?error=${encodeURIComponent(error instanceof Error ? error.message : "Could not save profile.")}`); }
  redirect("/profile?success=Profile%20updated%20successfully.");
}

export async function deleteAccount(formData: FormData) {
  if (formData.get("confirm") !== "on") redirect("/profile/delete?error=Confirm%20that%20you%20understand%20this%20action.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) redirect("/profile/delete?error=Account%20deletion%20is%20not%20configured%20yet.");
  const admin = createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) redirect(`/profile/delete?error=${encodeURIComponent(error.message)}`);
  redirect("/login?success=Your%20account%20and%20learning%20data%20were%20deleted.");
}