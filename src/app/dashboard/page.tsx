import Link from "next/link";
import { redirect } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { isInstructor, displayName, hongKongTime, isAdmin, lessonSeenTimes, userRecords, visibleLessons } from "@/lib/learning-server";
import { loadSetup } from "@/lib/onboarding-server";
import { lessonProgress } from "@/lib/learning";
import { DIFFICULTIES, readMetadata } from "@/lib/curriculum";

function lessonDifficulty(subject: string, metadata: unknown) {
  const value = readMetadata(subject, metadata);
  return value ? DIFFICULTIES[value.difficulty] : "Not specified";
}

export default async function Dashboard() {
  const setup = await loadSetup();
  if (setup.code !== "ok") return <LearnerShell active="/dashboard"><div className="portal-page">
    <h1>Learning setup unavailable.</h1><p role="alert" className="form-notice notice-error">{setup.message}</p>
    <p><a className="text-link" href="/dashboard">Try loading again</a></p>
    <p><Link className="text-link" href="/profile">Profile, export & deletion</Link></p>
    <p><Link className="text-link" href="/login">Log in / account recovery</Link></p>
  </div></LearnerShell>;
  if (!setup.profile.onboarding_completed_at) redirect("/onboarding");
  const user = setup.user;
  const [name, lessons, records, seen] = await Promise.all([displayName(user), visibleLessons(user), userRecords(user), lessonSeenTimes(user.id)]);
  const enrolled = lessons.filter(lesson => records.enrollments.some(record => record.lesson_id === lesson.id));
  const owned = lessons.filter(lesson => lesson.owner_id === user.id);
  return <LearnerShell active="/dashboard" name={name} admin={isAdmin(user)} instructor={isInstructor(user)}>
    <div className="portal-page">
      <header className="portal-heading"><div><span className="eyebrow">MY LEARNING</span><h1>Welcome, {name}.</h1></div></header>
      <section className="learning-section quick-start">
        <h2>Quick Start</h2>
        <div className="quick-start-actions">
          <Link className="secondary-button" href="/catalog">Find a lesson</Link>
          <Link className="auth-submit" href="/studio">Create a lesson</Link>
        </div>
      </section>
      <details className="lesson-fold">
        <summary>Private lesson <small>{owned.length}</small></summary>
        {!owned.length && <p>No private lessons created yet.</p>}
        {owned.length > 0 && <div className="lesson-table" role="table" aria-label="Private lessons">
          <div className="lesson-table-head" role="row"><span>Subject</span><span>Title</span><span>Difficulty</span><span>Progress</span><span>Last seen</span></div>
          {owned.map(lesson => {
            return <div className="lesson-table-row" role="row" key={lesson.id}>
              <span data-label="Subject">{lesson.subject}</span>
              <span data-label="Title"><Link className="text-link" href={`/courses/${lesson.id}`}>{lesson.title}</Link></span>
              <span data-label="Difficulty">{lessonDifficulty(lesson.subject, lesson.metadata)}</span>
              <span data-label="Progress">{lesson.visibility === "public" ? <Link className="visibility-public visibility-label" href={`/courses/${lesson.id}`}>Published</Link> : <Link className="text-link" href={`/studio?edit=${lesson.id}`}>Edit lesson</Link>}</span>
              <span data-label="Last seen">{hongKongTime(seen.get(lesson.id))}</span>
            </div>;
          })}
        </div>}
      </details>
      <details className="lesson-fold">
        <summary>Enrolled lesson <small>{enrolled.length}</small></summary>
        {!enrolled.length && <p>No enrolled lessons yet.</p>}
        {enrolled.length > 0 && <div className="lesson-table" role="table" aria-label="Enrolled lessons">
          <div className="lesson-table-head" role="row"><span>Subject</span><span>Title</span><span>Difficulty</span><span>Progress</span><span>Last seen</span></div>
          {enrolled.map(lesson => {
            const progress = lessonProgress(records.enrollments.find(record => record.lesson_id === lesson.id), records.attempts, lesson.id, lesson.version);
            return <div className="lesson-table-row" role="row" key={lesson.id}>
              <span data-label="Subject">{lesson.subject}</span>
              <span data-label="Title"><Link className="text-link" href={`/courses/${lesson.id}/lessons/1`}>{lesson.title}</Link></span>
              <span data-label="Difficulty">{lessonDifficulty(lesson.subject, lesson.metadata)}</span>
              <span data-label="Progress"><Link className="text-link" href={`/courses/${lesson.id}/lessons/1`}>{progress.passed ? "Completed" : "In-progress"}</Link></span>
              <span data-label="Last seen">{hongKongTime(seen.get(lesson.id))}</span>
            </div>;
          })}
        </div>}
      </details>
    </div>
  </LearnerShell>;
}
