import Link from "next/link";
import { LearnerShell } from "@/components/learner-shell";
import { DiagnosticForm } from "@/components/diagnostic-form";
import { loadSetup } from "@/lib/onboarding-server";
import { isAdmin, isInstructor } from "@/lib/permissions";

export default async function DiagnosticPage() {
  const loaded = await loadSetup();
  return <LearnerShell active="/profile" admin={loaded.code === "ok" && isAdmin(loaded.user)} instructor={loaded.code === "ok" && isInstructor(loaded.user)}>
    <div className="portal-page">
      <header className="portal-heading"><div><span className="eyebrow">OPTIONAL LOCAL DIAGNOSTIC</span><h1>Explore your starting point.</h1><p>An explained suggestion, not an automatic placement.</p></div></header>
      {loaded.code === "ok" ? <DiagnosticForm initial={loaded.profile} role={loaded.role} /> :
        <section><p role="alert" className="form-notice notice-error">{loaded.message}</p>
          <p><a className="text-link" href="/diagnostic">Try loading again</a></p>
          <p><Link className="text-link" href="/profile">Profile, export & deletion</Link></p>
          <p><Link className="text-link" href="/login">Log in / account recovery</Link></p></section>}
    </div>
  </LearnerShell>;
}
