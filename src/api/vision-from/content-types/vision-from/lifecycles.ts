// Puts a "Vision from" on the globe by itself: when it is saved with a place
// name ("Parigi, Francia") and no coordinates, they are looked up on
// OpenStreetMap's Nominatim. Typing latitude/longitude by hand always wins, and
// a place that can't be found just leaves them empty (the site skips entries
// without coordinates) — saving is never blocked by the lookup.

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UID = 'api::vision-from.vision-from';

type Coords = { latitude: number; longitude: number };

async function geocode(location: string): Promise<Coords | null> {
  try {
    const url = `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(location)}`;
    const res = await fetch(url, {
      // Nominatim's usage policy requires an identifying User-Agent.
      headers: { 'User-Agent': 'PixelWave-CMS/1.0 (https://pixelwave.it)', 'Accept-Language': 'it,en' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Nominatim answered ${res.status}`);
    const results = (await res.json()) as { lat: string; lon: string }[];
    const first = results[0];
    if (!first) return null;
    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  } catch (error) {
    strapi.log.warn(`[vision-from] geocoding "${location}" failed: ${(error as Error).message}`);
    return null;
  }
}

const blank = (v: unknown) => v === undefined || v === null || v === '';

async function fillCoordinates(event: { action: string; params: { data: any; where?: any } }) {
  const { data } = event.params;
  if (!data) return;

  let location: string | undefined = data.location;
  let stored: { location?: string; latitude?: number | null; longitude?: number | null } | null = null;
  if (event.action === 'beforeUpdate' && event.params.where) {
    stored = await strapi.db.query(UID).findOne({ where: event.params.where });
    location = data.location ?? stored?.location;
  }
  if (!location || !location.trim()) return;

  // Place changed but the coordinates were left as they were: they belong to
  // the old place, so look the new one up. Otherwise only fill what is empty.
  const placeChanged = !!stored && data.location !== undefined && data.location !== stored.location;
  const coordsTouched = data.latitude !== undefined || data.longitude !== undefined;
  const coordsEmpty =
    blank(data.latitude ?? stored?.latitude) || blank(data.longitude ?? stored?.longitude);
  if (!(coordsEmpty || (placeChanged && !coordsTouched))) return;

  const found = await geocode(location.trim());
  if (!found) return;
  data.latitude = found.latitude;
  data.longitude = found.longitude;
}

export default {
  beforeCreate: fillCoordinates,
  beforeUpdate: fillCoordinates,
};
