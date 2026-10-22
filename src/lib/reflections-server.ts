import "server-only";
import { database } from "@/lib/learning-server";
import { reflectionCursorSchema, reflectionHistorySchema, reflectionMetadataSchema, reflectionRowSchema, type ReflectionCursor, type ReflectionRow } from "@/lib/reflections";

export async function ownedReflection(owner: string, date: string) {
  const { data, error } = await database().from("forge_reflections").select("*").eq("owner_id", owner).eq("date", date).maybeSingle();
  if (error) throw new Error("Reflections unavailable");
  if (data === null) return null;
  const row = reflectionRowSchema.parse(data);
  if (row.owner_id !== owner || row.date !== date) throw new Error("Reflection mismatch");
  return row;
}
export async function reflectionHistory(owner: string, cursor: ReflectionCursor = null) {
  const parsed = reflectionCursorSchema.parse(cursor);
  let query = database().from("forge_reflections").select("id,date,revision,created_at,updated_at").eq("owner_id", owner)
    .order("date", { ascending: false }).order("id", { ascending: false }).limit(21);
  if (parsed) query = query.or(`date.lt.${parsed.date},and(date.eq.${parsed.date},id.lt.${parsed.id})`);
  const { data, error } = await query;
  if (error || !Array.isArray(data)) throw new Error("Reflections unavailable");
  const checked = reflectionMetadataSchema.array().max(21).parse(data);
  const rows = checked.slice(0, 20);
  const last = rows.at(-1);
  return reflectionHistorySchema.parse({ rows, cursor: checked.length > 20 && last ? { date: last.date, id: last.id } : null });
}
export async function writeReflection(owner: string, input: { date: string; delegation: string; description: string; discernment: string; diligence: string; id?: string; revision?: number }) {
  const client = database();
  const { id, revision, ...fields } = input;
  const query = id
    ? client.from("forge_reflections").update({ ...fields, revision: revision! + 1, updated_at: new Date().toISOString() }).eq("owner_id", owner).eq("id", id).eq("date", fields.date).eq("revision", revision!)
    : client.from("forge_reflections").insert({ ...fields, owner_id: owner });
  const { data, error } = await query.select("*").maybeSingle();
  if (error?.code === "23505") return { code: "conflict" as const };
  if (error?.code === "23514" || error?.code === "22008") return { code: "invalid" as const };
  if (error) throw new Error("Unconfirmed reflection write");
  if (data === null && id) {
    const existing = await ownedReflection(owner, fields.date);
    return { code: existing ? "conflict" as const : "missing" as const };
  }
  const row = reflectionRowSchema.parse(data);
  if (row.owner_id !== owner || row.date !== fields.date || row.revision !== (revision ?? 0) + 1 || (id && row.id !== id) ||
    (["delegation", "description", "discernment", "diligence"] as const).some(key => row[key] !== fields[key])) throw new Error("Unconfirmed reflection write");
  return { code: "ok" as const, row };
}
export async function removeReflection(owner: string, input: Pick<ReflectionRow, "id" | "date" | "revision">) {
  const { data, error } = await database().from("forge_reflections").delete().eq("owner_id", owner).eq("id", input.id).eq("date", input.date).eq("revision", input.revision).select("*").maybeSingle();
  if (error) throw new Error("Unconfirmed reflection deletion");
  if (data === null) return { code: await ownedReflection(owner, input.date) ? "conflict" as const : "missing" as const };
  const row = reflectionRowSchema.parse(data);
  if (row.owner_id !== owner || row.id !== input.id || row.date !== input.date || row.revision !== input.revision) throw new Error("Unconfirmed reflection deletion");
  return { code: "deleted" as const };
}
