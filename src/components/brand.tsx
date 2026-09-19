import Link from "next/link";
import { Zap } from "lucide-react";

export function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`site-brand ${light ? "site-brand-light" : ""}`}><span><Zap size={18} strokeWidth={2.6} /></span><strong>FORGE</strong></Link>;
}