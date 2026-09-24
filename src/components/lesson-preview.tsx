"use client";

import { useRef } from "react";
import { Eye, X } from "lucide-react";
import type { LessonContent } from "@/lib/learning";

export function LessonPreview({ content }: { content: LessonContent }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  return <>
    <button ref={trigger} type="button" className="secondary-button" onClick={() => dialog.current?.showModal()}><Eye size={17} />Preview lesson</button>
    <dialog ref={dialog} className="lesson-preview" aria-label="Learner-facing lesson preview" onClose={() => trigger.current?.focus()}>
      <header><span className="eyebrow">LESSON PREVIEW</span><button type="button" className="icon-button" aria-label="Close preview" onClick={() => dialog.current?.close()}><X size={18} /></button></header>
      <h2>{content.title || "Untitled lesson"}</h2><p>{content.summary}</p>
      {content.slides.map((slide, index) => <section key={index}><span className="eyebrow">SLIDE {index + 1}</span><h3>{slide.title}</h3><p>{slide.body}</p><blockquote>{slide.example}</blockquote></section>)}
      <section><span className="eyebrow">PRACTICE</span><h3>{content.activity.prompt}</h3><ol>{content.activity.steps.map((step, index) => <li key={index}>{step}</li>)}</ol></section>
      <section><span className="eyebrow">FINAL QUIZ</span>{content.questions.map((question, index) => <div key={index}><h3>{index + 1}. {question.prompt}</h3><ol type="A">{question.options.map((option, optionIndex) => <li key={optionIndex}>{option}</li>)}</ol></div>)}</section>
    </dialog>
  </>;
}