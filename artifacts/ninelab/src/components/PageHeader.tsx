import type { ReactNode } from "react";

// THE canopy header. Every tab-level page renders this instead of hand-rolled
// header markup, so the header system can never drift again (the design review
// found Resume and Jobs shipped plain-text headers while the rest had canopy).
//
// Composition contract (matches the app-wide canopy+sheet idiom):
//   <PageHeader title="Practice" subtitle="..." right={<HistoryChip/>} />
//   <div className={cn("bg-paper rounded-t-3xl -mt-6 ...", PAGE_CONTAINER)}>  {/* the page's sheet */}
//
// The sheet stays page-owned — only the canopy is standardized. Back buttons
// are NOT rendered here: tab destinations never show back (TopBar owns the
// rare non-tab back affordance).
//
// Alignment contract: the header's title and a page's content only line up on
// desktop if BOTH the canopy's inner box and the content wrapper apply their
// horizontal gutter and centering on the SAME div (padding applied to an
// already-mx-auto-centered box shifts that box's text left edge by the padding
// amount; a title in a box that clamps at a different max-width lands
// somewhere else entirely — that's what caused the desktop misalignment).
//
// There are therefore two widths, and a page must use the one that matches
// what its own content wrapper does:
//
//   default (READING_CONTAINER, below) — `px-4 max-w-md mx-auto lg:max-w-2xl`,
//     identical to the `p-4 max-w-md lg:max-w-2xl mx-auto` sheet that
//     single-column reading pages (Resume, ResumeDemo) still render. This is
//     the default precisely because those pages cannot be asked to change.
//
//   `wide` (PAGE_CONTAINER) — lg:max-w-5xl with no lg gutter, matching
//     AppLayout's <main> (lg:max-w-5xl lg:px-8) so it is a no-op clamp that
//     just fills main's 960px inner width. Pages whose content is a card grid
//     (Prep, ExploreHome, Opportunities) pass `wide` AND apply PAGE_CONTAINER
//     to their own content wrapper, so a 2-col PAGE_GRID actually benefits
//     from the width instead of being squeezed into a ~640px column under a
//     full-width canopy background.
//
// Pages that render their own content wrapper instead of composing via
// `children` should apply the matching constant on that wrapper rather than
// re-deriving the max-w/padding values by hand.
export const PAGE_CONTAINER = "px-4 max-w-md mx-auto lg:max-w-5xl lg:px-0";
/** Default (non-`wide`) header width — a single-column reading measure. */
export const READING_CONTAINER = "px-4 max-w-md mx-auto lg:max-w-2xl";
// Opt-in 2-column card grid for lg — pairs with PAGE_CONTAINER on the same
// or a nested element. Kept separate since not every page's content is a
// card grid (e.g. Resume's saved-list vs. a single reading column).
export const PAGE_GRID = "grid grid-cols-1 lg:grid-cols-2 gap-4";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-aligned slot (e.g. a HISTORY chip or Build button). */
  right?: ReactNode;
  /** Extra rows inside the canopy (e.g. ProfileDemo's avatar block). */
  children?: ReactNode;
  /**
   * Widen the canopy's inner box to PAGE_CONTAINER (lg:max-w-5xl) for pages
   * whose content wrapper also uses PAGE_CONTAINER. Leave off for pages whose
   * content is a single reading column at lg:max-w-2xl.
   */
  wide?: boolean;
}

export function PageHeader({ title, subtitle, right, children, wide }: PageHeaderProps) {
  return (
    <div className="bg-brand pt-6 pb-10">
      <div className={wide ? PAGE_CONTAINER : READING_CONTAINER}>
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
