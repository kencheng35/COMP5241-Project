import Link from "next/link";
import { redirect } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { createClient } from "@/lib/supabase/server";
import { EmailChangeForm } from "@/components/email-change-form";
import { ThemeSwitch } from "@/components/theme-switch";
import { RememberAvatar } from "@/components/remember-avatar";
import { ProfileForm } from "@/components/profile-form";
import { isInstructor, isAdmin } from "@/lib/learning-server";
import type { User } from "@supabase/supabase-js";

type ProfileRow = {
  avatar_url: string | null;
  display_name: string;
  age_range: string;
  age: number | null;
  learning_level: string | null;
  preferred_subjects: string[] | null;
  learning_goals: string | null;
  learning_setup_revision: number;
};

export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  let user: User | null = null;
  let profile: ProfileRow | null = null;
  let loadError: string | null = null;
  let unauthenticated = false;
  try {
    const supabase = await createClient();
    const authentication = await supabase.auth.getUser();
    if (authentication?.error !== null) loadError = "Could not verify your account. No profile fields can be saved until it loads.";
    else if (!authentication?.data?.user) unauthenticated = true;
    else {
      user = authentication.data.user;
      const response = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!response || response.error !== null) loadError = "Could not load your saved profile. No profile fields can be saved until it loads.";
      else if (!response.data) loadError = "Your profile is missing. Contact support; no profile or age has been invented.";
      else if (!Number.isInteger(response.data.learning_setup_revision) || response.data.learning_setup_revision < 0) loadError = "Profile editing needs the onboarding/diagnostic schema upgrade. No profile fields can be saved until it is available.";
      else profile = response.data as ProfileRow;
    }
  } catch { loadError = "Could not load your saved profile. No profile fields can be saved until it loads."; }
  if (unauthenticated) redirect("/login");
  if (!user || !profile) return <LearnerShell active="/profile" admin={Boolean(user && isAdmin(user))} instructor={Boolean(user && isInstructor(user))}>
    <div className="portal-page profile-page"><h1>Profile & settings.</h1>
      <div role="alert" className="form-notice notice-error">{loadError}</div>
      <p><a href="/profile" className="text-link">Retry loading your profile</a></p>
      <p><Link href="/login" className="text-link">Log in / account recovery</Link></p>
    </div>
  </LearnerShell>;
  const displayName = profile?.display_name ?? user.user_metadata.display_name ?? "Learner";
  const ageRange = profile.age_range ?? "";
  const learningLevel = profile.learning_level ?? "";
  const preferredSubjects = profile?.preferred_subjects?.join(", ") ?? "";
  const learningGoals = profile?.learning_goals ?? "";
  const initials = displayName
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const notice = params.error
    ? { message: params.error, isError: true }
    : params.success
      ? { message: params.success, isError: false }
      : null;

  return (
    <LearnerShell active="/profile" name={displayName} avatar={profile?.avatar_url ?? null} admin={isAdmin(user)} instructor={isInstructor(user)}>
      <RememberAvatar avatar={profile?.avatar_url ?? null} />
      <div className="portal-page profile-page">
        <header className="portal-heading">
          <div>
            <h1>Profile & settings</h1>
            <p>Your picture, name, and email.</p>
          </div>
        </header>
        <div className="profile-stack">
          <section className="privacy-panel">
            <h2>Appearance</h2>
            <ThemeSwitch />
          </section>
          <ProfileForm initial={{ displayName, email: user.email ?? "", age: profile?.age ?? null, ageRange, level: learningLevel, subjects: preferredSubjects, goals: learningGoals, avatar: profile?.avatar_url ?? null, initials, setupRevision: profile.learning_setup_revision }} notice={notice} emailChange={<EmailChangeForm />} />
        </div>
      </div>
    </LearnerShell>
  );
}
