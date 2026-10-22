import { notFound } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { ActionForm, LessonEditor } from "@/components/learning-controls";
import { LessonGeneration } from "@/components/lesson-generation";
import { createManualLesson, requestReview, updateLesson } from "@/app/learning/actions";
import { isInstructor, accessibleLesson, displayName, isAdmin, requireUser, canEditLesson, canPublishLessons } from "@/lib/learning-server";
import { DEMO_LESSON_STARTERS, getDemoLessonStarter } from "@/lib/demo-lessons";

export const runtime = "nodejs";
export const maxDuration = 90;

export default async function Studio({ searchParams }: { searchParams: Promise<{ edit?: string; manual?: string; starter?: string | string[] }> }) {
  const user = await requireUser();
  const { edit, manual, starter: starterInput } = await searchParams;
  const lesson = edit ? await accessibleLesson(edit, user, true) : null;
  if (edit && (!lesson || !canEditLesson(user, lesson))) notFound();
  // A persisted edit always wins, including over invalid starter parameters.
  const starter = !lesson && manual === "1" ? getDemoLessonStarter(starterInput) : null;
  const starterError = !lesson && starterInput !== undefined && !starter
    ? manual === "1"
      ? "Starter not found. Choose one of the authored starters below, or continue with a blank lesson. Use exactly one starter ID."
      : "Starters open in manual authoring. Choose a starter link below to load an editable draft."
    : null;
  const blank = { title: "", subject: "", summary: "", slides: Array.from({ length: 4 }, () => ({ title: "", body: "", example: "" })), activity: { prompt: "", steps: ["", "", ""] }, questions: Array.from({ length: 10 }, () => ({ prompt: "", options: ["", "", "", ""], correct: 0, explanation: "" })) };
  return <LearnerShell active="/studio" name={await displayName(user)} admin={isAdmin(user)} instructor={isInstructor(user)}>
    <div className="portal-page studio-editor">
      <header className="portal-heading"><div><span className="eyebrow">LESSON STUDIO</span><h1>{lesson ? "Edit lesson." : manual === "1" ? "Write a lesson." : "Explore a new topic."}</h1></div></header>
      {!lesson && <section className="learning-section" aria-labelledby="starter-heading">
        <h2 id="starter-heading">Authored lesson starters</h2>
        <p>Original authored content, not generated AI. Owner content and pedagogical review pending. Opening or reloading a starter does not save, publish, enroll or run AI. Review and save privately first; publication is a separate instructor decision.</p>
        {starterError && <p role="alert" className="form-notice notice-error">{starterError}</p>}
        <ul>{DEMO_LESSON_STARTERS.map(item => <li key={item.id}>
          <a className="text-link" href={`/studio?manual=1&starter=${item.id}`} aria-current={starter?.id === item.id ? "page" : undefined}>{item.title}</a>
          <p>{item.subject} — {item.description}</p>
        </li>)}</ul>
        <a className="text-link" href="/studio?manual=1">Start a blank manual lesson</a>
      </section>}
      {starter && <section className="learning-section" aria-labelledby="starter-review-heading">
        <h2 id="starter-review-heading">Starter review: {starter.content.title}</h2>
        <p>Check accuracy, age suitability for the supervised 13+ demo, learning outcomes, activity order, every answer and explanation. References are public review suggestions, not remotely verified sources in this slice. Reference notes are also in the final slide so ordinary saves retain them; keep or update them during review.</p>
        <ul>{starter.references.map(reference => <li key={reference.url}>
          <a className="text-link" href={reference.url} target="_blank" rel="noreferrer">{reference.title}</a> — {reference.review}
        </li>)}</ul>
      </section>}
      {lesson ? <>
        <LessonEditor key={`${lesson.id}-${lesson.version}`} id={lesson.id} version={lesson.version} initial={lesson.content} action={updateLesson} admin={canPublishLessons(user)} />
        {lesson.owner_id === user.id && lesson.visibility === "private" && !canPublishLessons(user) && <section className="learning-section"><h2>Publication review</h2><p>Submitting grants administrators access to this draft and permission to publish it for all learners.</p><ActionForm action={requestReview} label="Submit for publication review"><input type="hidden" name="lessonId" value={lesson.id} /></ActionForm></section>}
      </> : manual === "1" ? <LessonEditor key={starter?.id ?? "blank"} id="" version={1} initial={starter?.content ?? blank} action={createManualLesson} admin={canPublishLessons(user)} /> : <>
        <LessonGeneration />
        <p className="learning-section"><a className="text-link" href="/studio?manual=1">Write a lesson manually</a></p>
      </>}
    </div>
  </LearnerShell>;
}