import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FyneLogo } from "@/components/fyne/FyneLogo";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <FyneLogo variant="large" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
          <h1 className="text-6xl font-extrabold text-primary">404</h1>
          <p className="mt-3 text-base font-semibold text-slate-900">Page not found</p>
          <p className="mt-1 text-sm text-slate-500">
            The page you&apos;re looking for doesn&apos;t exist or has moved.
          </p>
          <Button asChild size="lg" className="mt-6 h-12 w-full text-base font-bold shadow-sm transition-all hover:shadow-md">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
