import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Trash2 } from "lucide-react";
import { LearnerShell } from "@/components/learner-shell";
import { createClient } from "@/lib/supabase/server";
import { changeEmail } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ProfileForm } from "@/components/profile-form";
import { ExportButton } from "@/components/export-button";
import { isAdmin } from "@/lib/learning-server";

type ProfileRow = {
  avatar_url: string | null;
  display_name: string;
  age_range: string;
  learning_level: string | null;
  preferred_subjects: string[] | null;
  learning_goals: string | null;
};

export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, age_range, learning_level, preferred_subjects, learning_goals, avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as ProfileRow | null;
  const displayName = profile?.display_name ?? user.user_metadata.display_name ?? "Learner";
  const ageRange = profile?.age_range ?? user.user_metadata.age_range ?? "18-24";
  const learningLevel = profile?.learning_level ?? "foundation";
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
      : profileError
        ? { message: `Could not load your saved profile: ${profileError.message}`, isError: true }
        : null;

  return (
    <LearnerShell active="/profile" name={displayName} admin={isAdmin(user)}>
      <div className="portal-page profile-page">
        <header className="portal-heading">
          <div>
            <span className="eyebrow">ACCOUNT</span>
            <h1>Profile & settings.</h1>
            <p>Keep your learning personal and your data under your control.</p>
          </div>
        </header>
        <section className="settings-layout">
          <ProfileForm initial={{ displayName, email: user.email ?? "", ageRange, level: learningLevel, subjects: preferredSubjects, goals: learningGoals, avatar: profile?.avatar_url ?? null, initials }} notice={notice} />
          <aside className="privacy-panel">
            <ShieldCheck size={24} />
            <h2>Privacy controls</h2>
            <p>Your profile and private lessons stay private. Authorized instructors can review your participation and quiz answers for published lessons, but never your coach conversations.</p>
            <form action={changeEmail} className="learning-form"><label>New email address<input name="email" type="email" required /></label><SubmitButton>Request email change</SubmitButton></form>
            <ExportButton />
            <Link href="/profile/delete" className="data-action danger"><Trash2 size={17} /><span><strong>Delete my account</strong><small>Permanently remove your data</small></span></Link>
            <small className="privacy-fineprint">Forge never asks for your address, phone number, exact birth date, government ID, or financial details.</small>
          </aside>
        </section>
      </div>
    </LearnerShell>
  );
}
