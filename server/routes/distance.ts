import { Router, Request, Response } from 'express';

// Uses OpenRouteService Directions API to compute driving distance in miles between two addresses
// Env var required: ORS_API_KEY
// Endpoint: GET /api/distance?from=<address>&to=<address>
// Response: { miles: number, provider: 'openrouteservice', cached?: boolean }

const router = Router();

// Simple in-memory cache keyed by from|to
const cache = new Map<string, { miles: number; ts: number }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

// Non-secret diagnostics: Reports whether ORS is configured
router.get('/distance/status', (_req: Request, res: Response) => {
  const apiKey = process.env.ORS_API_KEY || '';
  const configured = Boolean(apiKey);
  const provider = configured ? 'openrouteservice' : 'osrm+nominatim';
  // Do not leak the key; only return masked info
  const masked = configured ? `${apiKey.substring(0, 6)}…(${apiKey.length})` : null;
  return res.json({ configured, provider, keyPreview: masked });
});

router.get('/distance', async (req: Request, res: Response) => {
  try {
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    if (!from || !to) {
      return res.status(400).json({ message: 'from and to are required query params' });
    }

    const apiKey = process.env.ORS_API_KEY;

    const key = `${from}|${to}`.toLowerCase();
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.ts < CACHE_TTL_MS) {
      return res.json({ miles: cached.miles, provider: 'openrouteservice', cached: true });
    }

    // 1) Geocode both addresses
    const geocode = async (q: string): Promise<{ lon: number; lat: number }> => {
      if (apiKey) {
        // OpenRouteService geocoding
        const url = new URL('https://api.openrouteservice.org/geocode/search');
        url.searchParams.set('api_key', apiKey);
        url.searchParams.set('text', q);
        url.searchParams.set('size', '1');

        const r = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!r.ok) throw new Error(`Geocode failed: ${r.status} ${r.statusText}`);
        const data = await r.json();
        const feat = data?.features?.[0];
        const coords = feat?.geometry?.coordinates; // [lon, lat]
        if (!coords || coords.length !== 2) throw new Error(`No geocode result for: ${q}`);
        return { lon: coords[0], lat: coords[1] };
      }
      // Fallback: Nominatim (no key)
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', q);
      url.searchParams.set('format', 'json');
      url.searchParams.set('limit', '1');
      const r = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FiberAudit/1.0 (contact: admin@local)'
        }
      });
      if (!r.ok) throw new Error(`Geocode failed: ${r.status} ${r.statusText}`);
      const data = await r.json();
      const item = Array.isArray(data) ? data[0] : undefined;
      const latNum = Number(item?.lat);
      const lonNum = Number(item?.lon);
      if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) throw new Error(`No geocode result for: ${q}`);
      return { lon: lonNum, lat: latNum };
    };

    const [start, end] = await Promise.all([geocode(from), geocode(to)]);

    // 2) Directions between points
    let meters: number | undefined;
    if (apiKey) {
      // OpenRouteService directions
      const dirUrl = 'https://api.openrouteservice.org/v2/directions/driving-car';
      const r2 = await fetch(dirUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: JSON.stringify({
          coordinates: [
            [start.lon, start.lat],
            [end.lon, end.lat],
          ],
        }),
      });
      if (!r2.ok) throw new Error(`Directions failed: ${r2.status} ${r2.statusText}`);
      const route = await r2.json();
      meters = route?.routes?.[0]?.summary?.distance;
      if (typeof meters !== 'number') throw new Error('No distance in directions response');
      const miles = meters / 1609.344;
      cache.set(key, { miles, ts: now });
      return res.json({ miles, provider: 'openrouteservice' });
    } else {
      // Fallback: OSRM public demo server (no key)
      const osrmUrl = new URL('https://router.project-osrm.org/route/v1/driving/' +
        `${start.lon},${start.lat};${end.lon},${end.lat}`);
      osrmUrl.searchParams.set('overview', 'false');
      osrmUrl.searchParams.set('alternatives', 'false');
      const r2 = await fetch(osrmUrl, { headers: { Accept: 'application/json' } });
      if (!r2.ok) throw new Error(`Directions failed: ${r2.status} ${r2.statusText}`);
      const route = await r2.json();
      // distance is meters
      meters = route?.routes?.[0]?.distance ?? route?.routes?.[0]?.legs?.[0]?.distance;
      if (typeof meters !== 'number') throw new Error('No distance in directions response');
      const miles = meters / 1609.344;
      cache.set(key, { miles, ts: now });
      return res.json({ miles, provider: 'osrm+nominatim' });
    }
  } catch (err: any) {
    const message = err?.message || 'Failed to compute driving distance';
    return res.status(500).json({ message });
  }
});

export default router;
