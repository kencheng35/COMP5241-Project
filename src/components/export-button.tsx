"use client";

import { useState } from "react";
import { Download } from "lucide-react";

export function ExportButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function download() {
    setPending(true);
    setError(false);
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("Export unavailable");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Empty export");
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = "forge-learning-data.json";
        document.body.append(link);
        link.click();
        link.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return <div><button type="button" onClick={download} disabled={pending} className="data-action"><Download size={17} /><span><strong>{pending ? "Preparing download..." : error ? "Retry data export" : "Download my data"}</strong><small>Export a JSON copy</small></span></button>{error && <p role="alert">Could not download your data. Check your connection and try again.</p>}</div>;
}