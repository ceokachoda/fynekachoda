import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { PdfClient } from "./_components/PdfClient";

export const metadata = { title: "PDF" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ contentId: string }>;
}

export default async function PdfPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  const { contentId } = await params;
  return (
    <PdfClient contentId={contentId} fullName={session.full_name} />
  );
}
