// Minimal CSV export — no dependency needed for what the Reports page does.
// Every report section exports exactly the rows it is showing.

export interface CsvColumn<T> {
    /** Column heading written to the first row. */
    header: string;
    /** Cell value for a row; return null/undefined for an empty cell. */
    value: (row: T) => string | number | null | undefined;
}

/**
 * Escape one field per RFC 4180: wrap in quotes when it contains a comma,
 * quote or newline, and double any embedded quotes.
 *
 * A string starting with =, +, - or @ is prefixed with a tab so Excel and
 * Sheets treat the cell as text — names and remarks are user-entered and must
 * never be evaluated as a formula. The guard is deliberately limited to
 * strings: a number cannot carry a formula, and tab-prefixing one would turn a
 * numeric column into text on import.
 */
const escapeField = (raw: string | number | null | undefined): string => {
    if (raw == null) return "";
    if (typeof raw === "number") return String(raw);
    const s = /^[=+\-@]/.test(raw) ? `\t${raw}` : raw;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Build a CSV document (CRLF line endings) including a header row. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
    const lines = [columns.map((c) => escapeField(c.header)).join(",")];
    for (const row of rows) {
        lines.push(columns.map((c) => escapeField(c.value(row))).join(","));
    }
    return lines.join("\r\n");
}

/**
 * Trigger a browser download of `csv` as `filename`.
 *
 * A UTF-8 BOM is prepended so Excel opens non-ASCII names correctly instead of
 * showing mojibake. The object URL is revoked on the next tick — revoking it
 * synchronously can cancel the download before the browser has read it.
 */
export function downloadCsv(filename: string, csv: string): void {
    const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** "2026-09-13" — the date stamp used in exported filenames. */
export const todayStamp = (): string => new Date().toISOString().slice(0, 10);
