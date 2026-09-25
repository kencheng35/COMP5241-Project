"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Bookmark, Check, ChevronLeft, ChevronRight, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { attend, saveBookmark, saveResume, submitQuiz, type ActionState } from "@/app/learning/actions";
import type { LessonContent } from "@/lib/learning";
import type { ResumeState } from "@/lib/resume";
import { LessonPreview } from "./lesson-preview";

export function ActionForm({ action, children, label, preview }: { action: (previous: ActionState, form: FormData) => Promise<ActionState>; children: React.ReactNode; label: string; preview?: LessonContent }) {
  const [state, submit, pending] = useActionState(action, {});
  return <form action={submit} className="learning-form"><fieldset disabled={pending}>{children}{preview && <LessonPreview content={preview} />}<button className="auth-submit" type="submit">{pending ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}{pending ? "Working..." : label}</button></fieldset>{state.error && <p role="alert" className="form-notice notice-error">{state.error}</p>}{state.success && <p role="status" className="form-notice">{state.success}</p>}{state.lessonId && <Link className="text-link" href={`/courses/${state.lessonId}`}>Open lesson <ChevronRight size={15} /></Link>}</form>;
}

export function BookmarkButton({ id, initial }: { id: string; initial: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <div><button className="secondary-button" disabled={pending} aria-pressed={saved} onClick={() => startTransition(async () => { const result = await saveBookmark(id, !saved); setError(result.error ?? ""); if (!result.error) setSaved(!saved); })}><Bookmark size={17} fill={saved ? "currentColor" : "none"} />{pending ? "Saving..." : saved ? "Saved" : "Save lesson"}</button>{error && <p role="alert">{error}</p>}</div>;
}

type PlayerContent = Omit<LessonContent, "questions"> & { questions: { prompt: string; options: string[] }[] };

export function LessonPlayer({ id, version, content, saved, revision, resumeAvailable }: { id: string; version: number; content: PlayerContent; saved: ResumeState | null; revision: number; resumeAvailable: boolean }) {
  const initial = saved && saved.slide < content.slides.length && saved.ordering.length === content.activity.steps.length && new Set(saved.ordering).size === saved.ordering.length && saved.ordering.every(index => index < saved.ordering.length) ? saved : null;
  const [slide, setSlide] = useState(initial?.slide ?? 0);
  const [stage, setStage] = useState<"slides" | "activity" | "quiz">(initial?.stage ?? "slides");
  const [order, setOrder] = useState(initial?.ordering ?? content.activity.steps.map((_, index) => index).reverse());
  const [checked, setChecked] = useState(false);
  const [answers, setAnswers] = useState<number[]>(initial?.answers ?? Array(10).fill(-1));
  const [result, setResult] = useState<ActionState>({});
  const [pending, startTransition] = useTransition();
  const [resumeError, setResumeError] = useState("");
  const [resumeConflict, setResumeConflict] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const firstStage = useRef(true);
  const revisionRef = useRef(revision);
  const lastSaved = useRef(JSON.stringify(initial ?? { stage: "slides", slide: 0, ordering: content.activity.steps.map((_, index) => index).reverse(), answers: Array(10).fill(-1) }));
  const waiting = useRef<ResumeState | null>(null);
  const saving = useRef(false);
  const blocked = useRef(false);
  const flush = useCallback(async () => {
    if (saving.current || blocked.current) return;
    saving.current = true;
    setSavingProgress(true);
    try {
      while (waiting.current && !blocked.current) {
        const next = waiting.current;
        waiting.current = null;
        let outcome: Awaited<ReturnType<typeof saveResume>>;
        try { outcome = await saveResume(id, version, revisionRef.current, next); }
        catch { outcome = { error: "Could not save progress. Try again when your connection is restored." }; }
        if (outcome.error) {
          setResumeError(outcome.error);
          if (outcome.conflict) { blocked.current = true; setResumeConflict(true); }
          else waiting.current ??= next;
          break;
        }
        revisionRef.current = outcome.revision ?? revisionRef.current;
        lastSaved.current = JSON.stringify(next);
        setResumeError("");
      }
    } finally { saving.current = false; setSavingProgress(false); }
  }, [id, version]);
  useEffect(() => {
    const state: ResumeState = { stage, slide, ordering: order, answers };
    if (!resumeAvailable || blocked.current) return;
    if (!saving.current && JSON.stringify(state) === lastSaved.current) {
      waiting.current = null;
      setResumeError("");
      return;
    }
    waiting.current = state;
    void flush();
  }, [stage, slide, order, answers, resumeAvailable, flush]);
  useEffect(() => {
    if (firstStage.current) { firstStage.current = false; return; }
    stageHeading.current?.focus();
  }, [stage, slide]);
  useEffect(() => { if (result.score !== undefined) resultHeading.current?.focus(); }, [result.score]);
  const moveStep = (index: number, direction: number) => {
    const reordered = [...order];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    setOrder(reordered); setChecked(false);
  };
  const startQuiz = () => startTransition(async () => {
    const response = await attend(id);
    if (response.error) setResult(response);
    else setStage("quiz");
  });
  return <div className="learning-player">{!resumeAvailable && <p role="alert" className="form-notice notice-error">Progress saving is unavailable. You can continue this lesson, but your place will not be saved. Please contact the site administrator.</p>}{resumeError && <p role="alert" className="form-notice notice-error">{resumeError} {resumeConflict ? <button type="button" onClick={() => location.reload()}>Reload lesson</button> : <button type="button" disabled={savingProgress} onClick={() => void flush()}>Retry saving progress</button>}</p>}
    <nav className="learning-tabs" aria-label="Lesson sections"><button aria-current={stage === "slides" ? "step" : undefined} onClick={() => setStage("slides")}>Slides</button><button aria-current={stage === "activity" ? "step" : undefined} onClick={() => setStage("activity")}>Practice</button><button disabled={pending} aria-current={stage === "quiz" ? "step" : undefined} onClick={startQuiz}>Final quiz</button></nav>
    {result.error && <p role="alert" className="form-notice notice-error">{result.error}</p>}
    {stage === "slides" && <section className="slide-stage"><div className="slide-number" aria-hidden="true">{String(slide + 1).padStart(2, "0")}</div><div><span className="eyebrow">{slide + 1} / {content.slides.length}</span><h2 ref={stageHeading} tabIndex={-1}>{content.slides[slide].title}</h2><p>{content.slides[slide].body}</p><blockquote>{content.slides[slide].example}</blockquote></div><div className="player-navigation"><button className="secondary-button" disabled={slide === 0} onClick={() => setSlide(slide - 1)}><ChevronLeft size={18} />Previous</button><button className="auth-submit" onClick={() => slide + 1 < content.slides.length ? setSlide(slide + 1) : setStage("activity")}>{slide + 1 < content.slides.length ? "Next" : "Practice"}<ChevronRight size={18} /></button></div></section>}
    {stage === "activity" && <section className="activity-stage"><span className="eyebrow">PUT IT IN ORDER</span><h2 ref={stageHeading} tabIndex={-1}>{content.activity.prompt}</h2><ol className="ordering-list">{order.map((step, index) => <li key={step}><span>{content.activity.steps[step]}</span><button className="icon-button" title="Move up" aria-label={`Move step ${index + 1} up`} disabled={index === 0} onClick={() => moveStep(index, -1)}><ArrowUp size={17} /></button><button className="icon-button" title="Move down" aria-label={`Move step ${index + 1} down`} disabled={index === order.length - 1} onClick={() => moveStep(index, 1)}><ArrowDown size={17} /></button></li>)}</ol><div className="player-navigation"><button className="secondary-button" onClick={() => setChecked(true)}><Check size={17} />Check order</button><button className="auth-submit" disabled={pending} onClick={startQuiz}>Start final quiz<ChevronRight size={17} /></button></div>{checked && <p role="status">{order.every((value, index) => value === index) ? "Correct order." : "Not quite. Try another order or revisit the slides."}</p>}</section>}
    {stage === "quiz" && <section><div className="section-title"><h2 ref={stageHeading} tabIndex={-1}>Final quiz</h2><span>10 questions · Pass: 6 correct</span></div><form onSubmit={event => { event.preventDefault(); startTransition(async () => setResult(await submitQuiz(id, version, answers))); }}><fieldset disabled={pending || result.score !== undefined} className="quiz-fields">{content.questions.map((question, index) => <fieldset key={index} className="quiz-question"><legend>{index + 1}. {question.prompt}</legend>{question.options.map((option, optionIndex) => <label key={optionIndex}><input type="radio" name={`question-${index}`} required checked={answers[index] === optionIndex} onChange={() => setAnswers(answers.map((answer, answerIndex) => answerIndex === index ? optionIndex : answer))} />{option}</label>)}</fieldset>)}{result.score === undefined && <button className="auth-submit" type="submit" disabled={answers.includes(-1) || pending}>{pending ? "Saving result..." : "Submit quiz"}<Check size={17} /></button>}</fieldset></form>{result.score !== undefined && <div className="quiz-result" role="status"><h3 ref={resultHeading} tabIndex={-1}>{result.score} / 10 ({result.score * 10}%)</h3><p>{result.success}</p>{result.score >= 6 && <a className="auth-submit" href={`/api/certificates/${result.attemptId}`}>Download certificate</a>}<button className="secondary-button" onClick={() => { setAnswers(Array(10).fill(-1)); setResult({}); stageHeading.current?.focus(); }}>Retry quiz</button>{result.feedback?.map((feedback, index) => <details key={index}><summary>{index + 1}. {feedback.prompt}</summary><strong>{feedback.correct}</strong><p>{feedback.explanation}</p></details>)}</div>}</section>}
  </div>;
}

export function LessonEditor({ id, version, initial, action: saveLesson, admin }: { id: string; version: number; initial: LessonContent; action: (previous: ActionState, form: FormData) => Promise<ActionState>; admin: boolean }) {
  const [content, setContent] = useState(initial);
  const [savedContent, setSavedContent] = useState(JSON.stringify(initial));
  const readyInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (readyInput.current) readyInput.current.dataset.editorReady = "true"; }, []);
  const dirty = JSON.stringify(content) !== savedContent;
  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(event: BeforeUnloadEvent) { event.preventDefault(); }
    function leaveByLink(event: MouseEvent) {
      const target = event.target;
      const link = target instanceof Element ? target.closest("a[href]") : null;
      if (!link || link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("You have unsaved lesson changes. Leave without saving?")) event.preventDefault();
    }
    function leaveByHistory(event: Event) {
      const navigation = event as Event & { navigationType?: string };
      if (navigation.navigationType === "traverse" && navigation.cancelable && !window.confirm("You have unsaved lesson changes. Leave without saving?")) navigation.preventDefault();
    }
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", leaveByLink, true);
    navigation?.addEventListener("navigate", leaveByHistory);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", leaveByLink, true); navigation?.removeEventListener("navigate", leaveByHistory); };
  }, [dirty]);
  async function action(previous: ActionState, form: FormData) {
    const result = await saveLesson(previous, form);
    if (result.success) setSavedContent(String(form.get("content")));
    return result;
  }
  return <ActionForm action={action} label="Save lesson" preview={content}>
    <input ref={readyInput} type="hidden" name="lessonId" value={id} />
    <input type="hidden" name="version" value={version} />
    <input type="hidden" name="content" value={JSON.stringify(content)} />
    <label>Title<input value={content.title} maxLength={120} required onChange={event => setContent({ ...content, title: event.target.value })} /></label>
    <label>Subject<input value={content.subject} maxLength={60} required onChange={event => setContent({ ...content, subject: event.target.value })} /></label>
    <label>Summary<textarea value={content.summary} maxLength={300} required onChange={event => setContent({ ...content, summary: event.target.value })} /></label>
    <h2>Slides</h2>
    {content.slides.map((item, index) => <fieldset key={index}>
      <legend>Slide {index + 1}</legend>
      {(["title", "body", "example"] as const).map(field => <label key={field}>{field}<textarea value={item[field]} required onChange={event => setContent({ ...content, slides: content.slides.map((slide, slideIndex) => slideIndex === index ? { ...slide, [field]: event.target.value } : slide) })} /></label>)}
      <button type="button" className="secondary-button" disabled={content.slides.length <= 4} onClick={() => setContent({ ...content, slides: content.slides.filter((_, slideIndex) => slideIndex !== index) })}><Trash2 size={16} />Remove slide</button>
    </fieldset>)}
    <button className="secondary-button" type="button" disabled={content.slides.length >= 6} onClick={() => setContent({ ...content, slides: [...content.slides, { title: "", body: "", example: "" }] })}><Plus size={16} />Add slide</button>
    <h2>Ordering activity</h2>
    <label>Prompt<input value={content.activity.prompt} onChange={event => setContent({ ...content, activity: { ...content.activity, prompt: event.target.value } })} /></label>
    <label>Steps in correct order, one per line<textarea value={content.activity.steps.join("\n")} onChange={event => setContent({ ...content, activity: { ...content.activity, steps: event.target.value.split("\n") } })} /></label>
    <h2>Final quiz</h2>
    {content.questions.map((question, index) => <details key={index}>
      <summary>Question {index + 1}</summary>
      <label>Question<input value={question.prompt} onChange={event => setContent({ ...content, questions: content.questions.map((item, questionIndex) => questionIndex === index ? { ...item, prompt: event.target.value } : item) })} /></label>
      {question.options.map((option, optionIndex) => <label key={optionIndex}>Option {optionIndex + 1}<input value={option} onChange={event => setContent({ ...content, questions: content.questions.map((item, questionIndex) => questionIndex === index ? { ...item, options: item.options.map((choice, choiceIndex) => choiceIndex === optionIndex ? event.target.value : choice) } : item) })} /></label>)}
      <label>Correct option<select value={question.correct} onChange={event => setContent({ ...content, questions: content.questions.map((item, questionIndex) => questionIndex === index ? { ...item, correct: Number(event.target.value) } : item) })}>{question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>Option {optionIndex + 1}</option>)}</select></label>
      <label>Explanation<textarea value={question.explanation} onChange={event => setContent({ ...content, questions: content.questions.map((item, questionIndex) => questionIndex === index ? { ...item, explanation: event.target.value } : item) })} /></label>
    </details>)}
    {admin && <label><input type="checkbox" name="publish" /> Review and publish this lesson</label>}
  </ActionForm>;
}