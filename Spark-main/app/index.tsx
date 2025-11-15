// app/AuthSplashScreen.tsx

import React, { useEffect, useRef, useState, type FC } from "react";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  StatusBar,
  SafeAreaView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { MuseoModerno_700Bold } from "@expo-google-fonts/museomoderno";
import { supabase } from "./services/supabaseClient";

// --- Types for Animated values (TS only) ---
import type { Animated as RNAnimated } from "react-native";

// --- Black & Yellow Theme (Spark standard theme) ---
const YELLOW = "#FFD166"; // main accent
const YELLOW_GLOW = "rgba(255, 209, 102, 0.55)"; // soft golden glow

// Map old names to new palette (for reuse in code)
const GREEN = YELLOW;
const GOLD = YELLOW;
const GREEN_GLOW = YELLOW_GLOW;
const GOLD_GLOW = YELLOW_GLOW;

const TRACK_WIDTH = 280;
const BUFFER = 140;
const PASS = TRACK_WIDTH + BUFFER;
const DURATION = 2600;

export default function AuthSplashScreen() {
  const router = useRouter();
  const [sessionChecked, setSessionChecked] = useState(false);

  // Entry animation
  const inOpacity = useRef(new Animated.Value(0)).current;
  const inScale = useRef(new Animated.Value(0.96)).current;

  // Fade out + veil
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const veilOpacity = useRef(new Animated.Value(0)).current;

  // Sliding neon words
  const greenX = useRef(new Animated.Value(-PASS)).current;
  const yellowX = useRef(new Animated.Value(+PASS)).current;

  // Neon pulse
  const neonPulse = useRef(new Animated.Value(0.9)).current;

  const [fontsLoaded] = useFonts({ MuseoModerno_700Bold });

  // Check session before splash
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.replace("/(tabs)/map");
      } else {
        setSessionChecked(true);
      }
    })();
  }, []);

  // Run animation if no session
  useEffect(() => {
    if (!fontsLoaded || !sessionChecked) return;

    // Intro scale + fade
    Animated.parallel([
      Animated.timing(inOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(inScale, {
        toValue: 1,
        friction: 7,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();

    // Sliding words left/right
    Animated.parallel([
      Animated.timing(greenX, {
        toValue: +PASS,
        duration: DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(yellowX, {
        toValue: -PASS,
        duration: DURATION,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Looping neon pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(neonPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(neonPulse, {
          toValue: 0.85,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Fade out and navigate
    const t = setTimeout(() => {
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(veilOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          router.replace("/auth/LoginPage");
        }
      });
    }, DURATION + 400);

    return () => clearTimeout(t);
  }, [fontsLoaded, sessionChecked]);

  if (!fontsLoaded) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <LinearGradient
          colors={["#000000", "#07090B", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.container}
        >
          <Animated.View
            style={[
              styles.center,
              { opacity: inOpacity, transform: [{ scale: inScale }] },
            ]}
          >
            <Animated.View
              style={{ opacity: contentOpacity, alignItems: "center" }}
            >
              <View style={[styles.track, { width: TRACK_WIDTH }]}>
                {/* Both words are yellow now, sliding opposite directions */}
                <NeonWord
                  text="Spark"
                  color={YELLOW}
                  glow={YELLOW_GLOW}
                  translateX={greenX}
                  pulse={neonPulse}
                  top={2}
                />
                <NeonWord
                  text="Spark"
                  color={YELLOW}
                  glow={YELLOW_GLOW}
                  translateX={yellowX}
                  pulse={neonPulse}
                />
                <NeonBolt pulse={neonPulse} />
              </View>
            </Animated.View>
          </Animated.View>

          {/* Black veil fade-out */}
          <Animated.View
            pointerEvents="none"
            style={[styles.veil, { opacity: veilOpacity }]}
          />
        </LinearGradient>
      </SafeAreaView>
    </View>
  );
}

/** ---------- Neon helpers with types ---------- */

type NeonWordProps = {
  text: string;
  color: string;
  glow: string;
  translateX: RNAnimated.Value;
  pulse: RNAnimated.Value;
  top?: number;
};

const NeonWord: FC<NeonWordProps> = ({
  text,
  color,
  glow,
  translateX,
  pulse,
  top = 0,
}) => {
  return (
    <Animated.View
      style={[styles.neonWrap, { transform: [{ translateX }] }, { top }]}
    >
      {/* Aura (bigger, softer) */}
      <Animated.Text
        style={[
          styles.neonAura,
          {
            color,
            textShadowColor: glow,
            opacity: pulse as any, // satisfy RN style type
          },
        ]}
      >
        {text}
      </Animated.Text>

      {/* Crisp main */}
      <Animated.Text
        style={[
          styles.neonMain,
          {
            color,
            textShadowColor: glow,
            opacity: (pulse as any).interpolate({
              inputRange: [0.85, 1],
              outputRange: [0.95, 1],
            }),
          },
        ]}
      >
        {text}
      </Animated.Text>
    </Animated.View>
  );
};

type NeonBoltProps = { pulse: RNAnimated.Value };

const NeonBolt: FC<NeonBoltProps> = ({ pulse }) => {
  return (
    <Animated.Text
      style={[
        styles.bolt,
        {
          textShadowColor: YELLOW_GLOW,
          opacity: pulse as any,
        },
      ]}
    >
      ⚡
    </Animated.Text>
  );
};

/** ---------- Styles ---------- */

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  safe: {
    flex: 1,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  },
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  track: {
    height: 80,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },

  neonWrap: {
    position: "absolute",
    ...Platform.select({ android: { elevation: 0 } }),
  },

  neonAura: {
    position: "absolute",
    fontSize: 56,
    fontFamily: "MuseoModerno_700Bold",
    letterSpacing: 1.2,
    textShadowRadius: 26,
    textShadowOffset: { width: 0, height: 0 },
  },

  neonMain: {
    position: "absolute",
    fontSize: 54,
    fontFamily: "MuseoModerno_700Bold",
    letterSpacing: 1.2,
    textShadowRadius: 14,
    textShadowOffset: { width: 0, height: 0 },
  },

  bolt: {
    position: "absolute",
    fontSize: 30,
    color: YELLOW,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },

  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
});
