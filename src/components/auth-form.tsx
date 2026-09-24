"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";
import { SubmitButton } from "./submit-button";
import { logIn, requestReset, resendVerification, resetPassword, signUp, type CredentialState } from "@/app/auth/actions";

type Mode = "login" | "signup" | "forgot" | "reset";

export function AuthForm({ mode, error, success, message, email, verification }: { mode: Mode; error?: string; success?: string; message?: string; email?: string; verification?: string }) {
  const [credentialState, credentialAction] = useActionState(mode === "signup" ? signUp : logIn, {} as CredentialState);
  const [recoveryState, recoveryAction] = useActionState(requestReset, {} as CredentialState);
  error = typeof error === "string" ? error : undefined;
  success = typeof success === "string" ? success : undefined;
  message = typeof message === "string" ? message : undefined;
  email = typeof email === "string" ? email : undefined;
  verification = typeof verification === "string" ? verification : undefined;
  const content = {
    login: ["Welcome back.", "Continue where you left off.", "Log in"],
    signup: ["Make learning yours.", "Create a private learning profile in under a minute.", "Create account"],
    forgot: ["Reset your password.", "We’ll email a secure link if your account exists.", "Send reset link"],
    reset: ["Choose a new password.", "Use a strong password you do not reuse elsewhere.", "Update password"],
  }[mode];
  const state = mode === "forgot" ? recoveryState : credentialState;
  const notice = state.error ?? error ?? success ?? message;
  const fieldErrors = state.fieldErrors ?? {};
  const retainedEmail = state.fields?.email ?? email ?? "";
  const formRef = useRef<HTMLFormElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!state.error) return;
    const invalid = formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>('[aria-invalid="true"]');
    (invalid ?? noticeRef.current)?.focus();
  }, [state]);

  return <main className="auth-page">
    <section className="auth-aside">
      <Brand light />
      <div><span className="eyebrow">LEARN WITH AGENCY</span><h2>Build the judgment<br />behind the work.</h2><p>A little practice. A clearer understanding. Your next step starts here.</p></div>
      <ul><li><ShieldCheck size={17} /> Your private lessons stay private</li><li><LockKeyhole size={17} /> Passwords are securely managed</li></ul>
    </section>
    <section className="auth-main">
      <div className="auth-card">
        <Brand />
        <div className="auth-title"><h1>{content[0]}</h1><p>{content[1]}</p></div>
        {notice && <div ref={noticeRef} tabIndex={-1} role={state.error || error ? "alert" : "status"} className={`form-notice ${state.error || error ? "notice-error" : "notice-success"}`}>{success && !state.error && <CheckCircle2 size={17} />}{notice}</div>}
        <form ref={formRef} action={mode === "login" || mode === "signup" ? credentialAction : mode === "forgot" ? recoveryAction : resetPassword} className="auth-fields">
          {mode === "signup" && <label>Display name<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="How should we call you?" defaultValue={credentialState.fields?.name} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined} />{fieldErrors.name && <span id="name-error" className="field-error">{fieldErrors.name}</span>}</label>}
          {mode !== "reset" && <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" defaultValue={retainedEmail} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} />{fieldErrors.email && <span id="email-error" className="field-error">{fieldErrors.email}</span>}</label>}
          {mode === "signup" && <label>Age range<select key={credentialState.fields?.ageRange ?? "initial"} name="ageRange" required defaultValue={credentialState.fields?.ageRange ?? ""} aria-invalid={Boolean(fieldErrors.ageRange)} aria-describedby={fieldErrors.ageRange ? "age-error" : undefined}><option value="" disabled>Select an age range</option><option value="under-13">Under 13</option><option value="13-17">13–17</option><option value="18-24">18–24</option><option value="25-34">25–34</option><option value="35-plus">35 or above</option></select>{fieldErrors.ageRange && <span id="age-error" className="field-error">{fieldErrors.ageRange}</span>}</label>}
          {(mode === "login" || mode === "signup" || mode === "reset") && <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 8} placeholder={mode === "login" ? "Your password" : "8+ characters, uppercase and number"} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={fieldErrors.password ? "password-error" : undefined} />{fieldErrors.password && <span id="password-error" className="field-error">{fieldErrors.password}</span>}</label>}
          {mode === "signup" && <label className="consent-field"><input key={credentialState.fields ? "retained" : "initial"} name="consent" type="checkbox" defaultChecked={credentialState.fields?.consent} aria-invalid={Boolean(fieldErrors.consent)} aria-describedby={fieldErrors.consent ? "consent-error" : undefined} /> <span>I confirm I may create this account. A parent or guardian has agreed if I am under 13.{fieldErrors.consent && <span id="consent-error" className="field-error">{fieldErrors.consent}</span>}</span></label>}
          {mode === "login" && <Link className="text-link forgot-link" href="/forgot-password">Forgot password?</Link>}
          <SubmitButton>{content[2]} <ArrowRight size={17} /></SubmitButton>
        </form>
        {mode === "login" && (verification === "required" || credentialState.verification || success?.startsWith("Account created")) && <form action={resendVerification} className="resend-form"><input type="hidden" name="email" value={retainedEmail} /><span>Didn’t receive the verification email?</span><SubmitButton className="text-link" disabled={!retainedEmail}>Resend verification</SubmitButton></form>}
        <p className="auth-swap">{mode === "login" ? <>New to Forge? <Link href="/signup">Create an account</Link></> : mode === "signup" ? <>Already learning? <Link href="/login">Log in</Link></> : <>Return to <Link href="/login">log in</Link></>}</p>
        <p className="privacy-note">We only collect what supports your learning. Never share an address, phone number, ID, financial details, or exact birth date.</p>
      </div>
    </section>
  </main>;
}