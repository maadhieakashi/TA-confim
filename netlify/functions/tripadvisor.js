// ============================================================
//  ELLA EATS — EDGE FUNCTION: TripAdvisor Proxy
//
//  Edge Functions run at Netlify's CDN layer, not a Node server.
//  They do not attach Origin/Referer headers that trigger
//  TripAdvisor's free plan 403 block.
//
//  API key is stored in Netlify Environment Variables as TA_API_KEY.
//  It never reaches the browser.
// ============================================================

export default async function handler(request, context) {
  const url    = new URL(request.url);
  const locationId = url.searchParams.get('locationId');

  if (!locationId) {
    return new Response(
      JSON.stringify({ error: 'Missing locationId' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = Deno.env.get('TA_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'TA_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const taUrl = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details`
    + `?key=${apiKey}&language=en&currency=LKR`;

  try {
    const response = await fetch(taUrl, {
      headers: { 'accept': 'application/json' }
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const config = { path: '/api/tripadvisor' };