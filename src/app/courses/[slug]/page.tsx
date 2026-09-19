import Link from "next/link";
import { ArrowLeft, Award, Check, Circle, Clock, Play } from "lucide-react";
import { LearnerShell } from "@/components/learner-shell";

const lessons = ["Think before you prompt", "Write a useful specification", "Delegate with judgment", "Review what AI returns", "Ship with accountability"];

export default async function Course({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const known = slug === "ai-fluency";
  return <LearnerShell active="/courses/ai-fluency"><div className="portal-page"><Link href="/catalog" className="back-link"><ArrowLeft size={15} /> Catalog</Link><section className="course-banner"><div><span className="eyebrow">{known ? "AI & SOFTWARE · FOUNDATION" : "FEATURED COURSE"}</span><h1>{known ? "AI Fluency for Builders" : slug.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ")}</h1><p>Build practical judgment through short concepts, realistic decisions, and guided reflection.</p><div className="course-facts"><span><Clock size={15} /> 54 minutes</span><span><Award size={15} /> Certificate included</span></div></div><div className="course-progress-ring"><strong>40%</strong><span>complete</span></div></section><section className="lesson-list-section"><div className="section-title"><div><span className="eyebrow">COURSE PATH</span><h2>Five focused lessons</h2></div></div><div className="course-lesson-list">{lessons.map((lesson, index) => <Link href={`/courses/${slug}/lessons/${index + 1}`} key={lesson} className={index === 2 ? "current" : ""}><span className={`lesson-status ${index < 2 ? "complete" : ""}`}>{index < 2 ? <Check size={15} /> : <Circle size={15} />}</span><span><strong>{lesson}</strong><small>{index === 1 ? "Interactive exercise" : index === 2 ? "Branching scenario" : "Concept and reflection"} · {8 + index * 2} min</small></span>{index === 2 && <Play size={17} fill="currentColor" />}</Link>)}</div></section></div></LearnerShell>;
}