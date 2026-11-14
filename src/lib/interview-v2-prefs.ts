export type InterviewLook = "male" | "female";

export const interviewerLookKey = "forge-v2-interviewer-look";
export const intervieweeLookKey = "forge-v2-interviewee-look";
export const muteKey = "forge-v2-mute";

const lookBus = new Set<() => void>();
const lookMemory = new Map<string, InterviewLook>();
const muteBus = new Set<() => void>();
let muteMemory: boolean | null = null;

function storedLook(key: string): InterviewLook | null {
  try {
    const value = sessionStorage.getItem(key);
    return value === "male" || value === "female" ? value : null;
  } catch { return null; }
}

export function subscribeLooks(onChange: () => void) {
  lookBus.add(onChange);
  return () => { lookBus.delete(onChange); };
}

export function readStoredLook(key: string) {
  return lookMemory.get(key) ?? storedLook(key);
}

export function writeLook(key: string, look: InterviewLook) {
  lookMemory.set(key, look);
  try { sessionStorage.setItem(key, look); } catch { /* The scene still changes for this visit. */ }
  for (const notify of lookBus) notify();
}

export function subscribeMute(onChange: () => void) {
  muteBus.add(onChange);
  return () => { muteBus.delete(onChange); };
}

export function readMute() {
  if (muteMemory !== null) return muteMemory;
  try { return sessionStorage.getItem(muteKey) === "1"; }
  catch { return false; }
}

export function writeMute(on: boolean) {
  muteMemory = on;
  try { sessionStorage.setItem(muteKey, on ? "1" : "0"); } catch { /* Mute still applies for this visit. */ }
  for (const notify of muteBus) notify();
}
