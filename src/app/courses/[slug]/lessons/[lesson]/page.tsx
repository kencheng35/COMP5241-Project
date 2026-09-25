import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { LessonPlayer } from "@/components/learning-controls";
import { LessonCoach } from "@/components/lesson-coach";
import { isInstructor, accessibleLesson, database, displayName, isAdmin, requireUser } from "@/lib/learning-server";
import { resumeSchema } from "@/lib/resume";

export default async function Lesson({ params }: { params: Promise<{ slug: string; lesson: string }> }) {
  const user = await requireUser();
  const route = await params;
  if (route.lesson !== "1") notFound();
  const lesson = await accessibleLesson(route.slug, user);
  if (!lesson) notFound();
  const { data, error } = await database().from("forge_enrollments").select("lesson_id").eq("user_id", user.id).eq("lesson_id", lesson.id).maybeSingle();
  if (error) throw new Error("Could not verify enrollment.");
  if (!data) redirect(`/courses/${lesson.id}`);
  const { data: saved, error: resumeError } = await database().from("forge_resume").select("lesson_version,revision,stage,slide,ordering,answers").eq("user_id", user.id).eq("lesson_id", lesson.id).maybeSingle();
  const restored = !resumeError && saved?.lesson_version === lesson.version ? resumeSchema.safeParse(saved) : null;
  const content = { ...lesson.content, questions: lesson.content.questions.map(question => ({ prompt: question.prompt, options: question.options })) };
  return <LearnerShell active="/dashboard" name={await displayName(user)} admin={isAdmin(user)} instructor={isInstructor(user)}><div className="portal-page"><Link className="back-link" href={`/courses/${lesson.id}`}>Lesson overview</Link><h1>{lesson.title}</h1><LessonPlayer id={lesson.id} version={lesson.version} content={content} saved={restored?.success ? restored.data : null} revision={saved?.revision ?? 0} resumeAvailable={!resumeError} /><LessonCoach id={lesson.id} /></div></LearnerShell>;
}