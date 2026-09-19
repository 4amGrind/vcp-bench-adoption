import { NextResponse, type NextRequest } from 'next/server';
import { adoptSide, getSettings } from '@/lib/repo';
import { validateAdoption } from '@/lib/validate';
import { errorResponse } from '@/lib/http';
import { tooManyRequests } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'The request was not valid JSON.' }, { status: 400 });
    }

    // Hidden "website" field. People never fill it in, bots do.
    if (body && typeof body === 'object' && (body as Record<string, unknown>).website) {
      return NextResponse.json({ error: 'Request rejected.' }, { status: 400 });
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (tooManyRequests(`adopt:${ip}`)) {
      return NextResponse.json({ error: 'Too many adoption attempts from this connection. Try again in an hour.' }, { status: 429 });
    }

    const settings = await getSettings();
    const result = validateAdoption(body, settings);
    if (!result.ok) {
      return NextResponse.json({ error: 'Fix the highlighted fields.', fieldErrors: result.errors }, { status: 422 });
    }

    const adoption = await adoptSide(id, result.value);
    return NextResponse.json({ adoption }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
