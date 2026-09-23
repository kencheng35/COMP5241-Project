import Link from "next/link";
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Brand } from "./brand";
import { SubmitButton } from "./submit-button";
import { logIn, requestReset, resendVerification, resetPassword, signUp } from "@/app/auth/actions";

type Mode = "login" | "signup" | "forgot" | "reset";

export function AuthForm({ mode, error, success, message, email, verification }: { mode: Mode; error?: string; success?: string; message?: string; email?: string; verification?: string }) {
  error = typeof error === "string" ? error : undefined;
  success = typeof success === "string" ? success : undefined;
  message = typeof message === "string" ? message : undefined;
  email = typeof email === "string" ? email : undefined;
  verification = typeof verification === "string" ? verification : undefined;
  const content = {
    login: ["Welcome back.", "Continue where you left off.", "Log in", logIn],
    signup: ["Make learning yours.", "Create a private learning profile in under a minute.", "Create account", signUp],
    forgot: ["Reset your password.", "We’ll email a secure link if your account exists.", "Send reset link", requestReset],
    reset: ["Choose a new password.", "Use a strong password you do not reuse elsewhere.", "Update password", resetPassword],
  }[mode] as [string, string, string, (data: FormData) => Promise<void>];

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
        {(error || success || message) && <div role="status" className={`form-notice ${error ? "notice-error" : "notice-success"}`}>{success && <CheckCircle2 size={17} />}{error || success || message}</div>}
        <form action={content[3]} className="auth-fields">
          {mode === "signup" && <label>Display name<input name="name" autoComplete="name" required minLength={2} placeholder="How should we call you?" /></label>}
          {mode !== "reset" && <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" defaultValue={email} /></label>}
          {mode === "signup" && <label>Age range<select name="ageRange" required defaultValue=""><option value="" disabled>Select an age range</option><option value="under-13">Under 13</option><option value="13-17">13–17</option><option value="18-24">18–24</option><option value="25-34">25–34</option><option value="35-plus">35 or above</option></select></label>}
          {(mode === "login" || mode === "signup" || mode === "reset") && <label>Password<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? 1 : 8} placeholder={mode === "login" ? "Your password" : "8+ characters, uppercase and number"} /></label>}
          {mode === "signup" && <label className="consent-field"><input name="consent" type="checkbox" /> <span>I confirm I may create this account. A parent or guardian has agreed if I am under 13.</span></label>}
          {mode === "login" && <Link className="text-link forgot-link" href="/forgot-password">Forgot password?</Link>}
          <SubmitButton>{content[2]} <ArrowRight size={17} /></SubmitButton>
        </form>
        {mode === "login" && (verification === "required" || success?.startsWith("Account created")) && <form action={resendVerification} className="resend-form"><input type="hidden" name="email" value={email ?? ""} /><span>Didn’t receive the verification email?</span><SubmitButton className="text-link" disabled={!email}>Resend verification</SubmitButton></form>}
        <p className="auth-swap">{mode === "login" ? <>New to Forge? <Link href="/signup">Create an account</Link></> : mode === "signup" ? <>Already learning? <Link href="/login">Log in</Link></> : <>Return to <Link href="/login">log in</Link></>}</p>
        <p className="privacy-note">We only collect what supports your learning. Never share an address, phone number, ID, financial details, or exact birth date.</p>
      </div>
    </section>
  </main>;
}