import supabase from "./supabaseClient";

export type SearchEntry = {
  id: string;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  timestamp: number;
};

let HISTORY: SearchEntry[] = [];
let SUBSCRIBERS: ((h: SearchEntry[]) => void)[] = [];
let loaded = false;

const notify = () => {
  const snap = HISTORY.slice();
  SUBSCRIBERS.forEach((s) => {
    try {
      s(snap);
    } catch (err) {
      console.warn("subscriber error", err);
    }
  });
};

const load = async () => {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (!user) {
      HISTORY = [];
      return;
    }
    const { data, error } = await supabase
      .from("search_history")
      .select("id, name, address, lat, lng, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    HISTORY = (data ?? []).map((row: any) => ({
      id: row.id,
      name: row.name,
      address: row.address ?? undefined,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined,
      timestamp: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    }));
  } catch (e) {
    HISTORY = [];
    console.warn("searchHistory load failed", e);
  } finally {
    loaded = true;
  }
};

// No local persistence; database is the source of truth

// load once and notify subscribers after load completes
(async () => {
  await load();
  notify();
})();

export function addSearch(entry: Omit<SearchEntry, "id" | "timestamp">) {
  // Fire-and-forget insert; reflect optimistically
  (async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;
      if (!user) {
        // If not signed in, keep only in memory (session-scoped)
        const e: SearchEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          timestamp: Date.now(),
          ...entry,
        };
        HISTORY = [e, ...HISTORY.filter((i) => i.id !== e.id && i.name !== e.name)].slice(0, 100);
        notify();
        return;
      }
      const payload = {
        user_id: user.id,
        email: user.email ?? null,
        name: entry.name,
        address: entry.address ?? null,
        lat: entry.lat ?? null,
        lng: entry.lng ?? null,
      };
      const { data, error } = await supabase
        .from("search_history")
        .insert(payload)
        .select("id, created_at")
        .single();
      if (error) throw error;
      const e: SearchEntry = {
        id: data.id,
        name: entry.name,
        address: entry.address,
        lat: entry.lat,
        lng: entry.lng,
        timestamp: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
      };
      HISTORY = [e, ...HISTORY.filter((i) => i.id !== e.id)].slice(0, 200);
      notify();
    } catch (err) {
      console.warn("addSearch failed", err);
    }
  })();
}

export function removeSearch(id: string) {
  (async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;
      if (user) {
        const { error } = await supabase.from("search_history").delete().eq("id", id).eq("user_id", user.id);
        if (error) throw error;
      }
    } catch (err) {
      console.warn("removeSearch failed", err);
    } finally {
      HISTORY = HISTORY.filter((i) => i.id !== id);
      notify();
    }
  })();
}

export function getSearchHistory(): SearchEntry[] {
  return HISTORY.slice();
}

export function subscribeSearchHistory(cb: (h: SearchEntry[]) => void) {
  SUBSCRIBERS.push(cb);
  // only call immediately if we've finished loading to avoid double notification
  if (loaded) {
    try {
      cb(HISTORY.slice());
    } catch (err) {
      console.warn("subscriber immediate call failed", err);
    }
  }
  return () => {
    SUBSCRIBERS = SUBSCRIBERS.filter((s) => s !== cb);
  };
}

export async function clearSearchHistory() {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;
    if (user) {
      const { error } = await supabase.from("search_history").delete().eq("user_id", user.id);
      if (error) throw error;
    }
  } catch (e) {
    console.warn("clearSearchHistory failed", e);
  } finally {
    HISTORY = [];
    notify();
  }
}

// Refresh on login/logout
supabase.auth.onAuthStateChange((_event, _session) => {
  loaded = false;
  load().then(() => notify());
});