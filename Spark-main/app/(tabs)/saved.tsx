import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Dimensions, Platform, StatusBar, Alert } from "react-native";
import SmoothScreen from "./components/SmoothScreen";
import { useRouter } from "expo-router";
import { SavedParking, subscribeSavedParkings, getSavedParkings, clearSavedParkings, removeParking } from "../services/savedParkings";
import { supabase } from "../services/supabaseClient";


// Responsive helpers (match History screen)
const { width, height } = Dimensions.get("window");
const WP = (pct: number) => Math.round((width * pct) / 100);
const HP = (pct: number) => Math.round((height * pct) / 100);

export default function SavedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SavedParking[]>(() => getSavedParkings());
  const [loggedIn, setLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeSavedParkings((arr) => setItems(arr));
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setLoggedIn(!!data.user);
      } catch {}
    })();
    const authUnsub = supabase.auth.onAuthStateChange((_e, sess) => {
      setLoggedIn(!!sess?.user);
    });
    return () => unsub();
  }, []);

  const clearAll = async () => {
    Alert.alert("Clear saved", "Remove all saved parkings?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try { await clearSavedParkings(); } catch (e) { console.warn("Failed to clear saved", e); }
          setItems([]);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: SavedParking }) => {
    const sub = item.address ?? `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`;
    return (
      <TouchableOpacity
        style={styles.squareItem}
        activeOpacity={0.9}
        onPress={() => {
          try {
            router.push({
              pathname: "/(tabs)/map",
              params: {
                destLat: String(item.lat),
                destLng: String(item.lng),
                destName: item.address ?? item.name,
                from: "me",
                ts: String(Date.now()),
              },
            });
          } catch {}
        }}
        onLongPress={() => {
          Alert.alert("Remove saved", `Remove \"${item.name}\" from saved?`, [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: async () => { try { await removeParking(item.id); } catch {} } },
          ]);
        }}
      >
        <View style={styles.squareContent}>
          <Text style={styles.squareName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6} allowFontScaling>
            {item.name}
          </Text>
          <Text style={styles.squareSub} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6} allowFontScaling>
            {sub}
          </Text>
        </View>
        <Text style={styles.squareTime} numberOfLines={1} allowFontScaling>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SmoothScreen>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.recentTitle}>Saved Parkings</Text>
            {loggedIn && (
              <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>

          {!loggedIn ? (
            <View style={{ alignItems: 'center', marginTop: HP(3) }}>
              <Text style={styles.empty}>Please log in to view your saved parkings.</Text>
              <TouchableOpacity onPress={() => router.push('/auth/LoginPage')} style={[styles.clearButton, { marginTop: HP(1.2) }]}>
                <Text style={styles.clearText}>Go to Login</Text>
              </TouchableOpacity>
            </View>
          ) : items.length === 0 ? (
            <Text style={styles.empty}>No saved parkings yet — tap the bookmark icon in the Map tab.</Text>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(i) => i.id}
              renderItem={renderItem}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={{ paddingBottom: HP(3) }}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </SafeAreaView>
    </SmoothScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000", paddingTop: Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0 },
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: WP(4),
    paddingTop: HP(1.5),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: HP(1.5),
  },
  recentTitle: {
    color: "#FFD166",
    fontSize: Math.max(18, WP(5)),
    fontWeight: "700",
    flexShrink: 1,
  },
  clearButton: {
    paddingHorizontal: WP(3),
    paddingVertical: HP(0.7),
    borderRadius: 6,
    backgroundColor: "#222",
  },
  clearText: {
    color: "#FFD166",
    fontWeight: "700",
    fontSize: Math.max(12, WP(3.5)),
  },
  empty: {
    color: "#FFD166",
    textAlign: "center",
    marginTop: HP(3),
    fontSize: Math.max(13, WP(3.8)),
  },
  columnWrapper: {
    justifyContent: "space-between",
    marginBottom: HP(1.2),
  },
  squareItem: {
    width: "48%",
    aspectRatio: 1.05,
    marginBottom: HP(1.2),
    borderRadius: Math.round(WP(2)),
    backgroundColor: "#222",
    padding: WP(3),
    justifyContent: "space-between",
    ...Platform.select({
      ios: {
        shadowColor: "#444", // gray shadow outline
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  squareContent: {
    flex: 1,
    justifyContent: "flex-start",
  },
  squareName: {
    color: "#FFD166",
    fontSize: Math.max(14, WP(4.2)),
    fontWeight: "700",
    marginBottom: HP(0.6),
    flexShrink: 1,
    includeFontPadding: false,
  },
  squareSub: {
    color: "#FFD166",
    fontSize: Math.max(11, WP(3.6)),
    flexShrink: 1,
  },
  squareTime: {
    color: "#FFD166",
    fontSize: Math.max(10, WP(3.4)),
    alignSelf: "flex-end",
  },
});
