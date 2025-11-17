// app/services/parkingApi.ts
export type ParkingRecommendation = {
  index: number;
  name: string | null;
  details?: string | null;
  address?: string | null;
  link?: string | null;
  city?: string | null;
  lat: number;
  lng: number;
  distance_km: number;
  open_now: boolean;
  opening?: string | null;
  closing?: string | null;
  guards: number;
  cctvs: number;
  initial_rate: number;
  pwd_discount: number;
  street_parking: number;
  score: number;
};

type RecommendResponse = {
  user_location: {
    lat: number;
    lng: number;
    time_of_day: number;
  };
  recommendations: ParkingRecommendation[];
};

// 🔥 Hardcode your Render base URL
const API_BASE_URL = "https://sparkk-7js1.onrender.com";

export async function getParkingRecommendations(
  userLat: number,
  userLng: number
): Promise<ParkingRecommendation[]> {
  const now = new Date();
  const timeOfDay = now.getHours(); // 0–23

  const url = `${API_BASE_URL}/recommend`;
  console.log("[ParkingAPI] POST", url, {
    user_lat: userLat,
    user_lng: userLng,
    time_of_day: timeOfDay,
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_lat: userLat,
        user_lng: userLng,
        time_of_day: timeOfDay,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn("❌ API error:", res.status, text);
      throw new Error(`API error ${res.status}`);
    }

    const data = (await res.json()) as RecommendResponse;
    console.log("[ParkingAPI] API response:", data);

    console.log("[ParkingAPI] Got recommendations:", data.recommendations?.length);
    
    // Log each recommendation's coordinates
    data.recommendations.forEach((rec) => {
      console.log("Parking recommendation:", rec);
      console.log("Lat:", rec.lat, "Lng:", rec.lng);  // Log lat and lng to verify
    });

    return data.recommendations;
  } catch (err) {
    console.error("[ParkingAPI] Network or parse error:", err);
    throw err;
  }
}
