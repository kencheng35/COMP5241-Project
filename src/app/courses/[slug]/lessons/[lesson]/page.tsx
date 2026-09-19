"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Bookmark, CheckCircle2, Lightbulb } from "lucide-react";
import { useState } from "react";
import { LearnerShell } from "@/components/learner-shell";

export default function Lesson() {
  const [saved, setSaved] = useState(false); const [complete, setComplete] = useState(false);
  return <LearnerShell active="/courses/ai-fluency"><div className="lesson-page"><div className="lesson-toolbar"><Link href="/courses/ai-fluency"><ArrowLeft size={15} /> Course outline</Link><button className={saved ? "saved" : ""} onClick={() => setSaved(!saved)}><Bookmark size={16} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save lesson"}</button></div><article className="lesson-article"><span className="eyebrow">LESSON 3 · BRANCHING SCENARIO</span><h1>Delegate with judgment.</h1><p className="lesson-lead">Good delegation is not handing over the most work. It is assigning work with a clear boundary, useful context, and a way to verify the result.</p><div className="lesson-callout"><Lightbulb size={22} /><div><strong>A useful boundary</strong><p>Ask: what is reversible, what carries risk, and what evidence would make the output trustworthy?</p></div></div><h2>Try this before you delegate</h2><ol><li>Name the outcome in observable terms.</li><li>Describe constraints the agent cannot infer.</li><li>Choose a small sample and review it first.</li><li>Define checks before scaling the work.</li></ol><div className="lesson-actions">{complete && <div className="success-inline"><CheckCircle2 size={17} /> Lesson completed. Your progress is saved.</div>}<button onClick={() => setComplete(true)} className="auth-submit">Mark complete <ArrowRight size={17} /></button></div></article></div></LearnerShell>;
}