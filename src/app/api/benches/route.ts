import { NextResponse } from 'next/server';
import { listBenches } from '@/lib/repo';
import { errorResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await listBenches(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return errorResponse(err);
  }
}
