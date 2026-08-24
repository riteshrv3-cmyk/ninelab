import type { jsPDF } from "jspdf";
import type { ResumeDocument, SectionKey } from "@workspace/resume-core";
import { PAGE, CONTENT_WIDTH } from "./geometry";
import { spacing, TYPE_SCALE, PALETTE, UPPERCASE_NAME_EXTRA_TRACKING, type SpacingRole } from "./tokens";
import { setStyle, measureText, wrapText, linesHeight, resetTracking } from "./measure";
import type { Chunk, Atom, ChunkSource } from "./typeset";
import type { TemplateConfig } from "./templateConfig";
import { DEFAULT_HEADING_LABELS } from "./templateConfig";

const ML = PAGE.marginLeft;
const CW = CONTENT_WIDTH;

let chunkCounter = 0;
function nextId(): string {
  chunkCounter++;
  return `c${chunkCounter}`;
}

/**
 * Measures both sides of a left/right pair (e.g. degree ↔ dates, project
 * title ↔ tech stack) and resolves a collision instead of letting either
 * side silently overflow or vanish: truncate the left with an ellipsis if
 * it would collide, or move the right onto its own line if it alone is too
 * wide to share the row.
 */
function placePair(doc: jsPDF, left: string, right: string, width: number): { leftText: string; rightOnOwnLine: boolean } {
  const rw = right ? measureText(doc, right) : 0;
  if (right && rw > width * 0.45) {
    return { leftText: left, rightOnOwnLine: true };
  }
  const gap = 12;
  const availableForLeft = width - gap - rw;
  let lw = measureText(doc, left);
  let leftText = left;
  while (lw > availableForLeft && leftText.length > 1) {
    leftText = leftText.slice(0, -1);
    lw = measureText(doc, `${leftText}…`);
  }
  if (leftText !== left) leftText = `${leftText}…`;
  return { leftText, rightOnOwnLine: false };
}

function bulletHangingIndent(doc: jsPDF, glyph: string, family: TemplateConfig["fontFamily"]): number {
  setStyle(doc, "body", family, {});
  return measureText(doc, `${glyph} `);
}

export interface BuildChunksOptions {
  /** Applied on top of the template's own density multiplier — the fit pass's
   * compression ladder scales this down (never below what's needed to avoid
   * a near-empty second page) or up (to fill a sparse single page). Leading
   * itself is never scaled — only whitespace (section/entry gaps) — so body
   * text density stays identical across every compression rung. */
  compressionMultiplier?: number;
}

export function buildChunks(doc: jsPDF, resume: ResumeDocument, config: TemplateConfig, opts: BuildChunksOptions = {}): Chunk[] {
  const density = config.density;
  const family = config.fontFamily;
  const compressionMultiplier = opts.compressionMultiplier ?? 1;
  const sp = (role: SpacingRole): number => spacing(role, density) * compressionMultiplier;
  const gw = bulletHangingIndent(doc, config.bullet.glyph, family);

  // ─── Header ───────────────────────────────────────────────────────────────
  const headerAtoms: Atom[] = [];
  let headerDy = 0;

  setStyle(doc, "name", family, { extraTracking: config.header.nameCase === "upper" ? UPPERCASE_NAME_EXTRA_TRACKING : 0 });
  const displayName = config.header.nameCase === "upper" ? resume.contact.name.toUpperCase() : resume.contact.name;
  const nameX = config.header.align === "center" ? PAGE.width / 2 : ML;
  headerAtoms.push({
    kind: "text", x: nameX, dy: headerDy, text: displayName, role: "name", family,
    align: config.header.align === "center" ? "center" : "left",
    extraTracking: config.header.nameCase === "upper" ? UPPERCASE_NAME_EXTRA_TRACKING : 0,
  });
  headerDy += TYPE_SCALE.name.leading;

  if (config.header.showHeadline && resume.headline) {
    setStyle(doc, "headline", family, {});
    const lines = wrapText(doc, resume.headline, CW);
    for (const line of lines) {
      headerAtoms.push({ kind: "text", x: nameX, dy: headerDy, text: line, role: "headline", family, color: PALETTE.muted, align: config.header.align === "center" ? "center" : "left" });
      headerDy += TYPE_SCALE.headline.leading;
    }
  }

  setStyle(doc, "contact", family, {});
  const contactParts = [resume.contact.email, resume.contact.phone, resume.contact.city, ...resume.contact.links.map((l) => l.label)].filter(Boolean) as string[];
  const contactLine = contactParts.join("   |   ");
  const contactLines = wrapText(doc, contactLine, CW);
  for (const line of contactLines) {
    headerAtoms.push({ kind: "text", x: nameX, dy: headerDy, text: line, role: "contact", family, color: PALETTE.muted, align: config.header.align === "center" ? "center" : "left" });
    headerDy += TYPE_SCALE.contact.leading;
  }

  if (config.header.accentBar) {
    headerAtoms.push({ kind: "rect", x: ML, dy: headerDy + sp("sm"), w: CW, h: config.header.accentBar.height, color: config.accent ?? PALETTE.ink });
    headerDy += sp("sm") + config.header.accentBar.height + sp("sm");
  } else if (config.sectionHeading.rule !== "none") {
    headerAtoms.push({ kind: "rule", x1: ML, x2: ML + CW, dy: headerDy + sp("sm"), weight: 1, color: PALETTE.rule });
    headerDy += sp("sm") * 2;
  }

  const headerChunk: Chunk = { id: nextId(), kind: "header", height: headerDy, gapBefore: 0, keepWithNextHeight: 0, atoms: headerAtoms };

  // ─── Section content builders — each returns its own chunks, unaware of headings ─
  const pushBulletsForEntry = (entryId: string, bullets: { text: string }[], sourceSection?: SectionKey, entryIndex?: number): Chunk[] => {
    const out: Chunk[] = [];
    for (let bIdx = 0; bIdx < bullets.length; bIdx++) {
      const b = bullets[bIdx];
      setStyle(doc, "body", family, {});
      const lines = wrapText(doc, b.text, CW - gw);
      const atoms: Atom[] = [];
      let dy = 0;
      lines.forEach((line, i) => {
        atoms.push({ kind: "text", x: ML + (i === 0 ? 0 : gw), dy, text: i === 0 ? `${config.bullet.glyph} ${line}` : line, role: "body", family, color: PALETTE.body });
        dy += TYPE_SCALE.body.leading;
      });
      const source: ChunkSource | undefined = sourceSection !== undefined && entryIndex !== undefined
        ? { section: sourceSection, entryIndex, bulletIndex: bIdx, field: "bulletText" }
        : undefined;
      out.push({ id: nextId(), entryId, kind: "bullet", height: dy, gapBefore: 0, keepWithNextHeight: 0, atoms, source });
    }
    return out;
  };

  const buildSummary = (): Chunk[] => {
    if (!resume.summary) return [];
    setStyle(doc, "body", family, {});
    const lines = wrapText(doc, resume.summary, CW);
    const atoms: Atom[] = [];
    let dy = 0;
    for (const line of lines) {
      atoms.push({ kind: "text", x: ML, dy, text: line, role: "body", family, color: PALETTE.body });
      dy += TYPE_SCALE.body.leading;
    }
    return [{ id: nextId(), kind: "line", height: dy, gapBefore: 0, keepWithNextHeight: 0, atoms, source: { section: "summary", field: "summary" } }];
  };

  const buildExperience = (): Chunk[] => {
    const out: Chunk[] = [];
    resume.experience.forEach((e, idx) => {
      const entryId = `exp${idx}`;
      const left = `${e.role}, ${e.company}`;
      const right = `${e.start} – ${e.end}`;
      const { leftText, rightOnOwnLine } = placePair(doc, left, right, CW);
      const headerHeight = rightOnOwnLine ? TYPE_SCALE.entry.leading + TYPE_SCALE.meta.leading : TYPE_SCALE.entry.leading;
      const firstBulletHeight = e.bullets.length > 0 ? linesHeight("body", wrapText(doc, e.bullets[0].text, CW - gw).length) : 0;

      const atoms: Atom[] = [];
      setStyle(doc, "entry", family, {});
      atoms.push({ kind: "text", x: ML, dy: 0, text: leftText, role: "entry", family, color: PALETTE.ink });
      setStyle(doc, "meta", family, {});
      if (rightOnOwnLine) {
        atoms.push({ kind: "text", x: ML, dy: TYPE_SCALE.entry.leading, text: right, role: "meta", family, color: PALETTE.muted });
      } else {
        atoms.push({ kind: "text", x: ML + CW, dy: 0, text: right, role: "meta", family, color: PALETTE.muted, align: "right" });
      }
      out.push({ id: nextId(), entryId, kind: "entryHeader", height: headerHeight, gapBefore: idx === 0 ? 0 : sp("lg"), keepWithNextHeight: firstBulletHeight, atoms });
      out.push(...pushBulletsForEntry(entryId, e.bullets, "experience", idx));
    });
    return out;
  };

  const buildProjects = (): Chunk[] => {
    const out: Chunk[] = [];
    resume.projects.forEach((p, idx) => {
      const entryId = `proj${idx}`;
      const techStr = p.tech.join(", ");
      const { leftText, rightOnOwnLine } = placePair(doc, p.title, techStr, CW);
      const headerHeight = rightOnOwnLine ? TYPE_SCALE.entry.leading + TYPE_SCALE.meta.leading : TYPE_SCALE.entry.leading;
      const firstBulletHeight = p.bullets.length > 0 ? linesHeight("body", wrapText(doc, p.bullets[0].text, CW - gw).length) : 0;

      const atoms: Atom[] = [];
      setStyle(doc, "entry", family, {});
      atoms.push({ kind: "text", x: ML, dy: 0, text: leftText, role: "entry", family, color: PALETTE.ink });
      if (techStr) {
        setStyle(doc, "meta", family, { styleOverride: "italic" });
        if (rightOnOwnLine) {
          atoms.push({ kind: "text", x: ML, dy: TYPE_SCALE.entry.leading, text: techStr, role: "meta", family, color: PALETTE.muted, styleOverride: "italic" });
        } else {
          atoms.push({ kind: "text", x: ML + CW, dy: 0, text: techStr, role: "meta", family, color: PALETTE.muted, styleOverride: "italic", align: "right" });
        }
      }
      out.push({ id: nextId(), entryId, kind: "entryHeader", height: headerHeight, gapBefore: idx === 0 ? 0 : sp("lg"), keepWithNextHeight: firstBulletHeight, atoms });
      out.push(...pushBulletsForEntry(entryId, p.bullets, "projects", idx));
    });
    return out;
  };

  const buildSkills = (): Chunk[] => {
    const out: Chunk[] = [];
    resume.skillSections.forEach((s, idx) => {
      setStyle(doc, "body", family, { styleOverride: "bold" });
      const label = `${s.category}: `;
      const lw = measureText(doc, label);
      setStyle(doc, "body", family, {});
      const lines = wrapText(doc, s.items.join(", "), CW - lw);
      const atoms: Atom[] = [];
      let dy = 0;
      atoms.push({ kind: "text", x: ML, dy: 0, text: label, role: "body", family, color: PALETTE.ink, styleOverride: "bold" });
      lines.forEach((line, i) => {
        atoms.push({ kind: "text", x: ML + lw, dy, text: line, role: "body", family, color: PALETTE.body });
        dy += TYPE_SCALE.body.leading;
        void i;
      });
      out.push({ id: nextId(), kind: "line", height: Math.max(dy, TYPE_SCALE.body.leading), gapBefore: idx === 0 ? 0 : sp("sm"), keepWithNextHeight: 0, atoms });
    });
    return out;
  };

  const buildEducation = (): Chunk[] => {
    const out: Chunk[] = [];
    resume.education.forEach((ed, idx) => {
      const left = `${ed.degree}, ${ed.institution}`;
      const right = `${ed.start} – ${ed.end}`;
      const { leftText, rightOnOwnLine } = placePair(doc, left, right, CW);
      const atoms: Atom[] = [];
      let dy = 0;
      setStyle(doc, "entry", family, {});
      atoms.push({ kind: "text", x: ML, dy: 0, text: leftText, role: "entry", family, color: PALETTE.ink });
      setStyle(doc, "meta", family, {});
      if (rightOnOwnLine) {
        atoms.push({ kind: "text", x: ML, dy: TYPE_SCALE.entry.leading, text: right, role: "meta", family, color: PALETTE.muted });
        dy = TYPE_SCALE.entry.leading + TYPE_SCALE.meta.leading;
      } else {
        atoms.push({ kind: "text", x: ML + CW, dy: 0, text: right, role: "meta", family, color: PALETTE.muted, align: "right" });
        dy = TYPE_SCALE.entry.leading;
      }
      const subline = ed.cgpa ? `CGPA ${ed.cgpa}` : "";
      if (subline) {
        setStyle(doc, "meta", family, {});
        const sublineLines = wrapText(doc, subline, CW);
        for (const line of sublineLines) {
          atoms.push({ kind: "text", x: ML, dy, text: line, role: "meta", family, color: PALETTE.muted });
          dy += TYPE_SCALE.meta.leading;
        }
      }
      out.push({ id: nextId(), kind: "line", height: dy, gapBefore: idx === 0 ? 0 : sp("md"), keepWithNextHeight: 0, atoms });
    });
    return out;
  };

  const buildListLines = (items: string[]): Chunk[] => {
    const out: Chunk[] = [];
    items.forEach((text, idx) => {
      setStyle(doc, "body", family, {});
      const full = `${config.bullet.glyph} ${text}`;
      const lines = wrapText(doc, full, CW - gw);
      const atoms: Atom[] = [];
      let dy = 0;
      lines.forEach((line, i) => {
        atoms.push({ kind: "text", x: ML + (i === 0 ? 0 : gw), dy, text: line, role: "body", family, color: PALETTE.body });
        dy += TYPE_SCALE.body.leading;
      });
      out.push({ id: nextId(), kind: "line", height: dy, gapBefore: idx === 0 ? 0 : sp("xs"), keepWithNextHeight: 0, atoms });
    });
    return out;
  };

  const buildAchievements = (): Chunk[] => {
    const out: Chunk[] = [];
    resume.achievements.forEach((a, idx) => {
      setStyle(doc, "body", family, {});
      const full = `${config.bullet.glyph} ${a.text}`;
      const lines = wrapText(doc, full, CW - gw);
      const atoms: Atom[] = [];
      let dy = 0;
      lines.forEach((line, i) => {
        atoms.push({ kind: "text", x: ML + (i === 0 ? 0 : gw), dy, text: line, role: "body", family, color: PALETTE.body });
        dy += TYPE_SCALE.body.leading;
      });
      out.push({ id: nextId(), kind: "line", height: dy, gapBefore: idx === 0 ? 0 : sp("xs"), keepWithNextHeight: 0, atoms, source: { section: "achievements", entryIndex: idx, field: "achievementText" } });
    });
    return out;
  };

  const SECTION_BUILDERS: Record<SectionKey, () => Chunk[]> = {
    summary: buildSummary,
    experience: buildExperience,
    projects: buildProjects,
    skills: buildSkills,
    education: buildEducation,
    certifications: () => buildListLines(resume.certifications.map((c) => `${c.name}, ${c.issuer}${c.date ? ` (${c.date})` : ""}`)),
    achievements: buildAchievements,
  };

  const SECTION_HAS_CONTENT: Record<SectionKey, boolean> = {
    summary: Boolean(resume.summary),
    experience: resume.experience.length > 0,
    projects: resume.projects.length > 0,
    skills: resume.skillSections.length > 0,
    education: resume.education.length > 0,
    certifications: resume.certifications.length > 0,
    achievements: resume.achievements.length > 0,
  };

  const buildSectionHeading = (key: SectionKey, firstContentHeight: number): Chunk => {
    const label = (config.headingLabels[key] ?? DEFAULT_HEADING_LABELS[key]).toUpperCase();
    const atoms: Atom[] = [];
    let dy = 0;
    if (config.sectionHeading.rule === "short" && config.accent) {
      setStyle(doc, "section", family, { color: config.accent });
      atoms.push({ kind: "text", x: ML, dy, text: label, role: "section", family, color: config.accent });
      dy += TYPE_SCALE.section.leading;
      atoms.push({ kind: "rule", x1: ML, x2: ML + 24, dy: dy + sp("xs"), weight: config.sectionHeading.ruleWeight, color: config.accent });
      dy += sp("xs") + sp("sm");
    } else {
      setStyle(doc, "section", family, {});
      atoms.push({ kind: "text", x: ML, dy, text: label, role: "section", family, color: PALETTE.ink });
      dy += TYPE_SCALE.section.leading;
      if (config.sectionHeading.rule === "full") {
        atoms.push({ kind: "rule", x1: ML, x2: ML + CW, dy: dy + sp("xs"), weight: config.sectionHeading.ruleWeight, color: PALETTE.rule });
        dy += sp("xs") + sp("sm");
      } else {
        dy += sp("sm");
      }
    }
    return { id: nextId(), kind: "sectionHeading", height: dy, gapBefore: sp("xl"), keepWithNextHeight: firstContentHeight, atoms };
  };

  const chunks: Chunk[] = [headerChunk];
  for (const key of resume.order) {
    if (!SECTION_HAS_CONTENT[key]) continue; // never lead with (or render) an empty section
    const content = SECTION_BUILDERS[key]();
    if (content.length === 0) continue;
    chunks.push(buildSectionHeading(key, content[0].height));
    chunks.push(...content);
  }

  resetTracking(doc);
  return chunks;
}
