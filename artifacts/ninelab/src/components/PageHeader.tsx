import type { ReactNode } from "react";

// THE canopy header. Every tab-level page renders this instead of hand-rolled
// header markup, so the header system can never drift again (the design review
// found Resume and Jobs shipped plain-text headers while the rest had canopy).
//
// Composition contract (matches the app-wide canopy+sheet idiom):
//   <PageHeader title="Practice" subtitle="..." right={<HistoryChip/>} />
//   <div className="bg-paper rounded-t-3xl -mt-6 ...">  {/* the page's sheet */}
//
// The sheet stays page-owned — only the canopy is standardized. Back buttons
// are NOT rendered here: tab destinations never show back (TopBar owns the
// rare non-tab back affordance).

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned slot (e.g. a HISTORY chip or Build button). */
  right?: ReactNode;
  /** Extra rows inside the canopy (e.g. ProfileDemo's avatar block). */
  children?: ReactNode;
}

export function PageHeader({ title, subtitle, right, children }: PageHeaderProps) {
  return (
    <div className="bg-brand px-4 pt-6 pb-10">
      <div className="max-w-md lg:max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 text-left">
            <h1 className="text-display type-display font-extrabold text-white text-balance">
              {title}
            </h1>
            {subtitle && (
              <p className="type-caption text-white/80 mt-1">{subtitle}</p>
            )}
          </div>
          {right && <div className="flex-shrink-0 pt-1">{right}</div>}
        </div>
        {children}
      </div>
    </div>
  );
}
