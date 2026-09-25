type Account = { id: string; app_metadata?: Record<string, unknown> };
type Lesson = { owner_id: string; visibility: string; review_requested?: boolean };

export function isAdmin(user: Account) { return user.app_metadata?.role === "admin"; }

export function isInstructor(user: Account) { return user.app_metadata?.role === "instructor"; }

export function canPublishLessons(user: Account) { return isAdmin(user) || isInstructor(user); }

export function canEditLesson(user: Account, lesson: Lesson) {
  if (isAdmin(user)) return lesson.visibility === "public" || lesson.owner_id === user.id || lesson.review_requested === true;
  return lesson.owner_id === user.id && (lesson.visibility === "private" || isInstructor(user));
}

export function canManageEnrollment(user: Account, lesson: Lesson) {
  return lesson.visibility === "public" && (isAdmin(user) || (isInstructor(user) && lesson.owner_id === user.id));
}