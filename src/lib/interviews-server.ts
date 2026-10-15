import "server-only";
import { database } from "@/lib/learning-server";
import { historyCursorSchema, interviewMetadataSchema, interviewSchema, type HistoryCursor } from "@/lib/interviews";

export async function ownedInterview(owner: string, id: string) {
  const { data, error } = await database().from("forge_interviews").select("*").eq("owner_id", owner).eq("id", id).maybeSingle();
  if (error) throw new Error("Interview unavailable");
  if (!data) return null;
  const row = interviewSchema.parse(data);
  if (row.owner_id !== owner) throw new Error("Owner mismatch");
  return row;
}
export async function interviewHistory(owner: string, cursor: HistoryCursor = null) {
  const parsed = historyCursorSchema.parse(cursor);
  let query = database().from("forge_interviews")
    .select("id,topic,level,state,revision,created_at,updated_at,completed_at").eq("owner_id", owner)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(20);
  if (parsed) query = query.or(`created_at.lt.${parsed.created_at},and(created_at.eq.${parsed.created_at},id.lt.${parsed.id})`);
  const { data, error } = await query;
  if (error || !Array.isArray(data)) throw new Error("History unavailable");
  const rows = data.map(row => interviewMetadataSchema.parse(row));
  const last = rows.at(-1);
  return { rows, cursor: rows.length === 20 && last ? { id: last.id, created_at: last.created_at } : null };
}

export async function interviewRpc(name: string, args: Record<string, unknown>, owner: string) {
  const { data, error } = await database().rpc(name, { p_owner: owner, ...args });
  if (error || !data || typeof data.code !== "string") throw new Error("Interview mutation unconfirmed");
  const row = data.interview ? interviewSchema.parse(data.interview) : undefined;
  if (row && row.owner_id !== owner) throw new Error("Owner mismatch");
  return { code: data.code as string, interview: row };
}
