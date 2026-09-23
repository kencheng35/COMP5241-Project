"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const password = z.string().min(8, "Use at least 8 characters.").regex(/[A-Z]/, "Add one uppercase letter.").regex(/[0-9]/, "Add one number.");
const email = z.string().email("Enter a valid email address.");

function destination(path: string, type: "error" | "success" | "message", message: string) {
  return `${path}?${type}=${encodeURIComponent(message)}`;
}

function authCallback(next: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`;
}

export async function signUp(formData: FormData) {
  const schema = z.object({
    name: z.string().trim().min(2, "Enter your display name."),
    email,
    ageRange: z.enum(["under-13", "13-17", "18-24", "25-34", "35-plus"]),
    password,
    consent: z.string().optional(),
  }).refine((data) => data.ageRange !== "under-13" || data.consent === "on", {
    message: "A parent or guardian must consent for learners under 13.",
  });
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) redirect(destination("/signup", "error", result.error.issues[0].message));

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      emailRedirectTo: authCallback("/dashboard"),
      data: { display_name: result.data.name, age_range: result.data.ageRange, guardian_consent_self_attested: result.data.ageRange === "under-13" && result.data.consent === "on", consent_recorded_at: new Date().toISOString() },
    },
  });
  if (error) redirect(destination("/signup", "error", error.message));
  redirect(`/login?success=${encodeURIComponent("Account created. Check your inbox and verify your email before logging in.")}&email=${encodeURIComponent(result.data.email)}`);
}

export async function logIn(formData: FormData) {
  const result = z.object({ email, password: z.string().min(1, "Enter your password.") }).safeParse(Object.fromEntries(formData));
  if (!result.success) redirect(destination("/login", "error", result.error.issues[0].message));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error?.code === "email_not_confirmed") {
    redirect(`/login?error=${encodeURIComponent("Your password is correct, but your email is not verified yet.")}&verification=required&email=${encodeURIComponent(result.data.email)}`);
  }
  if (error) redirect(destination("/login", "error", "The email or password is incorrect."));
  redirect("/dashboard");
}

export async function resendVerification(formData: FormData) {
  const result = email.safeParse(formData.get("email"));
  if (!result.success) redirect(destination("/login", "error", result.error.issues[0].message));
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: result.data,
    options: { emailRedirectTo: authCallback("/dashboard") },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(result.data)}`);
  redirect(`/login?success=${encodeURIComponent("Verification email sent. Check your inbox and spam folder.")}&email=${encodeURIComponent(result.data)}`);
}

export async function requestReset(formData: FormData) {
  const result = email.safeParse(formData.get("email"));
  if (!result.success) redirect(destination("/forgot-password", "error", result.error.issues[0].message));
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(result.data, {
    redirectTo: authCallback("/reset-password"),
  });
  if (error) redirect(destination("/forgot-password", "error", "Could not send the reset email. Please try again later."));
  redirect(destination("/forgot-password", "success", "If that email exists, a reset link is on its way."));
}

export async function resetPassword(formData: FormData) {
  const result = password.safeParse(formData.get("password"));
  if (!result.success) redirect(destination("/reset-password", "error", result.error.issues[0].message));
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: result.data });
  if (error) redirect(destination("/reset-password", "error", "This reset link has expired. Request a new one."));
  redirect(destination("/login", "success", "Password updated. You can log in now."));
}

export async function logOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) redirect(destination("/profile", "error", "Could not log out. Please try again."));
  redirect("/login");
}