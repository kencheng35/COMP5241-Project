"use client";

import { useEffect } from "react";
import { rememberAvatar } from "@/components/learner-shell";

export function RememberAvatar({ avatar }: { avatar: string | null }) {
  useEffect(() => { rememberAvatar(avatar?.startsWith("data:image/") ? avatar : null); }, [avatar]);
  return null;
}
