import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { exportCsv } from '@/lib/admin';
import { errorResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const type = req.nextUrl.searchParams.get('type');
    if (type !== 'benches' && type !== 'adoptions') {
      return NextResponse.json({ error: 'type must be "benches" or "adoptions".' }, { status: 400 });
    }
    return new NextResponse(await exportCsv(type), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vcp-${type}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
