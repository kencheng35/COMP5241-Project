"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Award, BookOpen, LayoutDashboard, Library, LogOut, Menu, Settings, X, Zap } from "lucide-react";
import { logOut } from "@/app/auth/actions";

const links = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["Course catalog", "/catalog", Library],
  ["Create lesson", "/studio", BookOpen],
  ["Progress", "/progress", Award],
  ["Profile & settings", "/profile", Settings],
] as const;

export function LearnerShell({ children, active, name = "Learner", admin = false }: { children: React.ReactNode; active: string; name?: string; admin?: boolean }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);
  function closeMenu() { setOpen(false); menuButton.current?.focus(); }
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  return <main className="portal-shell">
    <aside className={`portal-sidebar ${open ? "portal-sidebar-open" : ""}`}>
      <div className="brand-row"><Link href="/dashboard" className="portal-brand"><span><Zap size={18} /></span><strong>FORGE</strong></Link><button ref={closeButton} className="portal-close" onClick={closeMenu} aria-label="Close navigation"><X size={19} /></button></div>
      <Link href="/profile" className="portal-profile"><span className="avatar">{initials}</span><span><strong>{name}</strong><small>{admin ? "Administrator" : "Learner"}</small></span></Link>
      <nav className="portal-nav" aria-label="Learner navigation">{links.map(([label, href, Icon]) => <Link key={href} href={href} className={active === href ? "active" : ""} aria-current={active === href ? "page" : undefined} onClick={() => setOpen(false)}><Icon size={18} />{label}</Link>)}</nav>
      <nav className="portal-nav" aria-label="Reporting"><Link href="/reports">Quiz reports</Link>{admin && <Link href="/admin">Publish & review</Link>}</nav>
      <div className="portal-foot"><form action={logOut}><button type="submit"><LogOut size={17} /> Log out</button></form></div>
    </aside>
    <section className="portal-workspace">
      <header className="portal-topbar"><button ref={menuButton} className="portal-menu" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open}><Menu size={20} /></button><Link href="/catalog" className="catalog-shortcut">Explore courses</Link><Link href="/profile" className="avatar portal-avatar">{initials}</Link></header>
      {children}
    </section>
    {open && <button className="portal-scrim" onClick={closeMenu} aria-label="Close navigation overlay" />}
  </main>;
}