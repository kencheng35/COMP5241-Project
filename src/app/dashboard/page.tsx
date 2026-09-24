import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { LearnerShell } from "@/components/learner-shell";
import { displayName, isAdmin, requireUser, userRecords, visibleLessons } from "@/lib/learning-server";

export default async function Dashboard() {
  const user = await requireUser();
  const [name, lessons, records] = await Promise.all([displayName(user), visibleLessons(user), userRecords(user)]);
  const enrolled = lessons.filter(lesson => records.enrollments.some(record => record.lesson_id === lesson.id));
  const passedCount = new Set(records.attempts.filter(attempt => attempt.score >= 6).map(attempt => attempt.original_lesson_id)).size;
  return <LearnerShell active="/dashboard" name={name} admin={isAdmin(user)}><div className="portal-page"><header className="portal-heading"><div><span className="eyebrow">MY LEARNING</span><h1>Welcome, {name}.</h1><p>{enrolled.length} enrolled lessons · {passedCount} passed</p></div><Link className="secondary-button" href="/studio"><Plus size={17} />Create a lesson</Link></header>{enrolled.length === 0 ? <section className="empty-state"><BookOpen size={32} /><h2>No lessons yet.</h2><Link className="text-link" href="/catalog">Find a lesson to enroll in</Link></section> : <div className="learning-list">{enrolled.map(lesson => { const passed = records.attempts.some(attempt => attempt.lesson_id === lesson.id && attempt.score >= 6); return <Link key={lesson.id} href={`/courses/${lesson.id}/lessons/1`}><div><span className="eyebrow">{lesson.visibility} · {lesson.subject}</span><h2>{lesson.title}</h2><p>{lesson.summary}</p></div><strong>{passed ? "Passed" : "Continue"}</strong></Link>; })}</div>}<section className="learning-section"><h2>Your private creations</h2>{lessons.filter(lesson => lesson.owner_id === user.id && lesson.visibility === "private").map(lesson => <p key={lesson.id}><Link className="text-link" href={`/courses/${lesson.id}`}>{lesson.title}</Link></p>)}{!lessons.some(lesson => lesson.owner_id === user.id && lesson.visibility === "private") && <p>No private lessons created yet.</p>}</section></div></LearnerShell>;
}