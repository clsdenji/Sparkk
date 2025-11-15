// app/(tabs)/CustomNavBar.tsx
import React, { memo } from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { LinearGradient } from "expo-linear-gradient";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/** Spark palette (Black + Gold aesthetic) */
const BLACK = "#000000";
const DARK = "#0d0d0d";
const GOLD = "#FFDE59";
const GOLD_GLOW = "rgba(255, 222, 89, 0.45)";
const WHITE = "#ffffff";

const ALLOWED = new Set(["map", "saved", "history", "profile"]);

function IconFor(route: string, color: string) {
  switch (route) {
    case "map":
      return <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={color} />;
    case "saved":
      return <Ionicons name="bookmark-outline" size={20} color={color} />;
    case "history":
      return <MaterialCommunityIcons name="clock-time-four-outline" size={20} color={color} />;
    case "profile":
      return <FontAwesome6 name="circle-user" size={20} color={color} />;
    default:
      return null;
  }
}

const CustomNavBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const visibleRoutes = state.routes.filter(r => ALLOWED.has(r.name));

  return (
    <View style={styles.wrapper}>
      <LinearGradient
        colors={[BLACK, DARK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.containerShadow}
      >
        <View style={styles.container}>
          {visibleRoutes.map((route, index) => {
            const isFocused = state.index === state.routes.indexOf(route);
            const { options } = descriptors[route.key];
            const label = (options.tabBarLabel ?? options.title ?? route.name) as string;

            const onPress = () => {
              const evt = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!isFocused && !evt.defaultPrevented) navigation.navigate(route.name, route.params);
            };

            return (
              <AnimatedTouchable
                key={route.key}
                onPress={onPress}
                activeOpacity={0.9}
                layout={LinearTransition.springify().mass(0.4)}
                style={[styles.tabItem, isFocused && styles.activeBubble]}
              >
                {IconFor(route.name, isFocused ? BLACK : GOLD)}
                {isFocused && (
                  <Animated.Text
                    entering={FadeIn.duration(160)}
                    exiting={FadeOut.duration(160)}
                    style={styles.label}
                  >
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </Animated.Text>
                )}
              </AnimatedTouchable>
            );
          })}
        </View>
      </LinearGradient>

      {/* Soft gold underglow */}
      <View style={styles.glow} />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    alignItems: "center",
  },
  containerShadow: {
    borderRadius: 45,
    padding: 3,
    shadowColor: GOLD_GLOW,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: BLACK,
    borderRadius: 45,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: "90%",
    alignSelf: "center",
  },
  tabItem: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 30,
  },
  activeBubble: {
    backgroundColor: GOLD,
    shadowColor: GOLD,
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  label: {
    marginLeft: 6,
    fontWeight: "700",
    fontSize: 13,
    color: BLACK,
  },
  glow: {
    position: "absolute",
    bottom: 6,
    height: 18,
    width: "80%",
    borderRadius: 40
  },
});

export default memo(CustomNavBar);
