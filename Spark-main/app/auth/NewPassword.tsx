// app/auth/NewPassword.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  SafeAreaView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFonts } from "expo-font";
import { Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Roboto_400Regular } from "@expo-google-fonts/roboto";
import { supabase } from "../services/supabaseClient";

// Black & Yellow palette
const GOLD = "#FFDE59";
const YELLOW_GLOW = "rgba(255, 209, 102, 0.45)";
const AMBER = "#FFB84D";
const RED = "#FF4D4D";

// Password validation: 8+ chars, upper, lower, number, special
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export default function NewPasswordScreen() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [rePasswordErr, setRePasswordErr] = useState("");
  const [updating, setUpdating] = useState(false);

  // Animations (match Spark card + glow)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-30)).current;
  const scaleAnim = useRef(new Animated.Value(0.97)).current;
  const glowOpacity = useRef(new Animated.Value(0.9)).current;

  const [fontsLoaded] = useFonts({ Poppins_700Bold, Roboto_400Regular });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.9,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const onChangePassword = (v: string) => {
    setPassword(v);
    if (v.length === 0) setPasswordErr("");
    else
      setPasswordErr(
        PASSWORD_REGEX.test(v)
          ? ""
          : "Password must be 8+ chars, include upper, lower, number & special char."
      );
    // Keep mismatch in sync if rePassword has value
    if (rePassword.length > 0)
      setRePasswordErr(v === rePassword ? "" : "Passwords do not match.");
  };

  const onChangeRePassword = (v: string) => {
    setRePassword(v);
    if (v.length === 0 || password.length === 0) setRePasswordErr("");
    else setRePasswordErr(v === password ? "" : "Passwords do not match.");
  };

  const handleUpdatePassword = async () => {
    // No prompts beyond inline errors
    if (!password || !rePassword) {
      if (!password) setPasswordErr("Password is required.");
      if (!rePassword) setRePasswordErr("Please re-enter your password.");
      return;
    }
    const invalid = !PASSWORD_REGEX.test(password);
    const mismatch = password !== rePassword;
    if (invalid)
      setPasswordErr(
        "Password must be 8+ chars, include upper, lower, number & special char."
      );
    if (mismatch) setRePasswordErr("Passwords do not match.");
    if (invalid || mismatch) return;

    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert("Error", error.message);
        return;
      }
      Alert.alert(
        "Password updated",
        "You can now log in with your new password.",
        [{ text: "OK", onPress: () => router.replace("/auth/LoginPage") }]
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update password.");
    } finally {
      setUpdating(false);
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.background}>
      <LinearGradient
        colors={["#000000", "#0d0d0d", "#1a1a1a"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.overlay}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Animated.View
            style={[
              styles.glowWrap,
              {
                transform: [
                  {
                    scale: glowOpacity.interpolate({
                      inputRange: [0.9, 1],
                      outputRange: [1, 1.015],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Glow layer */}
            <Animated.View
              style={[styles.glowLayer, { opacity: glowOpacity }]}
              pointerEvents="none"
            >
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
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.back()}
                >
                  <Ionicons name="arrow-back" size={26} color={GOLD} />
                </TouchableOpacity>

                <Text style={styles.title}>Set New Password</Text>

                <Text style={styles.subtitle}>
                  Enter and confirm your new password.
                </Text>

                <TextInput
                  style={[styles.input, !!passwordErr && styles.inputError]}
                  placeholder="New Password"
                  placeholderTextColor="#888"
                  secureTextEntry
                  value={password}
                  onChangeText={onChangePassword}
                />
                {!!passwordErr && (
                  <Text style={styles.errorText}>{passwordErr}</Text>
                )}

                <TextInput
                  style={[styles.input, !!rePasswordErr && styles.inputError]}
                  placeholder="Re-enter New Password"
                  placeholderTextColor="#888"
                  secureTextEntry
                  value={rePassword}
                  onChangeText={onChangeRePassword}
                />
                {!!rePasswordErr && (
                  <Text style={styles.errorText}>{rePasswordErr}</Text>
                )}

                <TouchableOpacity
                  onPress={handleUpdatePassword}
                  activeOpacity={0.9}
                  disabled={updating}
                  style={{ width: "100%" }}
                >
                  <LinearGradient
                    colors={[GOLD, GOLD]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.mainButton, updating && { opacity: 0.7 }]}
                  >
                    <Text style={styles.mainButtonText}>
                      {updating ? "Updating..." : "Update Password"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </LinearGradient>
          </Animated.View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  glowWrap: {
    width: "92%",
    alignSelf: "center",
    borderRadius: 40,
    shadowColor: GOLD,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 0 },
  },
  glowLayer: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    borderRadius: 50,
    overflow: "hidden",
  },
  glowGradient: { flex: 1, borderRadius: 50 },
  cardWrapper: { width: "100%", borderRadius: 40, padding: 2 },
  card: {
    backgroundColor: "rgba(15,15,15,0.95)",
    borderRadius: 40,
    paddingVertical: 40,
    paddingHorizontal: 28,
    alignItems: "center",
    width: "100%",
  },

  backButton: { position: "absolute", top: 20, left: 20 },

  title: {
    fontSize: 26,
    color: GOLD,
    fontFamily: "Poppins_700Bold",
    textAlign: "center",
    marginBottom: 10,
    textShadowColor: YELLOW_GLOW,
    textShadowRadius: 10,
  },
  subtitle: {
    color: "#ccc",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 25,
    fontFamily: "Roboto_400Regular",
  },

  input: {
    width: "100%",
    height: 55,
    borderRadius: 14,
    paddingHorizontal: 20,
    marginBottom: 12,
    backgroundColor: "#101010",
    borderColor: "#303030",
    borderWidth: 1,
    fontSize: 16,
    color: "#fff",
    fontFamily: "Roboto_400Regular",
  },

  errorText: {
    color: AMBER,
    fontSize: 13,
    marginBottom: 4,
    textAlign: "center",
  },

  inputError: {
    borderColor: RED,
    shadowColor: RED,
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },

  mainButton: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  mainButtonText: {
    color: "#0b0b0b",
    fontWeight: "700",
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
  },
});
