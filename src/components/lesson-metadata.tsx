"use client";

import { useState } from "react";
import { AUDIENCES, DIFFICULTIES, FAMILIES, TOPICS, TOPIC_LABELS, readMetadata, subjectSelection, topicFamily } from "@/lib/curriculum";
import styles from "./lesson-metadata.module.css";

export function LessonMetadata({ subject, metadata }: { subject: string; metadata?: unknown }) {
  const value = readMetadata(subject, metadata);
  return <section className={styles.metadata} aria-label="Curriculum metadata">
    <h2>Learning information</h2>
    <dl><dt>Subject</dt><dd>{subject || "Not specified"}</dd>
      <dt>Topic</dt><dd>{value ? TOPIC_LABELS[value.topic] : "Not specified"}</dd>
      <dt>Audience</dt><dd>{value ? AUDIENCES[value.audience] : "Not specified"}</dd>
      <dt>Difficulty</dt><dd>{value ? DIFFICULTIES[value.difficulty] : "Not specified"}</dd></dl>
    <h3>Learning outcomes</h3>{value ? <ul>{value.outcomes.map((outcome, index) => <li key={index}>{outcome}</li>)}</ul> : <p>Not specified</p>}
    <h3>Prerequisites</h3>{value ? value.prerequisites.length ? <ul>{value.prerequisites.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>None specified by author</p> : <p>Not specified</p>}
    <p className="privacy-note">Audience describes suitability, not permission to access a lesson.</p>
  </section>;
}

export function MetadataFields({ subject, metadata, onChange }: { subject: string; metadata?: unknown; onChange: (subject: string, metadata: unknown) => void }) {
  const value = metadata && typeof metadata === "object" ? metadata as Record<string, unknown> : {};
  const text = (key: string) => typeof value[key] === "string" ? value[key] as string : "";
  const lines = (key: string) => Array.isArray(value[key]) ? value[key].join("\n") : "";
  const change = (key: string, next: unknown) => onChange(subject, { version: 1, prerequisites: [], ...value, [key]: next });
  const family = subjectSelection(subject)?.family;
  return <fieldset className={styles.fields}><legend>Curriculum metadata (required for saving)</legend>
    <p>Choose explicit values. Legacy information is not inferred. Use 1–8 outcomes and 0–8 prerequisites, one per line, at most 240 characters each. Leaving prerequisites empty explicitly means “None specified by author”.</p>
    <label>Subject<select name="subject" required value={subject} onChange={event => onChange(event.target.value, { ...value, version: 1, topic: "" })}>
      <option value="">Choose a subject</option>{subject && !Object.values(FAMILIES).includes(subject as typeof FAMILIES[keyof typeof FAMILIES]) && <option value={subject}>{subject} (legacy — choose a canonical subject to save)</option>}
      {Object.entries(FAMILIES).map(([key, label]) => <option key={key} value={label}>{label}</option>)}
    </select></label>
    <label>Curriculum topic<select name="curriculumTopic" required value={text("topic")} onChange={event => change("topic", event.target.value)}>
      <option value="">Choose a topic</option>{TOPICS.filter(topic => topicFamily(topic) === family).map(topic => <option key={topic} value={topic}>{TOPIC_LABELS[topic]}</option>)}
    </select></label>
    <label>Audience<select name="audience" required value={text("audience")} onChange={event => change("audience", event.target.value)}><option value="">Choose an audience</option>{Object.entries(AUDIENCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label>Difficulty<select name="difficulty" required value={text("difficulty")} onChange={event => change("difficulty", event.target.value)}><option value="">Choose a difficulty</option>{Object.entries(DIFFICULTIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label>Learning outcomes<textarea name="outcomes" required rows={3} maxLength={1927} value={lines("outcomes")} onChange={event => change("outcomes", event.target.value.split("\n"))} /></label>
    <label>Prerequisites<textarea name="prerequisites" rows={2} maxLength={1927} value={lines("prerequisites")} onChange={event => change("prerequisites", event.target.value === "" ? [] : event.target.value.split("\n"))} /></label>
  </fieldset>;
}

export function GenerationMetadataFields() {
  const [selection, setSelection] = useState<{ subject: string; metadata?: unknown }>({ subject: "" });
  return <MetadataFields {...selection} onChange={(subject, metadata) => setSelection({ subject, metadata })} />;
}
