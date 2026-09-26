import * as XLSX from "xlsx";

export interface XlsxSheet {
  name: string;
  /** Row-major grid; all values coerced to trimmed strings. */
  rows: string[][];
}

export interface ParsedXlsx {
  sheets: XlsxSheet[];
}

function cellToString(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const dd = String(value.getDate()).padStart(2, "0");
    const mm = String(value.getMonth() + 1).padStart(2, "0");
    const yyyy = value.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }
  return String(value).trim();
}

/** Parse an .xlsx ArrayBuffer into named sheets of string grids. */
export function parseXlsxArrayBuffer(data: ArrayBuffer): ParsedXlsx {
  const workbook = XLSX.read(data, { type: "array", cellDates: true, raw: false });
  const sheets: XlsxSheet[] = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    return {
      name,
      rows: grid.map((row) => (Array.isArray(row) ? row.map(cellToString) : [])),
    };
  });
  return { sheets };
}
