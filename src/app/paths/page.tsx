import { LearnerShell } from "@/components/learner-shell";
import { LearningPath } from "@/components/learning-path";
import { isInstructor, database, isAdmin, requireUser, visibleLessons } from "@/lib/learning-server";
import { requireAiAccess } from "@/lib/ai-eligibility-server";
import { collectRows } from "@/lib/learning";
import { derivePreferences, lessonTopic } from "@/lib/recommendations";

export default async function Paths() {
  const user = await requireUser();
  const client = database();
  const [profileResult, catalog, passed, aiAvailable] = await Promise.all([
    client.from("profiles").select("display_name,learning_level,preferred_subjects,learning_goals").eq("id", user.id).maybeSingle(),
    visibleLessons(user),
    collectRows((start, end) => client.from("forge_attempts").select("original_lesson_id")
      .eq("user_id", user.id).gte("score", 6).order("id").range(start, end)),
    requireAiAccess(user).then(() => true, () => false),
  ]);
  if (profileResult.error) throw new Error("Could not load your learning preferences. Please try again later.");
  const profile = profileResult.data;
  const preferences = derivePreferences({
    level: profile?.learning_level,
    subjects: Array.isArray(profile?.preferred_subjects) ? profile.preferred_subjects.join(", ") : "",
    goals: profile?.learning_goals,
  });
  const lessons = catalog.filter(lesson => lessonTopic(lesson)).map(({ id, title, subject, summary }) => ({ id, title, subject, summary }));
  const completedIds = passed.map(row => String(row.original_lesson_id)).filter(id => lessons.some(lesson => lesson.id === id));

  return <LearnerShell active="/paths" name={String(profile?.display_name ?? "Learner")} admin={isAdmin(user)} instructor={isInstructor(user)}>
    <div className="portal-page">
      <header className="portal-heading"><div><span className="eyebrow">SOFTWARE DEVELOPMENT LIFE CYCLE</span><h1>Learning paths</h1><p>Optional recommendations. Enrollment is always your choice.</p></div></header>
      <LearningPath catalog={lessons} completedIds={completedIds} initialPreferences={preferences} aiAvailable={aiAvailable} />
    </div>
  </LearnerShell>;
}