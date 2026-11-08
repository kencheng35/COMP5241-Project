import { notFound } from "next/navigation";
import { PenLine, Upload } from "lucide-react";
import { LearnerShell } from "@/components/learner-shell";
import { ActionForm, LessonEditor } from "@/components/learning-controls";
import { UploadLessonPage } from "@/components/create-lesson";
import { PresentationLessonEditor } from "@/components/presentation-editor";
import { fromPresentationLesson, fromStoredLesson } from "@/lib/slide-lesson";
import { approveSlideLesson, requestReview, updateLesson } from "@/app/learning/actions";
import { isPresentation, collectRows } from "@/lib/learning";
import { isInstructor, accessibleLesson, database, displayName, hongKongDate, isAdmin, requireUser, canEditLesson, canPublishLessons } from "@/lib/learning-server";

export const runtime = "nodejs";
export const maxDuration = 90;

export default async function Studio({ searchParams }: { searchParams: Promise<{ edit?: string; manual?: string; upload?: string }> }) {
  const user = await requireUser();
  const { edit, manual, upload } = await searchParams;
  const lesson = edit ? await accessibleLesson(edit, user, true) : null;
  if (edit && (!lesson || !canEditLesson(user, lesson))) notFound();
  const owned = lesson || manual === "1" || upload === "1" ? [] : (await collectRows((start, end) => database().from("forge_lessons")
    .select("id,title,subject,visibility,created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, end))).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const presentationWorkspace = lesson ? lesson.content.template === "slides" : manual === "1" || upload === "1";
  return <LearnerShell active="/studio" name={await displayName(user)} admin={isAdmin(user)} instructor={isInstructor(user)}>
    <div className={`portal-page studio-editor${presentationWorkspace ? " presentation-studio" : ""}${!lesson && manual !== "1" && upload !== "1" ? " studio-home" : ""}`}>
      <header className="portal-heading"><div><span className="eyebrow">LESSON STUDIO</span><h1>{lesson ? "Edit lesson." : upload === "1" ? "Upload a file." : manual === "1" ? "Write a lesson." : "Create a lesson."}</h1></div></header>
      {!lesson && manual !== "1" && upload !== "1" && <section className="create-choices" aria-label="How to create a lesson">
        <a className="create-choice" href="/studio?manual=1"><span className="create-choice-icon"><PenLine size={26} /></span><h2>Write a lesson</h2><p>Start with blank slides.</p></a>
        <a className="create-choice" href="/studio?upload=1"><span className="create-choice-icon"><Upload size={26} /></span><h2>Upload a file</h2><p>Use a PowerPoint or document.</p></a>
      </section>}
      {!lesson && manual !== "1" && upload !== "1" && <details className="lesson-fold">
        <summary>Your created lessons <small>{owned.length}</small></summary>
        {!owned.length && <p>You have not created a lesson yet.</p>}
        {owned.length > 0 && <div className="lesson-table lesson-table-owned" role="table" aria-label="Your created lessons">
          <div className="lesson-table-head" role="row"><span>Subject</span><span>Title</span><span>Edit lesson</span><span>Status</span><span>Edit date</span></div>
          {owned.map(item => {
            return <div className="lesson-table-row" role="row" key={item.id}>
              <span data-label="Subject">{item.subject}</span>
              <span data-label="Title"><a className="text-link" href={`/studio?edit=${item.id}`}>{item.title}</a></span>
              <span data-label="Edit lesson"><a className="text-link" href={`/studio?edit=${item.id}`}>Edit lesson</a></span>
              <span data-label="Status" className={`visibility-label ${item.visibility === "public" ? "visibility-public" : "visibility-private"}`}>{item.visibility === "public" ? "Published" : "Private"}</span>
              <span data-label="Edit date">{hongKongDate(item.created_at)}</span>
            </div>;
          })}
        </div>}
      </details>}
      {!lesson && upload === "1" && <UploadLessonPage key={`${user.id}-upload`} />}
      {lesson ? <>
        {lesson.content.template === "slides"
          ? <PresentationLessonEditor key={`${user.id}-${lesson.id}`} lessonId={lesson.id} version={lesson.version}
            {...(isPresentation(lesson.content)?{initial:fromPresentationLesson(lesson.content)}:{initialLegacy:fromStoredLesson(lesson.content)})} />
          : <LessonEditor key={`${lesson.id}-${lesson.version}`} id={lesson.id} version={lesson.version} initial={lesson.content} action={updateLesson} admin={canPublishLessons(user)} />}
        {lesson.content.template === "slides" && isAdmin(user) && lesson.review_requested && <section className="learning-section"><h2>Administrator approval</h2><p>Review the saved slides and answer key above. Save changes and request review again before approving the new version.</p><ActionForm action={approveSlideLesson} label="Approve saved version for publication"><input type="hidden" name="lessonId" value={lesson.id} /><input type="hidden" name="version" value={lesson.version} /></ActionForm></section>}
        {lesson.content.template !== "slides" && lesson.owner_id === user.id && lesson.visibility === "private" && !canPublishLessons(user) && <section className="learning-section"><h2>Publication review</h2><p>Submitting grants administrators access to this draft and permission to publish it for all learners.</p><ActionForm action={requestReview} label="Submit for publication review"><input type="hidden" name="lessonId" value={lesson.id} /></ActionForm></section>}
      </> : manual === "1" ? <PresentationLessonEditor key={`${user.id}-blank`} /> : null}
    </div>
  </LearnerShell>;
}