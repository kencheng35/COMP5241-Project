import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, ShieldCheck, Trash2, Upload } from "lucide-react";
import { LearnerShell } from "@/components/learner-shell";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

type ProfileRow = {
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
    .select("display_name, age_range, learning_level, preferred_subjects, learning_goals")
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
    <LearnerShell active="/profile" name={displayName}>
      <div className="portal-page profile-page">
        <header className="portal-heading">
          <div>
            <span className="eyebrow">ACCOUNT</span>
            <h1>Profile & settings.</h1>
            <p>Keep your learning personal and your data under your control.</p>
          </div>
        </header>
        {notice && (
          <div className={`form-notice ${notice.isError ? "notice-error" : "notice-success"}`} role="status">
            {notice.message}
          </div>
        )}
        <section className="settings-layout">
          <form action={updateProfile} className="settings-panel">
            <div className="profile-photo-row">
              <span className="large-avatar">{initials}</span>
              <div>
                <strong>Profile picture</strong>
                <p>Optional. JPG or PNG, up to 2 MB.</p>
                <button type="button" className="secondary-button"><Upload size={15} /> Choose image</button>
              </div>
            </div>
            <div className="settings-fields">
              <label>Display name<input name="displayName" defaultValue={displayName} required /></label>
              <label>Email address<input value={user.email ?? ""} readOnly aria-describedby="email-help" /><small id="email-help">Email changes require verification.</small></label>
              <label>Age range<select name="ageRange" defaultValue={ageRange}><option value="under-13">Under 13</option><option value="13-17">13–17</option><option value="18-24">18–24</option><option value="25-34">25–34</option><option value="35-plus">35 or above</option></select></label>
              <label>Learning level<select name="level" defaultValue={learningLevel}><option value="new">New to the subject</option><option value="foundation">Foundation</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
              <label className="full-field">Preferred subjects<input name="subjects" defaultValue={preferredSubjects} /><small>Separate subjects with commas.</small></label>
              <label className="full-field">Learning goals<textarea name="goals" defaultValue={learningGoals} /></label>
            </div>
            <button className="auth-submit save-profile" type="submit">Save profile</button>
          </form>
          <aside className="privacy-panel">
            <ShieldCheck size={24} />
            <h2>Privacy controls</h2>
            <p>Your profile, progress, quiz results, and saved lessons are private to your account.</p>
            <Link href="/api/account/export" className="data-action"><Download size={17} /><span><strong>Download my data</strong><small>Export a JSON copy</small></span></Link>
            <Link href="/profile/delete" className="data-action danger"><Trash2 size={17} /><span><strong>Delete my account</strong><small>Permanently remove your data</small></span></Link>
            <small className="privacy-fineprint">Forge never asks for your address, phone number, exact birth date, government ID, or financial details.</small>
          </aside>
        </section>
      </div>
    </LearnerShell>
  );
}
