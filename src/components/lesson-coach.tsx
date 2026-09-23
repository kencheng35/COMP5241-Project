"use client";
import { useState, useTransition } from "react";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { askCoach } from "@/app/learning/actions";

export function LessonCoach({ id }: { id: string }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  return <section className="learning-section lesson-coach"><h2><MessageCircle size={22} /> Learning coach</h2><p className="privacy-note">AI responses can be wrong. Do not share personal information. This conversation is not saved to your account and disappears when you leave this page.</p><div aria-live="polite" aria-busy={pending}>{messages.map((message, index) => <div key={index} className="coach-message"><strong>{message.role === "user" ? "You" : "Coach"}</strong><p>{message.content}</p></div>)}</div><form className="learning-form" onSubmit={event => { event.preventDefault(); const conversation = [...messages.slice(-10), { role: "user" as const, content: question.trim() }]; startTransition(async () => { setError(""); const result = await askCoach(id, conversation); if (result.error) setError(result.error); else if (result.reply) { setMessages([...conversation, { role: "assistant", content: result.reply }]); setQuestion(""); } }); }}><label>Ask about this lesson<textarea value={question} maxLength={1200} required disabled={pending} onChange={event => setQuestion(event.target.value)} /></label><div className="player-navigation"><button className="auth-submit" disabled={pending || !question.trim()}><Send size={17} />{pending ? "Thinking..." : "Ask coach"}</button><button className="secondary-button" type="button" disabled={pending || !messages.length} onClick={() => { setMessages([]); setError(""); }}><Trash2 size={17} />Clear conversation</button></div></form>{error && <p role="alert" className="form-notice notice-error">{error}</p>}</section>;
}