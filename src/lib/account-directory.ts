import "server-only";
import type { User } from "@supabase/supabase-js";
import { z } from "zod";
import { canPublishLessons, database, isAdmin } from "@/lib/learning-server";

export type AccountSummary = { id: string; email: string; name: string; role: string; aiAccess?: boolean; age?: number | null };
export type DirectoryState = { accounts?: AccountSummary[]; query?: string; nextPage?: number; error?: string; notice?: string };

export async function findAccounts(actor: User, rawQuery: unknown, rawPage: unknown, learnersOnly = false): Promise<DirectoryState> {
  if (!canPublishLessons(actor)) throw new Error("Instructor access required.");
  const query = z.string().trim().max(254).parse(rawQuery ?? "").toLowerCase();
  const page = z.coerce.number().int().min(1).max(10000).parse(rawPage ?? 1);
  if (!isAdmin(actor) && query.length < 3) throw new Error("Enter at least three characters of a learner's email.");
  const client = database();
  for (let current = page; current < page + 10; current++) {
    const { data, error } = await client.auth.admin.listUsers({ page: current, perPage: 100 });
    if (error || !data?.users) throw new Error("Account search is unavailable. Try again.");
    const matches = data.users.filter(account => account.email?.toLowerCase().includes(query)
      && (!learnersOnly || (account.email_confirmed_at && !["admin", "instructor"].includes(account.app_metadata?.role))));
    const nextPage = data.users.length === 100 ? current + 1 : undefined;
    if (matches.length || !nextPage) {
      const profiles = isAdmin(actor) && matches.length
        ? await client.from("profiles").select("id,age").in("id", matches.map(account => account.id))
        : null;
      return {
        query, nextPage,
        ...(profiles?.error ? { notice: "Recorded ages are unavailable. Apply the age eligibility migration before approving AI access." } : {}),
        accounts: matches.map(account => ({
          id: account.id, email: account.email ?? "", name: String(account.user_metadata?.display_name ?? "Learner"),
          role: ["admin", "instructor"].includes(account.app_metadata?.role) ? account.app_metadata.role : "learner",
          ...(isAdmin(actor) ? { aiAccess: account.app_metadata?.ai_access === true, age: profiles?.data?.find(profile => profile.id === account.id)?.age ?? null } : {}),
        })),
      };
    }
  }
  return { query, accounts: [], nextPage: page + 10, notice: "No matches in this batch. Continue searching the next accounts." };
}