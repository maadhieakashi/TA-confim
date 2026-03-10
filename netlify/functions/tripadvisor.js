// ============================================================
//  ELLA EATS — NETLIFY FUNCTION: TripAdvisor Proxy
//
//  Routes TripAdvisor API calls server-side to keep the key
//  out of the browser. The key is stored in Netlify Environment
//  Variables as TA_API_KEY.
//
//  The TripAdvisor free plan blocks server-side calls that
//  include an Origin or Referer header. This function omits
//  those headers so the request appears as a direct API call.
//
//  Called by: src/js/api.js → fetchTripAdvisorData()
//  Endpoint:  /api/tripadvisor?locationId=XXXXXXX
// ============================================================

exports.handler = async function (event) {
  const { locationId } = event.queryStringParameters || {};

  if (!locationId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing locationId parameter' })
    };
  }

  const apiKey = process.env.TA_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'TA_API_KEY environment variable not set' })
    };
  }

  try {
    const url = `https://api.content.tripadvisor.com/api/v1/location/${locationId}/details`
      + `?key=${apiKey}&language=en&currency=LKR`;

    // IMPORTANT: Do not forward Origin or Referer headers.
    // TripAdvisor free plan returns 403 when these are present
    // on server-side requests. Omitting them allows the call through.
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json'
        // Origin and Referer intentionally omitted
      }
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`TripAdvisor API error ${response.status} for locationId ${locationId}: ${errorText}`);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `TripAdvisor API returned ${response.status}` })
      };
    }

    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };

  } catch (err) {
    console.error(`TripAdvisor proxy error for locationId ${locationId}:`, err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};