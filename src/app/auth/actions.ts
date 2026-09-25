"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicConfig } from "@/lib/public-config";
import { ageRangeFor, isDemoAge } from "@/lib/eligibility";

const password = z.string().min(8, "Use at least 8 characters.").regex(/[A-Z]/, "Add one uppercase letter.").regex(/[0-9]/, "Add one number.");
const email = z.string().email("Enter a valid email address.");

export type CredentialState = {
  error?: string;
  fields?: { name: string; email: string; age: string };
  fieldErrors?: Record<string, string>;
  verification?: boolean;
};

function formFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").slice(0, 100),
    email: String(formData.get("email") ?? "").slice(0, 320),
    age: String(formData.get("age") ?? ""),
  };
}

function validationErrors(issues: z.core.$ZodIssue[]) {
  return Object.fromEntries(issues.map(issue => [String(issue.path[0] ?? "consent"), issue.message]));
}

function destination(path: string, type: "error" | "success" | "message", message: string) {
  return `${path}?${type}=${encodeURIComponent(message)}`;
}

function authCallback(next: string) {
  const settings = publicConfig(process.env);
  if (!settings) throw new Error("Learning service configuration is unavailable.");
  return `${settings.siteOrigin}/auth/confirm?next=${encodeURIComponent(next)}`;
}

export async function signUp(_previous: CredentialState, formData: FormData): Promise<CredentialState> {
  const schema = z.object({
    name: z.string().trim().min(2, "Enter your display name.").max(100, "Use at most 100 characters."),
    email,
    age: z.coerce.number().refine(isDemoAge, "Enter a whole-number age from 13 to 120."),
    password,
  });
  const fields = formFields(formData);
  const result = schema.safeParse(Object.fromEntries(formData));
  if (!result.success) return { fields, fieldErrors: validationErrors(result.error.issues), error: "Check the highlighted fields." };

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
      options: {
        emailRedirectTo: authCallback("/dashboard"),
        data: { display_name: result.data.name, age: result.data.age, age_range: ageRangeFor(result.data.age) },
      },
    });
    if (error) return { fields, error: "Could not create the account. Please try again later." };
  } catch {
    return { fields, error: "Could not create the account. Please try again later." };
  }
  redirect(`/login?success=${encodeURIComponent("Account created. Check your inbox and verify your email before logging in.")}&email=${encodeURIComponent(result.data.email)}`);
}

export async function logIn(_previous: CredentialState, formData: FormData): Promise<CredentialState> {
  const fields = formFields(formData);
  const result = z.object({ email, password: z.string().min(1, "Enter your password.") }).safeParse(Object.fromEntries(formData));
  if (!result.success) return { fields, fieldErrors: validationErrors(result.error.issues), error: "Check the highlighted fields." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(result.data);
    if (error?.code === "email_not_confirmed") {
      return { fields, verification: true, error: "Your password is correct, but your email is not verified yet." };
    }
    if (error) return { fields, error: "The email or password is incorrect." };
  } catch {
    return { fields, error: "Could not log in. Please try again later." };
  }
  redirect("/dashboard");
}

export async function resendVerification(formData: FormData) {
  const result = email.safeParse(formData.get("email"));
  if (!result.success) redirect(`/login?error=${encodeURIComponent(result.error.issues[0].message)}&verification=required`);
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: result.data,
      options: { emailRedirectTo: authCallback("/dashboard") },
    });
    if (error) throw error;
  } catch {
    redirect(`/login?error=${encodeURIComponent("Could not resend the verification email. Please try again later.")}&verification=required&email=${encodeURIComponent(result.data)}`);
  }
  redirect(`/login?success=${encodeURIComponent("Verification email sent. Check your inbox and spam folder.")}&verification=required&email=${encodeURIComponent(result.data)}`);
}

export async function requestReset(_previous: CredentialState, formData: FormData): Promise<CredentialState> {
  const fields = formFields(formData);
  const result = email.safeParse(formData.get("email"));
  if (!result.success) return { fields, fieldErrors: { email: result.error.issues[0].message }, error: "Check the highlighted fields." };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(result.data, {
      redirectTo: authCallback("/reset-password"),
    });
    if (error) throw error;
  } catch {
    return { fields, error: "Could not send the reset email. Please try again later." };
  }
  redirect(destination("/forgot-password", "success", "If that email exists, a reset link is on its way."));
}

export async function resetPassword(formData: FormData) {
  const result = password.safeParse(formData.get("password"));
  if (!result.success) redirect(destination("/reset-password", "error", result.error.issues[0].message));
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: result.data });
    if (error) throw error;
  } catch {
    redirect(destination("/reset-password", "error", "Could not update the password. Request a new link or try again later."));
  }
  redirect(destination("/login", "success", "Password updated. You can log in now."));
}

export async function logOut() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch {
    redirect(destination("/profile", "error", "Could not log out. Please try again."));
  }
  redirect("/login");
}