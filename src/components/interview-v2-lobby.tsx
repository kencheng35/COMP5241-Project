"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { deleteSession, startSession } from "@/app/interviews-v2/actions";
import {
  intervieweeLookKey,
  interviewerLookKey,
  readMute,
  readStoredLook,
  subscribeLooks,
  subscribeMute,
  writeLook,
  writeMute,
  type InterviewLook,
} from "@/lib/interview-v2-prefs";
import { v2Notices, v2Profiles, type ProfileId, type V2Code } from "@/lib/interviews-v2";
import styles from "./interview-v2.module.css";

const voiceBus = new Set<() => void>();
let voiceMemory: boolean | null = null;
function subscribeVoice(onChange: () => void) {
  voiceBus.add(onChange);
  return () => { voiceBus.delete(onChange); };
}
function readVoice() {
  if (voiceMemory !== null) return voiceMemory;
  try { return sessionStorage.getItem("forge-v2-voice") !== "0"; }
  catch { return true; }
}
function writeVoice(on: boolean) {
  voiceMemory = on;
  try { sessionStorage.setItem("forge-v2-voice", on ? "1" : "0"); } catch { /* Typing still works without storage. */ }
  for (const notify of voiceBus) notify();
}

function stateLabel(state: string) {
  if (state === "intro") return "Introduction";
  if (state === "asking") return "In progress";
  if (state === "rating") return "Rating";
  if (state === "complete") return "Complete";
  return state;
}

export function InterviewV2Lobby({ sessions, staff = false }: {
  sessions: { id: string; profile_id: ProfileId; state: string; created_at: string }[];
  staff?: boolean;
}) {
  const router = useRouter();
  const [profileId, setProfileId] = useState<ProfileId>("cs_degree");
  const [notice, setNotice] = useState<V2Code | null>(null);
  const [busy, setBusy] = useState(false);
  const voice = useSyncExternalStore(subscribeVoice, readVoice, () => true);
  const muted = useSyncExternalStore(subscribeMute, readMute, () => false);
  const savedInterviewer = useSyncExternalStore(subscribeLooks, () => readStoredLook(interviewerLookKey), () => null);
  const savedInterviewee = useSyncExternalStore(subscribeLooks, () => readStoredLook(intervieweeLookKey), () => null);
  const professor = v2Profiles[profileId].interviewer === "professor";
  const interviewerLook = savedInterviewer ?? (professor ? "female" : "male");
  const intervieweeLook = savedInterviewee ?? "male";
  const [hidden, setHidden] = useState<string[]>([]);
  function chooseVoice(on: boolean) {
    writeVoice(on);
  }
  function chooseLook(who: "interviewer" | "interviewee", look: InterviewLook) {
    writeLook(who === "interviewer" ? interviewerLookKey : intervieweeLookKey, look);
  }
  return <div className={styles.lobby}>
    <form className={`${styles.panel} ${styles.setup}`} onSubmit={async event => {
      event.preventDefault();
      if (busy) return;
      setBusy(true);
      try {
        const result = await startSession({ profileId });
        setNotice(result.code);
        if (result.view) router.push(`/interviews-v2/${result.view.session.id}`);
      } catch { setNotice("unavailable"); }
      finally { setBusy(false); }
    }}>
      <h2>Choose who you are practicing as</h2>
      <fieldset className={styles.roles} id="v2-profile">
        <legend>Role</legend>
        {Object.entries(v2Profiles).map(([id, profile]) => <label key={id} className={styles.role}>
          <input type="radio" name="profile" value={id} checked={profileId === id} disabled={busy} onChange={() => setProfileId(id as ProfileId)} />
          <span><strong>{profile.label}</strong></span>
        </label>)}
      </fieldset>
      <label className={styles.optin}><input type="checkbox" checked={voice} disabled={busy} aria-describedby="v2-voice-note" onChange={event => chooseVoice(event.target.checked)} /> Use the microphone for my answers</label>
      <p className={styles.fine} id="v2-voice-note">The browser may send audio to its speech service. This app stores no audio. Only text you insert and then send is saved.</p>
      {!voice && <p className={styles.warn} role="status">Voice recording will not work if this is unticked.</p>}
      <button className="primary-button" disabled={busy}>Start interview</button>
      {staff && <p className={styles.staff}><Link href="/interviews-v2/bank">Edit the question bank</Link></p>}
      {notice && <p className={styles.notice} role="status">{v2Notices[notice]}</p>}
      <section className={styles.preflight} aria-labelledby="v2-settings-heading">
        <h3 id="v2-settings-heading">Interview settings</h3>
        <fieldset className={styles.cast}>
          <legend>Appearance</legend>
          <div className={styles.castRow}>
            <span>Interviewer</span>
            <label><input type="radio" name="v2-lobby-interviewer-look" value="male" checked={interviewerLook === "male"} disabled={busy} onChange={() => chooseLook("interviewer", "male")} /> Male</label>
            <label><input type="radio" name="v2-lobby-interviewer-look" value="female" checked={interviewerLook === "female"} disabled={busy} onChange={() => chooseLook("interviewer", "female")} /> Female</label>
          </div>
          <div className={styles.castRow}>
            <span>You</span>
            <label><input type="radio" name="v2-lobby-interviewee-look" value="male" checked={intervieweeLook === "male"} disabled={busy} onChange={() => chooseLook("interviewee", "male")} /> Male</label>
            <label><input type="radio" name="v2-lobby-interviewee-look" value="female" checked={intervieweeLook === "female"} disabled={busy} onChange={() => chooseLook("interviewee", "female")} /> Female</label>
          </div>
        </fieldset>
        <label className={styles.optin}>
          <input type="checkbox" checked={muted} disabled={busy} aria-describedby="v2-mute-note" onChange={event => writeMute(event.target.checked)} />
          Mute interviewer
        </label>
        <p className={styles.fine} id="v2-mute-note">These apply when the interview starts. You can change them again in the room.</p>
      </section>
    </form>
    <section className={styles.panel} aria-labelledby="v2-sessions-heading">
      <h2 id="v2-sessions-heading">Your sessions</h2>
      {sessions.filter(session => !hidden.includes(session.id)).length === 0 && <p className={styles.empty}>No simulator v2 sessions yet.</p>}
      <ul className={styles.sessions}>{sessions.filter(session => !hidden.includes(session.id)).map(session => <li className={styles.sessionItem} key={session.id}>
        <Link className={styles.sessionLink} href={`/interviews-v2/${session.id}`}>
          <span className={styles.sessionCopy}>
            <strong>{v2Profiles[session.profile_id].label}</strong>
            <span>{stateLabel(session.state)} · {String(session.created_at).slice(0, 10)}</span>
          </span>
        </Link>
        <button type="button" className={styles.sessionDelete} disabled={busy} onClick={async () => {
          if (!window.confirm("Delete this session? Its answers and feedback will be removed.")) return;
          setBusy(true);
          try {
            const result = await deleteSession({ id: session.id });
            setNotice(result.code === "ok" ? null : result.code);
            if (result.code === "ok") {
              setHidden(current => [...current, session.id]);
              router.refresh();
            }
          } catch { setNotice("unavailable"); }
          finally { setBusy(false); }
        }}>Delete</button>
      </li>)}</ul>
    </section>
  </div>;
}
