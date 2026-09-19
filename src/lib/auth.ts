import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';

// A very small admin login: one shared password from an environment variable.
// After a correct password we set a signed, http-only cookie that expires in 8 hours.

export const COOKIE = 'vcp_admin';
const MAX_AGE_SECONDS = 8 * 60 * 60;

export function adminEnabled(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function secret(): string {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || '';
}

function sign(value: string): string {
  return createHmac('sha256', secret()).update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(input: string): boolean {
  return adminEnabled() && safeEqual(input, process.env.ADMIN_PASSWORD as string);
}

export function makeToken(): string {
  const expires = String(Date.now() + MAX_AGE_SECONDS * 1000);
  return `${expires}.${sign(expires)}`;
}

export function tokenIsValid(token: string | undefined): boolean {
  if (!token || !adminEnabled()) return false;
  const [expires, sig] = token.split('.');
  if (!expires || !sig || !safeEqual(sig, sign(expires))) return false;
  return Number(expires) > Date.now();
}

export function setSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE, makeToken(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(COOKIE, '', { httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0 });
}

/** Returns an error response if the request is not from a logged in admin, or null if it is fine. */
export function requireAdmin(req: NextRequest): NextResponse | null {
  if (!adminEnabled()) {
    return NextResponse.json({ error: 'Admin is turned off. Set ADMIN_PASSWORD to turn it on.', code: 'disabled' }, { status: 503 });
  }
  if (!tokenIsValid(req.cookies.get(COOKIE)?.value)) {
    return NextResponse.json({ error: 'Please log in.', code: 'login' }, { status: 401 });
  }
  return null;
}
