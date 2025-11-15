// app/(tabs)/profile.tsx
import React, { useEffect, useRef, useState } from "react";
import { View, Text, Image, ImageBackground, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Animated, Easing, TextInput, ScrollView, Modal } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { supabase } from "../services/supabaseClient";
import { useRouter } from "expo-router";

// 🎨 Use same yellow as SavedScreen
const GOLD = "#FFD166";          // main accent
const GREEN = "#FFD166";         // was neutral gray; now yellow accent
const LOGOUT_GREEN = "#FFD166";  // was green; now yellow accent


const AVATARS = [
  { key: "avatar1", url: "https://fakqwgyvbqhonwfufhxg.supabase.co/storage/v1/object/sign/avatars/avatar1.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hYWZlNGUwNi0zNTA1LTQ2YmUtYTgzZi1jMzAzY2Q4MzE2YjMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhdmF0YXJzL2F2YXRhcjEucG5nIiwiaWF0IjoxNzYyODgzODQ5LCJleHAiOjE3OTQ0MTk4NDl9.ibrb-VmSpLWCl3jrS-nrcRbSleVS3tiSPtdOJCfWkCg" },
  { key: "avatar2", url: "https://fakqwgyvbqhonwfufhxg.supabase.co/storage/v1/object/sign/avatars/avatar2.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hYWZlNGUwNi0zNTA1LTQ2YmUtYTgzZi1jMzAzY2Q4MzE2YjMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhdmF0YXJzL2F2YXRhcjIucG5nIiwiaWF0IjoxNzYyODgzOTM3LCJleHAiOjE3OTQ0MTk5Mzd9.KRhdNjsVDZQYNBZfghT4iRD2_nHgddIzPwnPl7Geuc0" },
  { key: "avatar3", url: "https://fakqwgyvbqhonwfufhxg.supabase.co/storage/v1/object/sign/avatars/avatar3.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9hYWZlNGUwNi0zNTA1LTQ2YmUtYTgzZi1jMzAzY2Q4MzE2YjMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhdmF0YXJzL2F2YXRhcjMucG5nIiwiaWF0IjoxNzYyODgzOTU5LCJleHAiOjE3OTQ0MTk5NTl9.Nr3naZS4nRkp7Vno-nXv4rLalPw3LLZMXYQkV_U5Gnk" },
];

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [currentLocName, setCurrentLocName] = useState<string>("");
  const [locLoading, setLocLoading] = useState<boolean>(false);
  const [fullAddress, setFullAddress] = useState<string>("");
  const [showAddressInfo, setShowAddressInfo] = useState<boolean>(false);
  const router = useRouter();

  // Live preview: prefer selected avatar if present
  const previewAvatarUrl = selectedAvatar || avatarUrl;

  // Subtle pulsing glow for the avatar
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, {
            toValue: 1.06,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowScale, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glowOpacity, {
            toValue: 0.5,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(glowOpacity, {
            toValue: 0.3,
            duration: 1600,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [glowOpacity, glowScale]);

  // Spark loading animation (neon breathing)
  const sparkScale = useRef(new Animated.Value(1)).current;
  const sparkGlowOpacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(sparkScale, {
            toValue: 1.06,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(sparkScale, {
            toValue: 0.94,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(sparkGlowOpacity, {
            toValue: 0.55,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(sparkGlowOpacity, {
            toValue: 0.25,
            duration: 1100,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sparkScale, sparkGlowOpacity]);

  // Load user + profile
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        router.replace("/auth/LoginPage");
        return;
      }
      setUser(data.user);

      const { data: profile, error } = await supabase
        .from("users")
        .select("avatar_url, full_name")
        .eq("user_id", data.user.id)
        .single();

      if (!error && profile) {
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
        if (profile.full_name) setFullName(profile.full_name);
        setNameInput(profile.full_name || "");
      }
      setLoading(false);
    })();
  }, []);

  // Get current location (one-shot) and reverse geocode to display under Location
  useEffect(() => {
    (async () => {
      try {
        setLocLoading(true);
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setCurrentLocName("Location permission needed");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        const results = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const r = results?.[0];
        if (r) {
          // Short label under Location
          const parts = [r.name || r.street || r.subregion || r.city, r.region, r.country]
            .filter(Boolean)
            .slice(0, 2);
          const label = parts.join(", ");
          setCurrentLocName(label || "Current location");

          // Full address for popup
          const fullParts = [
            r.name,
            r.street,
            r.district,
            r.subregion,
            r.city,
            r.region,
            r.postalCode,
            r.country,
          ].filter(Boolean) as string[];
          // Deduplicate while preserving order
          const seen = new Set<string>();
          const ordered = fullParts.filter((p) => {
            const key = p.trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setFullAddress(ordered.join(', '));
        } else {
          setCurrentLocName("Current location");
          setFullAddress("");
        }
      } catch {
        setCurrentLocName("Current location");
        setFullAddress("");
      } finally {
        setLocLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!selectedAvatar || !user) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("users")
        .update({ avatar_url: selectedAvatar })
        .eq("user_id", user.id);
      if (error) throw error;

      setAvatarUrl(selectedAvatar);
      setChoosing(false);
      setSelectedAvatar(null);
      Alert.alert("Saved", "Your avatar has been updated!");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update avatar.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/auth/LoginPage");
  };

  const handleSaveName = async () => {
    if (!user) return;
    const value = nameInput.trim();
    if (!value) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }
    try {
      setNameSaving(true);
      const { error } = await supabase
        .from("users")
        .update({ full_name: value })
        .eq("user_id", user.id);
      if (error) throw error;
      setFullName(value);
      setEditingName(false);
      Alert.alert("Saved", "Your name has been updated!");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update name.");
    } finally {
      setNameSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animated.Text style={[styles.sparkText, { transform: [{ scale: sparkScale }] }]}>
          ⚡
        </Animated.Text>
      </View>
    );
  }

  return (
    <>
    <LinearGradient colors={["#000000", "#0a0a0a", "#000000"]} style={styles.container}>
      <ScrollView style={styles.scrollViewFullWidth} contentContainerStyle={styles.centerContentScroll} showsVerticalScrollIndicator={false}>
        {/* Top section with background image only here (ImageBackground wraps content) */}
        <ImageBackground
          source={require("@/assets/images/profile_bg.jpg")}
          style={styles.topHeader}
          imageStyle={styles.topHeaderBgImage}
          resizeMode="cover"
          blurRadius={10}
        >
          <View style={styles.topHeaderContent}>
            {/* Avatar bubble with gradient ring + glossy shine + pulsing glow */}
            <TouchableOpacity onPress={() => setChoosing(true)} activeOpacity={0.9}>
              <View style={styles.avatarWrap}>
                {/* Pulsing aura behind the ring */}
                <Animated.View
                  style={[
                    styles.glow,
                    {
                      transform: [{ scale: glowScale }],
                      opacity: glowOpacity,
                    },
                  ]}
                >
                  <LinearGradient colors={[GOLD, GREEN]} style={[StyleSheet.absoluteFill, styles.glowGradient]} />
                </Animated.View>

                {/* Gradient ring border */}
                <LinearGradient colors={[GOLD, GREEN]} style={styles.avatarBorder}>
                  <View style={styles.avatarInner}>
                    <Image
                      source={previewAvatarUrl ? { uri: previewAvatarUrl } : require("@/assets/images/icon.png")}
                      style={styles.avatar}
                    />
                    {/* Glossy highlight */}
                    <LinearGradient
                      colors={["rgba(255,255,255,0.45)", "rgba(255,255,255,0.1)", "transparent"]}
                      start={{ x: 0.1, y: 0.0 }}
                      end={{ x: 0.9, y: 0.9 }}
                      style={styles.shine}
                    />
                  </View>
                </LinearGradient>
              </View>
            </TouchableOpacity>

            {/* Name + email (only when not choosing) */}
            {!choosing && (
              <View style={styles.nameOutline}>
                {!editingName ? (
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{`${fullName || "Spark User"} ⚡`}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        setNameInput(fullName || "");
                        setEditingName(true);
                      }}
                      style={styles.editIconBtn}
                      activeOpacity={0.7}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Edit name"
                    >
                      <MaterialCommunityIcons name="pencil" size={16} color={GOLD} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.nameEditor}>
                    <TextInput
                      value={nameInput}
                      onChangeText={setNameInput}
                      placeholder="Enter your name"
                      placeholderTextColor="#777"
                      style={styles.nameInput}
                      returnKeyType="done"
                      onSubmitEditing={handleSaveName}
                      maxLength={64}
                    />
                    <View style={styles.nameActions}>
                      <TouchableOpacity
                        onPress={handleSaveName}
                        disabled={nameSaving}
                        style={[styles.primaryBtnWrap, nameSaving && { opacity: 0.6 }, { marginBottom: -13 }]}
                      >
                        <View style={styles.saveOutlineBtnGreen}>
                          <Text style={styles.saveOutlineTextGreen}>{nameSaving ? "Saving..." : "Save"}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setEditingName(false)}
                        disabled={nameSaving}
                        style={[styles.cancelOutlineGreen, { marginTop: 2 }]}
                      >
                        <Text style={styles.cancelOutlineTextGreen}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {!editingName && (
                  <Text style={[styles.email, { marginBottom: 0 }]}>{user?.email}</Text>
                )}
              </View>
            )}
          </View>
          {/* Soft fade-out at the bottom of the header instead of a hard line */}
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.6)", "#000"]}
            locations={[0, 0.6, 1]}
            style={styles.headerFade}
            pointerEvents="none"
          />
        </ImageBackground>

        {/* Avatar chooser now shown as a centered modal (no layout shift) */}

        {/* Hide these while choosing */}
        {!choosing && (
          <View style={styles.bottomSection}>
            {/* Subtle gradient background at the top of the bottom section to blend into header */}
            <LinearGradient
              colors={["#000", "rgba(0,0,0,0)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.bottomTopFade}
              pointerEvents="none"
            />

            <View style={styles.contentBlock}>

            {/* Plain, no-container menu with subtle white pills */}
            <View style={styles.menuListPlain}>
              <TouchableOpacity
                style={styles.menuItemBare}
                activeOpacity={0.9}
                onPress={() => setShowAddressInfo(true)}
                accessibilityRole="button"
                accessibilityLabel="Show full address"
              >
                <View style={{ alignItems: 'center' }}>
                  <View style={styles.locationTitleRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={20} color={LOGOUT_GREEN} style={{ marginRight: 8 }} />
                    <Text style={styles.locationTitleText}>Location</Text>
                  </View>
                  <Text style={styles.menuSubText} numberOfLines={1}>
                    {locLoading ? "Detecting location…" : (currentLocName || "Current location")}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Plain subtle white Logout (with icon), no container */}
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.7}
              accessibilityLabel="Log out"
              style={{ marginTop: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'center' }}
            >
              <MaterialCommunityIcons name="logout-variant" size={18} color="rgba(255,255,255,0.40)" />
              <Text style={styles.logoutPlainText}>Logout</Text>
            </TouchableOpacity>

            {/* logout moved into the menu card above to match reference design */}
          </View>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
    {/* Floating full-address info */}
    <Modal
      visible={showAddressInfo}
      transparent
      animationType="fade"
      onRequestClose={() => setShowAddressInfo(false)}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setShowAddressInfo(false)}
        style={styles.addressModalBackdrop}
      >
        <View style={styles.addressModalCard}>
          <Text style={styles.addressTitle}>Your Location:</Text>
          <Text style={styles.addressText} numberOfLines={6}>
            {locLoading ? 'Detecting location…' : (fullAddress || 'Address unavailable')}
          </Text>
        </View>
      </TouchableOpacity>
    </Modal>
    {/* Centered avatar picker modal */}
    <Modal
      visible={choosing}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!saving) {
          setChoosing(false);
          setSelectedAvatar(null);
        }
      }}
    >
      <View style={styles.addressModalBackdrop}>
        <View style={styles.pickerModalCard}>
          <Text style={styles.chooseText}>
            {selectedAvatar ? "Tap Save to confirm" : "Choose your avatar"}
          </Text>

          <View style={styles.grid}>
            {AVATARS.map((a) => (
              <TouchableOpacity
                key={a.key}
                onPress={() => setSelectedAvatar(a.url)}
                style={[styles.choice, selectedAvatar === a.url && styles.choiceSelected]}
                activeOpacity={0.85}
              >
                <Image source={{ uri: a.url }} style={styles.choiceImg} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!selectedAvatar || saving}
              style={[styles.modalActionBtnWrap, (!selectedAvatar || saving) && { opacity: 0.6 }]}
            >
              <View style={styles.saveOutlineBtnGreen}>
                <Text style={styles.saveOutlineTextGreen}>{saving ? "Saving..." : "Save"}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (!saving) {
                  setChoosing(false);
                  setSelectedAvatar(null);
                }
              }}
              style={[styles.cancelOutlineGreen, { marginTop: 0 }]}
            >
              <Text style={styles.cancelOutlineTextGreen}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  centerContent: { alignItems: "center", width: "100%" },
  sparkGlowNeon: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
  },
  sparkGlowNeonGradient: {
    borderRadius: 42,
  },
  sparkText: {
    fontSize: 44,
    color: GOLD,
    textAlign: "center",
    // Neon glow around the bolt (both platforms)
    textShadowColor: "rgba(255, 222, 89, 0.75)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  bgImageContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },
  bgImageFill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    pointerEvents: "none",
  },
  bgImage: {
    opacity: 0.8,
  },
  centerContentScroll: {
    flexGrow: 1,
    alignItems: "stretch",
    justifyContent: "flex-start",
    paddingHorizontal: 0, // remove padding so header can be truly full-bleed
    paddingVertical: 24,
  },
  scrollViewFullWidth: { width: "100%", alignSelf: "stretch" },
  topHeader: {
    width: "100%",
    alignSelf: "stretch", // ensure full-width even when ScrollView centers children
    minHeight: 490, // extend header further down per request
    alignItems: "center",
    justifyContent: "center",
    marginTop: 0,
    marginBottom: 0,
    position: "relative",
  },
  topHeaderBgImage: {
    opacity: 0.35,
  },
  topHeaderContent: {
    width: "100%",
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end", // push avatar/name/email lower in the header
    paddingTop: 8,
    paddingBottom: 40, // space above the divider
  },
  headerFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 28,
  },
  headerLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 8,
  },
  headerLocationText: {
    color: "#A5A5A5",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    maxWidth: "86%",
  },
  bottomSection: {
    width: "100%",
    position: "relative",
    paddingTop: 8,
  },
  bottomTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  contentBlock: {
    width: "86%",
    maxWidth: 400,
    alignSelf: "center",
    alignItems: "center",
  },
  nameOutline: {
    width: "100%",
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: "transparent",
    paddingHorizontal: 0,
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  infoCardBorder: {
    width: "100%",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
    marginBottom: 16,
    alignItems: "center",
  },
  infoCard: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  menuCardBorder: {
    width: "100%",
    borderRadius: 20,
    padding: 2,
    marginBottom: 10,
  },
  menuCard: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },
  sectionDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.14)",
    marginVertical: 12,
  },
  menuText: { color: "#fff", fontSize: 15, fontWeight: "700", textAlign: 'center' },
  locationTitleText: { color: "rgba(255,255,255,0.85)", fontSize: 15, fontWeight: "700", textAlign: 'center' },
  locationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  menuDivider: { height: 1, backgroundColor: "#222", marginVertical: 6, opacity: 0.9 },
  menuListPlain: { width: "100%", gap: 10, marginTop: 30 },
  menuItemBare: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  menuItemFloating: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  menuTextDark: { color: "#0b0b0b", fontSize: 15, fontWeight: "700" },
  menuSubText: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2, textAlign: 'center' },
  logoutPlainText: {
    color: "#fff",
    opacity: 0.40,
    fontSize: 13,
    textAlign: "center",
    marginLeft: 6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    width: "100%",
  },
  editIconBtn: { marginLeft: 2, padding: 4, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  editNameBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GOLD,
    marginLeft: 8,
  },
  editNameText: { color: GOLD, fontWeight: "700", fontSize: 12 },
  nameEditor: { width: "100%", maxWidth: 400, alignItems: "center", marginTop: 6, marginBottom: 10 },
  nameInput: {
    width: 260,
    alignSelf: "center",
    backgroundColor: "#0f0f0f",
    borderColor: "#333",
    borderWidth: 1,
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
  },
  nameActions: { width: "100%", alignItems: "center", marginTop: 10, marginBottom: 8 },

  avatarWrap: { alignItems: "center", justifyContent: "center", marginBottom: 20 },
  // Outer gradient ring (border)
  avatarBorder: {
    width: 146,
    height: 146,
    borderRadius: 73,
    padding: 4, // ring thickness
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  // Inner dark container to clip shine and image
  avatarInner: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
    borderRadius: 69,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  // Actual avatar image fills the inner circle
  avatar: { width: "100%", height: "100%", borderRadius: 69 },
  // Pulsing glow behind everything
  glow: {
    position: "absolute",
    width: 172,
    height: 172,
    borderRadius: 86,
    opacity: 0.35,
    overflow: "hidden", // ensure the inner gradient clips to a perfect circle
    pointerEvents: "none",
  },
  glowGradient: { borderRadius: 86 },
  // Glossy highlight overlay
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.35,
  },

  avatarPicker: { alignItems: "center", marginBottom: 20, width: "100%" },
  primaryBtnWrap: { width: "70%", marginBottom: 12 },
  primaryBtn: { borderRadius: 30, paddingVertical: 12, alignItems: "center" },
  primaryText: { color: "#000", fontSize: 16, fontWeight: "700" },
  saveOutlineBtn: {
    borderRadius: 30,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  saveOutlineText: { color: GOLD, fontSize: 16, fontWeight: "700" },
  saveOutlineBtnGreen: {
    borderRadius: 30,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 0,
    borderColor: LOGOUT_GREEN,
    backgroundColor: "transparent",
  },
  saveOutlineTextGreen: { color: LOGOUT_GREEN, fontSize: 16, fontWeight: "700" },

  chooseText: { color: GOLD, fontSize: 16, fontWeight: "700", marginBottom: 10, textAlign: "center" },
  cancelOutlineGreen: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  cancelOutlineTextGreen: { color: LOGOUT_GREEN, fontWeight: "700", fontSize: 14 },
  grid: { flexDirection: "row", justifyContent: "center", width: "100%", marginHorizontal: -6 },
  choice: {
    width: 70,
    height: 70,
    borderRadius: 14,
    borderColor: "#333",
    borderWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 6,
  },
  choiceSelected: {
    borderColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  choiceImg: { width: "100%", height: "100%" },
  cancelBtn: { marginTop: 10, paddingVertical: 6, paddingHorizontal: 12 },
  cancelText: { color: "#aaa", textDecorationLine: "underline" },
  cancelBtnGreen: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    backgroundColor: LOGOUT_GREEN,
  },
  cancelTextGreen: { color: "#000", fontWeight: "700", fontSize: 14 },

  name: { fontSize: 22, color: GOLD, fontWeight: "700", marginTop: 10, textAlign: "center" },
  email: { fontSize: 14, color: "#bbb", marginBottom: 30 },

  // ✅ Your “bubble” turned into a pill
  logoutBubble: {
    width: "100%",
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    overflow: "hidden",
  },
  logoutOutline: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    padding: 2, // gradient border thickness
    alignItems: "center",
    justifyContent: "center",
    shadowColor: LOGOUT_GREEN,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  logoutHollow: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  logoutTextOutline: { color: GOLD, fontSize: 16, fontWeight: "700" },
  logoutOutlineNeutral: {
    width: "100%",
    height: "100%",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: LOGOUT_GREEN,
  },
  logoutTextNeutral: { color: "#fff", fontSize: 16, fontWeight: "700" },
  // Address modal styles
  addressModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  addressModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  addressTitle: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  addressText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Avatar picker modal card
  pickerModalCard: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(0,0,0,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  modalActionBtnWrap: {
    minWidth: 120,
    marginBottom: 0,
    marginRight: 10,
  },
});
