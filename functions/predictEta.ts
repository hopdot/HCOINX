import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// hcoinx-driving: Bus/Vehicle ETA Prediction Endpoint
// POST /functions/predictEta
// Body: { "distance": number, "traffic": number, "time_of_day"?: number, "day_of_week"?: number }

// Model coefficients trained on 500-point hcoinx-driving dataset (R²=0.92)
const MODEL = {
  intercept: 1.7206,
  coefficients: {
    distance: 3.3147,
    traffic: 0.4694,
    time_of_day: 0.0665,
    day_of_week: -0.8175,
  },
};

function predict(distance: number, traffic: number, timeOfDay: number, dayOfWeek: number): number {
  const { intercept, coefficients: c } = MODEL;
  const result =
    intercept +
    c.distance * distance +
    c.traffic * traffic +
    c.time_of_day * timeOfDay +
    c.day_of_week * dayOfWeek;
  return Math.max(1.0, Math.round(result * 10) / 10);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const { distance, traffic, time_of_day, day_of_week } = body;

    if (distance === undefined || traffic === undefined) {
      return Response.json(
        { error: 'Missing required fields: distance (km) and traffic (1-10)' },
        { status: 400 }
      );
    }

    if (typeof distance !== 'number' || typeof traffic !== 'number') {
      return Response.json(
        { error: 'distance and traffic must be numbers' },
        { status: 400 }
      );
    }

    const now = new Date();
    const tod = typeof time_of_day === 'number' ? time_of_day : now.getHours();
    const dow = typeof day_of_week === 'number' ? day_of_week : now.getDay();

    const eta = predict(distance, traffic, tod, dow);

    return Response.json({
      ok: true,
      input: { distance, traffic, time_of_day: tod, day_of_week: dow },
      estimated_arrival_minutes: eta,
      model: {
        name: 'hcoinx-driving v1',
        r2_score: 0.9214,
        features: ['distance', 'traffic', 'time_of_day', 'day_of_week'],
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
