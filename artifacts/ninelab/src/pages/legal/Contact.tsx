import { Link } from "wouter";
import { Mail } from "lucide-react";
import { Footer } from "@/components/ninelab/Footer";

// Public legal/info page — not inside AppLayout. Wrapped like PublicResume /
// PublicCertificate: standalone, own bg-canvas background, own header.
export default function Contact() {
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
            Contact
          </h1>
          <p className="text-[13px] text-ink-muted mt-1">
            Last updated 2026-09-02
          </p>

          <div className="mt-6 space-y-4 text-[15px] text-ink leading-relaxed">
            <p>
              Questions, bugs, or feedback — write to us directly:
            </p>
            <a
              href="mailto:riteshrv3@gmail.com"
              className="inline-flex items-center gap-2 bg-brand-soft text-brand font-bold rounded-xl px-4 py-3 text-[15px]"
            >
              <Mail className="w-4 h-4" />
              riteshrv3@gmail.com
            </a>
            <p>We reply within 2 working days.</p>
            <p>
              To help us help you faster, please include your college name
              and which page of the app you were on when you write in.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
