import { NextRequest, NextResponse } from "next/server";
import { getOtpremaData } from "@/lib/sheets";
import type { OtpremaRowSerialized } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseDateParam(param: string | null): Date | undefined {
  if (!param) return undefined;
  const d = new Date(param);
  return isNaN(d.getTime()) ? undefined : d;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = parseDateParam(searchParams.get("from"));
    const to = parseDateParam(searchParams.get("to"));

    const rows = await getOtpremaData(from, to);

    // Serialize Date objects to ISO strings for JSON transport
    const serialized: OtpremaRowSerialized[] = rows.map((row) => ({
      ...row,
      datum: row.datum.toISOString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Error fetching otprema data:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
