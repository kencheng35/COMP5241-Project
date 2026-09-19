"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Code2,
  Flame,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Play,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  Users,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { logOut } from "./auth/actions";

type Role = "learner" | "instructor";

const modules = [
  { title: "Think before you prompt", type: "Concept", time: "8 min", complete: true },
  { title: "Write a useful specification", type: "Interactive", time: "12 min", complete: true },
  { title: "Delegate with judgment", type: "Scenario", time: "10 min", active: true },
  { title: "Review what AI returns", type: "Code lab", time: "18 min" },
  { title: "Ship with accountability", type: "Reflection", time: "6 min" },
];

const navItems = [
  { label: "Today", icon: LayoutDashboard, href: "/dashboard" },
  { label: "My learning", icon: BookOpen, href: "/courses/ai-fluency" },
  { label: "Practice lab", icon: Code2, href: "/courses/ai-fluency/lessons/3" },
  { label: "Course catalog", icon: Users, href: "/catalog" },
];

export default function Home() {
  const [role, setRole] = useState<Role>("learner");
  const [mobileNav, setMobileNav] = useState(false);
  const [completed, setCompleted] = useState(2);
  const [answer, setAnswer] = useState<string | null>(null);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachMessage, setCoachMessage] = useState("");
  const [coachReply, setCoachReply] = useState("");
  const [generated, setGenerated] = useState(false);

  const submitCoachMessage = () => {
    if (!coachMessage.trim()) return;
    setCoachReply(
      "Start by naming the outcome, constraints, and evidence of success. For this scenario, what must be true before you trust the generated migration?",
    );
    setCoachMessage("");
  };

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Zap size={18} strokeWidth={2.6} /></div>
          <span className="brand-name">FORGE</span>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation">
            <X size={19} />
          </button>
        </div>

        <Link href="/profile" className="profile-block">
          <div className="avatar">AL</div>
          <div>
            <strong>Ken Cheng</strong>
            <span>Product explorer</span>
          </div>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item, index) => (
            <Link className={index === 0 ? "nav-item active" : "nav-item"} href={item.href} key={item.label}>
              <item.icon size={19} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="streak-box">
            <Flame size={21} />
            <div><strong>6 day streak</strong><span>Keep your momentum</span></div>
          </div>
          <Link href="/progress" className="nav-item"><CircleHelp size={19} />Progress & awards</Link>
          <form action={logOut}><button className="nav-item" type="submit">Log out</button></form>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)} aria-label="Open navigation">
            <Menu size={21} />
          </button>
          <div className="search-box">
            <Search size={18} />
            <input aria-label="Search courses" placeholder="Search your learning" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="role-switch" aria-label="Choose workspace">
            <button className={role === "learner" ? "selected" : ""} onClick={() => setRole("learner")}>Learn</button>
            <button className={role === "instructor" ? "selected" : ""} onClick={() => setRole("instructor")}>Create</button>
          </div>
          <Link href="/profile" className="avatar avatar-small" aria-label="Account profile">AL</Link>
        </header>

        {role === "learner" ? (
          <LearnerView
            completed={completed}
            setCompleted={setCompleted}
            answer={answer}
            setAnswer={setAnswer}
            openCoach={() => setCoachOpen(true)}
          />
        ) : (
          <InstructorView generated={generated} setGenerated={setGenerated} />
        )}
      </section>

      {coachOpen && (
        <div className="coach-panel" role="dialog" aria-label="AI learning coach">
          <div className="coach-head">
            <div className="coach-identity"><span><Sparkles size={17} /></span><div><strong>Forge Coach</strong><small>Adapting to your goal</small></div></div>
            <button className="icon-button" onClick={() => setCoachOpen(false)} aria-label="Close coach"><X size={19} /></button>
          </div>
          <div className="coach-body">
            <div className="coach-intro"><Bot size={22} /><p>You are preparing to work in product teams. I’ll use practical examples and skip the syntax deep-dives.</p></div>
            {coachReply && <div className="coach-reply">{coachReply}</div>}
          </div>
          <div className="coach-suggestions">
            <button onClick={() => setCoachMessage("Give me a real-world example")}>Real-world example</button>
            <button onClick={() => setCoachMessage("Quiz me on delegation")}>Quiz me</button>
          </div>
          <div className="coach-input">
            <input
              value={coachMessage}
              onChange={(event) => setCoachMessage(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submitCoachMessage()}
              placeholder="Ask about this lesson..."
              aria-label="Message your learning coach"
            />
            <button onClick={submitCoachMessage} aria-label="Send message"><Send size={18} /></button>
          </div>
        </div>
      )}
      {mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close navigation overlay" />}
    </main>
  );
}

function LearnerView({
  completed,
  setCompleted,
  answer,
  setAnswer,
  openCoach,
}: {
  completed: number;
  setCompleted: (value: number) => void;
  answer: string | null;
  setAnswer: (value: string) => void;
  openCoach: () => void;
}) {
  const progress = Math.round((completed / modules.length) * 100);

  return (
    <div className="page-content">
      <section className="welcome-row">
        <div><span className="eyebrow">SATURDAY, 19 SEPTEMBER</span><h1>Good morning, Ken.</h1><p>One focused session will keep your learning streak alive.</p></div>
        <button className="coach-button" onClick={openCoach}><Sparkles size={17} /> Ask your AI coach</button>
      </section>

      <section className="learning-grid">
        <article className="course-focus">
          <div className="course-image">
            <Image
              src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=85"
              alt="Team collaborating around a planning board"
              fill
              sizes="(max-width: 900px) 100vw, 55vw"
              priority
            />
            <span className="image-label">IN PROGRESS</span>
          </div>
          <div className="course-copy">
            <div className="course-meta"><span>AI FLUENCY</span><span>•</span><span>FOUNDATION</span></div>
            <h2>Build better with AI,<br />without losing judgment.</h2>
            <p>Learn to delegate, describe, discern and verify through decisions that feel like real product work.</p>
            <div className="progress-row"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div>
            <button className="primary-button" onClick={() => setCompleted(Math.min(completed + 1, modules.length))}>
              <Play size={16} fill="currentColor" /> Continue lesson <ArrowRight size={17} />
            </button>
          </div>
        </article>

        <aside className="today-panel">
          <div className="section-title"><div><span className="eyebrow">YOUR PATH</span><h3>Today’s session</h3></div><span className="time-pill">28 min</span></div>
          <div className="module-list">
            {modules.map((module, index) => {
              const isComplete = index < completed;
              const isActive = index === completed;
              return (
                <button className={`module-row ${isActive ? "current" : ""}`} key={module.title} onClick={() => setCompleted(Math.max(completed, index + 1))}>
                  <span className={`module-state ${isComplete ? "done" : ""}`}>{isComplete ? <Check size={14} /> : index + 1}</span>
                  <span className="module-copy"><strong>{module.title}</strong><small>{module.type} · {module.time}</small></span>
                  {isActive && <Play size={16} fill="currentColor" />}
                </button>
              );
            })}
          </div>
        </aside>
      </section>

      <section className="practice-section">
        <div className="practice-heading"><div><span className="eyebrow">DECISION LAB</span><h2>What would you do?</h2></div><span className="scenario-count">03 / 05</span></div>
        <div className="scenario-layout">
          <div className="scenario-copy">
            <span className="scenario-tag"><MessageSquareText size={15} /> TEAM SCENARIO</span>
            <blockquote>“We need to migrate 8,000 customer records by Friday. Should I ask the AI agent to handle the whole thing?”</blockquote>
            <p>Your teammate is eager to move fast. The data includes inconsistent dates and some sensitive fields.</p>
          </div>
          <div className="decision-options">
            {[
              ["delegate", "Delegate it", "Give the agent access and review the final count."],
              ["frame", "Frame it first", "Define constraints, sample the data, and agree on checks."],
              ["manual", "Do it manually", "Avoid AI because customer data is involved."],
            ].map(([id, title, copy]) => (
              <button className={`decision ${answer === id ? "chosen" : ""}`} key={id} onClick={() => setAnswer(id)}>
                <span className="radio-dot" /><span><strong>{title}</strong><small>{copy}</small></span>
              </button>
            ))}
            {answer && (
              <div className={answer === "frame" ? "feedback correct" : "feedback"}>
                <strong>{answer === "frame" ? "Sound judgment" : "Consider the middle path"}</strong>
                <p>{answer === "frame" ? "You kept human accountability while using AI where it adds leverage." : "The goal is not maximum or zero delegation. Reduce uncertainty before assigning the work."}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function InstructorView({ generated, setGenerated }: { generated: boolean; setGenerated: (value: boolean) => void }) {
  const [topic, setTopic] = useState("Responsible AI-assisted software development");

  return (
    <div className="page-content studio-page">
      <section className="studio-heading">
        <div><span className="eyebrow">INSTRUCTOR STUDIO</span><h1>Shape a learning experience.</h1><p>Start with your teaching intent. Forge will propose a structure you can challenge and refine.</p></div>
        <button className="secondary-button"><Settings2 size={17} /> Course settings</button>
      </section>

      <section className="studio-grid">
        <div className="builder-panel">
          <div className="builder-head"><span><WandSparkles size={19} /> GENERATE WITH AI</span><small>Draft, not autopilot</small></div>
          <label htmlFor="topic">What should learners be able to do?</label>
          <textarea id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
          <div className="field-row">
            <div><label>Audience</label><button className="select-button">Mixed disciplines <ChevronDown size={16} /></button></div>
            <div><label>Duration</label><button className="select-button">45 minutes <ChevronDown size={16} /></button></div>
          </div>
          <div className="focus-row"><span>Prioritise</span><button className="chip active">Practice</button><button className="chip active">Reflection</button><button className="chip">Theory</button></div>
          <button className="generate-button" onClick={() => setGenerated(true)}><Sparkles size={18} /> Generate course outline</button>
        </div>

        <div className="insight-panel">
          <div className="section-title"><div><span className="eyebrow">LIVE COHORT</span><h3>Learning pulse</h3></div><button className="icon-button" aria-label="Open analytics"><BarChart3 size={19} /></button></div>
          <div className="big-stat"><strong>84%</strong><span>weekly participation</span></div>
          <div className="metric-bars">
            <div><span>Concepts</span><i><b style={{ width: "88%" }} /></i><strong>88</strong></div>
            <div><span>Scenarios</span><i><b style={{ width: "71%" }} /></i><strong>71</strong></div>
            <div><span>Reflection</span><i><b style={{ width: "64%" }} /></i><strong>64</strong></div>
          </div>
          <div className="attention-note"><Target size={20} /><div><strong>6 learners need a nudge</strong><span>Most paused before the first scenario.</span></div><ArrowRight size={17} /></div>
        </div>
      </section>

      <section className={`outline-section ${generated ? "outline-ready" : ""}`}>
        <div className="outline-head"><div><span className="eyebrow">COURSE CANVAS</span><h2>{generated ? "A first draft, ready for your judgment." : "Your outline will appear here."}</h2></div>{generated && <button className="primary-button"><Plus size={16} /> Add activity</button>}</div>
        {generated ? (
          <div className="outline-list">
            {[
              ["01", "Where AI creates leverage", "Concept + quick poll", "8 min"],
              ["02", "The delegation boundary", "Branching scenario", "12 min"],
              ["03", "Write a verifiable brief", "Guided practice", "15 min"],
              ["04", "Review, test, take ownership", "Code critique + reflection", "10 min"],
            ].map(([number, title, format, time]) => (
              <div className="outline-row" key={number}><span>{number}</span><div><strong>{title}</strong><small>{format}</small></div><em>{time}</em><button className="icon-button" aria-label={`Edit ${title}`}><Settings2 size={16} /></button></div>
            ))}
          </div>
        ) : (
          <div className="empty-canvas"><Sparkles size={25} /><span>Your goals stay in control of every generated activity.</span></div>
        )}
      </section>
    </div>
  );
}