import { notFound } from "next/navigation";
import { LearnerShell } from "@/components/learner-shell";
import { AccountMaintenance } from "@/components/account-maintenance";
import { isInstructor, displayName, isAdmin, requireUser } from "@/lib/learning-server";

export default async function Accounts() {
  const user = await requireUser();
  if (!isAdmin(user)) notFound();
  return <LearnerShell active="/admin/accounts" name={await displayName(user)} admin instructor={isInstructor(user)}>
    <div className="portal-page"><span className="eyebrow">ADMINISTRATOR</span><h1>Account maintenance.</h1><AccountMaintenance /></div>
  </LearnerShell>;
}