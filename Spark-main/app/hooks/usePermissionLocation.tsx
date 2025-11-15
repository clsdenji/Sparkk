import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Button,
  Alert,
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import * as Location from "expo-location";

type Props = {
  // alreadyGranted indicates whether permission was already granted before this component mounted
  onPermissionGranted: (location: Location.LocationObject, alreadyGranted: boolean) => void;
};

const GOLD = "#FFDE59";
const AURA = "rgba(255, 222, 89, 0.28)";
const AURA_STRONG = "rgba(255, 222, 89, 0.45)";
const DELAY_BEFORE_REQUEST_MS = 1000; // show text briefly first

const LocationPermission: React.FC<Props> = ({ onPermissionGranted }) => {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Avoid showing the loading message when we're skipping because it's already granted
  const [skipLoadingMessage, setSkipLoadingMessage] = useState(false);

  // adaptive sizing
  const { width, height } = useWindowDimensions();
  const scaleBase = Math.min(width / 390, height / 844);
  const size = (n: number) => Math.round(n * Math.max(0.8, scaleBase));

  // subtle glow pulse
  const glow = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.75, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const askLocationPermission = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied.");
        Alert.alert("Permission denied", "Location permission is required to proceed.");
        return;
      }

      // ✅ Hide overlay immediately after success
      const location = await Location.getCurrentPositionAsync({});
      setVisible(false);
      onPermissionGranted(location, false);
    } catch {
      setErrorMsg("An error occurred while fetching location.");
    } finally {
      setLoading(false);
    }
  };

  // On mount, detect if permission already granted; if yes, skip UI and continue immediately
  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        setLoading(true);
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === "granted") {
          setSkipLoadingMessage(true);
          try {
            await Location.hasServicesEnabledAsync();
          } catch {}

          const location = await Location.getCurrentPositionAsync({});
          if (cancelled) return;
          setVisible(false);
          onPermissionGranted(location, true);
          return;
        }
      } catch {
        // fall back to requesting
      } finally {
        if (!cancelled) setLoading(false);
      }

      // Not granted yet: request after a small delay to display message
      timeout = setTimeout(() => {
        if (!cancelled) askLocationPermission();
      }, DELAY_BEFORE_REQUEST_MS);
    })();

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const Cars = () => {
    const travel = useRef(new Animated.Value(0)).current;
    const offset1 = useRef(new Animated.Value(-width * 0.35)).current;
    const offset2 = useRef(new Animated.Value(-width * 0.05)).current;
    const offset3 = useRef(new Animated.Value(+width * 0.25)).current;

    useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(travel, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(travel, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, [travel]);

    const travelX = travel.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.6, width * 0.6] });

    return (
      <View style={[styles.sparkWrap, { width, height: size(110), marginBottom: size(18) }]} pointerEvents="none">
        <Animated.Text
          style={{
            position: "absolute",
            fontSize: size(36),
            textShadowColor: AURA_STRONG,
            textShadowRadius: size(18),
            textShadowOffset: { width: 0, height: 0 },
            opacity: glow as any,
            transform: [
              { translateX: Animated.add(travelX, offset1) },
              { translateY: -size(8) },
              { scaleX: -1 }, // face right
            ],
          }}
        >
          🚗
        </Animated.Text>
        <Animated.Text
          style={{
            position: "absolute",
            fontSize: size(40),
            textShadowColor: AURA,
            textShadowRadius: size(16),
            textShadowOffset: { width: 0, height: 0 },
            opacity: glow as any,
            transform: [
              { translateX: Animated.add(travelX, offset2) },
              { scaleX: -1 },
            ],
          }}
        >
          🚙
        </Animated.Text>
        <Animated.Text
          style={{
            position: "absolute",
            fontSize: size(34),
            textShadowColor: AURA,
            textShadowRadius: size(14),
            textShadowOffset: { width: 0, height: 0 },
            opacity: glow as any,
            transform: [
              { translateX: Animated.add(travelX, offset3) },
              { translateY: size(10) },
              { scaleX: -1 },
            ],
          }}
        >
          🚕
        </Animated.Text>

        {/* Tiny road */}
        <View
          style={{
            position: "absolute",
            bottom: 0,
            width: width * 0.82,
            height: size(6),
            backgroundColor: "#121212",
            borderRadius: size(4),
            overflow: "hidden",
          }}
        >
          <View style={{ position: "absolute", inset: 0, opacity: 0.25, backgroundColor: "#ffffff" }} />
          {/* Center dashed line */}
          <View
            style={{
              position: "absolute",
              top: size(2),
              left: width * 0.02,
              right: width * 0.02,
              height: size(2),
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <View key={i} style={{ width: width * 0.05, height: size(2), backgroundColor: GOLD, opacity: 0.9, borderRadius: 2 }} />
            ))}
          </View>
        </View>
      </View>
    );
  };

  if (!visible) return null; // ✅ removes component after success

  return (
    <View style={styles.overlay}>
      <View style={styles.centerBox}>
  <Cars />
        {loading && !skipLoadingMessage && (
          <Text style={[styles.msg, { fontSize: size(16), color: GOLD }]}>Requesting location permission…</Text>
        )}
        {errorMsg && (
          <>
            <Text style={[styles.error, { fontSize: size(15), marginBottom: size(16), paddingHorizontal: size(12) }]}>
              {errorMsg}
            </Text>
            <View style={{ width: "70%" }}>
              <Button title="Try Again" onPress={askLocationPermission} />
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    zIndex: 9999,
    elevation: 20,
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  sparkWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  msg: {
    marginTop: 8,
    color: "#fff",
    opacity: 0.92,
    textAlign: "center",
  },
  error: {
    color: "#ff6b6b",
    textAlign: "center",
  },
});

export default LocationPermission;
