import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabaseClient";
import { Ionicons } from "@expo/vector-icons";

const GOLD = "#FFDE59";
const YELLOW_GLOW = "rgba(255, 209, 102, 0.45)";

export default function Onboarding() {
  const router = useRouter();
  const { width, height } = Dimensions.get("window");
  const PAGES = 4;
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<any>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const linkOpacity = useRef(new Animated.Value(1)).current;
  const [linkHeight, setLinkHeight] = useState(0);

  // Float + glow
  const floatY = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(floatY, { toValue: -6, duration: 1200, useNativeDriver: true }),
          Animated.timing(floatY, { toValue: 0, duration: 1200, useNativeDriver: true }),
          Animated.timing(floatY, { toValue: 6, duration: 1200, useNativeDriver: true }),
          Animated.timing(floatY, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(glowOpacity, { toValue: 0.9, duration: 1500, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatY, glowOpacity]);

  const finish = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (userId) {
        await AsyncStorage.setItem(`onboarding_seen_v2:${userId}`, "1");
      } else {
        await AsyncStorage.setItem("onboarding_seen_v2", "1");
      }
    } catch {}
    router.replace("/(tabs)/map");
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const w = slideWidth || width;
    const idx = Math.round(e.nativeEvent.contentOffset.x / w);
    setPageIndex(Math.max(0, Math.min(PAGES - 1, idx)));
  };

  useEffect(() => {
    linkOpacity.setValue(pageIndex === 0 ? 1 : 0);
  }, [pageIndex, linkOpacity]);

  const goNext = () => {
    if (pageIndex >= PAGES - 1) return finish();
    const w = slideWidth || width;
    const target = Math.max(0, Math.min(PAGES - 1, pageIndex + 1));
    const nextX = target * w;
    (scrollRef.current as any)?.scrollTo?.({ x: nextX, animated: true });
    setPageIndex(target);
  };

  return (
    <SafeAreaView style={styles.background}>
      <LinearGradient
        colors={["#000000", "#0d0d0d", "#1a1a1a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        {/* Floating bubble card */}
        <Animated.View style={[styles.glowWrap, { transform: [{ translateY: floatY }] }]}>
          {/* Glow layer */}
          <Animated.View style={[styles.glowLayer, { opacity: glowOpacity }]} pointerEvents="none">
            <LinearGradient
              colors={[GOLD + "33", GOLD + "22", "transparent"]}
              start={{ x: 0.3, y: 0 }}
              end={{ x: 0.7, y: 1 }}
              style={styles.glowGradient}
            />
          </Animated.View>

          {/* Yellow-only border */}
          <LinearGradient
            colors={[GOLD, GOLD]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardWrapper}
          >
            <View style={styles.card}>
              {/* Top-right Skip */}
              <TouchableOpacity
                onPress={finish}
                style={styles.topSkip}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>

              {/* Pager */}
              <View
                style={styles.pagerWrap}
                onLayout={(e) => setSlideWidth(e.nativeEvent.layout.width)}
              >
                <Animated.ScrollView
                  ref={scrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={handleMomentumEnd}
                  snapToOffsets={Array.from(
                    { length: PAGES },
                    (_, i) => i * (slideWidth || width)
                  )}
                  disableIntervalMomentum
                  decelerationRate="fast"
                  contentContainerStyle={{ alignItems: "center" }}
                >
                  {/* Page 1 */}
                  <View style={[styles.slide, { width: slideWidth || width }]}>
                    <View style={styles.iconWrap}>
                      <Ionicons
                        name="map-outline"
                        size={height < 700 ? 56 : 64}
                        color={GOLD}
                      />
                    </View>
                    <Text
                      style={[styles.title, height < 700 && { fontSize: 24 }]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.9}
                    >
                      Find Parking in Manila City
                    </Text>
                    <Text
                      style={[styles.subtitle, height < 700 && { fontSize: 13 }]}
                      numberOfLines={4}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      Search parking around Manila City with top suggestions based on ranking.
                    </Text>
                  </View>

                  {/* Page 2 */}
                  <View style={[styles.slide, { width: slideWidth || width }]}>
                    <View style={styles.iconWrap}>
                      <Ionicons
                        name="navigate-outline"
                        size={height < 700 ? 56 : 64}
                        color={GOLD}
                      />
                    </View>
                    <Text
                      style={[styles.title, height < 700 && { fontSize: 24 }]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.9}
                    >
                      Live Routes & Distance
                    </Text>
                    <Text
                      style={[styles.subtitle, height < 700 && { fontSize: 13 }]}
                      numberOfLines={3}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      Preview your route on the map and see distance updates in real-time.
                    </Text>
                  </View>

                  {/* Page 3 */}
                  <View style={[styles.slide, { width: slideWidth || width }]}>
                    <View style={styles.iconWrap}>
                      <Ionicons
                        name="bookmark-outline"
                        size={height < 700 ? 56 : 64}
                        color={GOLD}
                      />
                    </View>
                    <Text
                      style={[styles.title, height < 700 && { fontSize: 24 }]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.9}
                    >
                      Save & Revisit
                    </Text>
                    <Text
                      style={[styles.subtitle, height < 700 && { fontSize: 13 }]}
                      numberOfLines={3}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      Bookmark favorite spots and review your recent search history.
                    </Text>
                  </View>

                  {/* Page 4 */}
                  <View style={[styles.slide, { width: slideWidth || width }]}>
                    <View style={styles.iconWrap}>
                      <Ionicons
                        name="pencil-outline"
                        size={height < 700 ? 56 : 64}
                        color={GOLD}
                      />
                    </View>
                    <Text
                      style={[styles.title, height < 700 && { fontSize: 24 }]}
                      numberOfLines={2}
                      adjustsFontSizeToFit
                      minimumFontScale={0.9}
                    >
                      Request an Edit
                    </Text>
                    <Text
                      style={[styles.subtitle, height < 700 && { fontSize: 13 }]}
                      numberOfLines={3}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      Submit an edit request form and our team will review and consider it for
                      future updates.
                    </Text>
                  </View>
                </Animated.ScrollView>
              </View>

              {/* Dots */}
              <View style={styles.dotsRow}>
                {Array.from({ length: PAGES }).map((_, i) => {
                  const w = slideWidth || width;
                  const inputRange = [(i - 1) * w, i * w, (i + 1) * w];
                  const dotWidth = scrollX.interpolate({
                    inputRange,
                    outputRange: [6, 18, 6],
                    extrapolate: "clamp",
                  });
                  const dotOpacity = scrollX.interpolate({
                    inputRange,
                    outputRange: [0.5, 1, 0.5],
                    extrapolate: "clamp",
                  });
                  return (
                    <Animated.View
                      key={i}
                      style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
                    />
                  );
                })}
              </View>

              {/* Bottom controls */}
              <View style={{ width: "100%" }}>
                <TouchableOpacity
                  onPress={goNext}
                  activeOpacity={0.9}
                  style={{ width: "100%" }}
                >
                  <LinearGradient
                    colors={[GOLD, GOLD]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.mainButton}
                  >
                    <Text style={styles.mainButtonText}>
                      {pageIndex === PAGES - 1 ? "Get Started" : "Next"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                {/* Ranking link only on first page */}
                <Animated.View
                  style={{
                    alignSelf: "center",
                    marginTop: 10,
                    opacity: linkOpacity,
                    minHeight: linkHeight || undefined,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => router.push("/auth/OnboardingRanking")}
                    style={{ alignSelf: "center" }}
                    disabled={pageIndex !== 0}
                    onLayout={(e) => {
                      if (!linkHeight) setLinkHeight(e.nativeEvent.layout.height);
                    }}
                  >
                    <Text
                      style={{
                        color: "#aaa",
                        textDecorationLine: "underline",
                      }}
                    >
                      How we rank suggestions
                    </Text>
                  </TouchableOpacity>
                </Animated.View>

                {/* Disclaimer */}
                <Text style={styles.disclaimer}>
                  Data shown in this app is experimental and manually collected. Some
                  information may be inaccurate or incomplete.
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#000" },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  glowWrap: {
    width: "92%",
    alignSelf: "center",
    borderRadius: 50,
  },
  glowLayer: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 60,
    overflow: "hidden",
  },
  glowGradient: {
    flex: 1,
    borderRadius: 60,
  },
  cardWrapper: { width: "100%", borderRadius: 50, padding: 2 },
  card: {
    width: "100%",
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "rgba(15,15,15,0.95)",
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  pagerWrap: {
    width: "100%",
    flexGrow: 1,
    justifyContent: "center",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  title: {
    fontSize: 26,
    color: GOLD,
    textAlign: "center",
    marginBottom: 6,
    fontWeight: "700",
    textShadowColor: YELLOW_GLOW,
    textShadowRadius: 8,
  },
  subtitle: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 14,
    lineHeight: 20,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    backgroundColor: "#0d0d0d",
    borderWidth: 2,
    borderColor: GOLD,
  },
  dotsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  dot: { height: 6, borderRadius: 3, backgroundColor: "#e5e5e5" },
  mainButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  mainButtonText: { color: "#0b0b0b", fontWeight: "700", fontSize: 18 },
  topSkip: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 5,
  },
  skipText: { color: "#aaa", textDecorationLine: "underline" },
  disclaimer: {
    color: "#888",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },
});
