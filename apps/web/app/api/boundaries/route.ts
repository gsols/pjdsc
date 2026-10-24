import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const raw = await readFile(
      join(process.cwd(), 'public', 'data', 'ncr-cities.geojson'),
      'utf8'
    );
    const geo = JSON.parse(raw);
    if (geo?.type !== 'FeatureCollection')
      return NextResponse.json({ error: 'Invalid GeoJSON' }, { status: 422 });
    return NextResponse.json(geo);
  } catch {
    return NextResponse.json(
      {
        error:
          'NCR city boundary GeoJSON not yet imported. See docs/data-sources.md.',
      },
      { status: 503 }
    );
  }
}
