import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { database } from "@/lib/learning-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const client = database();
    const tables = [["profiles", "id", "id"], ["enrollments", "user_id", "id"], ["lesson_progress", "user_id", "id"], ["quiz_results", "user_id", "id"], ["bookmarks", "user_id", "id"], ["achievements", "user_id", "id"], ["forge_lessons", "owner_id", "id"], ["forge_enrollments", "user_id", "lesson_id"], ["forge_attempts", "user_id", "id"], ["forge_bookmarks", "user_id", "lesson_id"], ["forge_requests", "user_id", "day"], ["forge_reviewers", "user_id", "lesson_id"]];
    const records: Record<string, unknown[]> = {};
    for (const [table, ownerColumn, orderColumn] of tables) {
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from(table).select("*").eq(ownerColumn, user.id).order(orderColumn).range(offset, offset + 499);
        if (error) throw new Error("Export query failed");
        rows.push(...data);
        if (data.length < 500) break;
      }
      records[table] = rows;
    }
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), account: { email: user.email, createdAt: user.created_at, metadata: user.user_metadata }, records }, null, 2), { headers: { "Content-Type": "application/json", "Content-Disposition": "attachment; filename=forge-learning-data.json", "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Data export requires a configured account." }, { status: 503 }); }
}