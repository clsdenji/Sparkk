import Constants from 'expo-constants';

export type LatLng = { latitude: number; longitude: number };
export type TravelMode = 'car' | 'walk' | 'motor' | 'commute';

function getExtra() {
  return (Constants as any)?.expoConfig?.extra ?? {};
}

export function hasCustomRouting(): boolean {
  const extra = getExtra();
  const base = (extra?.EXPO_PUBLIC_ROUTING_BASE_URL || extra?.routingBaseUrl || extra?.EXPO_PUBLIC_API_URL) as string | undefined;
  return typeof base === 'string' && base.trim().length > 0;
}

function getBaseAndHeaders() {
  const extra = getExtra();
  const base = (extra?.EXPO_PUBLIC_ROUTING_BASE_URL || extra?.routingBaseUrl || extra?.EXPO_PUBLIC_API_URL) as string | undefined;
  const token = (extra?.EXPO_PUBLIC_ROUTING_API_TOKEN || extra?.routingApiToken) as string | undefined;
  if (!base) throw new Error('Routing base not configured');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Allow overriding individual endpoint paths via env
  const routePath = (extra?.EXPO_PUBLIC_ROUTING_ROUTE_PATH || extra?.routingRoutePath || '/route') as string;
  const etaPath = (extra?.EXPO_PUBLIC_ROUTING_ETA_PATH || extra?.routingEtaPath || '/eta') as string;
  const optimizePath = (extra?.EXPO_PUBLIC_ROUTING_OPTIMIZE_PATH || extra?.routingOptimizePath || '/optimize') as string;
  return { base: base.replace(/\/$/, ''), headers, routePath, etaPath, optimizePath };
}

function mapMode(mode: TravelMode): 'car'|'walk'|'motor'|'commute' {
  return mode; // passthrough; customize here if server expects other tokens
}

export async function fetchCustomRoute(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  stops?: LatLng[],
): Promise<{ geometry: Array<{ latitude: number; longitude: number }>; durationSeconds?: number | null } | null> {
  const { base, headers, routePath } = getBaseAndHeaders();
  const body: any = {
    origin: { lat: origin.latitude, lon: origin.longitude },
    destination: { lat: destination.latitude, lon: destination.longitude },
    mode: mapMode(mode),
  };
  if (stops && stops.length > 0) {
    body.stops = stops.map(s => ({ lat: s.latitude, lon: s.longitude }));
  }
  const res = await fetch(`${base}${routePath.startsWith('/') ? '' : '/'}${routePath}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) return null;
  const data = await res.json();
  // Accept a few common shapes
  let coordinates: Array<[number, number]> | Array<{ lat: number; lon: number }> | Array<{ latitude: number; longitude: number }> | undefined;
  if (Array.isArray(data?.geometry)) coordinates = data.geometry as any;
  else if (Array.isArray(data?.route?.geometry)) coordinates = data.route.geometry as any;
  else if (data?.geojson?.type === 'LineString' && Array.isArray(data?.geojson?.coordinates)) coordinates = data.geojson.coordinates as any;
  if (!coordinates) return null;

  const mapped: Array<{ latitude: number; longitude: number }> = (coordinates as any[]).map((c: any) => {
    if (Array.isArray(c) && c.length >= 2) {
      // assume [lon, lat]
      return { latitude: c[1], longitude: c[0] };
    }
    if (typeof c?.lat === 'number' && typeof c?.lon === 'number') {
      return { latitude: c.lat, longitude: c.lon };
    }
    if (typeof c?.latitude === 'number' && typeof c?.longitude === 'number') {
      return { latitude: c.latitude, longitude: c.longitude };
    }
    throw new Error('Unrecognized geometry coordinate format');
  });

  const durationSeconds: number | null | undefined =
    typeof data?.durationSeconds === 'number' ? data.durationSeconds :
    typeof data?.duration === 'number' ? data.duration :
    typeof data?.route?.duration === 'number' ? data.route.duration : undefined;

  return { geometry: mapped, durationSeconds: durationSeconds ?? null };
}

export async function fetchCustomEta(origin: LatLng, destination: LatLng, mode: TravelMode): Promise<number | null> {
  const { base, headers, etaPath } = getBaseAndHeaders();
  const body: any = {
    origin: { lat: origin.latitude, lon: origin.longitude },
    destination: { lat: destination.latitude, lon: destination.longitude },
    mode: mapMode(mode),
    departAt: new Date().toISOString(),
  };
  const res = await fetch(`${base}${etaPath.startsWith('/') ? '' : '/'}${etaPath}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) return null;
  const data = await res.json();
  if (typeof data?.seconds === 'number') return data.seconds;
  if (typeof data?.etaSeconds === 'number') return data.etaSeconds;
  if (typeof data?.duration === 'number') return data.duration;
  if (typeof data?.durationSeconds === 'number') return data.durationSeconds;
  // accept ISO 8601 like "123s"
  if (typeof data?.eta === 'string' && /s$/.test(data.eta)) {
    const s = parseFloat(data.eta.replace('s',''));
    if (isFinite(s)) return s;
  }
  return null;
}

export async function fetchCustomOptimization(
  origin: LatLng,
  stops: LatLng[],
  destination: LatLng,
  mode: TravelMode,
): Promise<{ ordered: LatLng[]; geometry?: Array<{ latitude: number; longitude: number }>; durationSeconds?: number | null } | null> {
  const { base, headers, optimizePath } = getBaseAndHeaders();
  const body: any = {
    origin: { lat: origin.latitude, lon: origin.longitude },
    destination: { lat: destination.latitude, lon: destination.longitude },
    stops: stops.map(s => ({ lat: s.latitude, lon: s.longitude })),
    mode: mapMode(mode),
  };
  const res = await fetch(`${base}${optimizePath.startsWith('/') ? '' : '/'}${optimizePath}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) return null;
  const data = await res.json();
  let ordered: LatLng[] | undefined;
  if (Array.isArray(data?.ordered)) {
    ordered = data.ordered.map((p: any) => ({ latitude: p.latitude ?? p.lat, longitude: p.longitude ?? p.lon }));
  }
  let geometry: Array<{ latitude: number; longitude: number }> | undefined;
  if (Array.isArray(data?.geometry)) {
    geometry = (data.geometry as any[]).map((c: any) => Array.isArray(c) ? ({ latitude: c[1], longitude: c[0] }) : ({ latitude: c.latitude ?? c.lat, longitude: c.longitude ?? c.lon }));
  }
  const durationSeconds: number | null | undefined = typeof data?.durationSeconds === 'number' ? data.durationSeconds : undefined;
  if (!ordered) return null;
  return { ordered, geometry, durationSeconds: durationSeconds ?? null };
}
