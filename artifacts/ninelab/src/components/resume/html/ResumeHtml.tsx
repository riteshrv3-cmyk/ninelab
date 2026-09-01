// The one resume renderer: the live preview, the review-flow preview, and the
// printed PDF are all this component — so what a student sees on screen and
// what they download can never disagree. Values are in pt (CSS understands pt
// natively), matching lib/resume-pdf/geometry.ts's A4 page exactly.

import { useEffect, useRef } from "react";
import type { ResumeDocument, SectionKey } from "@workspace/resume-core";
import { resolveTemplateConfig } from "@/lib/resume-pdf";
import { DEFAULT_HEADING_LABELS } from "@/lib/resume-pdf/templateConfig";
import { PAGE, CONTENT_HEIGHT } from "@/lib/resume-pdf/geometry";
import { themeFor } from "./htmlTheme";

export interface ResumeClickTarget {
  section: SectionKey;
  field: "summary" | "bulletText" | "achievementText";
  entryIndex?: number;
  bulletIndex?: number;
}

export interface ResumeMeasure {
  heightPt: number;
  pages: number;
  fillPct: number;
}

export interface ResumeHtmlProps {
  doc: ResumeDocument;
  templateId: string;
  /** ReviewFlow: this section stays vivid, all others dim to 55%. Accepts
   * "contact"/"header" (the header block) or any SectionKey. */
  highlightSection?: string;
  onElementClick?: (target: ResumeClickTarget, el: HTMLElement) => void;
  onMeasure?: (m: ResumeMeasure) => void;
}

// The exact faces the print document embeds — injected for the in-app preview
// too, so preview and PDF shape text with the same fonts (identical widths,
// wrapping, and page-fit measurements).
export const RESUME_FONT_CSS = `
@font-face { font-family: "Source Sans 3"; src: url("/fonts/resume/SourceSans3-Regular.ttf") format("truetype"); font-weight: 400; font-style: normal; font-display: block; }
@font-face { font-family: "Source Sans 3"; src: url("/fonts/resume/SourceSans3-SemiBold.ttf") format("truetype"); font-weight: 600; font-style: normal; font-display: block; }
@font-face { font-family: "Source Sans 3"; src: url("/fonts/resume/SourceSans3-Italic.ttf") format("truetype"); font-weight: 400; font-style: italic; font-display: block; }
@font-face { font-family: "Source Serif 4"; src: url("/fonts/resume/SourceSerif4-Regular.ttf") format("truetype"); font-weight: 400; font-style: normal; font-display: block; }
@font-face { font-family: "Source Serif 4"; src: url("/fonts/resume/SourceSerif4-SemiBold.ttf") format("truetype"); font-weight: 600; font-style: normal; font-display: block; }
@font-face { font-family: "Source Serif 4"; src: url("/fonts/resume/SourceSerif4-Italic.ttf") format("truetype"); font-weight: 400; font-style: italic; font-display: block; }
`;

// Class-based stylesheet shared verbatim between the in-app preview (injected
// once into <head>) and the print document (inlined by printResume.ts).
export const RESUME_HTML_CSS = `
.rz-page {
  box-sizing: border-box;
  width: ${PAGE.width}pt;
  min-height: ${PAGE.height}pt;
  padding: ${PAGE.marginTop}pt ${PAGE.marginRight}pt ${PAGE.marginBottom}pt ${PAGE.marginLeft}pt;
  background: #ffffff;
  color: var(--r-ink);
  font-family: var(--r-font);
  font-size: var(--r-body-size);
  line-height: var(--r-body-leading);
  text-align: left;
}
.rz-page * { margin: 0; padding: 0; box-sizing: border-box; }
.rz-page a { color: var(--r-ink); text-decoration: none; }
.rz-page p, .rz-page li { overflow-wrap: break-word; hyphens: none; color: var(--r-body-color); }

.rz-accent-bar { height: 3pt; background: var(--r-accent); margin-bottom: var(--r-space-md); }

.rz-header { text-align: var(--r-header-align); margin-bottom: var(--r-space-lg); }
.rz-name {
  font-size: var(--r-name-size);
  line-height: var(--r-name-leading);
  letter-spacing: var(--r-name-tracking);
  font-weight: 600;
  color: var(--r-ink);
}
.rz-name--upper { text-transform: uppercase; }
.rz-headline { font-size: var(--r-headline-size); line-height: var(--r-headline-leading); color: var(--r-body-color); margin-top: 1.5pt; }
.rz-contact { font-size: var(--r-contact-size); line-height: var(--r-contact-leading); color: var(--r-muted); margin-top: 3pt; }
.rz-contact a { color: var(--r-body-color); }
.rz-contact-sep { padding: 0 3pt; color: var(--r-rule); }

.rz-section { margin-top: var(--r-space-xl); break-inside: auto; }
.rz-section:first-of-type { margin-top: 0; }
.rz-section-heading {
  font-size: var(--r-section-size);
  line-height: var(--r-section-leading);
  letter-spacing: var(--r-section-tracking);
  font-weight: 600;
  text-transform: uppercase;
  color: var(--r-ink);
  margin-bottom: var(--r-space-sm);
  break-after: avoid;
}
.rz-rule--full { border-bottom: 0.5pt solid var(--r-rule); padding-bottom: 2pt; }
.rz-rule--short { position: relative; padding-bottom: 4pt; }
.rz-rule--short::after { content: ""; position: absolute; left: 0; bottom: 0; width: 24pt; height: 2pt; background: var(--r-accent); }

.rz-entry { margin-bottom: var(--r-space-md); break-inside: avoid; }
.rz-entry:last-child { margin-bottom: 0; }
.rz-entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8pt; }
.rz-entry-title { font-size: var(--r-entry-size); line-height: var(--r-entry-leading); font-weight: 600; color: var(--r-ink); }
.rz-entry-title .rz-entry-co { font-weight: 400; color: var(--r-body-color); }
.rz-entry-meta {
  font-size: var(--r-meta-size);
  line-height: var(--r-meta-leading);
  letter-spacing: var(--r-meta-tracking);
  color: var(--r-muted);
  white-space: nowrap;
}
.rz-entry-sub { font-size: var(--r-meta-size); line-height: var(--r-meta-leading); letter-spacing: var(--r-meta-tracking); color: var(--r-muted); margin-top: 0.5pt; }
.rz-entry-sub a { color: var(--r-muted); }

.rz-bullets { list-style: none; margin-top: var(--r-space-xs); }
.rz-bullets li {
  position: relative;
  padding-left: 12pt;
  font-size: var(--r-body-size);
  line-height: var(--r-body-leading);
  margin-bottom: var(--r-space-xs);
  break-inside: avoid;
}
.rz-bullets li:last-child { margin-bottom: 0; }
.rz-bullets li::before { content: var(--r-bullet-glyph); position: absolute; left: 2pt; color: var(--r-body-color); }

.rz-summary { font-size: var(--r-body-size); line-height: var(--r-body-leading); }
.rz-skill-row { font-size: var(--r-body-size); line-height: var(--r-body-leading); margin-bottom: var(--r-space-xs); color: var(--r-body-color); }
.rz-skill-row b { color: var(--r-ink); font-weight: 600; }

.rz-clickable { cursor: pointer; border-radius: 2pt; }
.rz-clickable:hover { background: rgba(74, 85, 199, 0.08); outline: 1px solid rgba(74, 85, 199, 0.35); }
.rz-dim { opacity: 0.45; transition: opacity 0.2s; }
.rz-highlight { outline: 2px solid rgba(74, 85, 199, 0.5); outline-offset: 4pt; border-radius: 2pt; }
`;

let cssInjected = false;
function ensurePreviewCss(): void {
  if (cssInjected || typeof document === "undefined") return;
  if (document.getElementById("rz-resume-css")) { cssInjected = true; return; }
  const style = document.createElement("style");
  style.id = "rz-resume-css";
  style.textContent = RESUME_FONT_CSS + RESUME_HTML_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

function joinDates(start: string, end: string): string {
  const parts = [start, end].map((s) => s.trim()).filter(Boolean);
  return parts.join(" – ");
}

export function ResumeHtml({ doc, templateId, highlightSection, onElementClick, onMeasure }: ResumeHtmlProps) {
  const config = resolveTemplateConfig(templateId);
  const theme = themeFor(config);
  // The page box carries A4 min-height, so the fill meter measures the inner
  // content wrapper (real content height) — never the padded page itself.
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensurePreviewCss();
  }, []);

  useEffect(() => {
    if (!onMeasure) return;
    const el = contentRef.current;
    if (!el) return;
    const report = () => {
      // offsetHeight is unaffected by ancestor transforms; px → pt is ×0.75.
      const heightPt = el.offsetHeight * 0.75;
      const pages = Math.max(1, Math.ceil(heightPt / CONTENT_HEIGHT));
      const lastPageHeight = heightPt - (pages - 1) * CONTENT_HEIGHT;
      const fillPct = Math.min(100, Math.round((lastPageHeight / CONTENT_HEIGHT) * 100));
      onMeasure({ heightPt, pages, fillPct });
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onMeasure, JSON.stringify(doc), templateId]);

  const labelFor = (key: SectionKey) => config.headingLabels[key] ?? DEFAULT_HEADING_LABELS[key];

  const dimmed = (key: string) =>
    highlightSection && highlightSection !== key && !(key === "header" && (highlightSection === "contact" || highlightSection === "header"))
      ? "rz-dim"
      : highlightSection === key || (key === "header" && (highlightSection === "contact" || highlightSection === "header"))
        ? "rz-highlight"
        : "";

  const clickable = (target: ResumeClickTarget) =>
    onElementClick
      ? {
          className: "rz-clickable",
          onClick: (e: React.MouseEvent<HTMLElement>) => {
            e.stopPropagation();
            onElementClick(target, e.currentTarget);
          },
        }
      : { className: "" };

  const heading = (key: SectionKey) => (
    <p className={`rz-section-heading ${config.sectionHeading.rule === "full" ? "rz-rule--full" : config.sectionHeading.rule === "short" ? "rz-rule--short" : ""}`}>
      {labelFor(key)}
    </p>
  );

  const sections: Partial<Record<SectionKey, React.ReactNode>> = {};

  if (doc.summary.trim()) {
    const c = clickable({ section: "summary", field: "summary" });
    sections.summary = (
      <section key="summary" className={`rz-section ${dimmed("summary")}`} data-rz-section="summary">
        {heading("summary")}
        <p className={`rz-summary ${c.className}`} onClick={c.onClick}>{doc.summary}</p>
      </section>
    );
  }

  if (doc.skillSections.length > 0) {
    sections.skills = (
      <section key="skills" className={`rz-section ${dimmed("skills")}`} data-rz-section="skills">
        {heading("skills")}
        {doc.skillSections.map((s, i) => (
          <p key={i} className="rz-skill-row">
            <b>{s.category}:</b> {s.items.join(", ")}
          </p>
        ))}
      </section>
    );
  }

  if (doc.experience.length > 0) {
    sections.experience = (
      <section key="experience" className={`rz-section ${dimmed("experience")}`} data-rz-section="experience">
        {heading("experience")}
        {doc.experience.map((e, ei) => (
          <div key={ei} className="rz-entry">
            <div className="rz-entry-head">
              <p className="rz-entry-title">
                {e.role}
                {e.company && <span className="rz-entry-co"> · {e.company}</span>}
              </p>
              <p className="rz-entry-meta">{joinDates(e.start, e.end)}</p>
            </div>
            {(e.location || e.employmentType) && (
              <p className="rz-entry-sub">{[e.employmentType, e.location].filter(Boolean).join(" · ")}</p>
            )}
            <ul className="rz-bullets">
              {e.bullets.map((b, bi) => {
                const c = clickable({ section: "experience", field: "bulletText", entryIndex: ei, bulletIndex: bi });
                return <li key={bi} className={c.className} onClick={c.onClick}>{b.text}</li>;
              })}
            </ul>
          </div>
        ))}
      </section>
    );
  }

  if (doc.projects.length > 0) {
    sections.projects = (
      <section key="projects" className={`rz-section ${dimmed("projects")}`} data-rz-section="projects">
        {heading("projects")}
        {doc.projects.map((p, pi) => (
          <div key={pi} className="rz-entry">
            <div className="rz-entry-head">
              <p className="rz-entry-title">{p.title}</p>
              {p.tech.length > 0 && <p className="rz-entry-meta">{p.tech.join(" · ")}</p>}
            </div>
            {p.link && (
              <p className="rz-entry-sub">
                <a href={p.link.startsWith("http") ? p.link : `https://${p.link}`}>{p.link.replace(/^https?:\/\//, "")}</a>
              </p>
            )}
            <ul className="rz-bullets">
              {p.bullets.map((b, bi) => {
                const c = clickable({ section: "projects", field: "bulletText", entryIndex: pi, bulletIndex: bi });
                return <li key={bi} className={c.className} onClick={c.onClick}>{b.text}</li>;
              })}
            </ul>
          </div>
        ))}
      </section>
    );
  }

  if (doc.education.length > 0) {
    sections.education = (
      <section key="education" className={`rz-section ${dimmed("education")}`} data-rz-section="education">
        {heading("education")}
        {doc.education.map((ed, i) => (
          <div key={i} className="rz-entry">
            <div className="rz-entry-head">
              <p className="rz-entry-title">
                {ed.degree}
                {ed.institution && <span className="rz-entry-co"> · {ed.institution}</span>}
              </p>
              <p className="rz-entry-meta">{joinDates(ed.start, ed.end)}</p>
            </div>
            {(ed.field || ed.cgpa) && (
              <p className="rz-entry-sub">{[ed.field, ed.cgpa ? `CGPA ${ed.cgpa}` : null].filter(Boolean).join(" · ")}</p>
            )}
          </div>
        ))}
      </section>
    );
  }

  if (doc.certifications.length > 0) {
    sections.certifications = (
      <section key="certifications" className={`rz-section ${dimmed("certifications")}`} data-rz-section="certifications">
        {heading("certifications")}
        <ul className="rz-bullets">
          {doc.certifications.map((c, i) => (
            <li key={i}>
              {c.name}
              {c.issuer && ` — ${c.issuer}`}
              {c.date && ` (${c.date})`}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (doc.achievements.length > 0) {
    sections.achievements = (
      <section key="achievements" className={`rz-section ${dimmed("achievements")}`} data-rz-section="achievements">
        {heading("achievements")}
        <ul className="rz-bullets">
          {doc.achievements.map((a, i) => {
            const c = clickable({ section: "achievements", field: "achievementText", entryIndex: i });
            return <li key={i} className={c.className} onClick={c.onClick}>{a.text}</li>;
          })}
        </ul>
      </section>
    );
  }

  const contactBits: React.ReactNode[] = [];
  const pushBit = (node: React.ReactNode, key: string) => {
    if (contactBits.length > 0) contactBits.push(<span key={`sep-${key}`} className="rz-contact-sep">·</span>);
    contactBits.push(<span key={key}>{node}</span>);
  };
  if (doc.contact.email) pushBit(doc.contact.email, "email");
  if (doc.contact.phone) pushBit(doc.contact.phone, "phone");
  if (doc.contact.city) pushBit(doc.contact.city, "city");
  for (const [i, link] of doc.contact.links.entries()) {
    pushBit(<a href={link.url.startsWith("http") ? link.url : `https://${link.url}`}>{link.label}</a>, `link-${i}`);
  }

  return (
    <div className="rz-page" style={theme as React.CSSProperties} data-rz-template={config.id}>
      <div ref={contentRef}>
        {config.header.accentBar && <div className="rz-accent-bar" />}
        <header className={`rz-header ${dimmed("header")}`} data-rz-section="header">
          <p className={`rz-name ${config.header.nameCase === "upper" ? "rz-name--upper" : ""}`}>{doc.contact.name}</p>
          {config.header.showHeadline && doc.headline.trim() && <p className="rz-headline">{doc.headline}</p>}
          {contactBits.length > 0 && <p className="rz-contact">{contactBits}</p>}
        </header>
        {doc.order.map((key) => sections[key] ?? null)}
      </div>
    </div>
  );
}
