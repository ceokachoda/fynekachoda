import type { Metadata } from "next";

// ───────────────────────────────────────────────────────────────────────────
// EDIT THESE, then redeploy. Keep in sync with /privacy.
const INSTITUTE = {
  legalName: "FyneStudy",
  contactEmail: "kaustab.borah44@gmail.com",
  lastUpdated: "12 June 2026",
};
// ───────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Delete your account & data · FyneStudy",
  description:
    "How to request deletion of your FyneStudy account and associated data.",
};

// Static, public, no-login page. The admin middleware allowlists "/delete-account".
export const dynamic = "force-static";

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-xl font-semibold text-slate-900">{children}</h2>
  );
}
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left font-medium text-slate-700">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="border border-slate-200 px-3 py-2 align-top text-slate-700">
      {children}
    </td>
  );
}

export default function DeleteAccountPage() {
  const { legalName, contactEmail, lastUpdated } = INSTITUTE;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-[15px] leading-relaxed text-slate-700">
      <h1 className="text-3xl font-bold text-slate-900">
        Delete your FyneStudy account &amp; data
      </h1>

      <p className="mt-5">
        This page explains how a student, teacher, or parent/guardian can
        request deletion of a <strong>FyneStudy</strong> account (Android
        package{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5">
          com.fynestudy.app
        </code>
        ) and the personal data associated with it.
      </p>

      <p className="mt-3">
        FyneStudy is a private app for {legalName}, a coaching institute. It has{" "}
        <strong>no public sign-up</strong> — every account is created and
        managed by the Institute&rsquo;s administrators. Because of this,
        deletion requests are handled by the Institute rather than by a
        self-service button in the app.
      </p>

      <H2>How to request deletion (steps)</H2>
      <ol className="mt-3 list-decimal space-y-2 pl-6">
        <li>
          Send an email to{" "}
          <a className="text-blue-600 underline" href={`mailto:${contactEmail}`}>
            {contactEmail}
          </a>{" "}
          from the email address on file for the account (or, for a minor, from
          the parent/guardian who consented to the account).
        </li>
        <li>
          Use the subject line{" "}
          <strong>&ldquo;Delete my FyneStudy account&rdquo;</strong>.
        </li>
        <li>
          In the message, include the <strong>full name</strong> and{" "}
          <strong>registered email or phone number</strong> of the account to be
          deleted so we can verify and locate it.
        </li>
        <li>
          We verify the request and delete the account. We respond to confirm
          once it is done, normally within <strong>30 days</strong>.
        </li>
      </ol>

      <H2>What is deleted</H2>
      <p className="mt-3">
        On a verified request we permanently delete the account and its
        associated personal data, including:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>Login credentials and authentication record.</li>
        <li>
          Profile information — name, email, phone number, date of birth,
          gender, address, school, board, class/grade, and parent/guardian
          contact numbers.
        </li>
        <li>
          Activity data tied to the account — attendance records, quiz and exam
          attempts and scores, topic mastery and progress, study streaks, and
          leaderboard standing and badges.
        </li>
      </ul>

      <H2>What may be kept, and for how long</H2>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th>Data</Th>
            <Th>Why it is kept</Th>
            <Th>Retention</Th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <Td>
              Anonymised or aggregated records (e.g. a class attendance count
              with no personal identifiers)
            </Td>
            <Td>
              Institute academic and administrative records; these no longer
              identify you
            </Td>
            <Td>Retained as anonymised data</Td>
          </tr>
          <tr>
            <Td>
              Limited records we are required by law to keep, or that are needed
              to resolve a dispute or enforce our agreements
            </Td>
            <Td>Legal / regulatory obligation</Td>
            <Td>
              Only for the period required by applicable law, then deleted
            </Td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3">
        Apart from the limited exceptions above, your personal data is removed
        and not retained after deletion is complete.
      </p>

      <H2>Contact</H2>
      <p className="mt-3">
        <strong>{legalName}</strong>
        <br />
        Email:{" "}
        <a className="text-blue-600 underline" href={`mailto:${contactEmail}`}>
          {contactEmail}
        </a>
      </p>

      <p className="mt-8 text-sm text-slate-500">Last updated: {lastUpdated}</p>
    </main>
  );
}
