export function safeCsvCell(value: unknown, alwaysQuote = false) {
  const raw = value === null || value === undefined ? "" : String(value);
  // Prevent spreadsheet formula execution while preserving the visible value.
  const safe = /^[\t\r\n ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  const escaped = safe.replaceAll('"', '""');
  return alwaysQuote || /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}
