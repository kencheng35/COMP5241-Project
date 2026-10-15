"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { changeEmail, type EmailChangeState } from "@/app/profile/actions";

export function EmailChangeForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<EmailChangeState | null>(null);
  const [pending, setPending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const inFlight = useRef(false);
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state) notice.current?.focus(); }, [state]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || blocked) return;
    inFlight.current = true; setPending(true);
    const data = new FormData(); data.set("email", email);
    let next: EmailChangeState;
    try { next = await changeEmail(null, data); }
    catch { next = { email, code: "unknown", message: "Could not confirm whether the request was accepted. Check your current and new inboxes and account before trying again. No automatic retry will occur." }; }
    setState(next); setBlocked(next.code === "unknown" || next.code === "sent");
    inFlight.current = false; setPending(false);
  }
  return <form onSubmit={submit} className="learning-form" aria-label="Change email" aria-busy={pending}>
    {state && <div ref={notice} tabIndex={-1} role="status" className={`form-notice ${state.code === "sent" ? "notice-success" : "notice-error"}`}>{state.message}</div>}
    <label>New email address<input name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} disabled={pending} required /></label>
    <button type="submit" className="primary-button" disabled={pending || blocked}>{pending ? "Requesting…" : "Request email change"}</button>
    {blocked && <button type="button" className="text-link" onClick={() => { setBlocked(false); setState(null); }}>I checked my inboxes and account; allow another request</button>}
    {state?.code === "auth" && <Link href="/login" className="text-link">Log in again</Link>}
  </form>;
}
