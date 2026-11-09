"use client";

import { useEffect, useState } from "react";

export function ThemeSwitch() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);
  function choose(next: "light" | "dark") {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("forge-theme", next);
  }
  return <div className="theme-switch" role="group" aria-label="Background">
    <button type="button" aria-pressed={theme === "light"} onClick={() => choose("light")}>Light mode</button>
    <button type="button" aria-pressed={theme === "dark"} onClick={() => choose("dark")}>Dark mode</button>
  </div>;
}
