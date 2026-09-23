import { notFound } from "next/navigation";
import Link from "next/link";
import { LearnerShell } from "@/components/learner-shell";
import { ActionForm, LessonEditor } from "@/components/learning-controls";
import { createLesson, createManualLesson, requestReview, updateLesson } from "@/app/learning/actions";
import { accessibleLesson, displayName, isAdmin, requireUser } from "@/lib/learning-server";

export default async function Studio({ searchParams }: { searchParams: Promise<{ edit?: string; manual?: string }> }) {
  const user = await requireUser();
  const { edit, manual } = await searchParams;
  const lesson = edit ? await accessibleLesson(edit, user, true) : null;
  if (edit && (!lesson || (!isAdmin(user) && (lesson.owner_id !== user.id || lesson.visibility === "public")))) notFound();
  const blank = { title: "", subject: "", summary: "", slides: Array.from({ length: 4 }, () => ({ title: "", body: "", example: "" })), activity: { prompt: "", steps: ["", "", ""] }, questions: Array.from({ length: 10 }, () => ({ prompt: "", options: ["", "", "", ""], correct: 0, explanation: "" })) };
  return <LearnerShell active="/studio" name={await displayName(user)} admin={isAdmin(user)}><div className="portal-page studio-editor"><header className="portal-heading"><div><span className="eyebrow">LESSON STUDIO</span><h1>{lesson ? "Edit lesson." : manual === "1" ? "Write a lesson." : "Explore a new topic."}</h1></div></header>{lesson ? <><LessonEditor key={`${lesson.id}-${lesson.version}`} id={lesson.id} version={lesson.version} initial={lesson.content} action={updateLesson} admin={isAdmin(user)} />{lesson.owner_id === user.id && lesson.visibility === "private" && <section className="learning-section"><h2>Publication review</h2><p>Submitting grants administrators access to this draft and permission to publish it for all learners.</p><ActionForm action={requestReview} label="Submit for publication review"><input type="hidden" name="lessonId" value={lesson.id} /></ActionForm></section>}</> : manual === "1" ? <LessonEditor id="" version={1} initial={blank} action={createManualLesson} admin={isAdmin(user)} /> : <><ActionForm action={createLesson} label="Generate private lesson"><label>Topic and learning objective<textarea name="topic" required minLength={5} maxLength={500} rows={5} placeholder="Understand how software testing catches mistakes" /></label><p className="privacy-note">Do not include personal information. Generated content may be inaccurate. Your lesson stays private unless you submit it for administrator review.</p></ActionForm><p className="learning-section"><Link className="text-link" href="/studio?manual=1">Write a lesson manually</Link></p></>}</div></LearnerShell>;
}