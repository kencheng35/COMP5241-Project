export const interviewerVoices = {
  male: "en-US-GuyNeural",
  female: "en-US-JennyNeural",
} as const;
export type InterviewerVoice = keyof typeof interviewerVoices;

export function escapeSsml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function interviewerSsml(text: string, voice: InterviewerVoice) {
  return `<speak version="1.0" xml:lang="en-US"><voice name="${interviewerVoices[voice]}">${escapeSsml(text)}</voice></speak>`;
}
