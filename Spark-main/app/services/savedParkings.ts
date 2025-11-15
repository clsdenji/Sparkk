import { supabase } from './supabaseClient';

export type SavedParking = {
  id: string; // unique key, e.g. `${lat.toFixed(6)},${lng.toFixed(6)}`
  name: string;
  address?: string | null;
  lat: number;
  lng: number;
  createdAt: number;
};

let SAVED: SavedParking[] = [];
let LOADED = false;
let SUBSCRIBERS: Array<(items: SavedParking[]) => void> = [];

const notify = () => {
  const snap = SAVED.slice();
  SUBSCRIBERS.forEach((cb) => {
    try { cb(snap); } catch {}
  });
};

async function loadFromDb() {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (!user) {
      SAVED = [];
      return;
    }
    const { data, error } = await supabase
      .from('saved_parkings')
      .select('parking_id, name, address, lat, lng, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;
    SAVED = (data ?? []).map((row: any) => ({
      id: row.parking_id,
      name: row.name,
      address: row.address ?? null,
      lat: row.lat,
      lng: row.lng,
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    }));
    // Best-effort: backfill missing addresses for a few recent items
    try { void backfillMissingAddresses(); } catch {}
  } catch (e) {
    console.warn('savedParkings load failed', e);
    SAVED = [];
  } finally {
    LOADED = true;
  }
}

// Initialize asynchronously
;(async () => {
  await loadFromDb();
  notify();
})();

export function subscribeSavedParkings(cb: (items: SavedParking[]) => void) {
  SUBSCRIBERS.push(cb);
  if (LOADED) {
    try { cb(SAVED.slice()); } catch {}
  }
  return () => {
    SUBSCRIBERS = SUBSCRIBERS.filter((s) => s !== cb);
  };
}

export function getSavedParkings(): SavedParking[] {
  return SAVED.slice();
}

export function isParkingSaved(id: string): boolean {
  return SAVED.some((p) => p.id === id);
}

export async function saveParking(entry: Omit<SavedParking, 'createdAt'>) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user) {
    console.warn('saveParking requires login');
    return;
  }
  // avoid duplicates locally
  const exists = SAVED.find((p) => p.id === entry.id);
  if (exists) return;
  try {
    const payload = {
      user_id: user.id,
      email: user.email ?? null,
      parking_id: entry.id,
      name: entry.name,
      address: entry.address ?? null,
      lat: entry.lat,
      lng: entry.lng,
    };
    const { data, error } = await supabase
      .from('saved_parkings')
      .insert(payload)
      .select('created_at')
      .single();
    if (error) throw error;
    const e: SavedParking = { ...entry, createdAt: data?.created_at ? new Date(data.created_at).getTime() : Date.now() };
    SAVED = [e, ...SAVED].slice(0, 500);
    notify();
    // Backfill missing addresses after saving new parking
    await backfillMissingAddresses();
  } catch (err) {
    console.warn('saveParking failed', err);
  }
}

export async function removeParking(id: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user) return;
  try {
    const { error } = await supabase
      .from('saved_parkings')
      .delete()
      .eq('user_id', user.id)
      .eq('parking_id', id);
    if (error) throw error;
  } catch (err) {
    console.warn('removeParking failed', err);
  } finally {
    SAVED = SAVED.filter((p) => p.id !== id);
    notify();
  }
}

export async function toggleParking(entry: Omit<SavedParking, 'createdAt'>) {
  if (isParkingSaved(entry.id)) {
    await removeParking(entry.id);
  } else {
    await saveParking(entry);
  }
}

export function makeParkingId(lat: number, lng: number): string {
  // Check if lat/lng are valid numbers
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    console.warn("Invalid coordinates:", lat, lng);
    return `invalid-${Math.random().toString(36).slice(2)}`; // Fallback ID
  }
  // 6 decimals ~ 0.11 meter, good for uniqueness while stable for UI
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export async function clearSavedParkings() {
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (!user) return;
  try {
    const { error } = await supabase
      .from('saved_parkings')
      .delete()
      .eq('user_id', user.id);
    if (error) throw error;
  } catch (e) {
    console.warn('clearSavedParkings failed', e);
  } finally {
    SAVED = [];
    notify();
  }
}

// Refresh on login/logout
supabase.auth.onAuthStateChange((_event, _session) => {
  LOADED = false;
  loadFromDb().then(() => notify());
});

// --- helpers: reverse geocoding & backfill ---
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'SparkParking/1.0 (expo)' },
    });
    const data = await res.json();
    const display = (data?.display_name as string | undefined) || null;
    return display && display.trim().length > 0 ? display : null;
  } catch {
    return null;
  }
}

async function backfillMissingAddresses() {
  // Limit work to avoid spamming geocoder; handle up to 3 most recent missing entries
  const missing = SAVED.filter((s) => !s.address).slice(0, 3);
  if (missing.length === 0) return;
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (!user) return;
    for (const s of missing) {
      try {
        const addr = await reverseGeocode(s.lat, s.lng);
        if (!addr) continue;
        // update local cache
        SAVED = SAVED.map((p) => (p.id === s.id ? { ...p, address: addr } : p));
        notify();
        // persist to DB
        await supabase
          .from('saved_parkings')
          .update({ address: addr })
          .eq('user_id', user.id)
          .eq('parking_id', s.id)
          .select('parking_id')
          .maybeSingle();
      } catch {}
    }
  } catch {}
}
