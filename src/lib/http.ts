import { NextResponse } from 'next/server';
import { ConfigError } from './db';
import { AdoptError } from './repo';
import { ImportError } from './admin';

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AdoptError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  if (err instanceof ImportError) return NextResponse.json({ error: 'Nothing was imported. Fix these rows and try again.', details: err.details.slice(0, 50) }, { status: 422 });
  if (err instanceof ConfigError) return NextResponse.json({ error: err.message, code: 'config' }, { status: 500 });
  console.error(err);
  return NextResponse.json({ error: 'Something went wrong on the server. Try again in a moment.' }, { status: 500 });
}
