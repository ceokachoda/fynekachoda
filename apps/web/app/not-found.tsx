import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FyneLogo } from "@/components/fyne/FyneLogo";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-3xl font-extrabold text-slate-900">404</h1>
          <p className="mt-2 text-sm text-slate-600">
            That page doesn&apos;t exist.
          </p>
          <Button asChild size="lg" className="mt-6 h-11 w-full">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
