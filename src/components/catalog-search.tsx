"use client";

import { useEffect, useRef } from "react";

export function CatalogSearch({ query }: { query: string }) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && document.activeElement === input.current) input.current?.blur();
      if (event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      input.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    const element = input.current;
    if (element) element.dataset.shortcutReady = "true";
    return () => { document.removeEventListener("keydown", onKeyDown); if (element) delete element.dataset.shortcutReady; };
  }, []);

  return <label>Search<input ref={input} name="q" defaultValue={query} maxLength={150} placeholder="Topic or lesson" /></label>;
}