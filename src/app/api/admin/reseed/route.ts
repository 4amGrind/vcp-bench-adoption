import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { resetToPlaceholders } from '@/lib/admin';
import { errorResponse } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    await resetToPlaceholders();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
