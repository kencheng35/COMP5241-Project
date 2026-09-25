import Link from "next/link";
import { notFound } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { ActionForm, BookmarkButton } from "@/components/learning-controls";
import { enroll } from "@/app/learning/actions";
import { isInstructor, accessibleLesson, canEditLesson, displayName, isAdmin, requireUser, userRecords } from "@/lib/learning-server";

export default async function Course({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const lesson = await accessibleLesson(slug, user);
  if (!lesson) notFound();
  const [name, records] = await Promise.all([displayName(user), userRecords(user)]);
  const enrolled = records.enrollments.some(record => record.lesson_id === lesson.id);
  return <LearnerShell active="/catalog" name={name} admin={isAdmin(user)} instructor={isInstructor(user)}><div className="portal-page"><Link href="/catalog" className="back-link">Back to catalog</Link><section className="course-banner"><div><span className="eyebrow">{lesson.visibility === "private" ? "PRIVATE SELF-LEARNING" : "PUBLIC PUBLISHED LESSON"} · {lesson.subject}</span><h1>{lesson.title}</h1><p>{lesson.summary}</p><p>Version {lesson.version} · 10 quiz questions · 60% to pass</p></div></section><div className="lesson-detail-actions">{enrolled ? <Link className="auth-submit" href={`/courses/${lesson.id}/lessons/1`}>Open lesson</Link> : <ActionForm action={enroll} label="Enroll in lesson"><input type="hidden" name="lessonId" value={lesson.id} /></ActionForm>}<BookmarkButton id={lesson.id} initial={records.bookmarks.some(record => record.lesson_id === lesson.id)} />{canEditLesson(user, lesson) && <a className="secondary-button" href={`/studio?edit=${lesson.id}`}>Edit lesson</a>}</div><section className="learning-section"><h2>Lesson path</h2><ol><li>Visual slides and practical examples</li><li>Ordering mini-game</li><li>Ten-question quiz with unlimited retries</li><li>{lesson.visibility === "private" ? "Private Self-Learning" : "Public Published Lesson"} certificate after passing</li></ol></section></div></LearnerShell>;
}