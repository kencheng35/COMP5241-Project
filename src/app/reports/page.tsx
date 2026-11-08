import { LearnerShell } from "@/components/learner-shell";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { database, displayName, isAdmin, isInstructor } from "@/lib/learning-server";
import { attemptOutcome, collectRows } from "@/lib/learning";
import { buildLessonReport, reportRows } from "@/lib/reporting";

function quizDate(value: string) {
  return new Intl.DateTimeFormat("en-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "short", day: "2-digit" }).format(new Date(value));
}

export default async function Reports() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) redirect("/login");
  const client = database();
  const reports = await (async () => {
    try {
      const permissions = reportRows.grants.parse(await collectRows((start, end) => client.from("forge_reviewers").select("lesson_id").eq("user_id", user.id).order("lesson_id").range(start, end)));
      let lessonsQuery = client.from("forge_lessons").select("id,title,version").eq("visibility", "public").order("id");
      if (isInstructor(user)) lessonsQuery = lessonsQuery.eq("owner_id", user.id);
      else if (!isAdmin(user)) lessonsQuery = lessonsQuery.in("id", permissions.map(permission => permission.lesson_id));
      const lessons = reportRows.lessons.parse(await collectRows((start, end) => lessonsQuery.range(start, end)));
      const ids = lessons.map(lesson => lesson.id);
      const [attemptData, enrollmentData] = ids.length ? await Promise.all([
        collectRows((start, end) => client.from("forge_attempts").select("id,user_id,lesson_id,original_lesson_id,lesson_title,lesson_version,certificate_kind,score,answers,questions,completed_at").in("lesson_id", ids).eq("certificate_kind", "public").order("completed_at", { ascending: false }).order("id").range(start, end)),
        collectRows((start, end) => client.from("forge_enrollments").select("user_id,lesson_id,enrollment_kind,attended_at,progress_evidence").in("lesson_id", ids).eq("enrollment_kind", "public").order("lesson_id").order("user_id").range(start, end)),
      ]) : [[], []];
      const attempts = reportRows.attempts.parse(attemptData);
      const enrollments = reportRows.enrollments.parse(enrollmentData);
      return lessons.map(lesson => ({ lesson, ...buildLessonReport(lesson, enrollments, attempts) }));
    } catch {
      throw new Error("Reports are unavailable. Could not load complete, valid learning records. Check the database migrations and try again.");
    }
  })();
  return <LearnerShell active="/reports" name={await displayName(user)} admin={isAdmin(user)} instructor={isInstructor(user)}>
    <div className="portal-page">
      <h1>Student reports</h1>
      <p>One card for each published lesson you teach.</p>
      {!reports.length && <p>No published lessons have been granted to your account for review.</p>}
      {reports.map(({ lesson, roster, history }) => {
        const rows = roster.map(row => {
          const latest = history.filter(attempt => attempt.user_id === row.userId && attempt.lesson_version === lesson.version)
            .sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];
          const outcome = latest ? attemptOutcome(latest) : null;
          return { ...row, latest, outcome };
        });
        const failed = rows.filter(row => row.outcome && !row.outcome.passed).length;
        return <section className="learning-section report-section" key={lesson.id}>
          <h2>{lesson.title}</h2>
          <p>Version {lesson.version}</p>
          <div className="report-counts">
            <div><strong>{roster.length}</strong><span>Enrolled</span></div>
            <div><strong>{rows.filter(row => row.evidence.attendedAt).length}</strong><span>Attended</span></div>
            <div><strong>{failed}</strong><span>Failed</span></div>
            <div><strong>{rows.filter(row => row.evidence.passed).length}</strong><span>Passed</span></div>
          </div>
          <table className="report-table">
            <thead><tr><th>Learner</th><th>Attendance</th><th>Latest result</th><th>Quiz date</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.userId}>
              <td>{row.userId}</td>
              <td>{row.evidence.attendedAt ? "Attended" : "Not attended"}</td>
              <td className={row.outcome ? row.outcome.passed ? "report-pass" : "report-fail" : undefined}>{row.outcome ? `${row.outcome.passed ? "Passed" : "Failed"} ${row.latest!.score}/${row.outcome.total}` : "Enrolled, quiz not reached"}</td>
              <td>{row.latest ? quizDate(row.latest.completed_at) : "—"}</td>
            </tr>)}</tbody>
          </table>
          {!roster.length && <p>No current public enrollments.</p>}
        </section>;
      })}
    </div>
  </LearnerShell>;
}
