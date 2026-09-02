import { Link } from "wouter";
import { Footer } from "@/components/ninelab/Footer";

// Public legal/info page — not inside AppLayout. Wrapped like PublicResume /
// PublicCertificate: standalone, own bg-canvas background, own header.
export default function About() {
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
            About ninelab
          </h1>
          <p className="text-[13px] text-ink-muted mt-1">
            Last updated 2026-09-02
          </p>

          <div className="mt-6 space-y-4 text-[15px] text-ink leading-relaxed">
            <p>
              ninelab is a free, placement-season app for Indian engineering
              students. It brings together the things placement season
              actually asks of you — job and internship listings, an
              AI-built resume, AI mock interviews, and courses that end in a
              verifiable certificate — in one place.
            </p>
            <p>
              You can explore the entire app through a sample student before
              signing up for anything. There's no signup wall on the way in:
              open the app and look around first, and only give us your name
              the first time you do something for real.
            </p>
            <p>
              ninelab is for students at Indian engineering colleges getting
              ready for placements — first-time job seekers who want to walk
              into interviews with a real resume, real practice, and proof
              they can show a recruiter.
            </p>
            <p>
              This is an early product built by a small team. We're still
              adding to it, and we'd rather ship something useful now than
              wait for it to be perfect.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
