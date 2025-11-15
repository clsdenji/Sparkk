import Constants from "expo-constants";

export type TravelMode = "car" | "walk" | "motor" | "commute";
export type LatLng = { latitude: number; longitude: number };

// Returns ETA in seconds for the given mode using Google Routes API
export async function getEtaSeconds(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode
): Promise<number | null> {
  const extra = (Constants as any)?.expoConfig?.extra ?? {};

  const apiKey =
    (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined) ??
    (extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined) ??
    (extra?.googleMapsApiKey as string | undefined);

  console.log("[ETA] getEtaSeconds extra =", extra);
  console.log(
    "[ETA] getEtaSeconds apiKey =",
    apiKey ? "***set***" : "undefined"
  );

  if (!apiKey) {
    console.warn(
      "[ETA] No Google Maps API key configured; returning null ETA from getEtaSeconds"
    );
    return null;
  }

  try {
    let travelMode = modeToGoogle(mode);

    // Google complains if timestamp is "now" or slightly behind server time.
    // Make it 10 minutes in the future.
    const departureEpochSec = Math.floor(Date.now() / 1000) + 10 * 60;

    const makeBody = (tm: ReturnType<typeof modeToGoogle>) => {
      const useDeparture =
        tm === "DRIVE" || tm === "TWO_WHEELER" || tm === "TRANSIT";

      const base: any = {
        origin: {
          location: {
            latLng: {
              latitude: origin.latitude,
              longitude: origin.longitude,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          },
        },
        travelMode: tm,
        routingPreference:
          tm === "DRIVE" || tm === "TWO_WHEELER"
            ? "TRAFFIC_AWARE"
            : "ROUTING_PREFERENCE_UNSPECIFIED",
        computeAlternativeRoutes: false,
      };

      if (useDeparture) {
        base.departureTime = { seconds: departureEpochSec };
      }

      return base;
    };

    console.log("[ETA] getEtaSeconds travelMode =", travelMode);

    let res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration",
        },
        body: JSON.stringify(makeBody(travelMode)),
      }
    );

    console.log("[ETA] getEtaSeconds status =", res.status);
    let data: any;
    try {
      data = await res.json();
    } catch (e) {
      console.log("[ETA] getEtaSeconds failed to parse JSON:", e);
      data = null;
    }
    console.log("[ETA] getEtaSeconds data =", data);

    let dur = data?.routes?.[0]?.duration as string | undefined; // e.g. "123s"

    // Fallback if TWO_WHEELER not supported
    if (!(dur && /s$/.test(dur)) && travelMode === "TWO_WHEELER") {
      console.log(
        "[ETA] getEtaSeconds no duration for TWO_WHEELER, retrying with DRIVE"
      );
      travelMode = "DRIVE";

      res = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "routes.duration",
          },
          body: JSON.stringify(makeBody(travelMode)),
        }
      );

      console.log("[ETA] getEtaSeconds fallback status =", res.status);
      try {
        data = await res.json();
      } catch (e) {
        console.log(
          "[ETA] getEtaSeconds fallback failed to parse JSON:",
          e
        );
        data = null;
      }
      console.log("[ETA] getEtaSeconds fallback data =", data);

      dur = data?.routes?.[0]?.duration as string | undefined;
    }

    if (dur && /s$/.test(dur)) {
      const seconds = parseFloat(dur.replace("s", ""));
      console.log("[ETA] getEtaSeconds parsed seconds =", seconds);
      if (isFinite(seconds)) return seconds;
    } else {
      console.log(
        "[ETA] getEtaSeconds no valid duration found in response",
        dur
      );
    }
  } catch (e) {
    console.log("[ETA] getEtaSeconds error:", e);
  }

  console.warn("[ETA] getEtaSeconds returning null (no ETA)");
  return null;
}

export async function getEtaDetailed(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode
): Promise<{
  seconds: number | null;
  provider: "google" | "none";
  googleMode?: "DRIVE" | "WALK" | "BICYCLE" | "TWO_WHEELER" | "TRANSIT";
}> {
  const extra = (Constants as any)?.expoConfig?.extra ?? {};
  const apiKey =
    (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined) ??
    (extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined) ??
    (extra?.googleMapsApiKey as string | undefined);

  console.log("[ETA] getEtaDetailed extra =", extra);
  console.log(
    "[ETA] getEtaDetailed apiKey =",
    apiKey ? "***set***" : "undefined"
  );

  if (!apiKey) {
    console.warn(
      "[ETA] No Google Maps API key configured; returning provider='none'"
    );
    return { seconds: null, provider: "none" };
  }

  try {
    let travelMode = modeToGoogle(mode);
    const departureEpochSec = Math.floor(Date.now() / 1000) + 10 * 60;

    const makeBody = (tm: ReturnType<typeof modeToGoogle>) => {
      const useDeparture =
        tm === "DRIVE" || tm === "TWO_WHEELER" || tm === "TRANSIT";

      const base: any = {
        origin: {
          location: {
            latLng: {
              latitude: origin.latitude,
              longitude: origin.longitude,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.latitude,
              longitude: destination.longitude,
            },
          },
        },
        travelMode: tm,
        routingPreference:
          tm === "DRIVE" || tm === "TWO_WHEELER"
            ? "TRAFFIC_AWARE"
            : "ROUTING_PREFERENCE_UNSPECIFIED",
        computeAlternativeRoutes: false,
      };

      if (useDeparture) {
        base.departureTime = { seconds: departureEpochSec };
      }

      return base;
    };

    console.log("[ETA] getEtaDetailed travelMode =", travelMode);

    let res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration",
        },
        body: JSON.stringify(makeBody(travelMode)),
      }
    );

    console.log("[ETA] getEtaDetailed status =", res.status);
    let data: any;
    try {
      data = await res.json();
    } catch (e) {
      console.log("[ETA] getEtaDetailed failed to parse JSON:", e);
      data = null;
    }
    console.log("[ETA] getEtaDetailed data =", data);

    let dur = data?.routes?.[0]?.duration as string | undefined;

    if (!(dur && /s$/.test(dur)) && travelMode === "TWO_WHEELER") {
      console.log(
        "[ETA] getEtaDetailed no duration for TWO_WHEELER, retrying with DRIVE"
      );
      travelMode = "DRIVE";

      res = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "routes.duration",
          },
          body: JSON.stringify(makeBody(travelMode)),
        }
      );

      console.log("[ETA] getEtaDetailed fallback status =", res.status);
      try {
        data = await res.json();
      } catch (e) {
        console.log(
          "[ETA] getEtaDetailed fallback failed to parse JSON:",
          e
        );
        data = null;
      }
      console.log("[ETA] getEtaDetailed fallback data =", data);

      dur = data?.routes?.[0]?.duration as string | undefined;
    }

    if (dur && /s$/.test(dur)) {
      const seconds = parseFloat(dur.replace("s", ""));
      console.log("[ETA] getEtaDetailed parsed seconds =", seconds);
      if (isFinite(seconds))
        return { seconds, provider: "google", googleMode: travelMode };
    } else {
      console.log(
        "[ETA] getEtaDetailed no valid duration found in response",
        dur
      );
    }
  } catch (e) {
    console.log("[ETA] getEtaDetailed error:", e);
  }

  console.warn("[ETA] getEtaDetailed returning provider='none'");
  return { seconds: null, provider: "none" };
}

function modeToGoogle(
  mode: TravelMode
):
  | "DRIVE"
  | "WALK"
  | "BICYCLE"
  | "TWO_WHEELER"
  | "TRANSIT" {
  switch (mode) {
    case "car":
      return "DRIVE";
    case "walk":
      return "WALK";
    case "motor":
      return "TWO_WHEELER";
    case "commute":
      return "TRANSIT";
  }
}

/** Format ETA: 75s → "1 min", 3800s → "1 hr 3 min" */
export function formatEta(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}

/** Arrival time text: now + ETA → "14:37" */
export function getArrivalText(
  seconds: number,
  now = new Date()
): string {
  const arrive = new Date(now.getTime() + Math.max(0, seconds) * 1000);
  const hh = arrive.getHours();
  const mm = arrive.getMinutes();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${hh}:${pad(mm)}`;
}
