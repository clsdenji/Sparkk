// app/auth/LoginPage.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Alert,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFonts } from "expo-font";
import { Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Roboto_400Regular } from "@expo-google-fonts/roboto";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabaseClient";

// Black & Yellow palette
const GOLD = "#FFDE59"; // main yellow
const YELLOW_GLOW = "rgba(255, 209, 102, 0.45)";
const AMBER = "#FFB84D"; // keep for warnings
const RED = "#FF4D4D";   // error

export default function LoginPage() {
  const router = useRouter();

  // form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rePassword, setRePassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);

  const [passwordError, setPasswordError] = useState("");
  const [rePasswordError, setRePasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-50)).current;
  const scaleAnim = useRef(new Animated.Value(0.98)).current;
  const glowOpacity = useRef(new Animated.Value(0.9)).current;
  const heartbeat = useRef(new Animated.Value(1)).current;
  const errorFade = useRef(new Animated.Value(0)).current;

  const shakeEmailX = useRef(new Animated.Value(0)).current;
  const shakePasswordX = useRef(new Animated.Value(0)).current;
  const shakeRepasswordX = useRef(new Animated.Value(0)).current;

  const triggerShake = (anim: Animated.Value) => {
    anim.setValue(0);
    Animated.sequence([
      Animated.timing(anim, { toValue: -10, duration: 40, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -8, duration: 70, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 8, duration: 70, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -5, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 5, duration: 60, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const [fontsLoaded] = useFonts({ Poppins_700Bold, Roboto_400Regular });

  // Heartbeat animation (for loading bolt)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeat, { toValue: 1.25, duration: 400, useNativeDriver: true }),
        Animated.timing(heartbeat, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [heartbeat]);

  // Glow animation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.9, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [glowOpacity]);

  // Animate entry
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim, scaleAnim]);

  // Error fade
  useEffect(() => {
    const hasError = !!(emailError || passwordError || rePasswordError);
    Animated.timing(errorFade, {
      toValue: hasError ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [emailError, passwordError, rePasswordError, errorFade]);

  // Validation
  const ZW_SPACES = /[\s\u200B\u200C\u200D\uFEFF]/g;
  function normalizeEmail(value: string) {
    return value.normalize("NFKC").replace(ZW_SPACES, "").trim().toLowerCase();
  }
  const EMAIL_REGEX =
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

  const validateEmail = (v: string) => {
    const cleaned = normalizeEmail(v);
    setEmail(cleaned);
    if (cleaned.length === 0) {
      setEmailError("");
    } else {
      setEmailError(EMAIL_REGEX.test(cleaned) ? "" : "Please enter a valid email address.");
    }
  };

  const validatePassword = (v: string) => {
    const regex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (v.length === 0) {
      setPasswordError("");
    } else {
      setPasswordError(
        regex.test(v) ? "" : "Password must be 8+ chars, include upper, lower, number & special char."
      );
    }
    setPassword(v);
  };

  const validateRePassword = (v: string) => {
    setRePassword(v);
    if (v.length === 0 || password.length === 0) {
      setRePasswordError("");
    } else {
      setRePasswordError(v === password ? "" : "Passwords do not match.");
    }
  };

  const toggleMode = () => {
    setIsLogin((s) => !s);
    setName("");
    setEmail("");
    setPassword("");
    setRePassword("");
    setPasswordError("");
    setRePasswordError("");
    setEmailError("");
  };

  const handleSubmit = async () => {
    if (!email || !password || (!isLogin && (!name.trim() || !rePassword))) {
      Alert.alert("Incomplete", "Please fill all required fields.");
      return;
    }

    const sanitizedEmail = normalizeEmail(email);
    if (!EMAIL_REGEX.test(sanitizedEmail)) {
      setEmail(sanitizedEmail);
      if (!emailError) setEmailError("Please enter a valid email address.");
      triggerShake(shakeEmailX);
      return;
    }

    if (!isLogin) {
      const mismatch = rePassword !== password;
      if (mismatch && !rePasswordError) setRePasswordError("Passwords do not match.");
      if (passwordError || rePasswordError || mismatch) {
        if (passwordError) triggerShake(shakePasswordX);
        if (mismatch || rePasswordError) triggerShake(shakeRepasswordX);
        return;
      }
    }

    const sanitizedName = name.trim();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      });
      if (error) {
        Alert.alert("Wrong email or password", "Please check your credentials and try again.");
      } else {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const userId = userRes?.user?.id;
          let shouldShowOnboarding = true;
          if (userId) {
            const seen = await AsyncStorage.getItem(`onboarding_seen_v2:${userId}`);
            shouldShowOnboarding = !seen;
          } else {
            const legacy = await AsyncStorage.getItem("onboarding_seen_v2");
            shouldShowOnboarding = !legacy;
          }
          router.replace(shouldShowOnboarding ? "/auth/Onboarding" : "/(tabs)/map");
        } catch {
          router.replace("/(tabs)/map");
        }
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: sanitizedEmail,
        password,
      });
      if (error) {
        Alert.alert("Sign-up failed", error.message);
        return;
      }
      const userId = data.user?.id;
      const { error: insertError } = await supabase
        .from("users")
        .insert([{ user_id: userId, full_name: sanitizedName, email: sanitizedEmail }]);
      if (insertError) {
        Alert.alert("Error saving profile", insertError.message);
      } else {
        Alert.alert("Account Created", "Your account has been created. Please log in.", [
          { text: "OK", onPress: () => setIsLogin(true) },
        ]);
      }
    }
  };

  // Loading gate — fonts only
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.Text style={[styles.loadingBolt, { transform: [{ scale: heartbeat }] }]}>
          ⚡
        </Animated.Text>
      </View>
    );
  }

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
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
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
              <Animated.View style={[styles.glowLayer, { opacity: glowOpacity }]} pointerEvents="none">
                <LinearGradient
                  colors={[GOLD + "33", GOLD + "18", "transparent"]}
                  start={{ x: 0.3, y: 0 }}
                  end={{ x: 0.7, y: 1 }}
                  style={styles.glowGradient}
                />
              </Animated.View>

              {/* Card border gradient (yellow only) */}
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
                  <View style={{ alignItems: "center", marginBottom: 26 }}>
                    <Text style={styles.welcomeText}>Welcome to</Text>
                    <Text style={styles.sparkTitle}>Spark</Text>
                  </View>

                  {!isLogin && (
                    <TextInput
                      style={[styles.input, focusedInput === "name" && styles.inputFocused]}
                      onFocus={() => setFocusedInput("name")}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Full Name"
                      placeholderTextColor="#888"
                      autoCapitalize="words"
                      value={name}
                      onChangeText={setName}
                    />
                  )}

                  <Animated.View style={{ width: "100%", transform: [{ translateX: shakeEmailX }] }}>
                    <TextInput
                      style={[
                        styles.input,
                        focusedInput === "email" && styles.inputFocused,
                        !!emailError && styles.inputError,
                      ]}
                      onFocus={() => setFocusedInput("email")}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Email"
                      placeholderTextColor="#888"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={validateEmail}
                    />
                  </Animated.View>
                  {!!emailError && (
                    <Animated.Text style={[styles.errorText, { opacity: errorFade }]}>
                      {emailError}
                    </Animated.Text>
                  )}

                  <Animated.View style={{ width: "100%", transform: [{ translateX: shakePasswordX }] }}>
                    <TextInput
                      style={[
                        styles.input,
                        focusedInput === "password" && styles.inputFocused,
                        !isLogin && !!passwordError && styles.inputError,
                      ]}
                      onFocus={() => setFocusedInput("password")}
                      onBlur={() => setFocusedInput(null)}
                      placeholder="Password"
                      placeholderTextColor="#888"
                      secureTextEntry
                      value={password}
                      onChangeText={(v) => {
                        if (isLogin) {
                          setPassword(v);
                          if (v.length === 0) setPasswordError("");
                        } else {
                          validatePassword(v);
                          if (rePassword.length > 0) {
                            if (v.length === 0) setRePasswordError("");
                            else setRePasswordError(
                              v === rePassword ? "" : "Passwords do not match."
                            );
                          }
                        }
                      }}
                    />
                  </Animated.View>
                  {!!passwordError && (
                    <Animated.Text style={[styles.errorText, { opacity: errorFade }]}>
                      {passwordError}
                    </Animated.Text>
                  )}

                  {!isLogin && (
                    <>
                      <Animated.View
                        style={{ width: "100%", transform: [{ translateX: shakeRepasswordX }] }}
                      >
                        <TextInput
                          style={[
                            styles.input,
                            focusedInput === "repassword" && styles.inputFocused,
                            !!rePasswordError && styles.inputError,
                          ]}
                          onFocus={() => setFocusedInput("repassword")}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="Re-enter Password"
                          placeholderTextColor="#888"
                          secureTextEntry
                          value={rePassword}
                          onChangeText={validateRePassword}
                        />
                      </Animated.View>
                      {!!rePasswordError && (
                        <Animated.Text style={[styles.errorText, { opacity: errorFade }]}>
                          {rePasswordError}
                        </Animated.Text>
                      )}
                    </>
                  )}

                  <TouchableOpacity onPress={handleSubmit} activeOpacity={0.9} style={{ width: "100%" }}>
                    <LinearGradient
                      colors={[GOLD, GOLD]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.mainButton}
                    >
                      <Text style={styles.mainButtonText}>
                        {isLogin ? "Log in" : "Sign Up"}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={toggleMode} style={styles.outlineButton}>
                    <Text
                      style={styles.outlineButtonText}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                    >
                      {isLogin ? "Create new account" : "Already have an account? "}
                      {!isLogin && <Text style={styles.linkText}>Log in</Text>}
                    </Text>
                  </TouchableOpacity>

                  {isLogin && (
                    <TouchableOpacity onPress={() => router.push("/auth/ForgotPassword")}>
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  )}
                </Animated.View>
              </LinearGradient>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: "#000" },
  overlay: { ...StyleSheet.absoluteFillObject },
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  glowWrap: {
    width: "92%",
    alignSelf: "center",
    borderRadius: 50,
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
    borderRadius: 60,
    overflow: "hidden",
  },
  glowGradient: { flex: 1, borderRadius: 60 },
  cardWrapper: {
    width: "100%",
    borderRadius: 50,
    padding: 2,
  },
  card: {
    width: "100%",
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "rgba(15,15,15,0.95)",
    paddingVertical: 45,
    paddingHorizontal: 28,
    alignItems: "center",
  },
  welcomeText: {
    fontSize: 20,
    color: GOLD,
    fontFamily: "Poppins_700Bold",
    textShadowColor: YELLOW_GLOW,
    textShadowRadius: 10,
    marginBottom: -4,
  },
  sparkTitle: {
    fontSize: 38,
    color: GOLD,
    fontFamily: "Poppins_700Bold",
    textShadowColor: YELLOW_GLOW,
    textShadowRadius: 14,
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
  inputFocused: {
    borderColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.6,
    shadowRadius: 10,
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
    marginVertical: 12,
  },
  mainButtonText: {
    color: "#0b0b0b",
    fontWeight: "700",
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
  },
  outlineButton: {
    width: "100%",
    minHeight: 56,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  outlineButtonText: {
    color: GOLD,
    fontWeight: "700",
    fontSize: 16,
    textAlign: "center",
  },
  linkText: { color: GOLD, textDecorationLine: "underline" },
  forgotText: {
    color: GOLD,
    marginTop: 10,
    fontSize: 15,
    textDecorationLine: "underline",
  },
  errorText: { color: AMBER, fontSize: 13, marginBottom: 8 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  loadingBolt: {
    fontSize: 60,
    color: GOLD,
    textShadowColor: "rgba(255, 222, 89, 0.6)",
    textShadowRadius: 25,
  },
});
