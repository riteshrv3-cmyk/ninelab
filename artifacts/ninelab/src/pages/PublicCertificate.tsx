import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Award, Loader2 } from "lucide-react";
import { useGetPublicCertificate } from "@workspace/api-client-react";

/**
 * Public, unauthenticated certificate verify page (GET /api/certs/:slug),
 * mirroring PublicResume's structure: same loading spinner and 404 fallback,
 * rendered outside AppLayout so it never requires login or the student guard.
 */
export default function PublicCertificate({ slug }: { slug: string }) {
  const prefersReduced = useReducedMotion();
  const { data, isLoading, isError } = useGetPublicCertificate(slug);

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas text-ink">
        <div className="text-center space-y-2 p-8">
          <p className="text-display text-2xl font-extrabold">Certificate not found</p>
          <p className="text-ink-muted text-sm">This link may have been removed or expired.</p>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <Loader2 className="w-6 h-6 animate-spin text-ink-muted" />
      </div>
    );
  }

  const issued = new Date(data.issuedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const cardMotion = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4, ease: "easeOut" as const },
      };

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center px-4 py-10">
      <motion.div
        {...cardMotion}
        className="w-full max-w-2xl bg-paper rounded-2xl shadow-soft border border-line overflow-hidden"
      >
        {/* Formal double-rule frame */}
        <div className="m-4 lg:m-6 border-2 border-line rounded-xl">
          <div className="border border-line rounded-lg px-6 py-10 lg:px-12 lg:py-14 text-center">

            {/* Wordmark */}
            <p className="text-[13px] font-extrabold tracking-[0.35em] text-brand">
              NINELAB
            </p>

            {/* Verified badge */}
            <div className="mt-4 inline-flex items-center gap-1.5 bg-brand-soft rounded-full px-3 py-1">
              <ShieldCheck className="w-3.5 h-3.5 text-brand" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Verified</span>
            </div>

            <h1 className="text-display text-[26px] lg:text-[32px] font-extrabold text-ink leading-tight tracking-tight mt-6">
              Certificate of Completion
            </h1>
            <p className="text-[12px] text-ink-muted mt-2">This is to certify that</p>

            {/* Student name */}
            <p className="text-display text-[30px] lg:text-[40px] font-extrabold text-ink mt-3 leading-[1.1]">
              {data.studentName}
            </p>

            <p className="text-[13px] text-ink-muted mt-4 max-w-md mx-auto leading-relaxed">
              has successfully completed the course
            </p>

            {/* Course + domain */}
            <p className="text-[18px] lg:text-[20px] font-bold text-ink mt-1">
              {data.subDomainName}
            </p>
            <p className="text-[13px] text-ink-muted mt-0.5">{data.domainName}</p>

            {/* Skills covered */}
            {data.skillsCovered.length > 0 && (
              <p className="text-[12px] text-ink-muted mt-5 max-w-lg mx-auto leading-relaxed">
                <span className="font-bold text-ink">Skills covered:</span>{" "}
                {data.skillsCovered.join(" · ")}
              </p>
            )}

            {/* Score + honesty line */}
            <div className="mt-6 inline-flex items-center gap-2 bg-brand-soft rounded-full px-4 py-1.5">
              <Award className="w-4 h-4 text-brand" />
              <span className="text-[13px] font-bold text-brand">
                Final exam score {data.finalExamScore}%
              </span>
            </div>
            <p className="text-[11px] text-ink-muted mt-3 max-w-md mx-auto leading-relaxed">
              Passed a 70% final exam and an AI-evaluated mock interview
            </p>

            {/* Footer meta */}
            <div className="mt-8 pt-6 border-t border-line flex flex-col lg:flex-row items-center justify-center gap-1.5 lg:gap-8">
              <p className="text-[12px] text-ink-muted">
                Issued <span className="font-semibold text-ink">{issued}</span>
              </p>
              <p className="text-[12px] text-ink-muted">
                Certificate ID <span className="font-semibold text-ink font-mono">{data.certificateCode}</span>
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <p className="mt-6 text-[11px] text-ink-muted text-center">
        Verified by NINELAB — AI-powered career platform for students
      </p>
      <a
        href="/"
        className="mt-2 type-caption font-semibold text-brand text-center"
      >
        Made with ninelab — build yours free
      </a>
    </div>
  );
}
