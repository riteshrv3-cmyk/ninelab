# ninelab design system "Canopy" (v2) — conversion spec

Single source of truth for converting screens off the monochrome "W" look onto
the indigo UI-kit look the user chose (canopy header + white sheet, pill CTAs,
soft-shadow cards). This REPLACES `DESIGN_SYSTEM.md` v1 (the black-and-white
spec) — v1's non-negotiables (styling only, no logic changes) still apply.

## Tokens (already defined in index.css)

| Tailwind class | Value | Use for |
|---|---|---|
| `text-ink` / `bg-ink` | `#1a1d2e` | Headings, primary body text |
| `text-ink-muted` | `#5d6474` | Secondary text, captions, placeholders, inactive icons |
| `bg-paper` / `text-paper` | `#ffffff` | Sheets, cards, text on brand/ink surfaces |
| `bg-canvas` | `#f4f5f7` | Page background behind the white sheet |
| `border-line` / `bg-line` | `#ecedf3` | Hairline dividers, inactive track fills, input borders |
| `text-brand` / `bg-brand` | `#4a55c7` | Primary CTAs, active states, canopy background, icons-on-brand |
| `bg-brand-soft` | `#eef0fb` | Selected/active tile fills, subtle brand tint backgrounds |
| `text-highlight` / `bg-highlight` | `#f5a040` | ONLY calendar/date highlights, unread badges, "hot" emphasis |
| `text-done` / `bg-done` | `#22c55e` | ONLY a completed checkmark or a passing eligibility gate dot |
| `text-danger` / `bg-danger` | `#dc2626` | ONLY error messages, scam warnings, failing gate dots |
| `bg-toko` | `#4fb9a0` | ONLY surfaces where Toko is present or speaking — see the Toko section |
| `bg-toko-soft` | `#e6f5f1` | ONLY the tint behind something Toko is saying |
| `shadow-soft` | `0 8px 24px rgba(26,29,46,0.08)` | Cards and sheets that need to lift off the canvas |

Shadcn primitives (`Button`, `Badge`, `Switch`, etc.) already read brand indigo
via the repointed `--primary`/`--secondary`/`--accent` CSS vars — using the
plain shadcn component defaults is usually correct without extra classes.

## Hard replacement map (from the v1 monochrome pass)

| Old (v1 monochrome) | New (v2 canopy) |
|---|---|
| `bg-ink` on CTA buttons | `bg-brand` |
| `bg-paper` as the page background | `bg-canvas` (page) + white `bg-paper` sheet on top |
| `border border-line` as the only card treatment | `bg-paper rounded-2xl shadow-soft` (borders now optional, shadows are back) |
| `border-ink bg-line/40` (active/selected state) | `border-brand bg-brand-soft` |
| black toggles/switches (`bg-ink` when on) | `bg-brand` when on |
| flat `bg-ink` progress fill | `bg-brand` fill, `bg-line` track |
| plain hairline-divider lists | still fine for dense list rows; use cards for anything tappable/primary |

## Structural rules

1. **Canopy + sheet, for primary/flagship screens** (Home, Prep, Onboarding,
   and any screen with a back arrow + title as its header): render a solid
   `bg-brand` header block (back arrow + title, optionally step tabs), and
   place page content in a `bg-paper rounded-t-3xl` sheet that overlaps the
   bottom of the canopy by ~16-24px (negative margin or the canopy simply
   extends behind the sheet). Secondary/list screens (Inbox, InterviewHistory,
   Join) may skip the canopy and just sit on `bg-canvas` with a plain white
   TopBar — use judgment, don't force a canopy where the kit reference
   wouldn't have one.
2. **Step tabs** (used where a flow has stages, e.g. interview setup, resume
   builder): small `bg-paper` (inactive: `bg-white/20` on the canopy) rounded-xl
   tiles with icon + label; a completed tab gets a small `bg-done` check badge
   in its top-right corner. Active tab has a `border-2 border-brand` or solid
   fill per context.
3. **Primary button:** `bg-brand text-white font-bold rounded-full px-6 py-3.5`
   (kit CTAs are pills, not rounded rectangles). Secondary: `bg-paper text-brand
   border border-line rounded-full`. Never a gradient.
4. **Cards:** `bg-paper rounded-2xl shadow-soft p-4` (or `p-5`). Thumbnail/image
   left, bold title + muted meta row. Replace v1's hairline-only cards with
   this pattern wherever the card represents a tappable item (job, course,
   interview, application).
5. **List rows** that are dense/scannable (not card-like) can still use
   `components/ninelab/TaskRow.tsx`'s shape: `flex items-center gap-3 py-4
   border-t border-line first:border-t-0` — don't force every row into a card.
6. **Type scale:** page title `text-[26px]/[30px] font-extrabold text-ink
   leading-[1.06] tracking-tight` (white on canopy, ink on sheet); section
   label `text-[12px] font-bold uppercase tracking-wider text-ink-muted`;
   body `text-[14px] text-ink`; caption `text-[13px] text-ink-muted`.
   Type floor: 13px minimum for any text; only uppercase eyebrows with
   letter-spacing may be 12px. Muted grey is #5d6474 (ink-muted) — never
   lighter on white. The shared `index.css` type-scale utilities follow the
   same floor: `.type-micro` (chips, eyebrows, nav labels) is 13px/1.35,
   same as `.type-caption` — the old 11px value is gone.
7. **Icons / decorative elements:** functional icons (lucide) use `text-brand`
   when they represent an active/primary state, `text-ink-muted` otherwise.
   Domain tiles / category chips get `bg-brand-soft text-brand` instead of the
   v1 `border border-line bg-paper`. The one exception is Toko — he carries his
   own colours and is never tinted to brand (see the Toko section).
8. **Progress bars / rings / calendars:** track `bg-line`, fill `bg-brand`.
   Calendar "selected range" endpoints use `bg-highlight` (orange), matching
   the kit's date-picker. Score rings stay single-color (brand), not
   red/orange/green thresholds.
9. **Empty states:** `text-ink` headline, `text-ink-muted` sub-line, one
   `bg-brand` pill button. No generic illustrations or dashed boxes. The one
   exception is Toko (`pose="shrug"` or `pose="think"`) beside the message on
   the empty/loading states listed in the Toko section — he is not decoration,
   he is the same character the student is already talking to elsewhere in the
   app, so his presence there is continuity, not illustration for its own sake.
10. **Modals / sheets:** `bg-paper rounded-t-3xl shadow-soft`, overlay
    `bg-ink/40`, grabber `bg-line`. Follow the header / scrollable-body /
    pinned-footer structure established in `Prep.tsx`'s interview-setup drawer
    (fixed header with grabber + close button, `flex-1 min-h-0 overflow-y-auto`
    body, `flex-shrink-0 border-t border-line` footer holding the primary CTA)
    — this is what fixed the CTA-trapped-under-nav bug and must not regress.
    All sheets stay `z-[60]`, use `dvh` units for max-height, and pad for
    `env(safe-area-inset-bottom)`. On `lg:` the backdrop centers instead of
    bottom-anchoring (`items-end lg:items-center justify-center`) and the
    sheet becomes a centered rounded card (`lg:max-w-lg lg:rounded-3xl`,
    grabber `lg:hidden`) — see the v2.1 responsive pass in WP-B.

## Responsive rules (v2.1 — desktop)

The app was mobile-only; `lg` (1024px) is now the ONLY desktop breakpoint. Below
`lg` nothing changes — every rule here is `lg:`-ADDITIVE, never a replacement of
mobile markup. The shell already handles navigation: `BottomNav`/`TopBar` are
`lg:hidden`, `SideNav` (`components/layout/SideNav.tsx`) takes over at `lg:`,
and `AppLayout`'s `<main>` widens to `lg:max-w-5xl lg:px-8`. Screens only need
their own internal content to use that width instead of clamping to phone size.

1. **Remove/relax page-level `max-w-md`.** Any page-root or section wrapper
   with a hardcoded `max-w-md` (a mobile-era leftover — the shell now provides
   the outer width) should drop it, or override with `lg:max-w-none` /
   `lg:max-w-{2xl,3xl,5xl}` depending on content type (see below). Don't touch
   `max-w-md` on things that should legitimately stay narrow on desktop too
   (e.g. a single form field group) — use judgment.
2. **Card/list grids:** `grid grid-cols-1 lg:grid-cols-2 gap-4` for anything
   that was a single-column stack of cards (Opportunities feed, Prep's two
   mode cards, InterviewHistory sessions, Inbox invites, Resume's saved list,
   Pipeline's tracked applications). The Opportunities domain grid goes
   `grid-cols-3 lg:grid-cols-6`.
3. **Single-column reading/form content** (Course lessons, Onboarding, Join,
   AIChat thread, DriveCheck paste box, Test question) centers at
   `lg:max-w-2xl` or `lg:max-w-3xl mx-auto` depending on how text-heavy it is
   — don't stretch prose edge-to-edge on a wide screen.
4. **Canopy headers span the content area** — no extra width rule needed,
   they already stretch full-width of their container; just make sure the
   container itself isn't still clamped to `max-w-md`.
5. **Fullscreen routes** (`/practice/interview/:id`, `/onboarding` — no shell,
   no SideNav) widen their OWN centered column, e.g. `lg:max-w-2xl mx-auto`,
   since there's no shell-level max-width to inherit.
6. **Sheets/drawers on `lg:`** become centered dialogs, not bottom sheets —
   see rule 10 below; don't touch this per-screen, it's handled once per sheet.

## Toko

The ninelab toucan. Named for the toco toucan. Replaces the earlier "Kit"
persona (a lucide cat glyph plus a cat-pun voice) — Kit's naming and idioms
were an unrelated borrow with no visual identity behind them; Toko is an
actual character with a matching voice.

1. **Every render goes through `components/ninelab/Toko.tsx`.** Never
   import a pose file directly. This is what lets the artwork improve later
   (a hand-authored placeholder was replaced by a real 3D-render crop without
   touching a single call site) without hunting through every usage.
2. **Poses.** All five are real assets. `head` is the full head+collar bust,
   alpha-recovered from a flattened JPEG export (`scripts/dechecker.mjs`) —
   an earlier crop that trimmed the collar cut into the neck itself and read
   as the character being decapitated, so the crop was dropped in favour of
   the full bust. `hero`, `shrug`, `think`, `cheer` are the same bust sliced
   from one generated 2x2 pose sheet (`scripts/dechecker-grid.mjs`). This
   character has no established body beyond the bust, so gesture is carried
   only through head tilt, eyes, mouth and a single gloved arm — a prompt
   asking for a full standing figure with crossed arms just regenerated the
   familiar head shot instead of inventing new anatomy. The component still
   falls back to `head` if a pose file is ever missing.
3. **Colour.** `bg-toko` and `bg-toko-soft` are Toko's own tokens (`#4fb9a0`
   teal, `#e6f5f1` tint), scoped to surfaces where he is present or speaking —
   his avatar ring, his chat bubbles, the landing hero panel, the tint behind
   a "Toko noticed…" card. Never a CTA (indigo stays the only button colour)
   and never body text (at ~3:1 on white, `--color-toko` fails text contrast —
   fill only). His beak reuses `--color-highlight`, which is why rule 8 and
   the non-negotiable both now mention him.
4. **Voice.** First person, lowercase, short. He reports work the product
   actually does — reading boards, updating a profile, remembering a chat —
   never species puns, never "meow"/"purr", no 🐾. The bar: every line should
   describe something the backend genuinely did or is doing.
5. **Where he shows up today:** nav (`TokoBubble`, `SideNav`), the AI chat
   avatar and header, Home's canopy corner and noticing card, the landing
   page hero, and — per the amendment to rule 9 — the empty/loading states on
   Opportunities (per-group empty card, feed loading row), the offline banner,
   and Notebook's empty state.
6. **Never tint him.** Rule 7's brand-tinting convention for icons explicitly
   excludes Toko — he keeps his own colours in every context, including on
   the brand-indigo canopy.

## Non-negotiable

- Do NOT change any logic, state, data fetching, handler, hook, route, or
  `data-testid`. Styling and presentational markup only.
- Keep all existing functionality working. `npx tsc --noEmit` must pass.
- Do not delete features. Do not rename exports.
- `bg-done` (green) is reserved for completed/passing states only — never a
  general accent. `bg-danger` (red) is reserved for errors/scam warnings only
  — never a general accent. `bg-highlight` (orange) is for calendar/badge
  emphasis or Toko's beak/highlight colouring only — don't use it as a second
  CTA color. `bg-toko`/`bg-toko-soft` follow the same rule: scoped to Toko, not
  a general second accent — see the Toko section.
- Do not regress the sheet-overlay fix: no `willChange`/`backfaceVisibility`
  on the AppLayout page-fade wrapper, and every bottom sheet keeps its
  header/scrollable-body/pinned-footer structure.
- Do not regress mobile: every change in the v2.1 responsive pass must be a
  `lg:`-prefixed ADDITION. The rendered result below `lg` (1024px) must be
  pixel-equivalent to before the pass — if you're unsure, diff the classes
  you touched and confirm none of the unprefixed ones changed.

## v3 — Gwava-inspired refresh (display type, motion, momentum)

Adds drama to the marketing surfaces and restores the daily-momentum loop,
without touching Canopy's palette or Toko. Everything below is additive to
v2/v2.1 — no rule above is superseded.

1. **Display font.** `--font-display` (Bricolage Grotesque, weights 500-800)
   carries headings; body copy stays on `--font-sans` (Plus Jakarta). Applied
   in-app via `style={{ fontFamily: "var(--font-display)" }}` on h1/h2-level
   headings, wordmarks, and the Today canopy's `{firstName}.` greeting.
2. **Serif accent — marketing only.** `--font-serif` (Source Serif 4, already
   vendored under `public/fonts/resume/` for the PDF engine, now also exposed
   via `@font-face`) sets italic accent words in landing/onboarding headlines
   only (`.accent-serif` class). Never used in-app or for running text.
3. **Lowercase voice — marketing only.** The `.marketing` wrapper class
   (landing `RoleSelect.tsx`, onboarding `WizardShell.tsx`) lowercases `h1`/
   `h2` and switches them to the display font via a scoped CSS rule in
   `index.css`. In-app headings (Today, Resume, Profile, etc.) stay sentence
   case — lowercase is a marketing-voice choice, not a type-system default.
4. **Motion language.** Entrances: 300-500ms, `ease: "easeOut"`, 60-90ms
   stagger between siblings (`whileInView` with `viewport={{ once: true }}`
   for scroll-triggered marketing reveals; mount-based stagger for in-app
   lists like Today's task rows). Interactive elements get a spring
   (`type: "spring", stiffness: 380, damping: 32`) for shared-element
   transitions — see the nav active-pill below. Every new animation checks
   `useReducedMotion()` and renders the settled state statically when true;
   this is not optional, it's the same bar as the elevation system's own
   `prefers-reduced-motion` kill switch in `index.css`.
5. **Nav active indicator.** BottomNav and SideNav each render a
   `motion.div layoutId="bottomnav-pill"` / `"sidenav-pill"` behind the
   active item — framer-motion cross-fades/slides it between tabs on
   navigation. Two distinct `layoutId`s (mobile vs desktop) because both
   shells can be mounted in the same tree at different breakpoints; sharing
   one id would fight over the animation.
6. **5-item nav, Today first.** `navItems.ts` now leads with `{ href: "/home",
   icon: Flame, label: "Today" }` ahead of Resume/Jobs/Prep/Profile — the
   daily-momentum hub (streak, XP, task list) is the app's entry point again,
   not a hidden route. `App.tsx`'s post-login redirect (`/` → `/resume` for
   returning users, `/onboarding` for new ones) is unchanged; Today is reached
   via the nav, not the landing funnel.
7. **Streak chip.** `Flame` icon in `text-highlight` (the existing "hot
   emphasis" token, rule 8 above — a streak is exactly that: momentum
   emphasis, not a new accent) + tabular-nums count, shown in `TopBar`
   (mobile) and `SideNav` (desktop) whenever `streakCount > 0`, tappable to
   `/home`. Sourced from `useStudentProfile` (already fetched once by
   `AppLayout`) rather than a second request.
8. **XP / level.** Real stored columns (`students.xp`, `students.level`),
   not client-side math beyond the level formula (`floor(xp / 500) + 1`,
   duplicated in `lib/dailyTasks.ts` and `routes/quests.ts` — keep both in
   sync if the curve ever changes). Awarded server-side in `completeTask()`:
   +20 xp per task, +50 bonus for finishing every task that day, symmetric
   subtraction on uncomplete (no bonus clawback — accepted asymmetry on an
   edge case). Today's canopy renders it as a `bg-white/20` track + `bg-white`
   fill progress bar under the streak line, matching the wizard's
   `WizardProgress` fill pattern (rule: reuse the same progress-bar idiom
   everywhere one is needed, don't invent a second visual language for it).
