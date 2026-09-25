"use client";

import { useActionState } from "react";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { enrollSelected, searchLearners } from "@/app/teaching/actions";
import type { DirectoryState } from "@/lib/account-directory";
import type { ActionState } from "@/app/learning/actions";

export function LearnerImport({ lessonId }: { lessonId: string }) {
  const [directory, search, searching] = useActionState(searchLearners, {} as DirectoryState);
  const [result, enroll, pending] = useActionState(enrollSelected, {} as ActionState);
  return <section className="learning-section">
    <h2>Enroll learners</h2>
    <form action={search} className="learning-form">
      <input type="hidden" name="lessonId" value={lessonId} />
      <label>Learner email filter<input type="search" name="query" minLength={3} maxLength={254} required /></label>
      <button type="submit" name="page" value="1" disabled={searching || pending} className="secondary-button"><Search size={17} />{searching ? "Searching..." : "Find learners"}</button>
      {directory.nextPage && <button type="submit" name="page" value={directory.nextPage} disabled={searching || pending} className="secondary-button"><ChevronRight size={17} />Next learners</button>}
    </form>
    {directory.error && <p role="alert" className="form-notice notice-error">{directory.error}</p>}
    {directory.notice && <p role="status">{directory.notice}</p>}
    {directory.accounts?.length === 0 && <p role="status">No verified learners match this email filter.</p>}
    {Boolean(directory.accounts?.length) && <form action={enroll} className="learning-form" key={`${directory.query}-${directory.nextPage}`}>
      <input type="hidden" name="lessonId" value={lessonId} />
      <fieldset disabled={pending || searching}><legend>Select learners (up to 50)</legend>
        {directory.accounts?.map(account => <label key={account.id} className="learner-choice"><input type="checkbox" name="learnerId" value={account.id} /><span><strong>{account.name}</strong><span className="account-email">{account.email}</span></span></label>)}
        <button type="submit" className="auth-submit"><UserPlus size={17} />{pending ? "Enrolling..." : "Enroll selected learners"}</button>
      </fieldset>
    </form>}
    {result.error && <p role="alert" className="form-notice notice-error">{result.error}</p>}
    {result.success && <p role="status" className="form-notice">{result.success}</p>}
  </section>;
}