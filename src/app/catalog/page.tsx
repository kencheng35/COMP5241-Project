import Link from "next/link";
import { Search } from "lucide-react";
import { LearnerShell } from "@/components/learner-shell";
import { CatalogSearch } from "@/components/catalog-search";
import { ActionForm } from "@/components/learning-controls";
import { enroll } from "@/app/learning/actions";
import { AUDIENCES, DIFFICULTIES, FAMILIES, filterLessons, readMetadata, subjectSelection, type CatalogFilters } from "@/lib/curriculum";
import styles from "@/components/lesson-metadata.module.css";
import { isInstructor, canEditLesson, displayName, isAdmin, lessonCreators, requireUser, userRecords, visibleLessons } from "@/lib/learning-server";

function catalogDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "short", day: "2-digit" }).format(date);
}

export default async function Catalog({ searchParams }: { searchParams: Promise<CatalogFilters> }) {
  const user = await requireUser();
  const [name, lessons, records, rawFilters] = await Promise.all([displayName(user), visibleLessons(user), userRecords(user), searchParams]);
  const filters = Object.fromEntries(["q", "subject", "audience", "difficulty", "visibility"].map(key => [key, typeof rawFilters[key as keyof CatalogFilters] === "string" ? rawFilters[key as keyof CatalogFilters] : ""])) as CatalogFilters;
  const matches = filterLessons(lessons, filters).map(lesson => ({ ...lesson, metadata: readMetadata(lesson.subject, lesson.metadata) }));
  const creators = await lessonCreators(matches.map(lesson => lesson.owner_id));
  const enrolledIds = new Set(records.enrollments.map(record => record.lesson_id));
  const groups = [
    { title: "Not yet enrolled", items: matches.filter(lesson => lesson.visibility !== "private" && !enrolledIds.has(lesson.id)) },
    { title: "Enrolled", items: matches.filter(lesson => lesson.visibility !== "private" && enrolledIds.has(lesson.id)) },
    { title: "Private", items: matches.filter(lesson => lesson.visibility === "private") },
  ];
  const subjects = Array.from(new Set([...Object.values(FAMILIES), ...lessons.filter(lesson => !subjectSelection(lesson.subject)).map(lesson => lesson.subject)]));
  return <LearnerShell active="/catalog" name={name} admin={isAdmin(user)} instructor={isInstructor(user)}><div className="portal-page">
    <header className="portal-heading"><div><span className="eyebrow">LESSON CATALOG</span><h1>Find your next useful skill.</h1></div><Link className="secondary-button" href="/studio">Create a private lesson</Link></header>
    <form className={`catalog-filters ${styles.filters}`} action="/catalog">
      <CatalogSearch query={filters.q ?? ""} />
      <label>Subject<select name="subject" defaultValue={filters.subject}><option value="">All subjects</option>{subjects.map(subject => <option key={subject}>{subject}</option>)}</select></label>
      <label>Audience<select name="audience" defaultValue={filters.audience}><option value="">All / not specified</option>{Object.entries(AUDIENCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Difficulty<select name="difficulty" defaultValue={filters.difficulty}><option value="">All / not specified</option>{Object.entries(DIFFICULTIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Visibility<select name="visibility" defaultValue={filters.visibility}><option value="">All available</option><option value="public">Public published</option><option value="private">My private lessons</option></select></label>
      <button className="auth-submit"><Search size={17} />Search</button><Link href="/catalog">Clear</Link>
    </form>
    <p>Lessons with unspecified metadata stay visible unless you choose a specific audience or difficulty. Audience filters include lessons marked for both groups.</p>
    <p role="status">{matches.length} matching {matches.length === 1 ? "lesson" : "lessons"}</p>
    {groups.map(group => <details className="lesson-fold" key={group.title}>
      <summary>{group.title} <small>{group.items.length}</small></summary>
      {!group.items.length && <p>No lessons in this list.</p>}
      {group.items.length > 0 && <section className="catalog-grid">{group.items.map(lesson => {
        const creator = creators.get(lesson.owner_id);
        const published = lesson.visibility === "public";
        const enrolled = enrolledIds.has(lesson.id);
        const difficulty = lesson.metadata ? DIFFICULTIES[lesson.metadata.difficulty] : "Not specified";
        return <article className="catalog-card" key={lesson.id}><div className="catalog-copy">
          <p><span>Subject</span>{lesson.subject}</p>
          <h2>{lesson.title}</h2>
          <p><span>Difficulty</span>{difficulty}</p>
          <p><span>{published ? "Published date" : "Last edit date"}</span>{catalogDate(published ? lesson.published_at ?? lesson.created_at : lesson.created_at)}</p>
          <p><span>Created by</span>{lesson.owner_id === user.id ? "me" : `${creator?.role ?? "Learner"}-${creator?.name ?? "Learner"}`}</p>
          <div className="catalog-actions">
            {canEditLesson(user, lesson) && <Link className="secondary-button" href={`/studio?edit=${lesson.id}`}>Edit lesson</Link>}
            {enrolled ? <Link className="auth-submit" href={`/courses/${lesson.id}/lessons/1`}>Continue lesson</Link> : <ActionForm action={enroll} label="Enroll now"><input type="hidden" name="lessonId" value={lesson.id} /></ActionForm>}
          </div>
        </div></article>;
      })}</section>}
    </details>)}
    {matches.length === 0 && <div className="empty-state"><h2>No matching lessons.</h2><Link href="/catalog" className="text-link">Clear all filters</Link></div>}
  </div></LearnerShell>;
}
