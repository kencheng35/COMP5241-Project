import { notFound } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { ActionForm } from "@/components/learning-controls";
import { addReviewer, removeReviewer } from "@/app/learning/actions";
import { database, displayName, isAdmin, requireUser } from "@/lib/learning-server";
import { collectRows } from "@/lib/learning";

export default async function Admin() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  const data = await collectRows((start, end) => database().from("forge_lessons").select("id,title,visibility,version").or(`visibility.eq.public,review_requested.eq.true,owner_id.eq.${user.id}`).order("created_at", { ascending: false }).order("id").range(start, end));
  const reviewers = await collectRows((start, end) => database().from("forge_reviewers").select("user_id,lesson_id").order("lesson_id").order("user_id").range(start, end));
  return <LearnerShell active="/admin" name={await displayName(user)} admin>
    <div className="portal-page"><span className="eyebrow">ADMINISTRATOR</span><h1>Review & publish.</h1>
      <div className="learning-list">{data?.map(lesson => <div key={lesson.id}>
        <h2>{lesson.title}</h2><p>{lesson.visibility} · Version {lesson.version}</p>
        <a className="text-link" href={`/studio?edit=${lesson.id}`}>Review content and answer key</a>
        {lesson.visibility === "public" && <details><summary>Manage quiz-report access</summary>
          <ActionForm action={addReviewer} label="Add reviewer"><input type="hidden" name="lessonId" value={lesson.id} /><label>Registered reviewer user ID<input name="reviewerId" required /></label></ActionForm>
          {reviewers?.filter(reviewer => reviewer.lesson_id === lesson.id).map(reviewer => <ActionForm key={reviewer.user_id} action={removeReviewer} label="Revoke access"><p>{reviewer.user_id}</p><input type="hidden" name="lessonId" value={lesson.id} /><input type="hidden" name="reviewerId" value={reviewer.user_id} /></ActionForm>)}
        </details>}
      </div>)}</div>{!data?.length && <p>No lessons awaiting review.</p>}
    </div>
  </LearnerShell>;
}