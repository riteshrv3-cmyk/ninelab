// Date normalization shared by the auto-fixer (which rewrites dates) and the
// quality rules (which need to know whether a bad date is even mechanically
// fixable before advertising a one-tap fix for it).

const MONTHS: Record<string, string> = {
  jan: "Jan", january: "Jan", feb: "Feb", february: "Feb", mar: "Mar", march: "Mar",
  apr: "Apr", april: "Apr", may: "May", jun: "Jun", june: "Jun", jul: "Jul", july: "Jul",
  aug: "Aug", august: "Aug", sep: "Sep", sept: "Sep", september: "Sep",
  oct: "Oct", october: "Oct", nov: "Nov", november: "Nov", dec: "Dec", december: "Dec",
};
const MONTH_BY_NUMBER = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const MONTH_YEAR_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;
export const YEAR_RE = /^\d{4}$/;

/**
 * "June 2024" | "06/2024" | "2024-06" | "Jun'24" -> "Jun 2024". Values that
 * carry no month (a bare "2024") or are unparseable come back unchanged —
 * the fixer must never guess a month the student didn't write.
 */
export function normalizeDate(raw: string): string {
  const v = raw.trim();
  if (!v || v.toLowerCase() === "present") return v === raw ? raw : v;
  if (MONTH_YEAR_RE.test(v)) return v;

  let m = v.match(/^([A-Za-z]+)\.?\s*'?\s*(\d{2}|\d{4})$/); // "June 2024", "Jun'24"
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    if (month) {
      const year = m[2].length === 2 ? `20${m[2]}` : m[2];
      return `${month} ${year}`;
    }
  }
  m = v.match(/^(\d{1,2})\s*[\/.]\s*(\d{4})$/); // "06/2024"
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) return `${MONTH_BY_NUMBER[n]} ${m[2]}`;
  }
  m = v.match(/^(\d{4})\s*-\s*(\d{1,2})$/); // "2024-06"
  if (m) {
    const n = Number(m[2]);
    if (n >= 1 && n <= 12) return `${MONTH_BY_NUMBER[n]} ${m[1]}`;
  }
  return raw;
}

/** True when normalizeDate would actually change this value. */
export function isDateFixable(raw: string): boolean {
  return normalizeDate(raw) !== raw;
}

/** Digits that reformat to "+91 XXXXX XXXXX". */
export function isIndianMobileFixable(phone: string): boolean {
  return /^(91)?[6-9]\d{9}$/.test(phone.replace(/\D/g, ""));
}
