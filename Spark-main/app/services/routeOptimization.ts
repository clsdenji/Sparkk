import Constants from 'expo-constants';

export type LatLng = { latitude: number; longitude: number };
export type TravelMode = 'car' | 'walk' | 'motor' | 'commute';

function modeToGoogle(mode: TravelMode): 'DRIVE'|'WALK'|'BICYCLE'|'TWO_WHEELER'|'TRANSIT' {
  switch (mode) {
    case 'car': return 'DRIVE';
    case 'walk': return 'WALK';
    case 'motor': return 'TWO_WHEELER';
    case 'commute': return 'TRANSIT';
  }
}

export type OptimizeResult = {
  ordered: LatLng[]; // includes origin ... intermediates ... destination
  geometry: Array<{ latitude: number; longitude: number }>;
  durationSeconds: number | null;
  provider: 'google' | 'none';
};

/**
 * Optimize route order for given stops. Uses Custom optimization if available; otherwise uses
 * Google Distance Matrix to determine ordering and Google Directions (Routes v2) for geometry.
 * If Google key is missing, returns a trivial order (origin -> stops as given -> destination) with no geometry.
 */
export async function optimizeRoute(origin: LatLng, stops: LatLng[], destination: LatLng, mode: TravelMode): Promise<OptimizeResult> {
  const extra = (Constants as any)?.expoConfig?.extra ?? {};
  const apiKey = (extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || extra?.googleMapsApiKey) as string | undefined;
  const allPoints = [origin, ...stops, destination];
  // Helper: call Google Directions v2 to get geometry/order based on provided points (origin, intermediates..., destination)
  const callGoogleRouteThrough = async (points: LatLng[]): Promise<OptimizeResult> => {
    if (!apiKey) return { ordered: points, geometry: [], durationSeconds: null, provider: 'none' };
    const travelMode = modeToGoogle(mode);
    const originPt = points[0];
    const destPt = points[points.length - 1];
    const intermediates = points.slice(1, -1).map(p => ({ location: { latLng: { latitude: p.latitude, longitude: p.longitude } } }));
    const body: any = {
      origin: { location: { latLng: { latitude: originPt.latitude, longitude: originPt.longitude } } },
      destination: { location: { latLng: { latitude: destPt.latitude, longitude: destPt.longitude } } },
      intermediates,
      travelMode,
      routingPreference: (travelMode === 'DRIVE' || travelMode === 'TWO_WHEELER') ? 'TRAFFIC_AWARE' : 'ROUTING_PREFERENCE_UNSPECIFIED',
      departureTime: { seconds: Math.floor(Date.now() / 1000) },
      computeAlternativeRoutes: false,
    };
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.polyline.encodedPolyline,routes.duration',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const route = data?.routes?.[0];
    const encoded: string | undefined = route?.polyline?.encodedPolyline;
    let geometry: Array<{ latitude: number; longitude: number }> = [];
    if (encoded) {
      geometry = decodePolyline(encoded);
    }
    let durationSeconds: number | null = null;
    const dur = route?.duration as string | undefined;
    if (dur && /s$/.test(dur)) {
      const s = parseFloat(dur.replace('s',''));
      if (isFinite(s)) durationSeconds = s;
    }
    return { ordered: points, geometry, durationSeconds, provider: 'google' };
  };

  // If Google key available, compute matrix for ordering, then use Google Directions for geometry
  if (apiKey && stops.length > 0) {
    try {
      const travelMode = modeToGoogle(mode);
      const nodes = allPoints;
      // Build matrix indices: we need durations from each node to every other node
      const origins = nodes.map(n => ({ location: { latLng: { latitude: n.latitude, longitude: n.longitude } } }));
      const destinations = nodes.map(n => ({ location: { latLng: { latitude: n.latitude, longitude: n.longitude } } }));
      const body = {
        origins,
        destinations,
        travelMode,
        departureTime: { seconds: Math.floor(Date.now() / 1000) },
      };
      const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(body),
      });
      const rows = await res.json();
      // rows is a flat list of elements with originIndex & destinationIndex
      const N = nodes.length;
      const mat: number[][] = Array.from({ length: N }, () => Array(N).fill(Infinity));
      for (const r of rows as any[]) {
        const oi = r.originIndex; const di = r.destinationIndex;
        const dur = r?.duration?.duration ?? r?.duration?.seconds ?? r?.duration; // gRPC-like vs REST shapes
        let seconds: number | null = null;
        if (typeof dur === 'string' && /s$/.test(dur)) seconds = parseFloat(dur.replace('s',''));
        else if (typeof dur === 'number') seconds = dur;
        else if (typeof dur === 'object' && typeof dur?.seconds === 'number') seconds = dur.seconds;
        if (seconds != null && isFinite(seconds)) mat[oi][di] = seconds;
      }
      // Heuristic: Nearest Neighbor from origin -> visit each stop -> destination fixed
      const order: number[] = [0]; // start at origin index 0
      const stopIndices = stops.map((_, i) => i + 1); // 1..M are the stops
      const destIndex = N - 1; // last is destination
      const unvisited = new Set(stopIndices);
      let current = 0;
      while (unvisited.size > 0) {
        let bestJ: number | null = null; let bestCost = Infinity;
        for (const j of unvisited) {
          const cost = mat[current][j];
          if (cost < bestCost) { bestCost = cost; bestJ = j; }
        }
        if (bestJ == null) break;
        order.push(bestJ);
        unvisited.delete(bestJ);
        current = bestJ;
      }
      order.push(destIndex);
      const orderedPoints = order.map(i => nodes[i]);
      return await callGoogleRouteThrough(orderedPoints);
    } catch {
      // Fallback: return trivial order with no geometry
      return { ordered: allPoints, geometry: [], durationSeconds: null, provider: 'none' };
    }
  }

  // No Google key or no stops: return trivial order with no geometry
  return { ordered: allPoints, geometry: [], durationSeconds: null, provider: 'none' };
}

// Local polyline decoder (Google Encoded Polyline Algorithm Format)
function decodePolyline(encoded: string): Array<{ latitude: number; longitude: number }> {
  const points: Array<{ latitude: number; longitude: number }> = [];
  let index = 0, lat = 0, lng = 0;
  const len = encoded.length;
  while (index < len) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}
