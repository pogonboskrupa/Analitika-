import { google } from "googleapis";
import { parseBosnianDate, parseNumericBosnian } from "./utils";
import type { PrimkaRow, OtpremaRow } from "./types";

const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? "1DIpllQlrMJwE9wpF1Gtwbnbh6ghYM5f1PimSK2gwVQQ";

function getAuthClient() {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyBase64) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set");
  }

  let credentials: Record<string, unknown>;
  try {
    const jsonStr = Buffer.from(keyBase64, "base64").toString("utf-8");
    credentials = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    throw new Error("Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY as base64-encoded JSON");
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return auth;
}

async function fetchSheetValues(range: string): Promise<string[][]> {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range,
  });

  const values = response.data.values;
  if (!values || values.length === 0) return [];
  return values as string[][];
}

function parsePrimkaRow(row: string[]): PrimkaRow | null {
  if (!row[0] || row[0].trim() === "") return null;
  const datum = parseBosnianDate(row[0]);
  if (!datum) return null;

  const n = (idx: number) => parseNumericBosnian(row[idx]);

  return {
    datum,
    primac: (row[1] ?? "").trim(),
    odjel: (row[2] ?? "").trim(),
    radiliste: (row[3] ?? "").trim(),
    "izvođač": (row[4] ?? "").trim(),
    poslovoda: (row[5] ?? "").trim(),
    // Četinari: columns G–P (index 6–15)
    fl_c: n(6),
    i_c: n(7),
    ii_c: n(8),
    iii_c: n(9),
    rd_c: n(10),
    trupci_c: n(11),
    cel_duga: n(12),
    cel_cijepana: n(13),
    skart: n(14),
    sigma_cetinari: n(15),
    // Lišćari: columns Q–Z (index 16–25)
    fl_l: n(16),
    i_l: n(17),
    ii_l: n(18),
    iii_l: n(19),
    trupci_l: n(20),
    ogr_dugi: n(21),
    ogr_cijepani: n(22),
    gule: n(23),
    liscare: n(24),
    ukupno: n(25),
  };
}

function parseOtpremaRow(row: string[]): OtpremaRow | null {
  if (!row[0] || row[0].trim() === "") return null;
  const datum = parseBosnianDate(row[0]);
  if (!datum) return null;

  const n = (idx: number) => parseNumericBosnian(row[idx]);

  return {
    datum,
    otpremac: (row[1] ?? "").trim(),
    kupac: (row[2] ?? "").trim(),
    odjel: (row[3] ?? "").trim(),
    radiliste: (row[4] ?? "").trim(),
    "izvođač": (row[5] ?? "").trim(),
    poslovoda: (row[6] ?? "").trim(),
    // Četinari: columns H–Q (index 7–16)
    fl_c: n(7),
    i_c: n(8),
    ii_c: n(9),
    iii_c: n(10),
    rd_c: n(11),
    trupci_c: n(12),
    cel_duga: n(13),
    cel_cijepana: n(14),
    skart: n(15),
    sigma_cetinari: n(16),
    // Lišćari: columns R–AA (index 17–26)
    fl_l: n(17),
    i_l: n(18),
    ii_l: n(19),
    iii_l: n(20),
    trupci_l: n(21),
    ogr_dugi: n(22),
    ogr_cijepani: n(23),
    gule: n(24),
    liscare: n(25),
    ukupno: n(26),
  };
}

export async function getPrimkaData(
  dateFrom?: Date,
  dateTo?: Date
): Promise<PrimkaRow[]> {
  // Fetch all data rows (skip header row 1)
  const values = await fetchSheetValues("INDEKS_PRIMKA!A2:Z");

  const rows: PrimkaRow[] = [];

  for (const rawRow of values) {
    const parsed = parsePrimkaRow(rawRow);
    if (!parsed) continue;

    if (dateFrom && parsed.datum < dateFrom) continue;
    if (dateTo) {
      // Include up to end of dateTo day
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (parsed.datum > endOfDay) continue;
    }

    rows.push(parsed);
  }

  return rows;
}

export async function getOtpremaData(
  dateFrom?: Date,
  dateTo?: Date
): Promise<OtpremaRow[]> {
  // Fetch all data rows (skip header row 1)
  const values = await fetchSheetValues("INDEKS_OTPREMA!A2:AA");

  const rows: OtpremaRow[] = [];

  for (const rawRow of values) {
    const parsed = parseOtpremaRow(rawRow);
    if (!parsed) continue;

    if (dateFrom && parsed.datum < dateFrom) continue;
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (parsed.datum > endOfDay) continue;
    }

    rows.push(parsed);
  }

  return rows;
}
