import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, SlidersHorizontal } from "lucide-react";
import { LearnerShell } from "@/components/learner-shell";

const courses = [
  { slug: "ai-fluency", title: "AI Fluency for Builders", subject: "AI & software", level: "Foundation", lessons: 5, time: "54 min", image: "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=900&q=80" },
  { slug: "product-thinking", title: "Product Thinking in Practice", subject: "Product skills", level: "Beginner", lessons: 6, time: "72 min", image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80" },
  { slug: "team-communication", title: "Communicate in Technical Teams", subject: "Soft skills", level: "All levels", lessons: 4, time: "46 min", image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80" },
];

export default function Catalog() {
  return <LearnerShell active="/catalog"><div className="portal-page"><header className="portal-heading"><div><span className="eyebrow">COURSE CATALOG</span><h1>Find your next useful skill.</h1><p>Short paths designed for mixed backgrounds and practical goals.</p></div><button className="filter-button"><SlidersHorizontal size={17} /> Filters</button></header><div className="subject-chips"><button className="active">All subjects</button><button>AI & software</button><button>Product skills</button><button>Communication</button></div><section className="catalog-grid">{courses.map((course, index) => <article className="catalog-card" key={course.slug}><div className="catalog-image"><Image src={course.image} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" priority={index === 0} /><span>{index === 0 ? "ENROLLED" : "OPEN"}</span></div><div className="catalog-copy"><small>{course.subject} · {course.level}</small><h2>{course.title}</h2><div><span><BookOpen size={14} /> {course.lessons} lessons</span><span><Clock size={14} /> {course.time}</span></div><Link href={`/courses/${course.slug}`}>{index === 0 ? "Continue course" : "View course"}<ArrowRight size={16} /></Link></div></article>)}</section></div></LearnerShell>;
}