import type { Metadata } from "next";

// ───────────────────────────────────────────────────────────────────────────
// EDIT THESE FOUR VALUES, then redeploy. Everything below renders from them.
// (Mirror of docs/legal/privacy-policy.md — keep the two in sync.)
const INSTITUTE = {
  legalName: "FyneStudy",
  contactEmail: "kaustab.borah44@gmail.com",
  phoneOrAddress: "", // optional — leave "" to hide the line
  effectiveDate: "30 May 2026",
  lastUpdated: "30 May 2026",
};
// ───────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: "Privacy Policy · FyneStudy",
  description:
    "How the FyneStudy app collects, uses, and protects student and teacher data.",
};

// Static, public, no-login page. The admin middleware allowlists "/privacy".
export const dynamic = "force-static";

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
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 text-xl font-semibold text-slate-900">{children}</h2>
  );
}

export default function PrivacyPolicyPage() {
  const { legalName, contactEmail, phoneOrAddress, effectiveDate, lastUpdated } =
    INSTITUTE;

  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-[15px] leading-relaxed text-slate-700">
      <h1 className="text-3xl font-bold text-slate-900">
        FyneStudy — Privacy Policy
      </h1>

      <ul className="mt-5 space-y-1 text-sm">
        <li>
          <strong>App:</strong> FyneStudy (Android package{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">
            com.fynestudy.app
          </code>
          )
        </li>
        <li>
          <strong>Operated by:</strong> {legalName} (the coaching institute,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;the Institute&rdquo;)
        </li>
        <li>
          <strong>Contact email:</strong>{" "}
          <a
            className="text-blue-600 underline"
            href={`mailto:${contactEmail}`}
          >
            {contactEmail}
          </a>
        </li>
        <li>
          <strong>Effective date:</strong> {effectiveDate}
        </li>
        <li>
          <strong>Last updated:</strong> {lastUpdated}
        </li>
      </ul>

      <H2>1. Who this policy is for</H2>
      <p className="mt-3">
        FyneStudy is a private app for students and teachers of {legalName}, a
        coaching institute preparing students for the JEE, NEET, and CUET
        examinations. <strong>The app is not open to the public and has no
        self-signup.</strong>{" "}
        Accounts are created and issued only by the Institute&rsquo;s
        administrators. You can use FyneStudy only if the Institute has enrolled
        you.
      </p>
      <p className="mt-3">
        Because our students include minors (people under 18, and some under
        13), this policy explains in plain language what we collect, why, and
        how a parent or guardian can ask us to delete it. See §8 for the
        children-and-minors section.
      </p>

      <H2>2. What data we collect</H2>
      <p className="mt-3">
        We collect only what is needed to run the Institute&rsquo;s classes,
        attendance, assessments, and progress tracking. We do <strong>not</strong>{" "}
        ask you to enter anything beyond the categories below, and there is no
        advertising or tracking SDK in the app.
      </p>

      <h3 className="mt-6 font-semibold text-slate-900">
        2.1 Student personal information (entered by the Institute)
      </h3>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr>
            <Th>Data</Th>
            <Th>Why we hold it</Th>
          </tr>
        </thead>
        <tbody>
          <tr><Td>Full name</Td><Td>Identify the student in rosters, results, and leaderboards</Td></tr>
          <tr><Td>Email address</Td><Td>Login credential and account recovery</Td></tr>
          <tr><Td>Phone number</Td><Td>Contact and account identification</Td></tr>
          <tr><Td>Date of birth</Td><Td>Determine age group and batch eligibility</Td></tr>
          <tr><Td>Gender</Td><Td>Institute records</Td></tr>
          <tr><Td>Postal address</Td><Td>Institute records and correspondence</Td></tr>
          <tr><Td>School name</Td><Td>Institute records</Td></tr>
          <tr><Td>Education board (e.g. CBSE)</Td><Td>Academic context</Td></tr>
          <tr><Td>Class / grade</Td><Td>Batch and curriculum assignment</Td></tr>
          <tr><Td>Parent / guardian phone number(s)</Td><Td>Contact the family about the student&rsquo;s progress and attendance</Td></tr>
          <tr><Td>Parental-consent record</Td><Td>Evidence that a parent/guardian consented to a minor&rsquo;s use of the app (see §8)</Td></tr>
        </tbody>
      </table>

      <h3 className="mt-6 font-semibold text-slate-900">
        2.2 Teacher personal information
      </h3>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr><Th>Data</Th><Th>Why we hold it</Th></tr>
        </thead>
        <tbody>
          <tr><Td>Full name</Td><Td>Identify the teacher to students and admins</Td></tr>
          <tr><Td>Email address</Td><Td>Login credential</Td></tr>
          <tr><Td>Phone number</Td><Td>Contact and account identification</Td></tr>
          <tr><Td>Short bio</Td><Td>Shown to students</Td></tr>
          <tr><Td>Subjects taught</Td><Td>Assign classes and content</Td></tr>
        </tbody>
      </table>

      <h3 className="mt-6 font-semibold text-slate-900">
        2.3 App activity we generate as you use the app
      </h3>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr><Th>Data</Th><Th>Why we hold it</Th></tr>
        </thead>
        <tbody>
          <tr><Td>Attendance records</Td><Td>Track presence in classes (marked by scanning a QR code)</Td></tr>
          <tr><Td>Quiz and exam scores and answers</Td><Td>Grade assessments and show results</Td></tr>
          <tr><Td>Topic mastery and progress</Td><Td>Show each student their strengths and weak areas</Td></tr>
          <tr><Td>Study streaks</Td><Td>Motivation feature</Td></tr>
          <tr><Td>Leaderboard standing and badges</Td><Td>Motivation feature, shown within the student&rsquo;s own batch</Td></tr>
        </tbody>
      </table>

      <h3 className="mt-6 font-semibold text-slate-900">2.4 Camera</h3>
      <p className="mt-3">
        The app uses your device camera <strong>only</strong> to scan attendance
        QR codes that a teacher displays in class. The camera image is processed
        on your device to read the code.{" "}
        <strong>
          We do not photograph you, and we do not store, upload, or transmit any
          camera image.
        </strong>{" "}
        Camera access is requested at the moment you open the attendance scanner
        and you can decline it in your device settings.
      </p>

      <h3 className="mt-6 font-semibold text-slate-900">
        2.5 What we do NOT collect
      </h3>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>We do <strong>not</strong> collect your precise or approximate location.</li>
        <li>We do <strong>not</strong> show advertising or use any advertising or analytics tracking SDK.</li>
        <li>We do <strong>not</strong> record audio or video from your device.</li>
        <li>We do <strong>not</strong> collect contacts, SMS, call logs, or files outside the app.</li>
        <li>We do <strong>not</strong> use cookies for tracking (the app is not a website).</li>
      </ul>

      <H2>3. How we use your data</H2>
      <p className="mt-3">We use the data above only to:</p>
      <ol className="mt-3 list-decimal space-y-1 pl-6">
        <li>Authenticate you and keep your account secure.</li>
        <li>Run classes, attendance, practice quizzes, graded exams, and the study library.</li>
        <li>Show you and your teachers your academic progress, results, mastery, and streaks.</li>
        <li>Operate motivational features (badges and a batch-scoped leaderboard).</li>
        <li>Communicate with students and their parents/guardians about progress and attendance.</li>
      </ol>
      <p className="mt-3">
        We do <strong>not</strong> use your data for advertising, profiling for
        advertising, or any automated decision that produces legal effects.
      </p>

      <H2>4. Who can see your data (sharing)</H2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li><strong>We do not sell your personal data. Ever.</strong></li>
        <li><strong>We do not share your personal data with third parties for advertising or marketing.</strong></li>
        <li>Within the app, your name and progress are visible to the Institute&rsquo;s teachers and administrators, and your first name/standing may appear to other students <strong>in your own batch only</strong> on the leaderboard.</li>
        <li>We use the service providers listed in §5 purely to host and operate the app on our behalf. They process data under our instructions and do not use it for their own purposes.</li>
      </ul>

      <H2>5. Service providers (data processors)</H2>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr><Th>Provider</Th><Th>Role</Th><Th>What it processes</Th><Th>Where</Th></tr>
        </thead>
        <tbody>
          <tr>
            <Td>Supabase</Td>
            <Td>Database, authentication, file storage, realtime</Td>
            <Td>All account and activity data in §2.1–§2.3</Td>
            <Td>Hosted in the ap-south-1 (Mumbai, India) region</Td>
          </tr>
          <tr>
            <Td>YouTube (Google LLC)</Td>
            <Td>Live-class and recording video playback</Td>
            <Td>Live classes are unlisted YouTube videos embedded in a wrapped player; watching may cause YouTube to receive standard playback/device data governed by Google&rsquo;s own privacy policy</Td>
            <Td>Google infrastructure</Td>
          </tr>
          <tr>
            <Td>Expo / EAS (Expo, Inc.)</Td>
            <Td>App build and over-the-air update delivery</Td>
            <Td>App binaries and update bundles; does not receive your personal account data</Td>
            <Td>Expo infrastructure</Td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3">
        We currently do <strong>not</strong> use any crash-reporting (e.g.
        Sentry) or product-analytics (e.g. PostHog) service. If we add one later,
        we will update this policy and the Play &ldquo;Data safety&rdquo; form
        before enabling it.
      </p>
      <p className="mt-3 text-sm">
        Links to processors&rsquo; policies:{" "}
        <a className="text-blue-600 underline" href="https://supabase.com/privacy">Supabase</a>{" · "}
        <a className="text-blue-600 underline" href="https://policies.google.com/privacy">Google/YouTube</a>{" · "}
        <a className="text-blue-600 underline" href="https://expo.dev/privacy">Expo</a>.
      </p>

      <H2>6. How we protect your data</H2>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>All traffic between the app and our servers is <strong>encrypted in transit (HTTPS/TLS)</strong>.</li>
        <li>Data is stored in Supabase (Postgres) with <strong>row-level security (RLS)</strong> enabled on every table holding user data, so each account can read only the records it is permitted to.</li>
        <li>Privileged actions run server-side through audited functions; the app never holds an administrative database key.</li>
        <li>Administrative changes are recorded in an internal audit log.</li>
      </ul>
      <p className="mt-3">
        No system is perfectly secure, but we take reasonable technical and
        organisational measures appropriate to the sensitivity of student data.
      </p>

      <H2>7. How long we keep your data</H2>
      <p className="mt-3">
        We keep your account and activity data for as long as you are an enrolled
        student or teacher of the Institute, and for a reasonable period
        afterwards for the Institute&rsquo;s legitimate academic and
        administrative records. When data is no longer needed, or on a valid
        deletion request (§9), we delete or anonymise it.
      </p>

      <H2>8. Children&rsquo;s and minors&rsquo; data</H2>
      <p className="mt-3">
        FyneStudy is used by minors. We treat children&rsquo;s data with extra
        care:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-6">
        <li>An account for a minor is created by the Institute <strong>only after a parent or guardian has consented</strong>, and the app stores a record of that consent.</li>
        <li>We collect from minors only the information needed for their education at the Institute (§2.1).</li>
        <li>We do <strong>not</strong> show advertising to anyone, and we do not use children&rsquo;s data for advertising or for building advertising profiles.</li>
        <li>A parent or guardian may review, correct, or request deletion of their child&rsquo;s data at any time by contacting the Institute (§9).</li>
      </ul>
      <p className="mt-3">
        This app is designed to meet Google Play&rsquo;s Families policy
        expectations for an app whose audience includes children. If you are a
        parent or guardian and have any concern about your child&rsquo;s data,
        contact us at{" "}
        <a className="text-blue-600 underline" href={`mailto:${contactEmail}`}>
          {contactEmail}
        </a>
        .
      </p>

      <H2>9. Your rights and how to request access, correction, or deletion</H2>
      <p className="mt-3">
        Because the Institute issues and manages all accounts,{" "}
        <strong>requests are handled by the Institute, not inside the app.</strong>{" "}
        To review, correct, export, or delete your (or your child&rsquo;s)
        personal data, email{" "}
        <a className="text-blue-600 underline" href={`mailto:${contactEmail}`}>
          {contactEmail}
        </a>{" "}
        from the address on file
        {phoneOrAddress ? <>, or contact the Institute at {phoneOrAddress}</> : null}.
      </p>
      <p className="mt-3">
        Students and teachers cannot self-edit identity fields (name, email,
        phone, date of birth, batch, course, parent phone) in the app by design;
        ask the Institute to change them. We will respond to verified requests
        within a reasonable time and in line with applicable law.
      </p>

      <H2>10. Changes to this policy</H2>
      <p className="mt-3">
        If we change this policy, we will update the &ldquo;Last updated&rdquo;
        date above and, for material changes, notify the Institute community.
        Continued use of the app after an update means you accept the revised
        policy.
      </p>

      <H2>11. Contact us</H2>
      <p className="mt-3">
        <strong>{legalName}</strong>
        <br />
        Email:{" "}
        <a className="text-blue-600 underline" href={`mailto:${contactEmail}`}>
          {contactEmail}
        </a>
        {phoneOrAddress ? (
          <>
            <br />
            {phoneOrAddress}
          </>
        ) : null}
      </p>
    </main>
  );
}
