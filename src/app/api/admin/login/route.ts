import { NextResponse, type NextRequest } from 'next/server';
import { adminEnabled, passwordMatches, setSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!adminEnabled()) {
    return NextResponse.json({ error: 'Admin is turned off. Set ADMIN_PASSWORD to turn it on.', code: 'disabled' }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  if (typeof body.password !== 'string' || !passwordMatches(body.password)) {
    await new Promise((r) => setTimeout(r, 500)); // slows down password guessing
    return NextResponse.json({ error: 'Wrong password.' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res);
  return res;
}
