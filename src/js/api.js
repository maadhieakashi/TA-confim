// ============================================================
//  ELLA EATS — API MODULE
//  Handles all external data fetching.
//
//  Google Places: routed through /api/google-place
//    → Netlify serverless function
//    → key stored in Netlify Environment Variables (GOOGLE_API_KEY)
//
//  TripAdvisor: routed through Cloudflare Worker proxy
//    → key stored in Cloudflare Worker Environment Variables (TA_API_KEY)
//    → key never reaches the browser
//    → Worker URL stored in CONFIG.TRIPADVISOR_WORKER_URL
// ============================================================


/**
 * Fetches live Google Places data for all configured venues.
 * Calls the Netlify serverless function at /api/google-place.
 *
 * Uses Promise.allSettled so a single failed venue does not block the rest.
 *
 * @returns {Promise<{data: Object[], failed: string[]}>}
 *   data   — successfully fetched venue objects
 *   failed — names of venues that could not be fetched
 */
async function fetchGoogleData() {
  const results = await Promise.allSettled(
    CONFIG.VENUES.map(async venue => {
      const response = await fetch(
  `${CONFIG.TRIPADVISOR_WORKER_URL}/${venueConfig.taLocationId}`
);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return { ...data, venueTypes: venue.type };
    })
  );

  const data   = [];
  const failed = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      data.push(result.value);
    } else {
      failed.push(CONFIG.VENUES[index].name);
    }
  });

  return { data, failed };
}


/**
 * Fetches TripAdvisor ratings for all venues via the Cloudflare Worker proxy.
 *
 * The Worker holds the TA_API_KEY in its own environment variables.
 * The key is never sent to or visible in the browser at any point.
 *
 * Uses Promise.allSettled — venues without a taLocationId or that fail
 * the Worker call return null (handled gracefully by the scoring module).
 *
 * @param {Object[]} googleVenues - Venues from fetchGoogleData()
 * @returns {Promise<(Object|null)[]>} Array aligned with googleVenues; null = no TA data
 */
async function fetchTripAdvisorData(googleVenues) {
  if (!CONFIG.TRIPADVISOR_ENABLED) {
    return googleVenues.map(() => null);
  }

  // Build a lookup map: placeId → venue config
  const venueConfigMap = {};
  CONFIG.VENUES.forEach(venue => {
    venueConfigMap[venue.placeId] = venue;
  });

  const results = await Promise.allSettled(
    googleVenues.map(async googleVenue => {
      const venueConfig = venueConfigMap[googleVenue.placeId];
      if (!venueConfig?.taLocationId) return null;

      // Call Cloudflare Worker proxy — TA_API_KEY stays inside the Worker
      const response = await fetch(
        `${CONFIG.TRIPADVISOR_WORKER_URL}?locationId=${venueConfig.taLocationId}`
      );

      if (!response.ok) {
        console.warn(`TripAdvisor Worker HTTP ${response.status} for ${googleVenue.name}`);
        return null;
      }

      const data = await response.json();

      if (data.error || !data.rating) {
        console.warn(`TripAdvisor: no rating returned for ${googleVenue.name}`);
        return null;
      }

      return {
        rating:      parseFloat(data.rating),
        reviewCount: parseInt(data.num_reviews) || 0,
        ranking:     data.ranking_data?.ranking_string || '',
        cuisine:     (data.cuisine || []).map(c => c.name),
        webUrl:      data.web_url || '',
        source:      'tripadvisor_worker',
      };
    })
  );

  return results.map(result => result.status === 'fulfilled' ? result.value : null);
}