import { readFile } from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FyneLogo } from "@/components/fyne/FyneLogo";

export const metadata = {
  title: "Privacy Policy",
  description: "How FyneStudy handles your data.",
};

// SSR — renders the source markdown at request time. Closes the mobile
// Phase-12 carry-over "deferred /privacy Vercel hosting route". The same
// document feeds the Play Store privacy-policy URL.
export default async function PrivacyPage() {
  const filePath = path.resolve(
    process.cwd(),
    "..",
    "..",
    "docs",
    "legal",
    "privacy-policy.md",
  );
  const markdown = await readFile(filePath, "utf-8");

  return (
    <main className="min-h-svh bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link href="/" className="inline-flex">
          <FyneLogo variant="header" />
        </Link>
        <article className="prose prose-slate max-w-none rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </article>
        <p className="text-center text-xs text-slate-400">
          Questions? Contact your institute.
        </p>
      </div>
    </main>
  );
}
