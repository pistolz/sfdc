import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { ensureUserRecord, toAccountView } from "@/lib/firestore";
import { AppShell } from "@/components/app-shell";

// Every screen here depends on the session cookie, so nothing is prerendered.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const record = await ensureUserRecord(user);
  const account = toAccountView(record);

  return <AppShell account={account}>{children}</AppShell>;
}
