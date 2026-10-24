import { NextResponse } from 'next/server';
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !['NCR', 'QUEZON_CITY'].includes(body.area))
    return NextResponse.json(
      { error: 'Supported scopes are NCR or Quezon City.' },
      { status: 400 }
    );
  if (!body.forecastRunId)
    return NextResponse.json(
      {
        error:
          'A dated, verified forecast run is required. Forecast model is not integrated yet; simulation cannot run on invented cases.',
      },
      { status: 422 }
    );
  return NextResponse.json(
    {
      error:
        'Simulation service is not configured. Connect the validated forecast and FastAPI engine first.',
    },
    { status: 503 }
  );
}
