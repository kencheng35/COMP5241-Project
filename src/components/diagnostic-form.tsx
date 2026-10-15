"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { chooseDiagnosticLevel, runDiagnostic } from "@/app/diagnostic/actions";
import { reloadLearningSetup } from "@/app/onboarding/actions";
import { diagnosticQuestions, explainDiagnostic, levels, levelLabels, type Level, type SetupRole } from "@/lib/diagnostic";
import { setupFailure, type SetupProfile, type SetupResult } from "@/lib/onboarding";
import styles from "./onboarding.module.css";

export function DiagnosticForm({ initial, role }: { initial: SetupProfile; role: SetupRole }) {
  const [saved, setSaved] = useState(initial);
  const [answers, setAnswers] = useState<number[]>(Array(6).fill(-1));
  const [showQuiz, setShowQuiz] = useState(!initial.diagnostic_summary);
  const [override, setOverride] = useState<Level>("foundation");
  const [result, setResult] = useState<SetupResult | null>(null);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [roleChanged, setRoleChanged] = useState(false);
  const inFlight = useRef(false);
  const notice = useRef<HTMLDivElement>(null);
  const quizHeading = useRef<HTMLHeadingElement>(null);
  const savedHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (result) notice.current?.focus(); }, [result]);
  useEffect(() => { if (showQuiz) quizHeading.current?.focus(); }, [showQuiz]);
  const summary = saved.diagnostic_summary;

  async function perform(kind: "score" | "adopt" | "override" | "reload") {
    if (inFlight.current || (kind !== "reload" && (blocked || roleChanged))) return;
    inFlight.current = true; setPending(true);
    let next: SetupResult;
    try {
      next = kind === "reload" ? await reloadLearningSetup() : kind === "score"
        ? await runDiagnostic({ revision: saved.learning_setup_revision, role, answers })
        : await chooseDiagnosticLevel({ revision: saved.learning_setup_revision, role, decision: kind,
          level: kind === "adopt" ? summary?.suggested_level : override });
    } catch { next = setupFailure(kind === "reload" ? "unavailable" : "unknown"); }
    if ((next.code === "saved" || next.code === "loaded") && next.profile) {
      setSaved(next.profile);
      if (kind === "reload") {
        if (next.role !== role) {
          setRoleChanged(true);
          next = { code: "invalid", message: "Your trusted account role changed. Reopen this page for the current diagnostic; your draft has not been saved." };
        } else setBlocked(false);
      } else if (kind === "score") { setShowQuiz(false); setAnswers(Array(6).fill(-1)); }
    }
    if (next.code === "conflict" || next.code === "unknown") setBlocked(true);
    setResult(next); inFlight.current = false; setPending(false);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (answers.some(answer => answer < 0)) {
      setResult({ code: "invalid", message: "Answer all six questions before checking your starting point." }); return;
    }
    void perform("score");
  }
  return <section className={styles.setup}>
    <p>A short local check for your current {role} role. Only the latest bounded score summary is saved, not your answers or attempt history. No AI or external service is used.</p>
    <p className={styles.review}>Draft questions and rubric require project-owner pedagogical review. This is not a grade, certificate or proof of teaching ability.</p>
    <p><strong>Chosen level: {levelLabels[saved.learning_level as Level] ?? "Not recorded / unrecognised"}</strong>. A retake does not change it.</p>
    {result && <div ref={notice} tabIndex={-1} role="status" className={`form-notice ${["saved", "loaded"].includes(result.code) ? "notice-success" : "notice-error"}`}>{result.message}</div>}
    {summary && <div className={styles.summary} aria-label="Latest saved diagnostic">
      <h2 ref={savedHeading} tabIndex={-1}>Latest saved suggestion</h2><p>{explainDiagnostic(summary)}</p>
      <p>Rubric: {summary.rubric_version} · Recorded: <time dateTime={summary.completed_at}>{summary.completed_at.slice(0, 10)}</time></p>
      {summary.role !== role ? <p>Your trusted role has changed since this result. Retake the current questions before adopting a suggestion.</p> :
        <fieldset disabled={pending || blocked || roleChanged || showQuiz} className={styles.fields}>
          <legend>Explicitly choose your level (optional)</legend>
          <button type="button" className="primary-button" onClick={() => void perform("adopt")}>Adopt {levelLabels[summary.suggested_level]}</button>
          <label><span id="override-label">Override with your own level</span><select aria-labelledby="override-label" value={override} onChange={event => setOverride(event.target.value as Level)}>{levels.map(level => <option key={level} value={level}>{levelLabels[level]}</option>)}</select></label>
          <button type="button" className="secondary-button" onClick={() => void perform("override")}>Save my override</button>
          <small>You can also keep your current level without saving anything.</small>
        </fieldset>}
      {!showQuiz && <button className="secondary-button" type="button" disabled={pending || blocked || roleChanged} onClick={() => { setAnswers(Array(6).fill(-1)); setShowQuiz(true); setResult(null); }}>Retake diagnostic</button>}
    </div>}
    {showQuiz && <form onSubmit={submit} aria-label="Local diagnostic" aria-busy={pending}>
      <h2 ref={quizHeading} tabIndex={-1}>Your starting point</h2>
      <fieldset disabled={pending || roleChanged} className={styles.fields}><legend>Six {role} questions</legend>
        {diagnosticQuestions[role].map((question, index) => <fieldset key={question.id} className={styles.choices}>
          <legend>{index + 1}. {question.prompt}</legend>
          {question.choices.map((choice, answer) => <label key={answer}><input type="radio" name={question.id} value={answer} required checked={answers[index] === answer} onChange={() => setAnswers(answers.map((value, i) => i === index ? answer : value))} />{choice}</label>)}
        </fieldset>)}
        <button className="primary-button" disabled={blocked} type="submit">{pending ? "Saving…" : "Check and save latest summary"}</button>
      </fieldset>
      {summary && <button type="button" className="text-link" disabled={pending} onClick={() => { setShowQuiz(false); savedHeading.current?.focus(); }}>Cancel retake — keep saved result</button>}
    </form>}
    {!showQuiz && summary && <details><summary>What these questions check</summary><ul>{diagnosticQuestions[summary.role].map(question => <li key={question.id}>{question.explanation}</li>)}</ul></details>}
    <div className={styles.actions}>
      <button className="secondary-button" type="button" disabled={pending} onClick={() => void perform("reload")}>Reload saved version</button>
      {roleChanged && <a className="text-link" href="/diagnostic">Reopen diagnostic</a>}
      <Link className="text-link" href="/onboarding">Edit background & goals</Link>
      <Link className="text-link" href="/dashboard">Dashboard</Link>
      <Link className="text-link" href="/profile">Profile, export & deletion</Link>
      <Link className="text-link" href="/login">Log in / account recovery</Link>
    </div>
  </section>;
}
