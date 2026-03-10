// ============================================================
//  ELLA EATS — NETLIFY FUNCTION: TripAdvisor Public Scraper
//
//  Fetches TripAdvisor ratings from the public webpage —
//  no API key required. Uses the location ID to build the URL,
//  then extracts the rating from the page's JSON-LD structured data.
// ============================================================

exports.handler = async function (event) {
  const { locationId } = event.queryStringParameters || {};

  if (!locationId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing locationId' }) };
  }

  try {
    // Fetch the public TripAdvisor page for this location
    const url = `https://www.tripadvisor.com/Restaurant_Review-d${locationId}.html`;

    const response = await fetch(url, {
      headers: {
        // Mimic a real browser request
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      return { statusCode: response.status, body: JSON.stringify({ error: `Page fetch failed ${response.status}` }) };
    }

    const html = await response.text();

    // Extract rating from JSON-LD structured data in the page
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    if (!jsonLdMatch) {
      return { statusCode: 404, body: JSON.stringify({ error: 'No structured data found' }) };
    }

    const jsonLd = JSON.parse(jsonLdMatch[1]);
    const rating      = jsonLd?.aggregateRating?.ratingValue;
    const reviewCount = jsonLd?.aggregateRating?.reviewCount;
    const name        = jsonLd?.name;

    if (!rating) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Rating not found in page' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rating:      parseFloat(rating),
        num_reviews: parseInt(reviewCount) || 0,
        name:        name || '',
        source:      'tripadvisor_public',
      })
    };

  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};