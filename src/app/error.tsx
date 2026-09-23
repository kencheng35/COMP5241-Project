"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="portal-page"><h1>Could not load this page.</h1><p>The learning service may be unavailable or awaiting its database migration. Your saved records have not been changed.</p><button className="auth-submit" onClick={reset}>Try again</button><p><Link href="/dashboard">Dashboard</Link> · <Link href="/login">Log in</Link></p></main>;
}