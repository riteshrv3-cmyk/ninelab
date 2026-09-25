import { db } from "@workspace/db";
import { driveChecksTable, tpoDrivesTable } from "@workspace/db";
import { eq, and, desc, gte, ilike, sql } from "drizzle-orm";

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function parseFirstNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.toString().match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

export function normalizeBranch(b: string): string {
  const x = b.toLowerCase().trim();
  // The profile's CS-family fields ("Information Technology", "Data Science",
  // "Artificial Intelligence", "Cybersecurity") failed every branch gate.
  if (
    x.includes("comp") || x === "cse" || x === "cs" || x === "it" || x.includes("software") ||
    x.includes("information tech") || x.includes("data science") || x.includes("artificial intel") ||
    x === "ai" || x === "aiml" || x === "ai/ml" || x.includes("machine learning") || x.includes("cyber")
  ) return "cse";
  if (x.includes("electronic") || x === "ece" || x === "etc" || x === "ete") return "ece";
  if (x.includes("electric") || x === "eee" || x === "ee") return "eee";
  if (x.includes("mech")) return "mech";
  if (x.includes("civil")) return "civil";
  if (x.includes("chem")) return "chem";
  if (x === "all" || x.includes("any") || x.includes("circuit")) return "all";
  return x;
}

/**
 * Graduation (batch) year for a student in `year` of a 4-year degree. The
 * academic year starts in July: in Sep 2026 a final-year student is the 2027
 * batch. The old fixed "2026 + (4 - year)" was a year early from July on.
 */
export function graduationYear(year: number, now = new Date()): number | null {
  if (!year) return null;
  const startYear = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return startYear + (5 - year);
}

export interface EligibilityInput {
  cgpaCutoff: number | null;
  branches: string[];
  batch: string | null;
}

export interface EligibilityGate {
  open: boolean;
  label: string;
}

/** Deterministic eligibility gates — never trust the LLM's opinion on whether a student qualifies. */
export function computeEligibilityGates(
  student: { cgpa: string | null; field: string; year: number; targetBatch?: number | null },
  parsed: EligibilityInput,
): { gates: Record<string, EligibilityGate>; gatesOpen: number; gatesTotal: number } {
  const studentCgpa = parseFirstNumber(student.cgpa);
  const studentBranch = normalizeBranch(student.field);
  const studentBatch = student.targetBatch ?? graduationYear(student.year);

  const gates: Record<string, EligibilityGate> = {};

  if (parsed.cgpaCutoff != null && studentCgpa != null) {
    gates.cgpa = {
      open: studentCgpa >= parsed.cgpaCutoff,
      label: `CGPA ${studentCgpa} / Cutoff ${parsed.cgpaCutoff}`,
    };
  } else if (parsed.cgpaCutoff != null && studentCgpa == null) {
    gates.cgpa = { open: false, label: `CGPA cutoff ${parsed.cgpaCutoff} (yours not set)` };
  }

  if (parsed.branches.length > 0) {
    const allowAll = parsed.branches.includes("all");
    const open = allowAll || parsed.branches.includes(studentBranch);
    gates.branch = {
      open,
      label: allowAll
        ? "All branches allowed"
        : `Allowed: ${parsed.branches.join(", ").toUpperCase()} / Yours: ${studentBranch.toUpperCase()}`,
    };
  }

  if (parsed.batch && studentBatch) {
    const yearMatch = parsed.batch.match(/\d{4}/g) ?? [];
    const allowed = yearMatch.map((y) => parseInt(y));
    const open = allowed.length === 0 || allowed.includes(studentBatch);
    gates.batch = { open, label: `Batch ${parsed.batch} / Yours: ${studentBatch}` };
  }

  const gateValues = Object.values(gates);
  return { gates, gatesOpen: gateValues.filter((g) => g.open).length, gatesTotal: gateValues.length };
}

function normalizeText(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .replace(/\b(pvt|private|ltd|limited|inc|llc|llp|technologies|technology|tech|solutions|systems|services|india|global|corp|corporation|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokenSetSimilarity(a: string, b: string): number {
  const at = new Set(a.split(/\s+/).filter((t) => t.length >= 2));
  const bt = new Set(b.split(/\s+/).filter((t) => t.length >= 2));
  if (at.size === 0 || bt.size === 0) return 0;
  let inter = 0;
  for (const t of at) if (bt.has(t)) inter++;
  const union = new Set([...at, ...bt]).size;
  return inter / union;
}

// Common Indian-recruiting company aliases. Maps every form to a canonical
// key so "TCS", "Tata Consultancy Services" and "Tata Consultancy" all match.
const COMPANY_ALIASES: Record<string, string> = {
  "tcs": "tata consultancy",
  "tata consultancy": "tata consultancy",
  "tata consultancy services": "tata consultancy",
  "infy": "infosys",
  "infosys": "infosys",
  "wipro": "wipro",
  "hcl": "hcl",
  "hcltech": "hcl",
  "ibm": "ibm",
  "google": "google",
  "alphabet": "google",
  "meta": "meta",
  "facebook": "meta",
  "amazon": "amazon",
  "aws": "amazon",
  "microsoft": "microsoft",
  "msft": "microsoft",
  "ms": "microsoft",
  "accenture": "accenture",
  "cognizant": "cognizant",
  "ctsh": "cognizant",
  "cts": "cognizant",
  "capgemini": "capgemini",
  "deloitte": "deloitte",
  "jpmc": "jpmorgan chase",
  "jp morgan": "jpmorgan chase",
  "jpmorgan": "jpmorgan chase",
  "jpmorgan chase": "jpmorgan chase",
};

function canonicalCompany(s: string): string {
  return COMPANY_ALIASES[s] ?? s;
}

function companyMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ca = canonicalCompany(a);
  const cb = canonicalCompany(b);
  if (ca === cb) return true;
  if (ca.length >= 3 && cb.includes(ca)) return true;
  if (cb.length >= 3 && ca.includes(cb)) return true;
  return tokenSetSimilarity(a, b) >= 0.7;
}

/** Looks up TPO-posted drives for the student's college and fuzzy-matches by company + role. */
export async function computeTpoMatch(
  college: string | null | undefined,
  company: string | null | undefined,
  role: string | null | undefined,
): Promise<{ status: "matched" | "not_matched" | "unknown"; driveId: number | null }> {
  if (!college || !company) return { status: "unknown", driveId: null };

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const tpoPosts = await db
    .select()
    .from(tpoDrivesTable)
    .where(and(eq(tpoDrivesTable.college, college), eq(tpoDrivesTable.status, "active"), gte(tpoDrivesTable.createdAt, sixtyDaysAgo)))
    .orderBy(desc(tpoDrivesTable.createdAt))
    .limit(200);

  if (tpoPosts.length === 0) return { status: "unknown", driveId: null };

  const targetCompany = normalizeText(company);
  const targetRole = normalizeText(role);

  let best: { id: number; score: number } | null = null;
  for (const post of tpoPosts) {
    const postCompany = normalizeText(post.company);
    if (!companyMatch(targetCompany, postCompany)) continue;

    if (targetRole && post.role) {
      const roleScore = tokenSetSimilarity(targetRole, normalizeText(post.role));
      if (roleScore < 0.4) continue;
    }

    const score = canonicalCompany(targetCompany) === canonicalCompany(postCompany) ? 1 : Math.max(tokenSetSimilarity(targetCompany, postCompany), 0.7);
    if (!best || score > best.score) best = { id: post.id, score };
  }

  if (best) return { status: "matched", driveId: best.id };
  return { status: "not_matched", driveId: null };
}

/** Ghost-rate aggregator across everyone who reported an outcome for this company. */
export async function getCompanyStats(company: string) {
  const c = company.trim();
  if (!c) return null;

  const rows = await db
    .select({ outcome: driveChecksTable.outcome })
    .from(driveChecksTable)
    .where(and(ilike(driveChecksTable.company, c), sql`${driveChecksTable.outcome} <> 'pending'`));

  const total = rows.length;
  const applied = rows.filter((r) => r.outcome === "applied").length;
  const called = rows.filter((r) => r.outcome === "called").length;
  const ghosted = rows.filter((r) => r.outcome === "ghosted").length;
  const rejected = rows.filter((r) => r.outcome === "rejected").length;
  const offer = rows.filter((r) => r.outcome === "offer").length;
  const decided = called + ghosted + rejected + offer;

  return {
    total,
    applied,
    called,
    ghosted,
    rejected,
    offer,
    ghostRate: decided > 0 ? Math.round((ghosted / decided) * 100) : null,
    callRate: decided > 0 ? Math.round(((called + offer) / decided) * 100) : null,
    offerRate: decided > 0 ? Math.round((offer / decided) * 100) : null,
  };
}
