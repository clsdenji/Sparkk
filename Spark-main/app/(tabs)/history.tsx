import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Platform,
  StatusBar,
} from "react-native";
import ThemedPrompt from "../components/ThemedPrompt";
import SmoothScreen from "./components/SmoothScreen";
import { useRouter } from "expo-router";
import { getSearchHistory, subscribeSearchHistory, clearSearchHistory, SearchEntry } from "../services/searchHistory";


// Responsive helpers
const { width, height } = Dimensions.get("window");
const WP = (pct: number) => Math.round((width * pct) / 100);
const HP = (pct: number) => Math.round((height * pct) / 100);

type RecentItem = { id: string; name: string; address?: string; lat?: number; lng?: number; timestamp: number };

export default function HistoryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<SearchEntry[]>(() => getSearchHistory());
  const [selectionMode, setSelectionMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const unsub = subscribeSearchHistory((h) => setItems(h));
    return () => unsub();
  }, []);

  const clearAll = async () => {
    setPrompt({
      visible: true,
      title: "Clear history",
      message: "Remove all recent searches?",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearSearchHistory();
            } catch (e) {
              console.warn("Failed to clear history", e);
            }
            setItems([]);
          },
        },
      ],
    });
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const found = prev.indexOf(id) !== -1;
      if (found) return prev.filter((p) => p !== id);
      return [...prev, id];
    });
  };

  const enterSelectionMode = (initialId?: string) => {
    setSelectionMode(true);
    if (initialId) setSelectedIds([initialId]);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;
    setPrompt({
      visible: true,
      title: `Delete ${selectedIds.length} item(s)?`,
      message: `This will permanently remove the selected history entries.`,
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const { removeSearch } = await import("../services/searchHistory");
              await Promise.all(selectedIds.map((id) => removeSearch(id)));
            } catch (e) {
              console.warn("Bulk remove failed", e);
            } finally {
              setItems((prev) => prev.filter((p) => !selectedIds.includes(p.id)));
              exitSelectionMode();
            }
          },
        },
      ],
    });
  };

  type PromptButton = { text: string; style?: "default" | "destructive" | "cancel"; onPress?: () => void };
  const [prompt, setPrompt] = useState<{ visible: boolean; title?: string; message?: string; buttons?: PromptButton[] }>({ visible: false });

  const renderItem = ({ item }: { item: SearchEntry }) => {
    const time = new Date(item.timestamp).toLocaleString();
    const sub = item.address ?? (item.lat != null && item.lng != null ? `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}` : "");
    return (
      <TouchableOpacity
        style={[
          styles.squareItem,
          selectionMode && selectedIds.indexOf(item.id) !== -1 ? styles.squareItemSelected : undefined,
        ]}
        activeOpacity={0.9}
        onPress={() => {
          try {
            if (selectionMode) {
              toggleSelection(item.id);
              return;
            }
            if (item.lat != null && item.lng != null) {
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
            } else {
              router.push("/(tabs)/map");
            }
          } catch {}
        }}
        onLongPress={() => enterSelectionMode(item.id)}
      >
        <View style={[
          styles.squareContent,
          selectionMode ? { paddingRight: 36 } : undefined,
        ]}>
          <Text
            style={styles.squareName}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            allowFontScaling
          >
            {item.name}
          </Text>
          <Text
            style={styles.squareSub}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
            allowFontScaling
          >
            {sub}
          </Text>
        </View>
        <Text style={styles.squareTime} numberOfLines={1} allowFontScaling>
          {time}
        </Text>
        {selectionMode && (
          <View style={styles.selectBadge}>
            <Text style={styles.selectBadgeText}>{selectedIds.indexOf(item.id) !== -1 ? '⚡' : ''}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SmoothScreen>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <Text style={styles.recentTitle}>Recent Searches</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {selectionMode ? (
                <>
                  <TouchableOpacity onPress={exitSelectionMode} style={styles.clearButton}>
                    <Text style={styles.clearText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={deleteSelected} style={[styles.clearButton, { marginLeft: WP(2) }]}>
                    <Text style={styles.clearText}>Delete ({selectedIds.length})</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
                    <Text style={styles.clearText}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSelectionMode(true)} style={[styles.clearButton, { marginLeft: WP(2) }]}> 
                    <Text style={styles.clearText}>Select</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {items.length === 0 ? (
            <Text style={styles.empty}>No searches yet — search on the Map tab.</Text>
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
        <ThemedPrompt
          visible={!!prompt.visible}
          title={prompt.title}
          message={prompt.message}
          buttons={prompt.buttons}
          onRequestClose={() => setPrompt({ visible: false })}
        />
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
        shadowColor: "#444", 
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
    fontSize: Math.max(12, WP(4.0)),
    flexShrink: 1,
  },
  squareTime: {
    color: "#FFD166",
    fontSize: Math.max(10, WP(3.4)),
    alignSelf: "flex-end",
  },
  squareItemSelected: {
    borderColor: '#FFD166',
    borderWidth: 2,
  },
  selectBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFD166',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectBadgeText: {
    color: '#FFD166',
    fontWeight: '900',
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: HP(1.6),
    paddingHorizontal: WP(2.5),
    borderRadius: Math.round(WP(2)),
    backgroundColor: "#222",
    marginBottom: HP(0.8),
  },
  name: {
    color: "#FFD166",
    fontSize: Math.max(14, WP(4.2)),
    fontWeight: "700",
  },
  sub: {
    color: "#FFD166",
    fontSize: Math.max(11, WP(3.6)),
    marginTop: HP(0.4),
  },
  time: {
    color: "#FFD166",
    fontSize: Math.max(10, WP(3.4)),
    marginLeft: WP(3),
  },
});
