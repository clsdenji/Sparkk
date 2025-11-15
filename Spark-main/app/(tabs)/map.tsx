import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import MapView, { Marker, PROVIDER_GOOGLE, Polyline, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { getDistance } from 'geolib';
import { Feather, Entypo } from '@expo/vector-icons';
import { addSearch } from '../services/searchHistory';
import {
  makeParkingId,
  isParkingSaved,
  toggleParking,
  subscribeSavedParkings,
  getSavedParkings,
} from '../services/savedParkings';
import { useLocalSearchParams } from 'expo-router';
import {
  getParkingRecommendations,
  ParkingRecommendation,
} from '../services/parkingAPI';
import {
  pickDocument,
  pickImage,
  uploadAttachments,
  isAllowedAttachmentType,
  type Attachment as FormAttachment,
} from '../services/attachments';
import { supabase } from '../services/supabaseClient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getEtaSeconds,
  getEtaDetailed,
  formatEta,
  getArrivalText,
  type TravelMode,
} from '../services/eta';
import { optimizeRoute } from '../services/routeOptimization';

const GOLD = '#FFDE59';
const GRAY = '#9CA3AF';
const SELECTED_PIN = '#00A3FF'; // selected destination pin

type Place = {
  name: string;
  address?: string | null;
  lat: number;
  lon: number;
  distanceKm?: number;
  opening?: string | null;
  closing?: string | null;
  guards?: number;
  cctvs?: number;
  initial_rate?: number;
  street_parking?: number;
  open_now?: boolean;
};

const MANILA = { latitude: 14.5995, longitude: 120.9842 };

const MapScreen: React.FC = () => {
  const params = useLocalSearchParams<{
    destLat?: string;
    destLng?: string;
    destName?: string;
    from?: string;
    ts?: string;
  }>();

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [originPhrase, setOriginPhrase] = useState('');
  const [destinationPhrase, setDestinationPhrase] = useState('');
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [originPlace, setOriginPlace] = useState<Place | null>(null);
  const [destinationPlace, setDestinationPlace] = useState<Place | null>(null);
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>(
    [],
  );
  const [parkings, setParkings] = useState<ParkingRecommendation[]>([]);

  const [loadingParkings, setLoadingParkings] = useState(false);
  const [recommendedTo, setRecommendedTo] = useState<ParkingRecommendation[]>([]);
  const [loadingRecommendedTo, setLoadingRecommendedTo] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const lastRecoKeyRef = useRef<string | null>(null);
  const sortByDistanceKm = (a: ParkingRecommendation, b: ParkingRecommendation) => {
    const da =
      typeof a.distance_km === 'number' ? a.distance_km : Number.POSITIVE_INFINITY;
    const db =
      typeof b.distance_km === 'number' ? b.distance_km : Number.POSITIVE_INFINITY;
    return da - db;
  };

  const mapRef = useRef<MapView | null>(null);
  const originInputRef = useRef<TextInput | null>(null);
  const destinationInputRef = useRef<TextInput | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const ZOOM_OUT_FACTOR = 1.4;
  const handledParamRef = useRef<string | null>(null);
  const autoOriginRef = useRef<boolean>(false);
  const insets = useSafeAreaInsets();

  // Report form state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportEmail, setReportEmail] = useState('');
  const [reportAddress, setReportAddress] = useState('');
  const [reportConcern, setReportConcern] = useState<string>('');
  const [showConcernList, setShowConcernList] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [attachments, setAttachments] = useState<FormAttachment[]>([]);
  const [pickingAttachment, setPickingAttachment] = useState(false);

  // ETA state
  const [travelMode, setTravelMode] = useState<TravelMode>('car');
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  const [etaLoading, setEtaLoading] = useState(false);
  const [etaError, setEtaError] = useState<string | null>(null);
  const [etaProvider, setEtaProvider] = useState<'google' | 'none'>('none');

  // Live update controls
  const [originLive, setOriginLive] = useState(false);
  const locationWatcherRef = useRef<any | null>(null);
  const etaIntervalRef = useRef<number | null>(null);

  // Navigation controls
  const [navigating, setNavigating] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const lastRerouteAtRef = useRef<number>(0);
  const lastDirectDistanceRef = useRef<number | null>(null);
  const [optimizing, setOptimizing] = useState(false);

  const concernOptions: Array<{ key: string; label: string }> = [
    { key: 'location', label: 'Location Related' },
    { key: 'ui', label: 'App Functionality Related' },
    { key: 'others', label: 'Others' },
  ];

  const currentOriginCoord = originPlace
    ? { latitude: originPlace.lat, longitude: originPlace.lon }
    : null;
  const currentDestinationCoord = destinationPlace
    ? { latitude: destinationPlace.lat, longitude: destinationPlace.lon }
    : null;

  const showEditFab = !showReportForm && !currentDestinationCoord;

  // Attachments
  const pickAttachment = async () => {
    if (pickingAttachment) return;
    setPickingAttachment(true);
    try {
      const doc = await pickDocument();
      if (doc && isAllowedAttachmentType(doc.name, doc.mimeType)) {
        setAttachments((prev) => [...prev, doc]);
        return;
      }
      const img = await pickImage();
      if (img && isAllowedAttachmentType(img.name, img.mimeType)) {
        setAttachments((prev) => [...prev, img]);
      }
    } catch (e) {
      // ignore
    } finally {
      setPickingAttachment(false);
    }
  };

  const removeAttachment = (uri: string) => {
    setAttachments((prev) => prev.filter((a) => a.uri !== uri));
  };

  const submitReport = async () => {
    if (!reportEmail.trim() || !reportConcern || !reportDescription.trim()) {
      console.log('Report form: missing required fields');
      return;
    }
    const payload: any = {
      email: reportEmail.trim(),
      address: reportAddress.trim(),
      concern: reportConcern,
      description: reportDescription.trim(),
      attachments,
      ts: Date.now(),
    };
    try {
      // Upload attachments
      let uploaded: { path: string; publicUrl?: string }[] = [];
      if (attachments.length > 0) {
        uploaded = await uploadAttachments(supabase, 'attachments', attachments, {
          folder: 'reports',
          makePublic: true,
        });
        payload.attachmentUrls = uploaded
          .map((u) => u.publicUrl || u.path)
          .filter(Boolean);
      }
      // Store report
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      const { error } = await supabase.from('reports').insert({
        email: payload.email,
        address: payload.address,
        concern: payload.concern,
        description: payload.description,
        attachments: payload.attachmentUrls ?? [],
        created_at: new Date().toISOString(),
        user_id: userId,
      });
      if (error) {
        console.log('Supabase insert error (reports):', error.message);
      } else {
        console.log('Report submitted to Supabase:', payload);
      }
      // Notify via FastAPI
      try {
        const apiBase = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;
        if (apiBase) {
          await fetch(`${apiBase}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to_email: payload.email,
              subject: 'Spark Submission Confirmation',
              message:
                'Form Submitted! Thank you for your feedback. We will continue to improve our service.',
            }),
          });
        }
      } catch {}
      Alert.alert(
        'Form Submitted!',
        'Thank you for your feedback. We will continue to improve our service.',
      );
    } catch (e: any) {
      console.log('Submitting report (mock fallback):', payload);
      try {
        const apiBase = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;
        if (apiBase) {
          await fetch(`${apiBase}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to_email: payload.email,
              subject: 'Spark Submission Confirmation',
              message:
                'Form Submitted! Thank you for your feedback. We will continue to improve our service.',
            }),
          });
        }
      } catch {}
      Alert.alert(
        'Form Submitted!',
        'Thank you for your feedback. We will continue to improve our service.',
      );
    }
    // Reset form
    setShowReportForm(false);
    setShowConcernList(false);
    setReportEmail('');
    setReportAddress('');
    setReportConcern('');
    setReportDescription('');
    setAttachments([]);
  };

  // ---- PERMISSION STATE + EFFECTS (FIXED) ----
  const [locationPermissionGranted, setLocationPermissionGranted] =
    useState<boolean | null>(null);

  // Ask for permission once on mount
  useEffect(() => {
    const checkLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setLocationPermissionGranted(granted);

      if (granted) {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      }
    };

    checkLocationPermission();
  }, []);

  // Show alert if explicitly denied
  useEffect(() => {
    if (locationPermissionGranted === false) {
      Alert.alert('Location Permission Denied', 'You can enable it in settings.');
    }
  }, [locationPermissionGranted]);

  // no auto-location on mount (keeping for future)
  useEffect(() => {
    return () => {};
  }, []);

  // Saved parkings subscription
  useEffect(() => {
    try {
      const initial = new Set<string>(getSavedParkings().map((p) => p.id));
      setSavedIds(initial);
    } catch {}
    const unsub = subscribeSavedParkings((items) => {
      try {
        setSavedIds(new Set(items.map((p) => p.id)));
      } catch {}
    });
    return () => {
      try {
        unsub();
      } catch {}
    };
  }, []);

  // Recommendations near chosen destination
useEffect(() => {
  if (!destinationPlace?.lat || !destinationPlace?.lon) {
    console.log("Destination is missing coordinates");
    return;
  }

  console.log("Fetching parking recommendations with lat:", destinationPlace.lat, "lon:", destinationPlace.lon);

  const fetchRecommendations = async () => {
    try {
      setLoadingParkings(true);
      const recos = await getParkingRecommendations(destinationPlace.lat, destinationPlace.lon);
      console.log("Fetched parking recommendations:", recos);
      if (recos?.length > 0) {
  setParkings(recos);
}
    } catch (err) {
      console.error('Error fetching parking recommendations:', err);
    } finally {
      setLoadingParkings(false);
    }
  };
  fetchRecommendations();
}, [destinationPlace]);

  // Auto-set origin to current location once when destination is chosen
  useEffect(() => {
    (async () => {
      try {
        if (!destinationPlace) {
          autoOriginRef.current = false;
          return;
        }
        if (originPlace || location) return;
        if (autoOriginRef.current) return;
        autoOriginRef.current = true;
        await useCurrentAsOrigin({
          latitude: destinationPlace.lat,
          longitude: destinationPlace.lon,
        });
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinationPlace?.lat, destinationPlace?.lon]);

  // Recommendations near origin/current location for "To" suggestions
  useEffect(() => {
    if (activeField !== 'to') return;
    const base =
      currentOriginCoord ?? 
      (location
        ? { latitude: location.latitude, longitude: location.longitude }
        : null);
    const baseToUse = base ?? MANILA;
    const key = `${activeField}|${baseToUse.latitude.toFixed(
      5,
    )},${baseToUse.longitude.toFixed(5)}`;
    if (lastRecoKeyRef.current === key) return;
    lastRecoKeyRef.current = key;
    (async () => {
      try {
        setLoadingRecommendedTo(true);
        const recos = await getParkingRecommendations(
          baseToUse.latitude,
          baseToUse.longitude,
        );
        setRecommendedTo([...recos].sort(sortByDistanceKm));
      } catch (e) {
        setRecommendedTo([]);
      } finally {
        setLoadingRecommendedTo(false);
      }
    })();
  }, [activeField, originPlace, location?.latitude, location?.longitude]);

  const shortAddress = (
    full: string,
    parts: number = 3,
    maxLen: number = 48,
  ): string => {
    try {
      const segs = full
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      let s = segs.slice(0, parts).join(', ');
      if (s.length > maxLen) s = s.slice(0, maxLen - 1) + '…';
      return s || full;
    } catch {
      return full;
    }
  };

  const reverseGeocodeName = async (
    lat: number,
    lon: number,
  ): Promise<string> => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${encodeURIComponent(
        lat,
      )}&lon=${encodeURIComponent(lon)}`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'YourApp/1.0 (expo)',
        },
      });
      const data = await res.json();
      const display = data?.display_name as string | undefined;
      if (display && display.trim().length > 0) return display;
    } catch {}
    return 'Current location';
  };

  const distanceToRouteMeters = (
    pt: { latitude: number; longitude: number },
    poly: Array<{ latitude: number; longitude: number }>,

  ): number => {
    try {
      if (!poly || poly.length === 0) return Number.POSITIVE_INFINITY;
      let min = Number.POSITIVE_INFINITY;
      for (let i = 0; i < poly.length; i++) {
        const d = getDistance(pt, poly[i]);
        if (d < min) min = d;
      }
      return min;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  };
  const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
    const points: Array<{ latitude: number; longitude: number }> = [];
    let index = 0,
      lat = 0,
      lng = 0;
    const len = encoded.length;
    while (index < len) {
      let b,
        shift = 0,
        result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;
      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };

  const doSearch = async (query: string) => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      abortRef.current?.abort();
    } catch {}
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&q=${encodeURIComponent(
        q + ' Manila',
      )}`;
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'YourApp/1.0 (expo)',
        },
      });
      const data = (await res.json()) as Array<any>;
      const base = currentOriginCoord ?? MANILA;
      const mapped: Place[] = data.map((d) => {
        const lat = parseFloat(d.lat);
        const lon = parseFloat(d.lon);
        const name = d.display_name || `${d.name || q}`;
        let distanceKm: number | undefined;
        try {
          distanceKm = getDistance(base, { latitude: lat, longitude: lon }) / 1000;
        } catch {}
        return { name, address: name, lat, lon, distanceKm };
      });
      setSearchResults(mapped);
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') {
        setSearchResults([]);
      }
    }
  };

  const fetchFirstPlace = async (query: string): Promise<Place | null> => {
    const q = query.trim();
    if (q.length < 2) return null;
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(
        q + ' Manila',
      )}`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'YourApp/1.0 (expo)',
        },
      });
      const data = (await res.json()) as Array<any>;
      const d = data?.[0];
      if (!d) return null;
      const lat = parseFloat(d.lat);
      const lon = parseFloat(d.lon);
      const name = d.display_name || `${d.name || q}`;
      return { name, address: name, lat, lon };
    } catch {
      return null;
    }
  };

  const triggerSearch = (text: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current as number);
    }
    debounceRef.current = setTimeout(() => doSearch(text), 250) as unknown as number;
  };

  const recommendedPlaces: Place[] = (() => {
    try {
      const q = destinationPhrase.trim().toLowerCase();
      const filtered = recommendedTo.filter((p) => {
        if (!q) return true;
        const hay = `${p.name ?? ''} ${p.address ?? ''} ${p.city ?? ''}`.toLowerCase();
        return hay.includes(q);
      });
      const sorted = [...filtered].sort(sortByDistanceKm);
      const top = sorted.slice(0, 5).map((p) => ({
        name: p.name || p.address || 'Recommended parking',
        address: p.address || null,
        lat: p.lat,
        lon: p.lng,
        distanceKm:
          typeof p.distance_km === 'number'
            ? p.distance_km
            : (() => {
                try {
                  const base =
                    currentOriginCoord ?? 
                    (location
                      ? {
                          latitude: location.latitude,
                          longitude: location.longitude,
                        }
                      : null);
                  if (!base) return undefined;
                  return (
                    getDistance(base, { latitude: p.lat, longitude: p.lng }) / 1000
                  );
                } catch {
                  return undefined;
                }
              })(),
        opening: (p as any).opening ?? null,
        closing: (p as any).closing ?? null,
        guards: (p as any).guards,
        cctvs: (p as any).cctvs,
        initial_rate: (p as any).initial_rate,
        street_parking: (p as any).street_parking,
        open_now: (p as any).open_now,
      }));
      return top;
    } catch {
      return [];
    }
  })();

  const fitCameraIfPossible = (
    maybeFrom: { latitude: number; longitude: number } | null,
    maybeTo: { latitude: number; longitude: number } | null,
  ) => {
    if (!mapRef.current) return;
    try {
      if (maybeFrom && maybeTo) {
        animateToBounds([maybeFrom, maybeTo]);
      } else if (maybeFrom) {
        mapRef.current.animateToRegion(
          {
            latitude: maybeFrom.latitude,
            longitude: maybeFrom.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          },
          600,
        );
      } else if (maybeTo) {
        mapRef.current.animateToRegion(
          {
            latitude: maybeTo.latitude,
            longitude: maybeTo.longitude,
            latitudeDelta: 0.03,
            longitudeDelta: 0.03,
          },
          600,
        );
      }
    } catch {}
  };

  const refreshRoute = () => {
    try {
      const from =
        currentOriginCoord ?? 
        (location
          ? { latitude: location.latitude, longitude: location.longitude }
          : null);
      const to = currentDestinationCoord;
      if (!to) return;
      setTimeout(() => {
        fitCameraIfPossible(from, to);
        fetchRoute(from, to);
      }, 30);
    } catch {}
  };

  const setDestinationFromQuery = async (query: string) => {
    const best = await fetchFirstPlace(query);
    if (!best) return false;
    setActiveField('to');
    setDestinationPlace(best);
    try {
      setDestinationPhrase(shortAddress(best.name));
    } catch {}
    const to = { latitude: best.lat, longitude: best.lon };
    const from =
      currentOriginCoord ?? 
      (location
        ? { latitude: location.latitude, longitude: location.longitude }
        : null);
    setTimeout(() => {
      fitCameraIfPossible(from, to);
      fetchRoute(from, to);
    }, 50);
    try {
      setActiveField(null);
      Keyboard.dismiss();
      setSearchResults([]);
    } catch {}
    return true;
  };

  const setOriginFromQuery = async (query: string) => {
    const best = await fetchFirstPlace(query);
    if (!best) return false;
    setActiveField('from');
    setOriginPlace(best);
    setOriginLive(false);
    try {
      setOriginPhrase(shortAddress(best.name));
    } catch {}
    const from = { latitude: best.lat, longitude: best.lon };
    const to = currentDestinationCoord;
    setTimeout(() => {
      fitCameraIfPossible(from, to);
      fetchRoute(from, to);
    }, 50);
    try {
      setActiveField(null);
      Keyboard.dismiss();
      setSearchResults([]);
    } catch {}
    return true;
  };

  const animateToBounds = (
    points: Array<{ latitude: number; longitude: number }>,

  ) => {
    if (!mapRef.current || !points || points.length === 0) return;
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLon = Number.POSITIVE_INFINITY;
    let maxLon = Number.NEGATIVE_INFINITY;
    for (const p of points) {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLon) minLon = p.longitude;
      if (p.longitude > maxLon) maxLon = p.longitude;
    }
    if (
      !isFinite(minLat) ||
      !isFinite(maxLat) ||
      !isFinite(minLon) ||
      !isFinite(maxLon)
    )
      return;
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    let latDelta = (maxLat - minLat) * ZOOM_OUT_FACTOR || 0.02;
    let lonDelta = (maxLon - minLon) * ZOOM_OUT_FACTOR || 0.02;
    latDelta = Math.max(latDelta, 0.02);
    lonDelta = Math.max(lonDelta, 0.02);
    try {
      mapRef.current.animateToRegion(
        {
          latitude: centerLat,
          longitude: centerLon,
          latitudeDelta: latDelta,
          longitudeDelta: lonDelta,
        },
        650,
      );
    } catch {}
  };

  const fetchRoute = async (
    from: { latitude: number; longitude: number } | null,
    to: { latitude: number; longitude: number } | null,
  ) => {
    if (!from || !to) {
      setRouteCoords([]);
      return;
    }
    try {
      routeAbortRef.current?.abort();
    } catch {}
    const controller = new AbortController();
    routeAbortRef.current = controller;
    try {
      try {
        const extra: any = (Constants as any)?.expoConfig?.extra ?? {};
        const googleKey: string | undefined =
          extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || extra?.googleMapsApiKey;
        if (googleKey) {
          let googleMode:
            | 'DRIVE'
            | 'WALK'
            | 'BICYCLE'
            | 'TWO_WHEELER'
            | 'TRANSIT' =
            travelMode === 'car'
              ? 'DRIVE'
              : travelMode === 'walk'
              ? 'WALK'
              : travelMode === 'motor'
              ? 'TWO_WHEELER'
              : 'TRANSIT';
          const makeBody = (mode: typeof googleMode) => ({
            origin: {
              location: {
                latLng: {
                  latitude: from.latitude,
                  longitude: from.longitude,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: to.latitude,
                  longitude: to.longitude,
                },
              },
            },
            travelMode: mode,
            routingPreference:
              mode === 'DRIVE' || mode === 'TWO_WHEELER'
                ? 'TRAFFIC_AWARE'
                : 'ROUTING_PREFERENCE_UNSPECIFIED',
            departureTime: { seconds: Math.floor(Date.now() / 1000) + 60 },
            computeAlternativeRoutes: false,
          });
          let gres = await fetch(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
            {
              method: 'POST',
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': googleKey,
                'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
              },
              body: JSON.stringify(makeBody(googleMode)),
            },
          );
          const gdata = await gres.json();
          const encoded: string | undefined =
            gdata?.routes?.[0]?.polyline?.encodedPolyline;
          if (encoded) {
            const coords = decodePolyline(encoded);
            if (coords.length > 1) {
              setRouteCoords(coords);
              animateToBounds(coords);
              try {
                computeEta(from, to);
              } catch {}
              return;
            }
          }
          if (googleMode === 'TWO_WHEELER') {
            googleMode = 'DRIVE';
            gres = await fetch(
              'https://routes.googleapis.com/directions/v2:computeRoutes',
              {
                method: 'POST',
                signal: controller.signal,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Goog-Api-Key': googleKey,
                  'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
                },
                body: JSON.stringify(makeBody(googleMode)),
              },
            );
            const gdata2 = await gres.json();
            const encoded2: string | undefined =
              gdata2?.routes?.[0]?.polyline?.encodedPolyline;
            if (encoded2) {
              const coords2 = decodePolyline(encoded2);
              if (coords2.length > 1) {
                setRouteCoords(coords2);
                animateToBounds(coords2);
                try {
                  computeEta(from, to);
                } catch {}
                return;
              }
            }
          }
        }
      } catch {}
      setRouteCoords([]);
      try {
        computeEta(from, to);
      } catch {}
    } catch (e) {
      if ((e as any)?.name !== 'AbortError') {
        setRouteCoords([]);
      }
    }
  };

  const autoOptimizeRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
  ) => {
    try {
      if (optimizing) return;
      setOptimizing(true);

      // your ML / A* optimization
      const result = await optimizeRoute(origin, [], destination, travelMode);

      if (result?.geometry && result.geometry.length > 1) {
        setRouteCoords(result.geometry);
        animateToBounds(result.geometry);
        computeEta(origin, destination);
        return;
      }

      // fallback
      await fetchRoute(origin, destination);
    } catch (e) {
      await fetchRoute(origin, destination);
    } finally {
      setOptimizing(false);
    }
  };

  const computeEta = async (
    from: { latitude: number; longitude: number } | null,
    to: { latitude: number; longitude: number } | null,
  ) => {
    try {
      setEtaError(null);
      if (!to) {
        setEtaSeconds(null);
        return;
      }
      const origin =
        from ??
        (location
          ? { latitude: location.latitude, longitude: location.longitude }
          : null);
      if (!origin) {
        setEtaSeconds(null);
        return;
      }
      setEtaLoading(true);
      const { seconds, provider } = await getEtaDetailed(origin, to, travelMode);
      setEtaSeconds(seconds);
      setEtaProvider(provider);
    } catch (e: any) {
      setEtaError('ETA unavailable');
      setEtaSeconds(null);
      setEtaProvider('none');
    } finally {
      setEtaLoading(false);
    }
  };

  const useCurrentAsOrigin = async (
    toCoord?: { latitude: number; longitude: number } | null,
  ) => {
    try {
      let base = location;
      if (!base) {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const current = await Location.getCurrentPositionAsync({});
        base = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setLocation(base);
      }
      setOriginLive(true);
      setActiveField('from');
      const addr = base
        ? await reverseGeocodeName(base.latitude, base.longitude)
        : 'Current location';
      const place = base
        ? { name: addr, lat: base.latitude, lon: base.longitude }
        : null;
      setOriginPlace(place);
      setOriginPhrase(shortAddress(addr));
      setSearchResults([]);
      Keyboard.dismiss();
      const from = base
        ? { latitude: base.latitude, longitude: base.longitude }
        : null;
      const to = toCoord ?? currentDestinationCoord;
      setTimeout(() => {
        fitCameraIfPossible(from, to);
        fetchRoute(from, to);
      }, 50);
      setActiveField(null);
    } catch {}
  };

  const clearOrigin = () => {
    try {
      setOriginPhrase('');
      setOriginPlace(null);
      setOriginLive(false);
      try {
        locationWatcherRef.current?.remove?.();
      } catch {}
      locationWatcherRef.current = null;
      setRouteCoords([]);
      setSearchResults([]);
      handledParamRef.current = null;
      const to = currentDestinationCoord;
      setTimeout(() => {
        fitCameraIfPossible(null, to);
      }, 50);
    } catch {}
  };

  const clearDestination = () => {
    try {
      setDestinationPhrase('');
      setDestinationPlace(null);
      setRouteCoords([]);
      setSearchResults([]);
      handledParamRef.current = null;
      setParkings([]);
      const from = currentOriginCoord;
      setTimeout(() => {
        fitCameraIfPossible(from, null);
      }, 50);
    } catch {}
  };

  useEffect(() => {
    const from =
      currentOriginCoord ??
      (location
        ? { latitude: location.latitude, longitude: location.longitude }
        : null);
    const to = currentDestinationCoord ?? null;
    computeEta(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    travelMode,
    originPlace?.lat,
    originPlace?.lon,
    destinationPlace?.lat,
    destinationPlace?.lon,
    location?.latitude,
    location?.longitude,
  ]);

 const handleSelectResult = (item: Place) => {
  if (activeField === 'from') {
    setOriginPlace(item);
    setOriginPhrase(shortAddress(item.name));
  } else if (activeField === 'to') {
    setDestinationPlace(item);
    setDestinationPhrase(shortAddress(item.name)); // This should be set properly
  }
  try {
    if (activeField === 'to') {
      addSearch({
        name: shortAddress(item.name),
        address: item.address ?? item.name,
        lat: item.lat,
        lng: item.lon,
      });
    }
  } catch {}
  setSearchResults([]);
  Keyboard.dismiss();

  const from =
    activeField === 'from'
      ? { latitude: item.lat, longitude: item.lon }
      : currentOriginCoord;
  const to =
    activeField === 'to'
      ? { latitude: item.lat, longitude: item.lon }
      : currentDestinationCoord;

  // Check if the destination coordinates are correctly set
  console.log('Selected Destination:', to);

  setTimeout(() => {
    fitCameraIfPossible(from ?? null, to ?? null);
    fetchRoute(from ?? null, to ?? null);
  }, 50);

  setActiveField(null);
};


  // Live watcher for navigation / auto re-route
  useEffect(() => {
    const shouldWatch = !!destinationPlace && (originLive || !originPlace);
    if (!shouldWatch) {
      try {
        locationWatcherRef.current?.remove?.();
      } catch {}
      locationWatcherRef.current = null;
      lastDirectDistanceRef.current = null;
      return;
    }

    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        try {
          locationWatcherRef.current?.remove?.();
        } catch {}
        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 10000,
            distanceInterval: 25,
          },
          (pos) => {
            const base = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            };
            setLocation(base);

            // follow user when navigating
            try {
              if (navigating && followUser && mapRef.current) {
                mapRef.current.animateToRegion(
                  {
                    latitude: base.latitude,
                    longitude: base.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  },
                  450,
                );
              }
            } catch {}

            const to = currentDestinationCoord;
            if (!to) return;

            const from = base;

            // 1) direct distance change (big jumps)
            let directDist = Number.NaN;
            try {
              directDist = getDistance(from, to);
            } catch {}

            const last = lastDirectDistanceRef.current;
            lastDirectDistanceRef.current = directDist;

            if (originLive || !originPlace) {
              if (
                isFinite(directDist) &&
                last != null &&
                isFinite(last) &&
                directDist - last > 100
              ) {
                autoOptimizeRoute(from, to);
              } else if (!routeCoords || routeCoords.length < 2) {
                autoOptimizeRoute(from, to);
              } else {
                computeEta(from, to);
              }
            } else {
              // origin fixed, only update ETA
              computeEta(from, to);
            }

            // 2) off-route detection
            try {
              const distToRoute = distanceToRouteMeters(from, routeCoords);
              const now = Date.now();
              if (
                navigating &&
                isFinite(distToRoute) &&
                distToRoute > 80 &&
                now - lastRerouteAtRef.current > 20000
              ) {
                lastRerouteAtRef.current = now;
                autoOptimizeRoute(from, to);
              }
            } catch {}
          },
        );
      } catch {}
    })();

    return () => {
      try {
        locationWatcherRef.current?.remove?.();
      } catch {}
      locationWatcherRef.current = null;
      lastDirectDistanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    destinationPlace?.lat,
    destinationPlace?.lon,
    originLive,
    originPlace?.lat,
    originPlace?.lon,
  ]);

  // periodic ETA refresh
  useEffect(() => {
    const to = currentDestinationCoord;
    const origin =
      currentOriginCoord ??
      (location
        ? { latitude: location.latitude, longitude: location.longitude }
        : null);
    if (!to || !origin) {
      if (etaIntervalRef.current) {
        clearInterval(etaIntervalRef.current);
        etaIntervalRef.current = null;
      }
      return;
    }
    if (etaIntervalRef.current) {
      clearInterval(etaIntervalRef.current);
      etaIntervalRef.current = null;
    }
    etaIntervalRef.current = setInterval(() => {
      computeEta(origin, to);
    }, 60000) as unknown as number;
    return () => {
      if (etaIntervalRef.current) {
        clearInterval(etaIntervalRef.current);
        etaIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    destinationPlace?.lat,
    destinationPlace?.lon,
    originPlace?.lat,
    originPlace?.lon,
    travelMode,
  ]);

  // handle navigation from other screens (params)
  useEffect(() => {
    const latStr = params?.destLat as string | undefined;
    const lngStr = params?.destLng as string | undefined;
    const nameStr = params?.destName as string | undefined;
    const fromFlag = params?.from as string | undefined;
    const ts = params?.ts as string | undefined;
    if (!latStr || !lngStr) return;
    const key = `${latStr}|${lngStr}|${nameStr ?? ''}|${fromFlag ?? ''}|${ts ?? ''}`;
    if (handledParamRef.current === key) return;
    handledParamRef.current = key;
    const lat = parseFloat(latStr);
    const lon = parseFloat(lngStr);
    if (!isFinite(lat) || !isFinite(lon)) return;
    const name =
      nameStr && nameStr.trim().length > 0
        ? nameStr
        : `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    const dest: Place = { name, lat, lon };
    setActiveField('to');
    setDestinationPlace(dest);
    try {
      setDestinationPhrase(name);
    } catch {}
    if (fromFlag === 'me') {
      (async () => {
        try {
          await useCurrentAsOrigin({ latitude: lat, longitude: lon });
        } catch {}
      })();
    } else {
      const to = { latitude: lat, longitude: lon };
      setTimeout(() => {
        fitCameraIfPossible(currentOriginCoord, to);
        fetchRoute(currentOriginCoord, to);
      }, 80);
    }
  }, [
    params?.destLat,
    params?.destLng,
    params?.destName,
    params?.from,
    params?.ts,
  ]);

  const swapFromTo = () => {
    setOriginPlace(destinationPlace);
    setDestinationPlace(originPlace);
    setOriginPhrase(destinationPlace ? shortAddress(destinationPlace.name) : '');
    setDestinationPhrase(originPlace ? shortAddress(originPlace.name) : '');
    const newFrom = currentDestinationCoord
      ? {
          latitude: currentDestinationCoord.latitude,
          longitude: currentDestinationCoord.longitude,
        }
      : null;
    const newTo = currentOriginCoord
      ? {
          latitude: currentOriginCoord.latitude,
          longitude: currentOriginCoord.longitude,
        }
      : null;
    setTimeout(() => {
      fitCameraIfPossible(newFrom, newTo);
      fetchRoute(newFrom, newTo);
    }, 50);
  };

  const distanceToDestKm = (() => {
    try {
      if (currentOriginCoord && currentDestinationCoord) {
        return getDistance(currentOriginCoord, currentDestinationCoord) / 1000;
      }
      if (!currentOriginCoord && location && currentDestinationCoord) {
        return getDistance(location, currentDestinationCoord) / 1000;
      }
    } catch {}
    return null;
  })();

  // ---------- RENDER ----------
  return (
    <View style={styles.container}>
      {locationPermissionGranted === null ? (
        <View style={styles.loaderWrapper}>
          <ActivityIndicator size="large" color="#FFD166" />
        </View>
      ) : (
        <>
          <View style={[styles.searchContainer, { top: 24 }]} pointerEvents="box-none">
            <LinearGradient
              colors={[GOLD, GRAY]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.searchCardBorder}
            >
              <View style={styles.searchCard}>
                <View style={styles.fieldsCol}>
                  {/* FROM */}
                  <View
                    style={[ 
                      styles.row, 
                      activeField === 'from' && styles.rowActive 
                    ]}
                  >
                    <Feather name="map-pin" size={16} color="#FFD166" />
                    <TextInput
                      ref={(r) => {
                        originInputRef.current = r;
                      }}
                      style={styles.input}
                      placeholder="From"
                      placeholderTextColor="#8E8E93"
                      value={originPhrase}
                      onChangeText={(t) => {
                        setOriginPhrase(t);
                        setActiveField('from');
                        triggerSearch(t);
                      }}
                      onFocus={() => setActiveField('from')}
                      returnKeyType="search"
                      onSubmitEditing={() => setOriginFromQuery(originPhrase)}
                    />
                    <TouchableOpacity
                      accessibilityLabel="Use my current location as origin"
                      onPress={() => useCurrentAsOrigin(null)}
                      style={styles.clearTouch}
                    >
                      <Feather name="crosshair" size={16} color="#FFD166" />
                    </TouchableOpacity>
                    {originPhrase.length > 0 && (
                      <TouchableOpacity onPress={clearOrigin} style={styles.clearTouch}>
                        <Feather name="x" size={16} color="#bdbdbd" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.divider} />

                  {/* TO */}
                  <View style={[styles.row, activeField === 'to' && styles.rowActive]}>
                    <Feather name="search" size={16} color="#FFD166" />
                    <TextInput
                      ref={(r) => {
                        destinationInputRef.current = r;
                      }}
                      style={styles.input}
                      placeholder="To (Search for Parking Areas)"
                      placeholderTextColor="#8E8E93"
                      value={destinationPhrase}
                      onChangeText={(t) => {
                        setDestinationPhrase(t);
                        setActiveField('to');
                        triggerSearch(t);
                      }}
                      onFocus={() => setActiveField('to')}
                      returnKeyType="search"
                      onSubmitEditing={() => setDestinationFromQuery(destinationPhrase)}
                    />
                    {destinationPhrase.length > 0 && (
                      <TouchableOpacity onPress={clearDestination} style={styles.clearTouch}>
                        <Feather name="x" size={16} color="#bdbdbd" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={styles.swapCol}>
                  <TouchableOpacity
                    accessibilityLabel="Swap origin and destination"
                    onPress={swapFromTo}
                    style={styles.swapBtnCircle}
                  >
                    <Entypo name="swap" size={18} color="#FFD166" />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>

            {(() => {
              const hasRecoContent =
                activeField === 'to' &&
                (recommendedPlaces.length > 0 || loadingRecommendedTo);
              const hasSearchResults = searchResults.length > 0;
              const hasUnknownTo =
                activeField === 'to' &&
                !loadingRecommendedTo &&
                recommendedPlaces.length === 0 &&
                destinationPhrase.trim().length >= 2 &&
                searchResults.length === 0;
              const hasUnknownFrom =
                activeField === 'from' &&
                searchResults.length === 0 &&
                originPhrase.trim().length >= 2;
              const showDropdown =
                !!activeField &&
                (hasRecoContent || hasSearchResults || hasUnknownTo || hasUnknownFrom);
              return showDropdown;
            })() ? (
              <ScrollView
                style={styles.resultsContainer}
                keyboardShouldPersistTaps="handled"
              >
                {/* Recommended (TO) */}
                {activeField === 'to' && (
                  <View>
                    <View style={styles.recoHeaderRow}>
                      <Text style={styles.recoHeaderText}>Top parkings near you</Text>
                      {loadingRecommendedTo && (
                        <ActivityIndicator size="small" color="#FFD166" />
                      )}
                    </View>
                    <View style={styles.legendRow}>
                      <View style={styles.legendItemRow}>
                        <Feather
                          name="shield"
                          size={12}
                          color="#8E8E93"
                          style={styles.legendIcon}
                        />
                        <Text style={styles.legendLabel}>Guards</Text>
                      </View>
                      <View style={styles.legendItemRow}>
                        <Feather
                          name="video"
                          size={12}
                          color="#8E8E93"
                          style={styles.legendIcon}
                        />
                        <Text style={styles.legendLabel}>CCTV</Text>
                      </View>
                    </View>
                    {recommendedPlaces.map((r, i) => {
                      const id = makeParkingId(r.lat, r.lon);
                      const saved = savedIds.has(id);
                      return (
                        <TouchableOpacity
                          key={`reco-${r.lat}-${r.lon}-${i}`}
                          style={styles.resultItem}
                          onPress={() => handleSelectResult(r)}
                        >
                          <Text style={styles.resultText} numberOfLines={2}>
                            {r.name}
                          </Text>
                          <TouchableOpacity
                            accessibilityLabel={saved ? 'Remove bookmark' : 'Save bookmark'}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              toggleParking({
                                id,
                                name: r.name,
                                address: r.address ?? r.name,
                                lat: r.lat,
                                lng: r.lon,
                              });
                            }}
                            style={styles.bookmarkBtn}
                          >
                            <Feather
                              name="bookmark"
                              size={16}
                              color={saved ? '#FFD166' : '#8E8E93'}
                            />
                          </TouchableOpacity>
                          <View style={styles.resultDetailsRow}>
                            {r.distanceKm != null && (
                              <Text style={styles.resultDetailText}>
                                {r.distanceKm.toFixed(2)} km
                              </Text>
                            )}
                            {(() => {
                              const rate =
                                typeof r.initial_rate === 'number' &&
                                isFinite(r.initial_rate)
                                  ? `~₱${r.initial_rate.toFixed(0)}`
                                  : '';
                              return rate ? (
                                <Text style={styles.resultDetailText}>{rate}</Text>
                              ) : null;
                            })()}
                            {!!r.guards && (
                              <Feather
                                name="shield"
                                size={12}
                                color="#bdbdbd"
                                style={styles.resultDetailIcon}
                              />
                            )}
                            {!!r.cctvs && (
                              <Feather
                                name="video"
                                size={12}
                                color="#bdbdbd"
                                style={styles.resultDetailIcon}
                              />
                            )}
                            {!!r.street_parking && (
                              <Text style={styles.resultDetailText}>Street</Text>
                            )}
                            {(() => {
                              const hrs =
                                r.opening || r.closing
                                  ? `${r.opening ?? ''}${
                                      r.opening || r.closing ? ' - ' : ''
                                    }${r.closing ?? ''}`.trim()
                                  : '';
                              return hrs ? (
                                <Text style={styles.resultDetailText}>{hrs}</Text>
                              ) : null;
                            })()}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                    {recommendedPlaces.length > 0 && (
                      <View style={styles.sectionDivider} />
                    )}
                  </View>
                )}

                {/* Geocoder results (both fields) */}
                {searchResults.map((r, i) => {
                  const id = makeParkingId(r.lat, r.lon);
                  const saved = savedIds.has(id);
                  return (
                    <TouchableOpacity
                      key={`${r.lat}-${r.lon}-${i}`}
                      style={styles.resultItem}
                      onPress={() => handleSelectResult(r)}
                    >
                      <Text style={styles.resultText} numberOfLines={2}>
                        {r.name}
                      </Text>
                      <TouchableOpacity
                        accessibilityLabel={saved ? 'Remove bookmark' : 'Save bookmark'}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          toggleParking({
                            id,
                            name: r.name,
                            address: r.address ?? r.name,
                            lat: r.lat,
                            lng: r.lon,
                          });
                        }}
                        style={styles.bookmarkBtn}
                      >
                        <Feather
                          name="bookmark"
                          size={16}
                          color={saved ? '#FFD166' : '#8E8E93'}
                        />
                      </TouchableOpacity>
                      <Text style={styles.resultDistance}>
                        {r.distanceKm != null ? `${r.distanceKm.toFixed(2)} km` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {/* Unknown TO */}
                {activeField === 'to' &&
                  !loadingRecommendedTo &&
                  recommendedPlaces.length === 0 &&
                  destinationPhrase.trim().length >= 2 &&
                  searchResults.length === 0 && (
                    <View style={styles.unknownRow}>
                      <Text style={styles.unknownText}>Unknown destination</Text>
                    </View>
                  )}

                {/* Unknown FROM */}
                {activeField === 'from' &&
                  searchResults.length === 0 &&
                  originPhrase.trim().length >= 2 && (
                    <View style={styles.unknownRow}>
                      <Text style={styles.unknownText}>Unknown location</Text>
                    </View>
                  )}
              </ScrollView>
            ) : null}
          </View>

          <MapView
            ref={(r) => {
              mapRef.current = r;
            }}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: MANILA.latitude,
              longitude: MANILA.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            onPress={() => {
              try {
                setActiveField(null);
                setSearchResults([]);
                Keyboard.dismiss();
              } catch {}
            }}
          >
            {currentOriginCoord && (
              <Marker
                coordinate={currentOriginCoord}
                title={originPlace ? originPlace.name : 'Your location'}
                pinColor="yellow"
              />
            )}
            {currentDestinationCoord && (
              <Marker
                coordinate={currentDestinationCoord}
                title={destinationPlace?.name}
                pinColor={SELECTED_PIN}
              />
            )}

{parkings.map((p) => {
  const hours =
    p.opening || p.closing
      ? `${p.opening ?? ''}${p.opening || p.closing ? ' - ' : ''}${p.closing ?? ''}`.trim()
      : '';
  const rateText = isFinite(p.initial_rate)
    ? `~₱${p.initial_rate.toFixed(0)}`
    : '₱—'; // Ensure the cost is shown
  const descParts: string[] = [];
  descParts.push(`${p.distance_km.toFixed(2)} km`); // Ensure distance is shown
  descParts.push(rateText);
  const gc = `G${p.guards ? '✓' : '✗'}/C${p.cctvs ? '✓' : '✗'}`; // Ensure guards and CCTV info is included
  descParts.push(gc);
  if (p.street_parking) descParts.push('Street');
  if (hours) descParts.push(hours);
  const descText = descParts.join(' • ');

  const isSelectedParking =
    destinationPlace &&
    Math.abs(destinationPlace.lat - p.lat) < 1e-6 &&
    Math.abs(destinationPlace.lon - p.lng) < 1e-6;

  return (
    <Marker
      key={`parking-${p.index}-${p.lat}-${p.lng}`}
      coordinate={{ latitude: p.lat, longitude: p.lng }}
      title={p.name || 'Recommended parking'}
      // Don't use the description here anymore
    >
      <Callout tooltip>
        <View style={styles.calloutContainer}>
          <View style={styles.callout}>
            <Text style={styles.calloutTitle} numberOfLines={2}>
              {p.name || 'Recommended parking'}
            </Text>
            <View style={styles.calloutRow}>
              <Text style={styles.calloutChip}>
                {p.distance_km.toFixed(2)} km {/* Distance */}
              </Text>
              <Text style={styles.calloutChip}>{rateText}</Text> {/* Cost */}
              <Text
                style={[styles.calloutChip, p.open_now ? styles.calloutOpen : styles.calloutClosed]}
              >
                {p.open_now ? 'Open' : 'Closed'}
              </Text>
            </View>
            <View style={styles.calloutRow}>
              {!!p.guards && (
                <Feather
                  name="shield"
                  size={12}
                  color="#bdbdbd"
                  style={styles.calloutIcon}
                />
              )}
              {!!p.cctvs && (
                <Feather
                  name="video"
                  size={12}
                  color="#bdbdbd"
                  style={styles.calloutIcon}
                />
              )}
              {!!p.street_parking && (
                <Text style={styles.calloutChip}>Street</Text>
              )}
              {hours ? (
                <View style={styles.calloutHours}>
                  <Feather name="clock" size={12} color="#bdbdbd" />
                  <Text style={styles.calloutHoursText}>{hours}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.calloutArrowBorder} />
          <View style={styles.calloutArrow} />
        </View>
      </Callout>
    </Marker>
  );
})}




            {routeCoords && routeCoords.length > 1 && (
              <Polyline coordinates={routeCoords} strokeColor="#34C759" strokeWidth={4} />
            )}
          </MapView>

          {/* Edit FAB */}
          {showEditFab && (
            <TouchableOpacity
              accessibilityLabel="Open report form"
              onPress={() => setShowReportForm(true)}
              style={[styles.editFab, { bottom: Math.max(24, insets.bottom + 95) }]}
              activeOpacity={0.85}
            >
              <Feather name="edit-2" size={20} color="#FFD166" />
            </TouchableOpacity>
          )}

          {/* Report overlay */}
          {showReportForm && (
            <View style={styles.reportOverlayCenterWrapper}>
              <View style={styles.reportOverlayCard}>
                <View style={styles.reportHeaderRow}>
                  <Text style={styles.reportTitle}>Feedback Form</Text>
                  <TouchableOpacity
                    onPress={() => setShowReportForm(false)}
                    style={styles.reportCloseBtn}
                  >
                    <Feather name="x" size={18} color="#bdbdbd" />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  style={styles.reportScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Email *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="you@example.com"
                      placeholderTextColor="#666"
                      value={reportEmail}
                      onChangeText={setReportEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Concerned Address</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Address or landmark"
                      placeholderTextColor="#666"
                      value={reportAddress}
                      onChangeText={setReportAddress}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Concern *</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setShowConcernList((v) => !v)}
                    >
                      <Text style={styles.dropdownTriggerText}>
                        {concernOptions.find((o) => o.key === reportConcern)?.label ||
                          'Select concern'}
                      </Text>
                      <Feather name="chevron-down" size={16} color="#FFD166" />
                    </TouchableOpacity>
                    {showConcernList && (
                      <View style={styles.dropdownMenu}>
                        {concernOptions.map((o) => (
                          <TouchableOpacity
                            key={o.key}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setReportConcern(o.key);
                              setShowConcernList(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>{o.label}</Text>
                            {reportConcern === o.key && (
                              <Feather name="check" size={14} color="#FFD166" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Description *</Text>
                    <TextInput
                      style={[styles.formInput, styles.multilineInput]}
                      placeholder="Describe the issue or suggestion"
                      placeholderTextColor="#666"
                      value={reportDescription}
                      onChangeText={setReportDescription}
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Attachments (.jpg, .png, .pdf)</Text>
                    <View style={styles.attachRow}>
                      <TouchableOpacity
                        style={styles.attachBtn}
                        onPress={pickAttachment}
                        disabled={pickingAttachment}
                      >
                        <Feather name="paperclip" size={16} color="#FFD166" />
                        <Text style={styles.attachBtnText}>
                          {pickingAttachment ? 'Adding...' : 'Add'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {attachments.length > 0 && (
                      <View style={styles.attachmentList}>
                        {attachments.map((a) => (
                          <View key={a.uri} style={styles.attachmentItem}>
                            <Text style={styles.attachmentText} numberOfLines={1}>
                              {a.name || a.uri}
                            </Text>
                            <TouchableOpacity
                              onPress={() => removeAttachment(a.uri)}
                              style={styles.attachmentRemove}
                            >
                              <Feather name="x" size={14} color="#bdbdbd" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.submitRow}>
                    <TouchableOpacity
                      style={[ 
                        styles.submitBtn,
                        (!reportEmail.trim() ||
                          !reportConcern ||
                          !reportDescription.trim()) && 
                        styles.submitBtnDisabled,
                      ]}
                      onPress={submitReport}
                      disabled={
                        !reportEmail.trim() ||
                        !reportConcern ||
                        !reportDescription.trim()
                      }
                    >
                      <Text style={styles.submitBtnText}>Submit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setShowReportForm(false)}
                    >
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          )}

          {/* Distance + ETA + navigation */}
          {(distanceToDestKm != null || etaSeconds != null) && (
            <View
              style={[
                styles.distanceContainer,
                {
                  bottom: showEditFab
                    ? Math.max(24, insets.bottom + 150)
                    : Math.max(24, insets.bottom + 95),
                },
              ]}
            >
              <View style={styles.modeRow}>
                <TouchableOpacity
                  onPress={() => setTravelMode('car')}
                  style={[
                    styles.modeBtn,
                    travelMode === 'car' && styles.modeBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      travelMode === 'car' && styles.modeBtnTextActive,
                    ]}
                  >
                    Car
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTravelMode('walk')}
                  style={[
                    styles.modeBtn,
                    travelMode === 'walk' && styles.modeBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      travelMode === 'walk' && styles.modeBtnTextActive,
                    ]}
                  >
                    Walk
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTravelMode('motor')}
                  style={[
                    styles.modeBtn,
                    travelMode === 'motor' && styles.modeBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      travelMode === 'motor' && styles.modeBtnTextActive,
                    ]}
                  >
                    Motor
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTravelMode('commute')}
                  style={[
                    styles.modeBtn,
                    travelMode === 'commute' && styles.modeBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.modeBtnText,
                      travelMode === 'commute' && styles.modeBtnTextActive,
                    ]}
                  >
                    Commute
                  </Text>
                </TouchableOpacity>
              </View>
              {distanceToDestKm != null && (
                <Text style={styles.distanceText}>
                  {`Distance: ${distanceToDestKm.toFixed(2)} km way`}
                </Text>
              )}
              <Text style={styles.etaText}>
                {etaLoading
                  ? 'Calculating ETA…'
                  : etaSeconds != null
                  ? `ETA: ${formatEta(etaSeconds)} • Arrive ${getArrivalText(
                      etaSeconds,
                    )} (${etaProvider === 'google' ? 'Google' : '—'}${
                      originLive || !!locationWatcherRef.current ? ' • Live' : ''
                    })`
                  : etaError ||
                    `ETA unavailable (${etaProvider === 'google' ? 'Google' : '—'})`}
              </Text>
              <View style={styles.navRow}>
                {!navigating ? (
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        if (!currentDestinationCoord) return;
                        setFollowUser(true);
                        await useCurrentAsOrigin(currentDestinationCoord);
                        setNavigating(true);
                      } catch {}
                    }}
                    style={[styles.navBtn, !currentDestinationCoord && styles.navBtnDisabled]}
                    disabled={!currentDestinationCoord}
                  >
                    <Text style={styles.navBtnText}>Start</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      onPress={() => {
                        setNavigating(false);
                        setFollowUser(false);
                      }}
                      style={styles.navBtn}
                    >
                      <Text style={styles.navBtnText}>End</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setFollowUser(true);
                        try {
                          if (location && mapRef.current) {
                            mapRef.current.animateToRegion(
                              {
                                latitude: location.latitude,
                                longitude: location.longitude,
                                latitudeDelta: 0.01,
                                longitudeDelta: 0.01,
                              },
                              450,
                            );
                          }
                        } catch {}
                      }}
                      style={styles.recenterBtn}
                    >
                      <Text style={styles.recenterBtnText}>
                        {followUser ? 'Following' : 'Recenter'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  map: { flex: 1 },
  searchContainer: {
    position: 'absolute',
    top: 78,
    left: 20,
    right: 20,
    zIndex: 900,
    elevation: 5,
  },
  searchCardBorder: { borderRadius: 16, padding: 2 },
  searchCard: {
    flexDirection: 'row',
    backgroundColor: '#000',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'stretch',
  },
  fieldsCol: { flex: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  rowActive: { backgroundColor: '#0b0b0b' },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 4 },
  input: { color: '#fff', marginLeft: 8, flex: 1 },
  clearTouch: { padding: 6 },
  swapCol: {
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  swapBtnCircle: {
    backgroundColor: '#0b0b0b',
    borderRadius: 16,
    padding: 8,
    borderWidth: 1,
    borderColor: '#222',
  },
  resultsContainer: {
    marginTop: 8,
    backgroundColor: '#0b0b0b',
    borderRadius: 10,
    padding: 6,
    maxHeight: 220,
    opacity: 0.75,
  },
  resultItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomColor: '#222',
    borderBottomWidth: 1,
  },
  resultText: { color: '#fff', fontSize: 14 },
  resultDistance: { color: '#bdbdbd', fontSize: 12, marginTop: 4 },
  bookmarkBtn: { position: 'absolute', right: 8, top: 10, padding: 6 },
  stopBtn: {
    position: 'absolute',
    right: 48,
    top: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
  },
  stopBtnText: { color: '#FFD166', fontSize: 12 },
  recoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  recoHeaderText: { color: '#FFD166', fontSize: 12, fontWeight: '600' },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 4,
  },
  legendItemRow: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  legendIcon: { marginRight: 6 },
  legendLabel: { color: '#8E8E93', fontSize: 11 },
  resultDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 4,
  },
  resultDetailText: {
    color: '#bdbdbd',
    fontSize: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  resultDetailIcon: { marginRight: 8, marginBottom: 4 },
  callout: {
    padding: 8,
    minWidth: 180,
    maxWidth: 280,
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  calloutTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginBottom: 6 },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  calloutChip: { color: '#bdbdbd', fontSize: 12, marginRight: 8, marginBottom: 4 },
  calloutIcon: { marginRight: 8 },
  calloutHours: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  calloutHoursText: { color: '#bdbdbd', fontSize: 12, marginLeft: 4 },
  calloutOpen: { color: '#6EE7B7' },
  calloutClosed: { color: '#FCA5A5' },
  calloutContainer: { flexDirection: 'column', alignSelf: 'flex-start' },
  calloutArrowBorder: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderTopColor: '#222',
    borderWidth: 8,
    marginTop: -1,
  },
  calloutArrow: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderTopColor: '#111',
    borderWidth: 8,
    marginTop: -14,
  },
  sectionDivider: { height: 1, backgroundColor: '#222', marginVertical: 6 },
  distanceContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#000',
    padding: 10,
    borderRadius: 10,
    zIndex: 1100,
    elevation: 10,
  },
  distanceText: { color: '#FFD166', fontSize: 16, fontWeight: '600' },
  etaText: { color: '#bdbdbd', fontSize: 13, marginTop: 4 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  navBtn: {
    backgroundColor: '#FFD166',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  navBtnDisabled: { opacity: 0.5 },
  navBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  recenterBtn: {
    backgroundColor: '#111',
    borderColor: '#FFD166',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  recenterBtnText: { color: '#FFD166', fontSize: 12, fontWeight: '600' },
  modeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  modeBtn: {
    backgroundColor: '#111',
    borderColor: '#222',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
  },
  modeBtnActive: { backgroundColor: '#FFD16622', borderColor: '#FFD166' },
  modeBtnText: { color: '#FFD166', fontSize: 12 },
  modeBtnTextActive: { color: '#FFD166', fontWeight: '600' },
  editFab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#000',
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: '#222',
    zIndex: 1200,
    elevation: 12,
  },
  reportOverlayCenterWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000080',
    zIndex: 1300,
  },
  reportOverlayCard: {
    width: '88%',
    maxWidth: 520,
    maxHeight: '80%',
    backgroundColor: '#0b0b0b',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    elevation: 22,
    borderWidth: 1,
    borderColor: '#222',
  },
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reportTitle: { color: '#FFD166', fontSize: 16, fontWeight: '600' },
  reportCloseBtn: { padding: 6 },
  reportScroll: { maxHeight: 380 },
  formGroup: { marginBottom: 14 },
  label: { color: '#bdbdbd', fontSize: 12, marginBottom: 6 },
  formInput: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  multilineInput: { minHeight: 100, textAlignVertical: 'top' },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  dropdownTriggerText: { color: '#fff', fontSize: 14, flex: 1, marginRight: 8 },
  dropdownMenu: {
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
    marginTop: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownItemText: { color: '#fff', fontSize: 14, marginRight: 8 },
  attachRow: { flexDirection: 'row', alignItems: 'center' },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  attachBtnText: { color: '#FFD166', fontSize: 14, marginLeft: 6 },
  attachmentList: { marginTop: 10 },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#222',
  },
  attachmentText: { flex: 1, color: '#fff', fontSize: 12, marginRight: 8 },
  attachmentRemove: { padding: 4 },
  submitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#FFD166',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginRight: 10,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#000', fontWeight: '600', fontSize: 14 },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 18 },
  cancelBtnText: { color: '#FFD166', fontSize: 14 },
  unknownRow: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
  },
  unknownText: {
    color: '#bdbdbd',
    fontSize: 13,
    fontStyle: 'italic',
  },
});

export default MapScreen;
