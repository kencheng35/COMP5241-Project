import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Trash2 } from "lucide-react";
import { LearnerShell } from "@/components/learner-shell";
import { createClient } from "@/lib/supabase/server";
import { EmailChangeForm } from "@/components/email-change-form";
import { ProfileForm } from "@/components/profile-form";
import { ExportButton } from "@/components/export-button";
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
      <section className="privacy-panel"><h2>Privacy controls remain available</h2><ExportButton />
        <Link href="/profile/delete" className="data-action danger">Delete my account</Link>
      </section>
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
    <LearnerShell active="/profile" name={displayName} admin={isAdmin(user)} instructor={isInstructor(user)}>
      <div className="portal-page profile-page">
        <header className="portal-heading">
          <div>
            <span className="eyebrow">ACCOUNT</span>
            <h1>Profile & settings.</h1>
            <p>Keep your learning personal and your data under your control.</p>
          </div>
        </header>
        <section className="learning-section" aria-label="Background and diagnostic">
          <h2>Your starting point</h2>
          <p>Background and goals are separate from your optional local diagnostic. A diagnostic never changes your chosen learning level automatically.</p>
          <p><Link className="text-link" href="/onboarding">Edit background & goals</Link> · <Link className="text-link" href="/diagnostic">View or retake diagnostic</Link></p>
        </section>
        <section className="settings-layout">
          <ProfileForm initial={{ displayName, email: user.email ?? "", age: profile?.age ?? null, ageRange, level: learningLevel, subjects: preferredSubjects, goals: learningGoals, avatar: profile?.avatar_url ?? null, initials, setupRevision: profile.learning_setup_revision }} notice={notice} />
          <aside className="privacy-panel">
            <ShieldCheck size={24} />
            <h2>Privacy controls</h2>
            <p>Your profile and private lessons stay private. Authorized instructors can review your participation and quiz answers for published lessons, but never your coach conversations.</p>
            <p>Interview transcripts are saved privately until you delete the interview or your account, and included in your export. They are not automatically shared with instructors, administrators, reviewers or peers. Relevant text is sent to the external AI service; avoid personal or confidential information. Generic coach chat remains unsaved.</p>
            <EmailChangeForm />
            <ExportButton />
            <Link href="/profile/delete" className="data-action danger"><Trash2 size={17} /><span><strong>Delete my account</strong><small>Permanently remove your data</small></span></Link>
            <small className="privacy-fineprint">Forge never asks for your address, phone number, exact birth date, government ID, or financial details.</small>
          </aside>
        </section>
      </div>
    </LearnerShell>
  );
}
