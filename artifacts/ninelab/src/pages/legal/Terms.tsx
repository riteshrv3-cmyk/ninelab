import { Link } from "wouter";
import { Footer } from "@/components/ninelab/Footer";

// Public legal/info page — not inside AppLayout. Wrapped like PublicResume /
// PublicCertificate: standalone, own bg-canvas background, own header.
export default function Terms() {
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
            Terms
          </h1>
          <p className="text-[13px] text-ink-muted mt-1">
            Last updated 2026-09-02
          </p>

          <div className="mt-6 space-y-4 text-[15px] text-ink leading-relaxed">
            <p>ninelab is free for students to use.</p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              No guarantees
            </h2>
            <p>
              We don't guarantee that using ninelab will get you a job or a
              particular interview outcome. The app is here to help you
              prepare — the result is still up to the process you go
              through and the companies you apply to.
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              Certificates
            </h2>
            <p>
              Certificates you earn on ninelab are ninelab's own — they are
              not issued by, or affiliated with, any university or company.
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              Acceptable use
            </h2>
            <p>
              Don't scrape the app, create fake profiles, or abuse the AI
              interviewer (for example, trying to break it or use it for
              anything other than practicing for your own interviews).
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              Changes to the service
            </h2>
            <p>
              ninelab may change, add, remove, or pause features at any
              time as we keep building it.
            </p>

            <h2 className="text-[16px] font-bold text-ink mt-6">
              Governing law
            </h2>
            <p>These terms are governed by the laws of India.</p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
