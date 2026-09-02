import { Link } from "wouter";

// Shared footer for the marketing landing page and in-app screens that need
// legal/contact links (currently Profile). Kept intentionally small and
// muted — this is not a marketing surface, just a place for the four legal
// pages to be reachable from. `pb-[calc(6rem+env(safe-area-inset-bottom))]`
// clears BottomNav (h-16-ish + safe area) when this renders inside AppLayout
// on mobile; `lg:pb-8` is the plain desktop footer padding since SideNav
// doesn't overlay content on lg.
const LINKS = [
  { href: "/about", label: "About" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer
      data-testid="site-footer"
      className="pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8 pt-8 px-6 border-t border-line mt-8"
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-3 text-center lg:flex-row lg:justify-between lg:text-left">
        <div className="flex flex-col items-center gap-1 lg:items-start">
          <span className="text-[13px] font-extrabold text-ink">ninelab</span>
          <span className="text-[13px] text-ink-muted">
            Free for students. Made in India.
          </span>
        </div>

        <nav
          aria-label="Legal"
          className="flex items-center gap-4 flex-wrap justify-center"
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-[13px] font-semibold text-ink-muted hover:text-brand"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <span className="text-[13px] text-ink-muted">© 2026 ninelab</span>
      </div>
    </footer>
  );
}

export default Footer;
