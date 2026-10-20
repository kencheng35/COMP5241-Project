"use client";

import { useEffect, useRef, useState } from "react";
import { GenerationMetadataFields } from "./lesson-metadata";
import { createLesson } from "@/app/learning/actions";
import { importTeachingMaterial } from "@/app/teaching/actions";
import { advanceLessonGeneration, deleteLessonGeneration, finalizeLessonGeneration, listLessonGenerations, loadLessonGeneration } from "@/app/learning/generation-actions";
import { readyToFinalize, stageLabel, type Generation, type GenerationState, type GenerationSummary } from "@/lib/lesson-generation";
import styles from "./lesson-generation.module.css";

export function LessonGeneration({ importing = false }: { importing?: boolean }) {
  const [draft, setDraft] = useState<Generation>();
  const [drafts, setDrafts] = useState<GenerationSummary[]>([]);
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [needsLoad, setNeedsLoad] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("No AI runs until you choose Resume.");
  const run = useRef(false);
  const selected = useRef("");
  const status = useRef<HTMLHeadingElement>(null);
  const storageKey = `forge-generation-${importing ? "import" : "studio"}`;

  function remember(value: string) {
    setId(value); selected.current = value;
    try { localStorage.setItem(storageKey, value); } catch { /* Saved list also recovers IDs. */ }
  }
  async function refresh() {
    try {
      const state = await listLessonGenerations();
      if (state.drafts) setDrafts(state.drafts);
      else setError(state.error ?? "Could not load saved drafts.");
    } catch { setError("Saved draft list could not be loaded. Please reload."); }
  }
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      let stored = "";
      try { stored = localStorage.getItem(storageKey) ?? ""; } catch {}
      const value = stored || crypto.randomUUID();
      setId(value); selected.current = value;
      const state = await listLessonGenerations();
      if (cancelled) return;
      if (state.drafts) setDrafts(state.drafts);
      else setError(state.error ?? "Could not load saved drafts.");
      if (stored) {
        const recovered = await loadLessonGeneration(stored);
        if (!cancelled && recovered.draft && selected.current === stored) {
          setDraft(recovered.draft); setNotice("Saved state recovered. Generation is paused; choose Resume explicitly.");
        } else if (!cancelled && recovered.error) {
          setError(recovered.error); setNeedsLoad(!recovered.missing);
        }
      }
    }).catch(() => {
      if (!cancelled) { setError("Recovery could not be confirmed. Load saved state before continuing."); setNeedsLoad(true); }
    });
    return () => { cancelled = true; run.current = false; };
  }, [storageKey]);

  async function load(value: string) {
    run.current = false; setRunning(false); setBusy(true); setError("");
    remember(value);
    try {
      const state = await loadLessonGeneration(value);
      if (state.draft) {
        setDraft(state.draft); setNeedsLoad(false);
        setNotice("Saved state loaded. Resume/Retry is explicit; completed parts will be skipped.");
      } else {
        setError(state.error ?? "Saved state unavailable.");
        setNeedsLoad(!state.missing);
        if (state.missing) {
          setDraft(undefined);
          setNotice("No saved draft was found. Retry saving with the SAME start ID to reconcile safely; an already committed start cannot claim quota again.");
        }
      }
    } catch { setError("Load could not be confirmed. Try loading saved state again."); setNeedsLoad(true); }
    finally { setBusy(false); status.current?.focus(); }
  }
  async function start(form: FormData) {
    run.current = false; setBusy(true); setError("");
    // Persist identity BEFORE transport. Reusing it reconciles ambiguous starts atomically.
    remember(id); form.set("generationId", id);
    try {
      const state = await (importing ? importTeachingMaterial : createLesson)({}, form);
      if (state.generationId) await load(state.generationId);
      else {
        setError(state.error ?? "Start was not confirmed.");
        setNeedsLoad(Boolean(state.saveUncertain));
      }
    } catch { setError("Start acknowledgement was lost. Load saved state using this start ID; do not start another copy."); setNeedsLoad(true); }
    finally { setBusy(false); void refresh(); status.current?.focus(); }
  }
  async function resume() {
    if (!draft || busy || needsLoad) return;
    run.current = true; setRunning(true); setBusy(true); setError("");
    let current = draft;
    try {
      while (run.current && selected.current === current.id && !current.lesson_id) {
        setNotice(`Generating ${stageLabel(current)}. This request may take up to 60 seconds.`);
        const result: GenerationState = readyToFinalize(current) ?
          await finalizeLessonGeneration(current.id, current.revision) :
          await advanceLessonGeneration(current.id, current.revision, crypto.randomUUID());
        if (!result.draft || result.error || result.replay) {
          setError(result.error ?? "Request was already seen. Load saved state before continuing.");
          setNotice("Stopped. Load saved state before retrying.");
          setNeedsLoad(true); break;
        }
        current = result.draft;
        if (selected.current !== current.id) break;
        setDraft(current);
        if (current.lesson_id) { setNotice("Private lesson completed. Review it in the editor."); break; }
        setNotice(`${current.parts.length} parts saved. ${run.current ? "Continuing sequentially." : "Paused."}`);
      }
    } catch { setError("Response lost. The part may already be saved. Load saved state before an explicit retry."); setNotice("Stopped. Load saved state before retrying."); setNeedsLoad(true); }
    finally {
      run.current = false; setRunning(false); setBusy(false);
      void refresh(); status.current?.focus();
    }
  }
  function pause() {
    run.current = false; setRunning(false);
    setNotice("Paused: the in-flight request may still save, but no further request will be scheduled. Closing this page also stops scheduling.");
  }
  async function remove(value: string) {
    if (!window.confirm("Delete this saved generation and any retained extracted reference? A completed normal lesson is not deleted.")) return;
    run.current = false; setRunning(false);
    try {
      const state = await deleteLessonGeneration(value);
      if (!state.deleted) { setError(state.error ?? "Deletion was not confirmed. Reload saved state."); setNeedsLoad(true); return; }
      if (selected.current === value) { setDraft(undefined); remember(crypto.randomUUID()); setNeedsLoad(false); }
      setNotice("Draft content/reference deleted. A minimal owner/start-ID tombstone prevents replay; account deletion removes it.");
      await refresh();
    } catch { setError("Deletion acknowledgement lost. Reload the saved list to reconcile."); setNeedsLoad(true); }
    status.current?.focus();
  }
  const attempts = draft?.attempts.filter(a => a.stage === draft.parts.length).length ?? 0;
  return <section className={styles.panel} aria-label={importing ? "Saved teaching import" : "Saved lesson generation"}>
    <p>Generation is saved one part at a time: outline → individual slides → activity → two five-question batches. Starting saves a private generation draft, not a normal lesson, and uses one of five daily starts. Resume does not use another start. Each stage allows at most three explicit attempts.</p>
    <p className={`privacy-note ${styles.privacy}`}>Do not include personal information. Drafts are private to you, including from administrators. {(importing || draft?.kind === "import") && "Only extracted reference text (up to 20,000 characters) is retained while generation is pending; it is cleared at completion or deletion. Original files are never stored. "}Delete saved drafts below or delete your account to remove them. Generated content needs your review.</p>
    {!draft && <form onSubmit={event => { event.preventDefault(); void start(new FormData(event.currentTarget)); }} className={styles.form}>
      <GenerationMetadataFields />
      <label>Learning objective<textarea name="topic" required minLength={5} maxLength={500} rows={3} /></label>
      {importing && <>
        <label>Teaching file<input type="file" name="material" required accept=".pdf,.pptx,.ppt" /></label>
        <p>PDF/PPTX only: up to 4 MB and 60 pages/slides. Legacy PPT conversion remains unsupported.</p>
        <label><input type="checkbox" name="consent" required /> I have permission to retain the extracted reference privately until completion/deletion and send it to the configured AI provider. It contains no personal student data.</label>
      </>}
      <button className="primary-button" disabled={!id || busy || needsLoad}>Save generation draft (no AI yet)</button>
    </form>}
    <div className={styles.status}>
      <h2 ref={status} tabIndex={-1}>Generation status</h2>
      <p role="status" aria-live="polite">{notice}</p>
      {error && <p role="alert">{error}</p>}
      {draft && <>
        <h3>{draft.objective}</h3>
        <p>{draft.parts.length} saved parts · Last confirmed revision {draft.revision} · Next: {draft.lesson_id ? "Completed" : stageLabel(draft)}</p>
        <progress aria-label="Saved lesson parts" value={draft.parts.length} max={draft.parts.length ? ((draft.parts[0] as { plan: string[] }).plan.length + 4) : 10} />
        {!draft.lesson_id && <p>Last confirmed stage attempts: {attempts}/3. A lost in-flight request may hold a 90-second lease. Load saved state before retrying; retries are never automatic.</p>}
        {draft.lesson_id && <a className="text-link" href={`/studio?edit=${draft.lesson_id}`}>Review completed private lesson in editor</a>}
      </>}
      <div className={styles.buttons}>
        {draft && !draft.lesson_id && <button type="button" className="primary-button" onClick={resume} disabled={busy || needsLoad || attempts >= 3}>Resume / Retry explicitly</button>}
        {running && <button type="button" className="secondary-button" onClick={pause}>Pause after current request</button>}
        <button type="button" className="secondary-button" disabled={!id || busy} onClick={() => load(id)}>Load saved state / reconcile response loss</button>
        {draft && <button type="button" className="secondary-button" onClick={() => remove(draft.id)}>Delete this generation draft</button>}
        {draft && !busy && <button type="button" className="secondary-button" onClick={() => {
          setDraft(undefined); remember(crypto.randomUUID()); setError(""); setNeedsLoad(false); setNotice("New start identity ready. Existing drafts remain in the saved list.");
        }}>Prepare another draft</button>}
      </div>
    </div>
    <h2>Saved generation drafts</h2>
    <button type="button" className="secondary-button" onClick={refresh}>Reload saved list</button>
    <ul className={styles.list}>{drafts.map(row => <li key={row.id}>
      <span>{row.objective} — {row.lesson_id ? "Completed" : `${row.part_count} parts saved`} ({row.kind})</span>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => load(row.id)}>Load draft</button>
      <button type="button" className="secondary-button" onClick={() => remove(row.id)}>Delete draft</button>
    </li>)}</ul>
  </section>;
}
