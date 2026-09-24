"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { publicConfig } from "@/lib/public-config";

export type ProfileState = {
  error?: string;
  fields?: { displayName: string; ageRange: string; level: string; subjects: string; goals: string };
  fieldErrors?: Record<string, string>;
};

export async function updateProfile(_previous: ProfileState, formData: FormData): Promise<ProfileState> {
  const fields = {
    displayName: String(formData.get("displayName") ?? "").slice(0, 100),
    ageRange: String(formData.get("ageRange") ?? ""),
    level: String(formData.get("level") ?? ""),
    subjects: String(formData.get("subjects") ?? "").slice(0, 300),
    goals: String(formData.get("goals") ?? "").slice(0, 800),
  };
  const result = z.object({ displayName: z.string().trim().min(2).max(100), ageRange: z.enum(["under-13", "13-17", "18-24", "25-34", "35-plus"]), level: z.enum(["new", "foundation", "intermediate", "advanced"]), subjects: z.string().max(300), goals: z.string().max(800) }).safeParse(Object.fromEntries(formData));
  if (!result.success) return { fields, fieldErrors: Object.fromEntries(result.error.issues.map(issue => [String(issue.path[0]), issue.message])), error: "Please check the highlighted profile fields." };
  let avatar: string | null | undefined;
  const image = formData.get("avatar");
  if (formData.get("removeAvatar") === "on") avatar = null;
  else if (image instanceof File && image.size) {
    try {
      if (image.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png"].includes(image.type)) throw new Error("Invalid image");
      const processor = sharp(Buffer.from(await image.arrayBuffer()), { limitInputPixels: 20_000_000 });
      const metadata = await processor.metadata();
      if (!["jpeg", "png"].includes(metadata.format ?? "")) throw new Error("Invalid image");
      const buffer = await processor.rotate().resize(160, 160, { fit: "cover" }).jpeg({ quality: 80 }).toBuffer();
      avatar = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    } catch { return { fields, error: "Choose a valid JPG or PNG under 2 MB and 20 megapixels." }; }
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { fields, error: "Your session has expired. Log in again before saving." };
    const { error } = await supabase.from("profiles").upsert({ id: user.id, display_name: result.data.displayName, age_range: result.data.ageRange, learning_level: result.data.level, preferred_subjects: result.data.subjects.split(",").map(item => item.trim()).filter(Boolean), learning_goals: result.data.goals, ...(avatar !== undefined ? { avatar_url: avatar } : {}), updated_at: new Date().toISOString() });
    if (error) return { fields, error: "Could not save your profile. Please try again." };
  } catch {
    return { fields, error: "Could not save your profile. Please try again." };
  }
  revalidatePath("/profile");
  redirect("/profile?success=Profile%20updated%20successfully.");
}

export async function deleteAccount(formData: FormData) {
  if (formData.get("confirm") !== "on") redirect("/profile/delete?error=Confirm%20that%20you%20understand%20this%20action.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const password = z.string().min(1).safeParse(formData.get("password"));
  if (!password.success || !user.email) redirect("/profile/delete?error=Enter%20your%20current%20password.");
  const { error: passwordError } = await supabase.auth.signInWithPassword({ email: user.email, password: password.data });
  if (passwordError) redirect("/profile/delete?error=The%20password%20could%20not%20be%20verified.");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) redirect("/profile/delete?error=Account%20deletion%20is%20not%20configured%20yet.");
  try {
    const admin = createSupabaseClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
  } catch {
    redirect("/profile/delete?error=Could%20not%20confirm%20account%20deletion.%20Check%20whether%20you%20can%20still%20log%20in%20before%20retrying%2C%20or%20contact%20support.");
  }
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  } catch {
    redirect("/login?error=Your%20account%20was%20deleted%2C%20but%20this%20browser%20session%20could%20not%20be%20cleared.%20Clear%20site%20cookies%20before%20using%20this%20device%20again.");
  }
  redirect("/login?success=Your%20account%20and%20learning%20data%20were%20deleted.");
}

export async function changeEmail(formData: FormData) {
  const result = z.email().safeParse(formData.get("email"));
  if (!result.success) redirect("/profile?error=Enter%20a%20valid%20email%20address.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const settings = publicConfig(process.env);
  if (!settings) redirect("/profile?error=Email%20changes%20are%20temporarily%20unavailable.");
  const { error } = await supabase.auth.updateUser({ email: result.data }, { emailRedirectTo: `${settings.siteOrigin}/auth/confirm?next=/profile` });
  if (error) redirect("/profile?error=Could%20not%20request%20an%20email%20change.");
  redirect("/profile?success=Check%20your%20current%20and%20new%20email%20inboxes%20to%20confirm%20the%20change.");
}