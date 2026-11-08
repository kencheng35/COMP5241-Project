import Link from "next/link";
import { Search } from "lucide-react";
import { LearnerShell } from "@/components/learner-shell";
import { CatalogSearch } from "@/components/catalog-search";
import { ActionForm } from "@/components/learning-controls";
import { enroll, deletePrivateLesson, leaveLesson } from "@/app/learning/actions";
import { DIFFICULTIES, FAMILIES, filterLessons, readMetadata, subjectSelection, type CatalogFilters } from "@/lib/curriculum";
import styles from "@/components/lesson-metadata.module.css";
import { isInstructor, canEditLesson, displayName, isAdmin, lessonCreators, lessonHasUpdate, lessonResumeDates, requireUser, userRecords, visibleLessons } from "@/lib/learning-server";

const subjectTones = ["tone-green", "tone-yellow", "tone-coral", "tone-sage", "tone-sand"] as const;

function subjectTone(subject: string) {
  const total = [...subject].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return subjectTones[total % subjectTones.length];
}

function catalogDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-HK", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "short", day: "2-digit" }).format(date);
}

export default async function Catalog({ searchParams }: { searchParams: Promise<CatalogFilters & { creator?: string }> }) {
  const user = await requireUser();
  const [name, lessons, records, rawFilters, resume] = await Promise.all([displayName(user), visibleLessons(user), userRecords(user), searchParams, lessonResumeDates(user.id)]);
  const filters = {
    q: typeof rawFilters.q === "string" ? rawFilters.q : "",
    subject: typeof rawFilters.subject === "string" ? rawFilters.subject : "",
    difficulty: typeof rawFilters.difficulty === "string" ? rawFilters.difficulty : "",
    creator: typeof rawFilters.creator === "string" ? rawFilters.creator : "",
  };
  const narrowed = filterLessons(lessons, { ...filters, q: "" }).map(lesson => ({ ...lesson, metadata: readMetadata(lesson.subject, lesson.metadata) }));
  const creators = await lessonCreators(narrowed.map(lesson => lesson.owner_id));
  const creatorLabel = (ownerId: string) => ownerId === user.id ? "me" : `${creators.get(ownerId)?.role ?? "Learner"}-${creators.get(ownerId)?.name ?? "Learner"}`;
  const creatorOptions = [...new Set(narrowed.map(lesson => creatorLabel(lesson.owner_id)))].sort((a, b) => a === "me" ? -1 : b === "me" ? 1 : a.localeCompare(b));
  const query = (filters.q ?? "").trim().toLowerCase();
  const matches = narrowed.filter(lesson => {
    const creator = creatorLabel(lesson.owner_id);
    return `${lesson.title} ${lesson.subject}`.toLowerCase().includes(query) && (!filters.creator || creator === filters.creator);
  });
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
      <label>Difficulty<select name="difficulty" defaultValue={filters.difficulty}><option value="">All difficulties</option>{Object.entries(DIFFICULTIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>Created by<select name="creator" defaultValue={filters.creator}><option value="">All creators</option>{creatorOptions.map(option => <option key={option}>{option}</option>)}</select></label>
      <button className="auth-submit"><Search size={17} />Search</button><Link href="/catalog">Clear</Link>
    </form>
    {Boolean(filters.q || filters.subject || filters.difficulty || filters.creator) && <p role="status">{matches.length} matching {matches.length === 1 ? "lesson" : "lessons"}</p>}
    {groups.map(group => <details className="lesson-fold" key={group.title}>
      <summary>{group.title} <small>{group.items.length}</small></summary>
      {!group.items.length && <p>No lessons in this list.</p>}
      {group.items.length > 0 && <section className="catalog-grid">{group.items.map(lesson => {
        const creator = creators.get(lesson.owner_id);
        const published = lesson.visibility === "public";
        const enrolled = enrolledIds.has(lesson.id);
        const difficulty = lesson.metadata ? DIFFICULTIES[lesson.metadata.difficulty] : "Not specified";
        return <article className="catalog-card" key={lesson.id}><div className="catalog-copy">
          <p className={`subject-highlight ${subjectTone(lesson.subject)}`}><span>Subject</span>{lesson.subject}</p>
          <h2>{lesson.title}{lessonHasUpdate(lesson.version, Boolean(lesson.review_requested), lesson.visibility, resume.get(lesson.id), enrolled) && <span className="update-mark">Updated</span>}</h2>
          <p><span>Difficulty</span>{difficulty}</p>
          <p><span>{published ? "Published date" : "Last edit date"}</span>{catalogDate(published ? lesson.published_at ?? lesson.created_at : lesson.created_at)}</p>
          <p><span>Created by</span>{lesson.owner_id === user.id ? "me" : `${creator?.role ?? "Learner"}-${creator?.name ?? "Learner"}`}</p>
          <div className="catalog-actions">
            {canEditLesson(user, lesson) && <Link className="secondary-button" href={`/studio?edit=${lesson.id}`}>Edit lesson</Link>}
            {!published && lesson.owner_id === user.id && <ActionForm action={deletePrivateLesson} label="Delete"><input type="hidden" name="lessonId" value={lesson.id} /></ActionForm>}
            {!published ? <Link className="secondary-button" href={`/courses/${lesson.id}/lessons/1`}>Preview lesson</Link> : enrolled ? <><Link className="auth-submit" href={`/courses/${lesson.id}/lessons/1`}>Continue lesson</Link><ActionForm action={leaveLesson} label="Leave lesson"><input type="hidden" name="lessonId" value={lesson.id} /></ActionForm></> : <ActionForm action={enroll} label="Enroll now"><input type="hidden" name="lessonId" value={lesson.id} /></ActionForm>}
          </div>
        </div></article>;
      })}</section>}
    </details>)}
    {Boolean(filters.q || filters.subject || filters.difficulty || filters.creator) && matches.length === 0 && <div className="empty-state"><h2>No matching lessons.</h2><Link href="/catalog" className="text-link">Clear all filters</Link></div>}
  </div></LearnerShell>;
}
