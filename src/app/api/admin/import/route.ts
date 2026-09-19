import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { parseAdoptionCsv, parseBenchCsv } from '@/lib/csv';
import { importAdoptions, importBenches } from '@/lib/admin';
import { errorResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const body = (await req.json().catch(() => ({}))) as { type?: string; csv?: unknown; removePlaceholders?: unknown };
    if (typeof body.csv !== 'string' || body.csv.trim() === '') {
      return NextResponse.json({ error: 'The file is empty.' }, { status: 400 });
    }

    if (body.type === 'benches') {
      const parsed = parseBenchCsv(body.csv);
      if (parsed.errors.length > 0) return NextResponse.json({ error: 'Nothing was imported. Fix these rows and try again.', details: parsed.errors.slice(0, 50) }, { status: 422 });
      return NextResponse.json({ result: await importBenches(parsed.rows, body.removePlaceholders === true) });
    }
    if (body.type === 'adoptions') {
      const parsed = parseAdoptionCsv(body.csv);
      if (parsed.errors.length > 0) return NextResponse.json({ error: 'Nothing was imported. Fix these rows and try again.', details: parsed.errors.slice(0, 50) }, { status: 422 });
      return NextResponse.json({ result: await importAdoptions(parsed.rows) });
    }
    return NextResponse.json({ error: 'type must be "benches" or "adoptions".' }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
