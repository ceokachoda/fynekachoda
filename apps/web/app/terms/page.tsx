import Link from "next/link";
import { FyneLogo } from "@/components/fyne/FyneLogo";

export const metadata = {
  title: "Terms of Use",
  description: "Terms of use for FyneStudy.",
};

export default function TermsPage() {
  return (
    <main className="min-h-svh bg-slate-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <Link href="/" className="inline-flex">
          <FyneLogo variant="header" />
        </Link>
        <article className="prose prose-slate max-w-none rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <h1>FyneStudy — Terms of Use</h1>
          <p>
            <strong>Last updated:</strong> 28 May 2026.
          </p>

          <h2>1. Who can use FyneStudy</h2>
          <p>
            FyneStudy is a private application for the students and teachers of
            a specific coaching institute. Accounts are issued only by the
            institute&apos;s administrators. <strong>There is no public
            sign-up.</strong> If you do not have an account, contact the
            institute that enrolled you.
          </p>

          <h2>2. Acceptable use</h2>
          <ul>
            <li>Do not share your login credentials with anyone.</li>
            <li>Do not attempt to circumvent attendance, quiz or exam controls.</li>
            <li>
              Do not record, redistribute or screen-capture live classes or
              study materials.
            </li>
            <li>
              Treat other students and teachers with respect in chat and live
              sessions.
            </li>
          </ul>

          <h2>3. Content ownership</h2>
          <p>
            Study materials, recorded sessions and assessment content uploaded
            by the institute remain the property of the institute and its
            teachers. You receive a limited, non-transferable licence to use
            them for personal study while you are enrolled.
          </p>

          <h2>4. Data handling</h2>
          <p>
            See our{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{" "}
            for details on what data we collect and why.
          </p>

          <h2>5. Account suspension</h2>
          <p>
            Administrators can suspend or terminate accounts for violations of
            these terms or for the institute&apos;s own administrative reasons.
          </p>

          <h2>6. No warranty</h2>
          <p>
            FyneStudy is provided on an as-is basis. The institute makes no
            warranty about uninterrupted availability.
          </p>

          <h2>7. Contact</h2>
          <p>
            For questions about these terms, contact your institute&apos;s
            administrator.
          </p>
        </article>
      </div>
    </main>
  );
}
