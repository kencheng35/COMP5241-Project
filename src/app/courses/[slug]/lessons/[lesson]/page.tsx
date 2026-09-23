import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { LessonPlayer } from "@/components/learning-controls";
import { LessonCoach } from "@/components/lesson-coach";
import { accessibleLesson, database, displayName, isAdmin, requireUser } from "@/lib/learning-server";

export default async function Lesson({ params }: { params: Promise<{ slug: string; lesson: string }> }) {
  const user = await requireUser();
  const route = await params;
  if (route.lesson !== "1") notFound();
  const lesson = await accessibleLesson(route.slug, user);
  if (!lesson) notFound();
  const { data, error } = await database().from("forge_enrollments").select("lesson_id").eq("user_id", user.id).eq("lesson_id", lesson.id).maybeSingle();
  if (error) throw new Error("Could not verify enrollment.");
  if (!data) redirect(`/courses/${lesson.id}`);
  const content = { ...lesson.content, questions: lesson.content.questions.map(question => ({ prompt: question.prompt, options: question.options })) };
  return <LearnerShell active="/dashboard" name={await displayName(user)} admin={isAdmin(user)}><div className="portal-page"><Link className="back-link" href={`/courses/${lesson.id}`}>Lesson overview</Link><h1>{lesson.title}</h1><LessonPlayer id={lesson.id} version={lesson.version} content={content} /><LessonCoach id={lesson.id} /></div></LearnerShell>;
}