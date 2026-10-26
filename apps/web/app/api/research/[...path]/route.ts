import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const allowed = /^(forecast-runs(?:\/[A-Za-z0-9_-]{1,120})?|research-evidence|qc-simulation|future-simulation|outbreak-demo|spatial-allocations\/[A-Za-z0-9_-]{1,120}|outbreak-context\/[A-Za-z0-9_-]{1,120}|(?:outbreak-scenarios|scenarios)(?:\/[a-f0-9]{64})?)$/;
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const path = (await context.params).path.join('/');
  if (!allowed.test(path) || (request.method === 'POST' && !['scenarios', 'outbreak-scenarios', 'qc-simulation', 'future-simulation'].includes(path)))
    return NextResponse.json({ error: 'Unsupported research endpoint' }, { status: 404 });
  const base = process.env.ENGINE_BASE_URL;
  if (!base) return NextResponse.json({ error: 'Set server-only ENGINE_BASE_URL to connect the audited research engine.' }, { status: 503 });
  let body: string | undefined;
  if (request.method === 'POST') {
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Missing JSON body' }, { status: 422 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        return NextResponse.json({ error: 'Request exceeds 32 KB' }, { status: 413 });
      }
      chunks.push(value);
    }
    body = Buffer.concat(chunks).toString('utf8');
    try { JSON.parse(body); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 422 }); }
  }
  const query = new URL(request.url).searchParams;
  const area = query.get('area');
  if (area && !['QUEZON_CITY', 'NCR'].includes(area))
    return NextResponse.json({ error: 'Unsupported area' }, { status: 422 });
  try {
    const response = await fetch(`${base.replace(/\/$/, '')}/v1/${path}${area ? `?area=${area}` : ''}`, {
      method: request.method, headers: { 'content-type': 'application/json' }, body,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(20000)]), cache: 'no-store',
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return NextResponse.json({ error: 'Research engine unavailable or timed out.' }, { status: 503 });
  }
}
export const GET = proxy;
export const POST = proxy;
