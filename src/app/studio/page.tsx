import { notFound } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { ActionForm, LessonEditor } from "@/components/learning-controls";
import { LessonGeneration } from "@/components/lesson-generation";
import { createManualLesson, requestReview, updateLesson } from "@/app/learning/actions";
import { isInstructor, accessibleLesson, displayName, isAdmin, requireUser, canEditLesson, canPublishLessons } from "@/lib/learning-server";

export const runtime = "nodejs";
export const maxDuration = 90;

export default async function Studio({ searchParams }: { searchParams: Promise<{ edit?: string; manual?: string }> }) {
  const user = await requireUser();
  const { edit, manual } = await searchParams;
  const lesson = edit ? await accessibleLesson(edit, user, true) : null;
  if (edit && (!lesson || !canEditLesson(user, lesson))) notFound();
  const blank = { title: "", subject: "", summary: "", slides: Array.from({ length: 4 }, () => ({ title: "", body: "", example: "" })), activity: { prompt: "", steps: ["", "", ""] }, questions: Array.from({ length: 10 }, () => ({ prompt: "", options: ["", "", "", ""], correct: 0, explanation: "" })) };
  return <LearnerShell active="/studio" name={await displayName(user)} admin={isAdmin(user)} instructor={isInstructor(user)}>
    <div className="portal-page studio-editor">
      <header className="portal-heading"><div><span className="eyebrow">LESSON STUDIO</span><h1>{lesson ? "Edit lesson." : manual === "1" ? "Write a lesson." : "Explore a new topic."}</h1></div></header>
      {lesson ? <>
        <LessonEditor key={`${lesson.id}-${lesson.version}`} id={lesson.id} version={lesson.version} initial={lesson.content} action={updateLesson} admin={canPublishLessons(user)} />
        {lesson.owner_id === user.id && lesson.visibility === "private" && !canPublishLessons(user) && <section className="learning-section"><h2>Publication review</h2><p>Submitting grants administrators access to this draft and permission to publish it for all learners.</p><ActionForm action={requestReview} label="Submit for publication review"><input type="hidden" name="lessonId" value={lesson.id} /></ActionForm></section>}
      </> : manual === "1" ? <LessonEditor id="" version={1} initial={blank} action={createManualLesson} admin={canPublishLessons(user)} /> : <>
        <LessonGeneration />
        <p className="learning-section"><a className="text-link" href="/studio?manual=1">Write a lesson manually</a></p>
      </>}
    </div>
  </LearnerShell>;
}