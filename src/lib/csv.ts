/**
 * CSV export — the operator's "give me my data" button.
 *
 * Gyms, invoices, the roster: every table in the consoles can leave the app as
 * a spreadsheet, because the alternative is someone re-typing rows into one.
 *
 * ## Shape
 *
 * - `toCsv` is pure (testable, usable server-side); `downloadCsv` is the
 *   browser half and does nothing on a server render.
 * - Values are stringified, wrapped in quotes with inner quotes doubled — the
 *   RFC 4180 escape — and joined with `\r\n`, which Excel on Windows still
 *   demands before it opens a file without the import wizard.
 * - A leading BOM keeps Excel from misreading UTF-8 names (é, ñ, أ) as
 *   mojibake. Gym rosters are full of exactly those names.
 * - Formula-like text is prefixed with an apostrophe. Quoting alone does
 *   not prevent spreadsheet formula injection.
 */

export type CsvColumn<T> = {
  header: string;
  /** Returns the cell for one row; missing data must come back as ''. */
  value: (row: T) => string | number | null | undefined;
};

export function csvEscape(value: string | number | null | undefined): string {
  const raw =
    value === null || value === undefined ? '' : typeof value === 'number' ? String(value) : value;
  const safe = typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const head = columns.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => csvEscape(c.value(row))).join(','));
  return [head, ...body].join('\r\n');
}

/** Serialise rows to a CSV data URL (with BOM) for an anchor download. */
export function toCsvHref(csv: string): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent('\ufeff' + csv)}`;
}

/**
 * Trigger a browser download. Does nothing outside a document context, so
 * components can call it unguarded in render-adjacent code paths.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' }));
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
