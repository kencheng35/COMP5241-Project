import { LearnerShell } from "@/components/learner-shell";
import { database, displayName, isAdmin, requireUser, type AttemptRow } from "@/lib/learning-server";
import { collectRows } from "@/lib/learning";

export default async function Reports() {
  const user = await requireUser();
  const client = database();
  const permissions = await collectRows((start, end) => client.from("forge_reviewers").select("lesson_id").eq("user_id", user.id).order("lesson_id").range(start, end));
  let lessonsQuery = client.from("forge_lessons").select("id,title").eq("visibility", "public");
  if (!isAdmin(user)) lessonsQuery = lessonsQuery.in("id", permissions?.map(permission => permission.lesson_id) ?? []);
  const lessons = await collectRows((start, end) => lessonsQuery.order("id").range(start, end));
  const ids = lessons?.map(lesson => lesson.id) ?? [];
  const [attempts, enrollments] = ids.length ? await Promise.all([
    collectRows((start, end) => client.from("forge_attempts").select("*").in("lesson_id", ids).eq("certificate_kind", "public").order("completed_at", { ascending: false }).order("id").range(start, end)),
    collectRows((start, end) => client.from("forge_enrollments").select("lesson_id,attended_at").in("lesson_id", ids).eq("enrollment_kind", "public").order("lesson_id").order("user_id").range(start, end)),
  ]) : [[], []];
  return <LearnerShell active="/reports" name={await displayName(user)} admin={isAdmin(user)}><div className="portal-page"><span className="eyebrow">INSTRUCTOR REPORTS</span><h1>Participation & results.</h1>{!ids.length && <p>No published lessons have been granted to your account for review.</p>}{lessons.map(lesson => <section className="learning-section" key={lesson.id}><h2>{lesson.title}</h2><p>{enrollments.filter(record => record.lesson_id === lesson.id).length} enrolled · {enrollments.filter(record => record.lesson_id === lesson.id && record.attended_at).length} reached final quiz</p>{(attempts as AttemptRow[]).filter(attempt => attempt.lesson_id === lesson.id).map(attempt => <details key={attempt.id}><summary>{attempt.user_id} · {attempt.score}/10 · {new Date(attempt.completed_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}</summary><ol>{attempt.questions.map((question, index) => <li key={index}><strong>{question.prompt}</strong><p>Selected: {question.options[attempt.answers[index]]}</p><p>Correct: {question.options[question.correct]}</p></li>)}</ol></details>)}</section>)}</div></LearnerShell>;
}