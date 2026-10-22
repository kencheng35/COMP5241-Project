"use client";

import { useEffect, useRef, useState } from "react";
import { createReflection, deleteReflection, listReflections, readReflection, updateReflection } from "@/app/reflections/actions";
import { reflectionCreateSchema, reflectionFields, reflectionListResultSchema, reflectionMessages, reflectionResultSchema, type ReflectionHistory, type ReflectionListResult, type ReflectionResult, type ReflectionRow, type ReflectionTexts } from "@/lib/reflections";
import styles from "./reflections.module.css";

const empty = (): ReflectionTexts => ({ delegation: "", description: "", discernment: "", diligence: "" });
const texts = (row: ReflectionRow | null): ReflectionTexts => row ? Object.fromEntries(reflectionFields.map(({ key }) => [key, row[key]])) as ReflectionTexts : empty();
type Props = { owner: string; date: string; initial: ReflectionResult; history: ReflectionListResult };

export function DailyReflections({ owner, date: initialDate, initial, history: initialHistory }: Props) {
  const initialRow = initial.code === "ok" ? initial.row : undefined;
  const [date, setDate] = useState(initialDate);
  const [row, setRow] = useState<ReflectionRow | null | undefined>(initialRow);
  const [draft, setDraft] = useState<ReflectionTexts>(texts(initialRow ?? null));
  const [history, setHistory] = useState<ReflectionHistory | null>(initialHistory.code === "ok" ? initialHistory : null);
  const [historyError, setHistoryError] = useState(initialHistory.code === "ok" ? "" : reflectionMessages[initialHistory.code]);
  const [message, setMessage] = useState(initial.code === "ok" ? "" : initial.code === "deleted" ? "" : reflectionMessages[initial.code]);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<"reconcile" | "deleted" | null>(null);
  const [canonical, setCanonical] = useState<ReflectionRow | null | undefined>(undefined);
  const [dialog, setDialog] = useState<"discard" | "delete" | null>(null);
  const lock = useRef(false), epoch = useRef(0), historyEpoch = useRef(0);
  const queued = useRef<(() => void) | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const notice = useRef<HTMLParagraphElement>(null);
  const dateInput = useRef<HTMLInputElement>(null);
  const baseline = texts(row ?? null);
  const dirty = reflectionFields.some(({ key }) => draft[key] !== baseline[key]);
  const dirtyRef = useRef(dirty);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  useEffect(() => () => { epoch.current++; historyEpoch.current++; }, [owner]);
  useEffect(() => { if (dialog) cancelButton.current?.focus(); }, [dialog]);
  useEffect(() => { if (message) notice.current?.focus(); }, [message]);
  function guarded(next: () => void, origin?: HTMLElement) {
    if (lock.current) return;
    if (!dirtyRef.current) { next(); return; }
    returnFocus.current = origin ?? document.activeElement as HTMLElement;
    queued.current = next;
    setDialog("discard");
  }
  useEffect(() => {
    function click(event: MouseEvent) {
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (!dirtyRef.current && !lock.current) || event.defaultPrevented) return;
      event.preventDefault(); event.stopPropagation();
      guarded(() => window.location.assign(anchor.href), anchor);
    }
    function submit(event: SubmitEvent) {
      const form = event.target as HTMLFormElement;
      if (form.dataset.reflectionForm || (!dirtyRef.current && !lock.current)) return;
      event.preventDefault(); event.stopPropagation();
      const submitter = event.submitter;
      guarded(() => {
        dirtyRef.current = false;
        form.requestSubmit(submitter as HTMLButtonElement | null);
      });
    }
    document.addEventListener("click", click, true);
    document.addEventListener("submit", submit, true);
    return () => { document.removeEventListener("click", click, true); document.removeEventListener("submit", submit, true); };
  });
  function cancel() {
    setDialog(null); queued.current = null;
    returnFocus.current?.focus();
  }
  function begin() { if (lock.current) return false; lock.current = true; setBusy(true); return true; }
  function end() { lock.current = false; setBusy(false); }
  async function loadDate(nextDate: string, inspect = false) {
    if (!begin()) return;
    const token = ++epoch.current;
    try {
      const result = reflectionResultSchema.parse(await readReflection({ date: nextDate }));
      if (token !== epoch.current) return;
      if (result.code !== "ok" || (result.row && (result.row.owner_id !== owner || result.row.date !== nextDate))) {
        setMessage(result.code === "ok" || result.code === "deleted" ? reflectionMessages.unavailable : reflectionMessages[result.code]); return;
      }
      if (inspect) {
        setCanonical(result.row);
        setMessage("Canonical entry loaded for inspection. Your draft has not changed. Choose explicitly how to continue.");
      } else {
        setDate(nextDate); setRow(result.row); setDraft(texts(result.row)); setBlocked(null); setCanonical(undefined);
        setMessage(result.row ? "Entry loaded." : "No entry for this date. A new entry is saved only when you choose Create entry.");
      }
    } catch { if (token === epoch.current) setMessage(reflectionMessages.unavailable); }
    finally { if (token === epoch.current) end(); }
  }
  async function loadHistory(more = false) {
    if (!begin()) return;
    const token = ++historyEpoch.current;
    try {
      const result = reflectionListResultSchema.parse(await listReflections(more ? history?.cursor ?? null : null));
      if (token !== historyEpoch.current) return;
      if (result.code !== "ok") { setHistoryError(reflectionMessages[result.code]); return; }
      setHistory(previous => ({ rows: more && previous ? [...previous.rows, ...result.rows.filter(item => !previous.rows.some(old => old.id === item.id))] : result.rows, cursor: result.cursor }));
      setHistoryError("");
    } catch { if (token === historyEpoch.current) setHistoryError(reflectionMessages.unavailable); }
    finally { if (token === historyEpoch.current) end(); }
  }
  function remember(saved: ReflectionRow) {
    setHistory(previous => previous ? {
      ...previous,
      rows: [...previous.rows.filter(item => item.id !== saved.id), { id: saved.id, date: saved.date, revision: saved.revision, created_at: saved.created_at, updated_at: saved.updated_at }]
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    } : previous);
  }
  async function mutate(deleting = false) {
    if (row === undefined || blocked || (!deleting && row && !dirty) || !begin()) return;
    setDialog(null);
    const token = ++epoch.current;
    if (!deleting && !reflectionCreateSchema.safeParse({ date, ...draft }).success) {
      setMessage(reflectionMessages.invalid); end(); return;
    }
    const selected = row;
    try {
      const raw = deleting && selected
        ? await deleteReflection({ id: selected.id, date, revision: selected.revision })
        : selected
          ? await updateReflection({ id: selected.id, date, revision: selected.revision, ...draft })
          : await createReflection({ date, ...draft });
      const result = reflectionResultSchema.parse(raw);
      if (token !== epoch.current) return;
      if (deleting && result.code === "deleted" && selected) {
        setHistory(previous => previous ? { ...previous, rows: previous.rows.filter(item => item.id !== selected.id) } : previous);
        setRow(null); setBlocked("deleted"); setCanonical(undefined);
        setMessage("Deletion confirmed. Your text remains here; starting another entry requires an explicit choice.");
      } else if (!deleting && result.code === "ok" && result.row && result.row.owner_id === owner && result.row.date === date &&
        result.row.revision === (selected?.revision ?? 0) + 1 && (!selected || result.row.id === selected.id) &&
        reflectionFields.every(({ key }) => result.row![key] === draft[key])) {
        setRow(result.row); setDraft(texts(result.row)); remember(result.row); setMessage("Entry saved privately.");
      } else {
        const code = result.code === "ok" || result.code === "deleted" || result.code === "unavailable" ? "unconfirmed" : result.code;
        setMessage(reflectionMessages[code]);
        if (["unconfirmed", "conflict", "missing"].includes(code)) { setBlocked("reconcile"); setCanonical(undefined); }
      }
    } catch {
      if (token === epoch.current) { setMessage(reflectionMessages.unconfirmed); setBlocked("reconcile"); setCanonical(undefined); }
    } finally { if (token === epoch.current) end(); }
  }
  function useCanonical() {
    if (canonical === undefined) return;
    const inspected = canonical;
    guarded(() => { setRow(inspected); setDraft(texts(inspected)); setCanonical(undefined); setBlocked(null); if (inspected) remember(inspected); setMessage("Canonical state selected. Nothing was written."); });
  }
  return <div className={styles.layout}>
    <section className={styles.editor} aria-label="Daily reflection editor">
      <p>Private to your signed-in account. Plain text only; no AI forwarding, sharing, grading, streaks, certificates or progress awards. Retained until you delete the entry or account.</p>
      <label htmlFor="reflection-date">Reflection date · Asia/Hong_Kong (Hong Kong)</label>
      <input ref={dateInput} id="reflection-date" type="date" value={date} disabled={busy} onChange={event => {
        const next = event.target.value;
        guarded(() => { void loadDate(next); });
      }} />
      <p className={styles.hint}>One editable entry per date. Default date uses Hong Kong time; choose any real date to revisit it. A date change loads first and never saves.</p>
      {message && <p ref={notice} tabIndex={-1} role="status" className={styles.notice}>{message}</p>}
      {row === undefined && <button disabled={busy} onClick={() => void loadDate(date)}>Retry loading selected date</button>}
      <form data-reflection-form="true" onSubmit={event => { event.preventDefault(); void mutate(); }}>
        <fieldset disabled={busy || row === undefined}>
          <legend>{blocked === "reconcile" ? "State needs reconciliation — writing disabled" : blocked === "deleted" ? "Deletion confirmed — inspect before creating again" : row ? `Entry · revision ${row.revision}` : row === null ? "New entry (not saved)" : "Entry not loaded — saving disabled"}</legend>
          {reflectionFields.map(({ key, label, prompt, example }) => <div className={styles.field} key={key}>
            <label htmlFor={`reflection-${key}`}>{label}</label>
            <p id={`${key}-hint`}>{prompt}<br /><span className={styles.hint}>Example: {example}</span></p>
            <textarea id={`reflection-${key}`} name={key} rows={4} required maxLength={4000} aria-describedby={`${key}-hint ${key}-count`} value={draft[key]} onChange={event => {
              setDraft(previous => ({ ...previous, [key]: event.target.value })); setCanonical(undefined);
            }} />
            <small id={`${key}-count`}>{Array.from(draft[key]).length} / 2000 characters</small>
          </div>)}
        </fieldset>
        <div className={styles.buttons}>
          <button type="submit" disabled={busy || row === undefined || !!blocked || (!!row && !dirty)}>{busy ? "Working…" : row ? "Save changes" : "Create entry"}</button>
          {row && <button type="button" disabled={busy || !!blocked} onClick={() => { returnFocus.current = document.activeElement as HTMLElement; setDialog("delete"); }}>Delete entry</button>}
          <button type="button" disabled={busy} onClick={() => void loadDate(date, true)}>Inspect canonical entry</button>
        </div>
      </form>
      {canonical !== undefined && <section className={styles.canonical} aria-label="Canonical entry">
        <h2>Canonical entry · {date}</h2>
        {canonical ? <><p>Revision {canonical.revision} · updated {canonical.updated_at}</p>{reflectionFields.map(({ key, label }) => <div key={key}><h3>{label}</h3><p className={styles.plain}>{canonical[key]}</p></div>)}</> : <p>No entry currently exists for this date.</p>}
        <button disabled={busy} onClick={useCanonical}>{canonical ? "Use canonical entry (discard draft)" : "Use empty date (discard draft)"}</button>
        {canonical === null && <button disabled={busy} onClick={() => { setRow(null); setBlocked(null); setCanonical(undefined); setMessage("Draft kept for a new entry. Choose Create entry to save; nothing was written."); }}>Keep draft for new entry</button>}
      </section>}
      {blocked === "deleted" && <button disabled={busy} onClick={() => { setBlocked("reconcile"); void loadDate(date, true); }}>Inspect date before starting another entry</button>}
      {busy && <p role="status">Working. Please wait before changing selection or leaving.</p>}
    </section>
    <aside className={styles.history} aria-label="Private reflection history">
      <h2>Your daily history</h2><p>Dates and revisions only. Select a date to read its private text.</p>
      {historyError && <p role="alert">{historyError}</p>}
      <button disabled={busy} onClick={() => void loadHistory()}>Reload history</button>
      {history && history.rows.length === 0 && !historyError && <p>No saved entries.</p>}
      <ul>{history?.rows.map(item => <li key={item.id}><button disabled={busy} aria-current={item.date === date ? "date" : undefined} onClick={() => guarded(() => { void loadDate(item.date); })}>{item.date} · revision {item.revision}</button></li>)}</ul>
      {history?.cursor && <button disabled={busy} onClick={() => void loadHistory(true)}>Load older dates</button>}
    </aside>
    {dialog && <div className={styles.backdrop}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="reflection-dialog-title" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
      if (event.key === "Tab") {
        const buttons = event.currentTarget.querySelectorAll("button");
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}>
      <h2 id="reflection-dialog-title">{dialog === "delete" ? "Delete this private entry?" : "Discard unsaved text?"}</h2>
      <p>{dialog === "delete" ? "This deletes only the selected revision. Export first if you want a copy. Newer edits will not be deleted." : "Your draft will be lost if you continue. Cancel to keep editing."}</p>
      <div className={styles.buttons}><button ref={cancelButton} onClick={cancel}>Cancel — keep editing</button><button onClick={() => {
        if (dialog === "delete") { void mutate(true); }
        else { const next = queued.current; queued.current = null; setDialog(null); next?.(); }
      }}>{dialog === "delete" ? "Confirm deletion" : "Discard and continue"}</button></div>
    </section></div>}
  </div>;
}
