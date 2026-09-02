import { Link } from "wouter";
import { Footer } from "@/components/ninelab/Footer";

// Public legal/info page — not inside AppLayout. Wrapped like PublicResume /
// PublicCertificate: standalone, own bg-canvas background, own header.
export default function Privacy() {
  return (
    <div className="min-h-[100dvh] bg-canvas flex flex-col">
      <header className="max-w-2xl mx-auto w-full px-5 pt-6">
        <Link
          href="/"
          className="text-display font-extrabold text-ink text-[20px] inline-block"
        >
          ninelab
        </Link>
      </header>

      <main className="max-w-2xl mx-auto w-full px-5 pt-6 pb-4 flex-1">
        <div className="bg-paper rounded-2xl shadow-soft p-6 lg:p-8">
          <h1 className="text-[26px] font-extrabold text-ink leading-[1.1] tracking-tight">
            Privacy
          </h1>
          <p className="text-[13px] text-ink-muted mt-1">
            Last updated 2026-09-02
          </p>

          <div className="mt-6 space-y-4 text-[15px] text-ink leading-relaxed">
            <p>
              This page explains, in plain English, what ninelab stores and
              why.
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              What we store
            </h2>
            <p>
              Your name and basic profile details, any GitHub data you
              choose to connect, resume text you write or upload, and
              transcripts and scores from mock interviews you take. This is
              what lets us build your resume and give you useful feedback —
              we don't collect anything beyond what the app needs to work.
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              Sign-in
            </h2>
            <p>
              Authentication (signing in and keeping you signed in) is
              handled by Clerk, a third-party identity provider. We don't
              store your password ourselves.
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              We never sell your data
            </h2>
            <p>
              We don't sell your data to anyone, for any reason.
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              Cookies and local storage
            </h2>
            <p>
              We use cookies and your browser's local storage to keep you
              signed in and to remember that you're in explore mode (looking
              around before creating an account).
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              Deleting your data
            </h2>
            <p>
              To request deletion of your data, email{" "}
              <a
                href="mailto:riteshrv3@gmail.com"
                className="font-bold text-brand"
              >
                riteshrv3@gmail.com
              </a>
              . We'll delete it within 14 days.
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              The sample student
            </h2>
            <p>
              When you explore the app before signing up, you see a sample
              student profile named "Priya." Priya is fictional demo data —
              not a real person, and no real student's information.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
