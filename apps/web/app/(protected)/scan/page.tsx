import { requireTeacher } from "@/lib/auth";
import { ScanClient } from "./_components/ScanClient";

export const metadata = { title: "Scan QR" };
export const dynamic = "force-dynamic";

// /scan needs the live session; do not pre-render.
export default async function ScanPage() {
  await requireTeacher();
  return <ScanClient />;
}
