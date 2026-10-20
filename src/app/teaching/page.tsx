import Link from "next/link";
import { notFound } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { LearnerImport } from "@/components/learner-import";
import { LessonGeneration } from "@/components/lesson-generation";
import { isInstructor, accessibleLesson, canManageEnrollment, canPublishLessons, database, displayName, isAdmin, requireUser } from "@/lib/learning-server";
import { collectRows } from "@/lib/learning";

export const runtime = "nodejs";
export const maxDuration = 90;

export default async function Teaching({ searchParams }: { searchParams: Promise<{ lesson?: string }> }) {
  const user = await requireUser();
  if (!canPublishLessons(user)) notFound();
  const { lesson: id } = await searchParams;
  const selected = id ? await accessibleLesson(id, user) : null;
  if (id && (!selected || !canManageEnrollment(user, selected))) notFound();
  const lessons = await collectRows((start, end) => {
    let query = database().from("forge_lessons").select("id,title,visibility,version");
    query = isAdmin(user) ? query.or(`visibility.eq.public,owner_id.eq.${user.id}`) : query.eq("owner_id", user.id);
    return query.order("created_at", { ascending: false }).order("id").range(start, end);
  });
  return <LearnerShell active="/teaching" name={await displayName(user)} admin={isAdmin(user)} instructor={isInstructor(user)}>
    <div className="portal-page"><span className="eyebrow">TEACHING</span><h1>Your lessons.</h1>
      <p><a href="/studio?manual=1" className="secondary-button">Create lesson</a></p>
      {selected && <><h2>{selected.title}</h2><LearnerImport key={selected.id} lessonId={selected.id} /></>}
      <section className="learning-section"><h2>Teaching materials</h2>
        <LessonGeneration importing />
      </section>
      <section className="learning-section"><h2>Lesson library</h2>
        {!lessons.length && <p>No lessons yet.</p>}
        <div className="learning-list">{lessons.map(lesson => <div key={lesson.id}>
          <h3>{lesson.title}</h3><p>{lesson.visibility} - Version {lesson.version}</p>
          <a className="text-link" href={`/studio?edit=${lesson.id}`}>Edit slides and quiz</a>
          {lesson.visibility === "public" && <p><Link className="text-link" href={`/teaching?lesson=${lesson.id}`}>Manage learners</Link></p>}
        </div>)}</div>
      </section>
    </div>
  </LearnerShell>;
}