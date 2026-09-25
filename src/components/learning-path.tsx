"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, LoaderCircle, Sparkles } from "lucide-react";
import { generateLearningPath, type PathState } from "@/app/paths/actions";
import { GOALS, TOPICS, recommendLessons, type CatalogLesson, type Goal, type Preferences, type Recommendation, type Topic } from "@/lib/recommendations";

const topicLabels: Record<Topic, string> = {
  overview: "SDLC overview", requirements: "Requirements", design: "Design", implementation: "Implementation",
  testing: "Testing", deployment: "Deployment", maintenance: "Maintenance",
};
const goalLabels: Record<Goal, string> = {
  foundations: "Establish foundations", build: "Build software", quality: "Improve software quality", delivery: "Deliver and maintain software",
};

function LessonList({ lessons }: { lessons: Recommendation[] }) {
  return <ol className="ordering-list">{lessons.map(lesson => <li key={lesson.id}>
    <span style={{ minWidth: 0 }}>
      <small>{topicLabels[lesson.topic]}</small>
      <h3><Link href={`/courses/${lesson.id}`} className="text-link" style={{ overflowWrap: "anywhere" }}>{lesson.title}</Link></h3>
      <p>{lesson.reason}</p>
    </span>
    <ArrowRight size={20} aria-hidden="true" style={{ flexShrink: 0 }} />
  </li>)}</ol>;
}

export function LearningPath({ catalog, completedIds, initialPreferences, aiAvailable }: {
  catalog: CatalogLesson[]; completedIds: string[]; initialPreferences: Preferences; aiAvailable: boolean;
}) {
  const [topic, setTopic] = useState<Topic | "profile">("profile");
  const [goal, setGoal] = useState<Goal | "profile">("profile");
  const [shareCourseContent, setShareCourseContent] = useState(false);
  const [state, action, pending] = useActionState(generateLearningPath, {} as PathState);
  const preferences: Preferences = {
    ...initialPreferences,
    topics: topic === "profile" ? initialPreferences.topics : [topic],
    goal: goal === "profile" ? initialPreferences.goal : goal,
  };
  const recommendations = recommendLessons(catalog, preferences, completedIds);
  const currentPath = !pending && state.selectionKey === `${topic}:${goal}` ? state.path : undefined;

  return <form action={action} className="learning-form">
    <section className="learning-section" aria-labelledby="local-path-heading">
      <h2 id="local-path-heading">Local recommendations</h2>
      <p>Rule-based, not AI. Lessons you have passed are excluded.</p>
      <div className="catalog-filters">
        <label>SDLC topic<select name="topic" value={topic} disabled={pending} onChange={event => setTopic(event.target.value as Topic | "profile")}>
          <option value="profile">Profile preferences</option>{TOPICS.map(value => <option key={value} value={value}>{topicLabels[value]}</option>)}
        </select></label>
        <label>Learning goal<select name="goal" value={goal} disabled={pending} onChange={event => setGoal(event.target.value as Goal | "profile")}>
          <option value="profile">Profile goal</option>{GOALS.map(value => <option key={value} value={value}>{goalLabels[value]}</option>)}
        </select></label>
      </div>
      {recommendations.length ? <LessonList lessons={recommendations} /> : <p>No uncompleted SDLC lessons are available in your visible catalog. <Link href="/catalog" className="text-link">Course catalog</Link></p>}
    </section>
    <section className="learning-section" aria-labelledby="ai-path-heading" aria-busy={pending}>
      <h2 id="ai-path-heading">AI-generated path</h2>
      <p>Optional and not saved. Reloading clears the generated path. No automatic enrollment.</p>
      {!aiAvailable && <p id="ai-access-notice" role="status">External AI requires a recorded adult age (18+) and administrator-approved AI access. Local recommendations remain available.</p>}
      <label className="checkbox-field"><input name="shareCourseContent" type="checkbox" checked={shareCourseContent} onChange={event => setShareCourseContent(event.target.checked)} disabled={!aiAvailable || pending || !recommendations.length} />Share candidate lesson titles (including my private lessons) and coarse SDLC preferences with the external AI provider for this request.</label>
      <p>No profile text, personal identifiers, grades, answers, or chats are sent. The shared daily AI generation allowance applies.</p>
      <button type="submit" className="auth-submit" disabled={!aiAvailable || !shareCourseContent || pending || !recommendations.length} aria-describedby={!aiAvailable ? "ai-access-notice" : undefined}>
        {pending ? <LoaderCircle className="spin" size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}Generate AI path
      </button>
      <div aria-live="polite" aria-atomic="true">
        {pending && <p role="status">Generating a path...</p>}
        {!pending && state.error && <p className="form-notice notice-error" role="alert">{state.error}</p>}
      </div>
      {currentPath && <section className="learning-section" aria-labelledby="generated-path-heading">
        <h3 id="generated-path-heading">Generated path (not saved)</h3>
        <p>AI-selected order; explanations below use local recommendation rules.</p>
        <LessonList lessons={currentPath} />
      </section>}
    </section>
  </form>;
}