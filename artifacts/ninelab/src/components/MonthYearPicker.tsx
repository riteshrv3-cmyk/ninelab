import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function yearOptions() {
  const current = new Date().getFullYear();
  return Array.from({ length: 60 }, (_, i) => String(current + 5 - i));
}

interface MonthYearPickerProps {
  /** "Mon YYYY" (e.g. "Jun 2024"), "YYYY" alone, "Present", or "" (unset). */
  value: string;
  onChange: (value: string) => void;
  allowPresent?: boolean;
}

/**
 * Two shadcn Selects (month + year) that together produce/parse a single
 * "Mon YYYY" string — the same format resume-core's ExperienceEntry/
 * EducationEntry start/end fields already expect, so no new date shape
 * needs to be threaded through the resume pipeline.
 */
export function MonthYearPicker({ value, onChange, allowPresent }: MonthYearPickerProps) {
  const isPresent = value === "Present";
  const parts = !isPresent && value ? value.split(" ") : [];
  const month = parts.length === 2 ? parts[0] : "";
  const year = parts.length === 2 ? parts[1] : parts[0] || "";

  if (isPresent) {
    return (
      <div className="flex items-center gap-2 h-9">
        <span className="text-sm font-semibold text-ink flex-1">Present</span>
        <button type="button" onClick={() => onChange("")} className="text-[11px] font-bold text-brand shrink-0">
          Set a date
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <Select value={month || undefined} onValueChange={m => onChange(year ? `${m} ${year}` : m)}>
        <SelectTrigger className="text-sm h-9">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map(m => (
            <SelectItem key={m} value={m}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={year || undefined} onValueChange={y => onChange(month ? `${month} ${y}` : y)}>
        <SelectTrigger className="text-sm h-9">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          {yearOptions().map(y => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {allowPresent && (
        <button
          type="button"
          onClick={() => onChange("Present")}
          className="text-[11px] font-bold text-ink-muted shrink-0 whitespace-nowrap"
        >
          Present
        </button>
      )}
    </div>
  );
}
