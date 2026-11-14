import { NextResponse } from "next/server";
import { z } from "zod";
import { interviewerSsml } from "@/lib/interviewer-speech";
import { currentUser } from "@/lib/learning-server";

const bodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
  voice: z.enum(["male", "female"]),
});
const regionPattern = /^[a-z0-9]+$/;

export async function POST(request: Request) {
  try { await currentUser(); }
  catch { return NextResponse.json({ error: "Authentication required." }, { status: 401 }); }
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim().toLowerCase();
  if (!key || !region || !regionPattern.test(region)) {
    return NextResponse.json({ error: "Speech is not configured." }, { status: 503 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  let response: Response;
  try {
    response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "User-Agent": "forge-interview",
      },
      body: interviewerSsml(parsed.data.text, parsed.data.voice),
    });
  } catch {
    return NextResponse.json({ error: "Speech failed." }, { status: 502 });
  }
  if (!response.ok) return NextResponse.json({ error: "Speech failed." }, { status: 502 });
  const audio = await response.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
