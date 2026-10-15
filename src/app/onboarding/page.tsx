import Link from "next/link";
import { LearnerShell } from "@/components/learner-shell";
import { OnboardingForm } from "@/components/onboarding-form";
import { loadSetup } from "@/lib/onboarding-server";
import { isAdmin, isInstructor } from "@/lib/permissions";

export default async function OnboardingPage() {
  const loaded = await loadSetup();
  return <LearnerShell active="/profile" admin={loaded.code === "ok" && isAdmin(loaded.user)} instructor={loaded.code === "ok" && isInstructor(loaded.user)}>
    <div className="portal-page">
      <header className="portal-heading"><div><span className="eyebrow">GETTING STARTED</span>
        <h1>{loaded.code === "ok" && loaded.profile.onboarding_completed_at ? "Edit background & goals." : "Your learning starts here."}</h1>
        <p>Choose a useful starting point. You can change it later from your profile.</p>
      </div></header>
      {loaded.code === "ok" ? <OnboardingForm initial={loaded.profile} role={loaded.role} /> :
        <section><p role="alert" className="form-notice notice-error">{loaded.message}</p>
          <p><a className="text-link" href="/onboarding">Try loading again</a></p>
          <p><Link className="text-link" href="/profile">Profile, export & deletion</Link></p>
          <p><Link className="text-link" href="/login">Log in / account recovery</Link></p></section>}
    </div>
  </LearnerShell>;
}
