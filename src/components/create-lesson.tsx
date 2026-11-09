"use client";

import { lazy,Suspense,useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createManualLesson, updateLesson, type ActionState } from "@/app/learning/actions";
import { authorLessonSchema, emptyAuthorLesson, type AuthorLesson } from "@/lib/slide-lesson";
import { blankPresentation, MAX_PRESENTATION_SLIDES, MAX_TEXTBOX_CHARACTERS, type PresentationAuthor } from "@/lib/presentation";
import { beginPresentationDraft, discardPresentationDraft, uploadPresentationImage } from "@/app/presentation/actions";
import { fitPdfPage, renderPdfPages, validatePdfFile } from "@/lib/pdf-import";
const PresentationLessonEditor=lazy(()=>import("./presentation-editor").then(m=>({default:m.PresentationLessonEditor})));

// Mount inside Suspense so focus moves only after the lazy editor is ready,
// never back to the now-hidden Preview slides button.
function UploadPreview({draft,draftId,onSaveLock}:{draft:PresentationAuthor;draftId:string;onSaveLock:(locked:boolean)=>void}) {
  const preview=useRef<HTMLDivElement>(null);
  useEffect(()=>{preview.current?.querySelector<HTMLInputElement>(".presentation-document-bar input")?.focus();},[]);
  return <div ref={preview}><PresentationLessonEditor initial={draft} initialDraftId={draftId} onSaveLock={onSaveLock}/></div>;
}

export function UploadLessonPage() {
  const [fileName, setFileName] = useState("");
  const [importerOpen, setImporterOpen] = useState(true);
  const [draft, setDraft] = useState<{presentation:PresentationAuthor;draftId:string} | null>(null);
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const epoch = useRef(0);
  const locked = useRef(false);
  const [saveLocked, setSaveLocked] = useState(false);
  useEffect(() => () => { epoch.current++; }, []);
  function invalidate() {
    epoch.current++;
    setDraft(null);
    setError("");
  }

  async function readFile(form: FormData) {
    if (inFlight.current || locked.current) return;
    inFlight.current = true;
    const request = ++epoch.current;
    setBusy(true);
    setDraft(null);
    setError("");
    let imageDraftId = "";
    let complete = false;
    try {
      const file = form.get("material");
      if (!(file instanceof File)) throw new Error("Choose a PDF file.");
      validatePdfFile(file);
      const presentation = blankPresentation();
      const slides:PresentationAuthor["document"]["slides"] = [];
      const title = file.name.replace(/\.pdf$/i,"").trim().slice(0,120);
      presentation.title = title.length >= 3 ? title : "Imported PDF lesson";
      const totalPages = await renderPdfPages(file,async(pageNumber,image) => {
        if(request!==epoch.current)throw new Error("PDF import canceled.");
        if(!imageDraftId){
          const begun=await beginPresentationDraft();
          if(!begun.id)throw new Error(begun.error??"Private image storage is unavailable.");
          imageDraftId=begun.id;
        }
        const uploadForm=new FormData();
        uploadForm.set("draftId",imageDraftId);
        uploadForm.set("image",image);
        const uploaded=await uploadPresentationImage(uploadForm);
        if(!uploaded.id||!uploaded.width||!uploaded.height)throw new Error(uploaded.error??"Image upload failed.");
        const box=fitPdfPage(uploaded.width,uploaded.height);
        slides.push({
          id:crypto.randomUUID(),title:`Page ${pageNumber}`,background:"#ffffff",
          elements:[{id:crypto.randomUUID(),type:"image",assetId:uploaded.id,alt:`Imported PDF page ${pageNumber}`,
            ratio:uploaded.width/uploaded.height,...box,rotation:0}],
        });
      });
      if(request!==epoch.current)return;
      if(!imageDraftId||slides.length!==totalPages)throw new Error("Not every PDF page was imported. Nothing was saved.");
      presentation.document.slides=slides;
      if(!presentation.document.slides.length)throw new Error("The PDF contains no importable pages.");
      setDraft({presentation,draftId:imageDraftId});
      complete=true;
      setGeneration(value => value + 1);
      setImporterOpen(false);
    } catch (cause) {
      if(request===epoch.current)setError(cause instanceof Error?cause.message:"PDF import failed. Try the file again.");
    } finally {
      try {
        if(imageDraftId&&!complete){
          const cleanup=await discardPresentationDraft(imageDraftId);
          const message=cleanup.error;
          if(message&&request===epoch.current)setError(value=>value?`${value} Private page cleanup is pending; retry cleanup before importing again.`:message);
        }
      } catch {
        if(request===epoch.current)setError(value=>value?`${value} Private page cleanup could not be confirmed; retry cleanup before importing again.`:"Private page cleanup could not be confirmed; retry cleanup before importing again.");
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }

  return <section className={`learning-section presentation-upload-page${draft ? " presentation-upload-ready" : ""}`} aria-labelledby="upload-heading">
    <div className={draft ? "presentation-import-bar" : undefined}>
      <h2 id="upload-heading">{draft ? "Imported PDF" : "Upload a PDF"}</h2>
      {draft && <>
        <p title={fileName}><strong>{fileName}</strong> · {draft.presentation.document.slides.length} PDF page{draft.presentation.document.slides.length===1?"":"s"}</p>
        <button type="button" className="secondary-button" aria-expanded={importerOpen} aria-controls="upload-importer" disabled={busy || saveLocked} onClick={() => setImporterOpen(value => !value)}>{importerOpen ? "Close importer" : "Change file"}</button>
      </>}
    </div>
    <form id="upload-importer" className="learning-form" hidden={!!draft && !importerOpen} onSubmit={event => { event.preventDefault(); void readFile(new FormData(event.currentTarget)); }}>
      {draft && <p>Changing the PDF replaces this preview. Close the importer to keep editing.</p>}
      <p>PDF only. Each page is rendered in this browser as one image slide; pages keep their aspect ratio and are fitted and centered on the 960 × 540 canvas. Maximum upload: 4 MiB and 30 pages. Rendering is limited to 2,073,600 pixels per page, 40 million total page pixels, and 3,840 pixels per side. Each rendered page is uploaded through private lesson image storage. The original PDF is not stored or sent to AI. Protected, damaged, oversized or unsupported PDFs and pages that exceed image-storage limits are rejected.</p>
      <label>PDF file<input type="file" name="material" required disabled={busy || saveLocked} onChange={event => { setFileName(event.currentTarget.files?.[0]?.name ?? ""); invalidate(); }} accept=".pdf,application/pdf" /></label>
      <button className="primary-button" type="submit" disabled={busy || saveLocked}>{busy ? "Rendering PDF pages..." : "Import PDF pages"}</button>
    </form>
    {error && <p role="alert" className="form-notice notice-error">{error}</p>}
    {draft && <Suspense fallback={<p>Loading presentation editor…</p>}><UploadPreview key={generation} draft={draft.presentation} draftId={draft.draftId} onSaveLock={value => { locked.current = value; setSaveLocked(value); }} /></Suspense>}
  </section>;
}

export function SlideLessonEditor({ lessonId = "", version = 1, initial, onSaveLock }: { lessonId?: string; version?: number; initial?: AuthorLesson; onSaveLock?: (locked: boolean) => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<AuthorLesson>(initial ?? emptyAuthorLesson());
  const [index, setIndex] = useState(0);
  const [quizOn, setQuizOn] = useState((initial?.quiz.length ?? 0) > 0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [ack, setAck] = useState({ id: lessonId, version });
  const [success, setSuccess] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const inFlight = useRef(false);
  const blocked = useRef(false);
  const live = useRef(true);
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  useEffect(() => { if (error || success) notice.current?.focus(); }, [error, success]);
  const slide = draft.slides[index] ?? draft.slides[0];

  function updateSlide(patch: Partial<AuthorLesson["slides"][number]>) {
    setDraft({ ...draft, slides: draft.slides.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  }
  function updateStyle(patch: Partial<AuthorLesson["slides"][number]["style"]>) {
    updateSlide({ style: { ...slide.style, ...patch } });
  }

  async function save(intent: "save" | "publish") {
    if (inFlight.current || blocked.current) return;
    const quiz = quizOn ? draft.quiz : [];
    const payload = { ...draft, quiz };
    const parsed = authorLessonSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Complete the lesson before saving.");
      return;
    }
    setPending(true);
    inFlight.current = true;
    onSaveLock?.(true);
    setError("");
    setSuccess("");
    const form = new FormData();
    form.set("template", "slides");
    form.set("intent", intent);
    form.set("content", JSON.stringify(parsed.data));
    form.set("lessonId", ack.id);
    form.set("version", String(ack.version));
    try {
      const result: ActionState = ack.id ? await updateLesson({}, form) : await createManualLesson({}, form);
      if (!live.current) return;
      if (result.saveUncertain || !result.error && (!result.lessonId || !result.version)) {
        blocked.current = true; setUncertain(true);
        setError("Save outcome is unknown. Keep this input and check Your lessons in another tab before saving again.");
      } else if (result.error) setError(result.error);
      else {
        setAck({ id: result.lessonId!, version: result.version! });
        setSuccess(`${result.success ?? "Lesson saved."} Version ${result.version}.`);
        // Stay mounted with acknowledged ID/version for reliable repeated saves.
        // Refresh server history/review forms without a same-URL navigation reset.
        router.refresh();
      }
    } catch {
      if (!live.current) return;
      blocked.current = true; setUncertain(true);
      setError("Save outcome is unknown. Keep this input and check Your lessons in another tab before saving again.");
    } finally {
      inFlight.current = false;
      if (live.current) { setPending(false); onSaveLock?.(blocked.current); }
    }
  }

  return <div className="learning-form"><fieldset disabled={pending || uncertain}>
    <section className="slide-stage" aria-label="Slide preview" style={{ background: slide.style.background, color: slide.style.color, textAlign: slide.style.align }}>
      <div className="slide-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
      <div>
        <span className="eyebrow">{index + 1} / {draft.slides.length}</span>
        <h2 style={{ color: slide.style.color, fontSize: slide.style.size, textAlign: slide.style.align }}>{slide.title || "Slide title"}</h2>
        <p style={{ color: slide.style.color, fontSize: Math.max(16, slide.style.size - 6), textAlign: slide.style.align }}>{slide.body || "Slide body"}</p>
        <div className="player-navigation">
          <button type="button" className="secondary-button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
          <button type="button" className="secondary-button" disabled={index === draft.slides.length - 1} onClick={() => setIndex(index + 1)}>Next</button>
        </div>
      </div>
    </section>
    <label>Lesson title<input value={draft.title} maxLength={120} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
    <label>Audience<select value={draft.audience} onChange={event => setDraft({ ...draft, audience: event.target.value as AuthorLesson["audience"] })}>
      <option value="learners">University learners</option>
      <option value="instructors">Instructors</option>
      <option value="both">Learners and instructors</option>
    </select></label>
    <label>Difficulty<select value={draft.difficulty} onChange={event => setDraft({ ...draft, difficulty: event.target.value as AuthorLesson["difficulty"] })}>
      <option value="new">New</option>
      <option value="foundation">Foundation</option>
      <option value="intermediate">Intermediate</option>
      <option value="advanced">Advanced</option>
    </select></label>
    <h2>Slide {index + 1}</h2>
    <label>Title<textarea value={slide.title} maxLength={100} onChange={event => updateSlide({ title: event.target.value })} /></label>
    <label>Body<textarea value={slide.body} maxLength={MAX_TEXTBOX_CHARACTERS} onChange={event => updateSlide({ body: event.target.value })} /></label>
    <label>Text color<input type="color" value={slide.style.color} onChange={event => updateStyle({ color: event.target.value })} /></label>
    <label>Font size<select value={slide.style.size} onChange={event => updateStyle({ size: Number(event.target.value) as AuthorLesson["slides"][number]["style"]["size"] })}>
      <option value={18}>Small</option>
      <option value={24}>Medium</option>
      <option value={32}>Large</option>
      <option value={40}>Extra large</option>
    </select></label>
    <label>Text position<select value={slide.style.align} onChange={event => updateStyle({ align: event.target.value as AuthorLesson["slides"][number]["style"]["align"] })}>
      <option value="left">Left</option>
      <option value="center">Center</option>
      <option value="right">Right</option>
    </select></label>
    <label>Background color<input type="color" value={slide.style.background} onChange={event => updateStyle({ background: event.target.value })} /></label>
    <p>
      <button type="button" className="secondary-button" disabled={draft.slides.length <= 1} onClick={() => { setDraft({ ...draft, slides: draft.slides.filter((_, itemIndex) => itemIndex !== index) }); setIndex(Math.max(0, index - 1)); }}>Remove slide</button>
      <button type="button" className="secondary-button" disabled={draft.slides.length >= MAX_PRESENTATION_SLIDES} onClick={() => { setDraft({ ...draft, slides: [...draft.slides, { title: "", body: "", style: { ...slide.style } }] }); setIndex(draft.slides.length); }}>Add slide</button>
    </p>
    <label className="checkbox-field"><input type="checkbox" checked={quizOn} onChange={event => {
      const on = event.target.checked;
      setQuizOn(on);
      if (on && draft.quiz.length < 3) setDraft({ ...draft, quiz: Array.from({ length: 3 }, (_, questionIndex) => draft.quiz[questionIndex] ?? { prompt: "", options: ["", "", "", ""], correct: 0 }) });
    }} /> Include a quiz</label>
    {quizOn && <>
      {draft.quiz.map((question, questionIndex) => <fieldset key={questionIndex}>
        <legend>Question {questionIndex + 1}</legend>
        <label>Question<input value={question.prompt} maxLength={300} onChange={event => setDraft({ ...draft, quiz: draft.quiz.map((item, itemIndex) => itemIndex === questionIndex ? { ...item, prompt: event.target.value } : item) })} /></label>
        {question.options.map((option, optionIndex) => <label key={optionIndex}>Option {optionIndex + 1}<input value={option} maxLength={200} onChange={event => setDraft({ ...draft, quiz: draft.quiz.map((item, itemIndex) => itemIndex === questionIndex ? { ...item, options: item.options.map((choice, choiceIndex) => choiceIndex === optionIndex ? event.target.value : choice) } : item) })} /></label>)}
        <label>Correct option<select value={question.correct} onChange={event => setDraft({ ...draft, quiz: draft.quiz.map((item, itemIndex) => itemIndex === questionIndex ? { ...item, correct: Number(event.target.value) } : item) })}>
          {question.options.map((_, optionIndex) => <option key={optionIndex} value={optionIndex}>Option {optionIndex + 1}</option>)}
        </select></label>
      </fieldset>)}
      <button type="button" className="secondary-button" disabled={draft.quiz.length >= 10} onClick={() => setDraft({ ...draft, quiz: [...draft.quiz, { prompt: "", options: ["", "", "", ""], correct: 0 }] })}>Add question</button>
    </>}
    </fieldset>
    {(error || success) && <p ref={notice} tabIndex={-1} role={error ? "alert" : "status"} className={`form-notice${error ? " notice-error" : ""}`}>{error || success}</p>}
    {uncertain && <a className="text-link" href="/studio" target="_blank" rel="noopener noreferrer">Check Your lessons (new tab)</a>}
    <p>
      <button type="button" className="secondary-button" disabled={pending || uncertain} onClick={() => void save("save")}>{pending ? "Saving..." : "Save"}</button>
      <button type="button" className="auth-submit" disabled={pending || uncertain} onClick={() => void save("publish")}>{pending ? "Saving..." : "Save and publish"}</button>
    </p>
    <p>Save keeps the lesson private. Save and publish sends it to an administrator for approval before anyone else can see it. A quiz needs at least 3 questions.</p>
  </div>;
}
