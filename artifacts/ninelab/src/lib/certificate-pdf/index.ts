import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { ensureFonts, JSPDF_FONT_NAME } from "../resume-pdf/fonts";

export interface CertificateData {
  studentName: string;
  certificateCode: string;
  subDomainName: string;
  domainName: string;
  skillsCovered: string[];
  finalExamScore: number;
  issuedAt: string;
  verifyUrl: string;
}

// Landscape A4 in points.
const PAGE_W = 841.89;
const PAGE_H = 595.28;

// Muted ink palette. Literal hex is deliberate here — this is a print PDF,
// not the themed UI, so it does not read design tokens.
const INK = "#1a1d2e"; // dark slate for body text
const INDIGO = "#4a55c7"; // brand indigo for the title + rules
const MUTED = "#6b7280"; // muted slate for secondary lines

const SERIF = JSPDF_FONT_NAME.serif; // "ResumeSerif"

/**
 * Sets the active serif font, falling back to jsPDF's built-in "times" when
 * the embedded ResumeSerif faces failed to load.
 */
function setSerif(doc: jsPDF, style: "normal" | "bold" | "italic", fontsLoaded: boolean) {
  if (fontsLoaded) {
    doc.setFont(SERIF, style);
  } else {
    doc.setFont("times", style === "normal" ? "normal" : style);
  }
}

/** Formats an ISO/date string into a readable "18 August 2026" form. */
function formatIssuedDate(issuedAt: string): string {
  const d = new Date(issuedAt);
  if (Number.isNaN(d.getTime())) return issuedAt;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Caps the skills list to keep the line readable, appending an ellipsis when trimmed. */
function formatSkills(skills: string[]): string {
  const MAX = 8;
  const cleaned = skills.map((s) => s.trim()).filter(Boolean);
  if (cleaned.length <= MAX) return cleaned.join(", ");
  return cleaned.slice(0, MAX).join(", ") + ", …";
}

/**
 * Renders a formal, classic completion certificate as a landscape A4 PDF and
 * returns it as a Blob. Reuses the resume-pdf font loader so the serif face is
 * fetched at most once per session; degrades to jsPDF's built-in serif if the
 * fetch fails.
 */
export async function generateCertificatePdf(cert: CertificateData): Promise<Blob> {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const fontsLoaded = await ensureFonts(doc, "serif");

  const centerX = PAGE_W / 2;

  // --- Double-ruled border -------------------------------------------------
  doc.setDrawColor(INDIGO);
  doc.setLineWidth(2.5);
  doc.rect(28, 28, PAGE_W - 56, PAGE_H - 56); // outer rule
  doc.setLineWidth(0.75);
  doc.rect(38, 38, PAGE_W - 76, PAGE_H - 76); // inner rule

  // --- Wordmark ------------------------------------------------------------
  setSerif(doc, "bold", fontsLoaded);
  doc.setTextColor(INDIGO);
  doc.setFontSize(12);
  doc.text("NINELAB", centerX, 84, { align: "center", charSpace: 3 });

  // --- Title ---------------------------------------------------------------
  setSerif(doc, "bold", fontsLoaded);
  doc.setTextColor(INDIGO);
  doc.setFontSize(26);
  doc.text("Certificate of Completion", centerX, 128, { align: "center" });

  // Small flourish rule under the title.
  doc.setDrawColor(INDIGO);
  doc.setLineWidth(1);
  doc.line(centerX - 90, 142, centerX + 90, 142);

  // --- "This certifies that" -----------------------------------------------
  setSerif(doc, "italic", fontsLoaded);
  doc.setTextColor(MUTED);
  doc.setFontSize(13);
  doc.text("This certifies that", centerX, 186, { align: "center" });

  // --- Student name --------------------------------------------------------
  setSerif(doc, "bold", fontsLoaded);
  doc.setTextColor(INK);
  doc.setFontSize(30);
  doc.text(cert.studentName, centerX, 228, { align: "center" });

  // --- "has successfully completed" ----------------------------------------
  setSerif(doc, "normal", fontsLoaded);
  doc.setTextColor(MUTED);
  doc.setFontSize(13);
  doc.text("has successfully completed", centerX, 262, { align: "center" });

  // --- Course line: subDomain (bold) + (domain) ----------------------------
  // Compose as two styled segments so only the sub-domain is bold, laid out
  // centered around the page midpoint.
  doc.setFontSize(18);
  setSerif(doc, "bold", fontsLoaded);
  const courseBold = cert.subDomainName;
  const courseTail = ` (${cert.domainName})`;
  const boldW = doc.getTextWidth(courseBold);
  setSerif(doc, "normal", fontsLoaded);
  const tailW = doc.getTextWidth(courseTail);
  const totalW = boldW + tailW;
  const startX = centerX - totalW / 2;
  const courseY = 296;

  setSerif(doc, "bold", fontsLoaded);
  doc.setTextColor(INK);
  doc.text(courseBold, startX, courseY, { align: "left" });
  setSerif(doc, "normal", fontsLoaded);
  doc.setTextColor(INK);
  doc.text(courseTail, startX + boldW, courseY, { align: "left" });

  // --- Skills covered (wrapped) --------------------------------------------
  setSerif(doc, "normal", fontsLoaded);
  doc.setTextColor(MUTED);
  doc.setFontSize(11);
  const skillsText = "Skills covered: " + formatSkills(cert.skillsCovered);
  const skillsLines = doc.splitTextToSize(skillsText, PAGE_W - 220);
  doc.text(skillsLines, centerX, 336, { align: "center" });

  // --- Honesty line --------------------------------------------------------
  setSerif(doc, "italic", fontsLoaded);
  doc.setTextColor(MUTED);
  doc.setFontSize(10);
  doc.text(
    "Passed a 70% final exam and an AI-evaluated mock interview.",
    centerX,
    336 + skillsLines.length * 14 + 12,
    { align: "center" },
  );

  // --- QR code (bottom-right, inside border) -------------------------------
  const qrSize = 90;
  const qrX = PAGE_W - 60 - qrSize;
  const qrY = PAGE_H - 70 - qrSize;
  try {
    const dataUrl = await QRCode.toDataURL(cert.verifyUrl, { margin: 1, width: 160 });
    doc.addImage(dataUrl, "PNG", qrX, qrY, qrSize, qrSize);
    setSerif(doc, "normal", fontsLoaded);
    doc.setTextColor(MUTED);
    doc.setFontSize(8);
    doc.text("Verify", qrX + qrSize / 2, qrY + qrSize + 12, { align: "center" });
  } catch {
    // QR generation failed — leave the certificate intact without the code.
  }

  // --- Bottom-left issue line ----------------------------------------------
  setSerif(doc, "normal", fontsLoaded);
  doc.setTextColor(INK);
  doc.setFontSize(10);
  const issueLine = `Issued ${formatIssuedDate(cert.issuedAt)}  ·  ${cert.certificateCode}`;
  doc.text(issueLine, 60, PAGE_H - 60, { align: "left" });

  return doc.output("blob");
}
