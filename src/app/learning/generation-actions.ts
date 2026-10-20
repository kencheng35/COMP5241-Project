"use server";

import { advanceGeneration, deleteGeneration, finalizeGeneration, listGenerations, readGeneration } from "@/lib/lesson-generation-server";

export async function loadLessonGeneration(id: string) { return readGeneration(id); }
export async function listLessonGenerations() { return listGenerations(); }
export async function deleteLessonGeneration(id: string) { return deleteGeneration(id); }
export async function advanceLessonGeneration(id: string, revision: number, request: string) { return advanceGeneration(id, revision, request); }
export async function finalizeLessonGeneration(id: string, revision: number) { return finalizeGeneration(id, revision); }
