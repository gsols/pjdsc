import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reply(body: Record<string, string>, status: number) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

// Liveness only: model/data readiness is still validated by research endpoints.
export async function GET(request: Request) {
  const base = process.env.ENGINE_BASE_URL;
  try {
    const url = new URL(base ?? '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error();
  } catch {
    return reply({ code: 'ENGINE_NOT_CONFIGURED', error: 'Set a valid server-only ENGINE_BASE_URL on the frontend service and redeploy it.' }, 503);
  }
  const starting = () => reply({ code: 'ENGINE_STARTING', error: 'Engine is not responding yet. It may be starting or temporarily unavailable.' }, 503);
  try {
    const response = await fetch(`${base!.replace(/\/$/, '')}/health`, {
      headers: { accept: 'application/json' }, cache: 'no-store',
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(8000)]),
    });
    if (response.status >= 500) return starting();
    if (!response.ok) return reply({ code: 'ENGINE_HEALTH_FAILED', error: 'Engine health check failed. Check the engine URL and Render service logs.' }, 502);
    // Render can return an HTML loading page while a free service wakes up.
    let data;
    try { data = await response.json(); } catch { return starting(); }
    if (data?.status !== 'ok') return reply({ code: 'ENGINE_HEALTH_FAILED', error: 'Engine health response was not recognized. Check the engine URL and service logs.' }, 502);
    return reply({ status: 'ok' }, 200);
  } catch {
    return starting();
  }
}
