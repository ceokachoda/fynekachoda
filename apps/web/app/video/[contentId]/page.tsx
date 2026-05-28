import { redirect } from "next/navigation";
import { loadWebSession } from "@/lib/auth";
import { VideoClient } from "./_components/VideoClient";

export const metadata = { title: "Video" };
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ contentId: string }>;
}

export default async function VideoPage({ params }: Props) {
  const { session, redirectTo } = await loadWebSession();
  if (redirectTo) redirect(redirectTo);
  if (!session) redirect("/login");
  const { contentId } = await params;
  return <VideoClient contentId={contentId} fullName={session.full_name} />;
}
