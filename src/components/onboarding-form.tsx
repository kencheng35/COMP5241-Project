"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { reloadLearningSetup, saveOnboarding } from "@/app/onboarding/actions";
import { backgroundChoices, goalChoices, setupFailure, type SetupProfile, type SetupResult } from "@/lib/onboarding";
import { levels, levelLabels, type Level, type SetupRole } from "@/lib/diagnostic";
import styles from "./onboarding.module.css";

export function OnboardingForm({ initial, role }: { initial: SetupProfile; role: SetupRole }) {
  const background = initial.onboarding_background?.role === role ? initial.onboarding_background : null;
  const [saved, setSaved] = useState(initial);
  const [experience, setExperience] = useState(background?.experience ?? "");
  const [goals, setGoals] = useState<string[]>(background?.goals ?? []);
  const [level, setLevel] = useState(levels.includes(initial.learning_level as Level) ? initial.learning_level! : "");
  const [result, setResult] = useState<SetupResult | null>(null);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [roleChanged, setRoleChanged] = useState(false);
  const inFlight = useRef(false);
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (result) notice.current?.focus(); }, [result]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || blocked || roleChanged) return;
    if (!experience || !goals.length || !level) {
      setResult({ code: "invalid", message: "Choose a background, at least one goal and a learning level." });
      return;
    }
    inFlight.current = true; setPending(true);
    let next: SetupResult;
    try { next = await saveOnboarding({ revision: saved.learning_setup_revision, role, experience, goals, level }); }
    catch { next = setupFailure("unknown"); }
    if (next.code === "saved" && next.profile) setSaved(next.profile);
    if (next.code === "unknown" || next.code === "conflict") setBlocked(true);
    setResult(next); inFlight.current = false; setPending(false);
  }
  async function reload() {
    if (inFlight.current) return;
    inFlight.current = true; setPending(true);
    try {
      const next = await reloadLearningSetup();
      if (next.code === "loaded" && next.profile) {
        setSaved(next.profile);
        if (next.role !== role) {
          setRoleChanged(true);
          setResult({ code: "invalid", message: "Your trusted account role changed. Reopen this page for the current questions. Your draft has not been saved." });
        } else { setBlocked(false); setResult(next); }
      } else setResult(next);
    } catch { setResult(setupFailure("unavailable")); }
    inFlight.current = false; setPending(false);
  }
  return <section className={styles.setup}>
    <p>Use coarse choices only. Do not enter personal records. These preferences do not grant teaching or AI access and do not yet implement tailored lessons.</p>
    {result && <div ref={notice} tabIndex={-1} role="status" className={`form-notice ${["saved", "loaded"].includes(result.code) ? "notice-success" : "notice-error"}`}>{result.message}</div>}
    <form onSubmit={submit} aria-label="Background and goals" aria-busy={pending}>
      <fieldset disabled={pending || roleChanged} className={styles.fields}>
        <legend>{role === "instructor" ? "Instructor background and teaching goals" : "Learner background and learning goals"}</legend>
        <label><span id="background-label">Background</span><select aria-labelledby="background-label" value={experience} onChange={event => setExperience(event.target.value)} required>
          <option value="">Choose your starting experience</option>
          {backgroundChoices[role].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
        <fieldset className={styles.choices}><legend>Goals — choose at least one</legend>
          {goalChoices[role].map(([value, label]) => <label key={value}><input type="checkbox" checked={goals.includes(value)} onChange={event => setGoals(event.target.checked ? [...goals, value] : goals.filter(goal => goal !== value))} />{label}</label>)}
        </fieldset>
        <label><span id="chosen-level-label">Your chosen learning level</span><select aria-labelledby="chosen-level-label" value={level} onChange={event => setLevel(event.target.value)} required>
          <option value="">Choose a level</option>{levels.map(value => <option key={value} value={value}>{levelLabels[value]}</option>)}
        </select><small>This is your choice, separate from the optional diagnostic suggestion.</small></label>
        <button className="primary-button" disabled={blocked} type="submit">{pending ? "Saving…" : saved.onboarding_completed_at ? "Save background changes" : "Save and complete onboarding"}</button>
      </fieldset>
    </form>
    {saved.onboarding_background && <div className={styles.summary} aria-label="Saved background">
      <h2>Currently saved</h2><p>{backgroundChoices[saved.onboarding_background.role].find(([id]) => id === saved.onboarding_background?.experience)?.[1]}</p>
      <ul>{saved.onboarding_background.goals.map(goal => <li key={goal}>{goalChoices[saved.onboarding_background!.role].find(([id]) => id === goal)?.[1]}</li>)}</ul>
      <p>Chosen level: {levelLabels[saved.learning_level as Level] ?? "Not recorded / unrecognised"}</p>
    </div>}
    <div className={styles.actions}>
      <button type="button" className="secondary-button" disabled={pending} onClick={reload}>Reload saved version</button>
      {roleChanged && <a className="text-link" href="/onboarding">Reopen onboarding</a>}
      {saved.onboarding_completed_at && <Link className="text-link" href="/dashboard">Continue to dashboard</Link>}
      <Link className="text-link" href="/diagnostic">Optional local diagnostic</Link>
      <Link className="text-link" href="/profile">Profile, export & deletion</Link>
      <Link className="text-link" href="/login">Log in / account recovery</Link>
    </div>
    <p className={styles.review}>Draft questions and rubric require project-owner pedagogical review. No external inference is used.</p>
  </section>;
}
