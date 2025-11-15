// app/(tabs)/components/SmoothScreen.tsx
import React, { PropsWithChildren, useEffect, useMemo, useRef } from "react";
import { View, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeOutUp, Layout } from "react-native-reanimated";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { Gesture, GestureDetector, PanGestureHandlerEventPayload } from "react-native-gesture-handler";

export default function SmoothScreen({ children }: PropsWithChildren) {
  const focused = useIsFocused();
  // Avoid flicker on tab change by preventing re-mount animations.
  // We run the entering animation only once on the very first mount.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  // Swipe-to-switch tabs: navigate to previous/next tab on horizontal fling
  const navigation = useNavigation<any>();
  const pan = useMemo(() => {
    const SWIPE_TX = 40; // px
    const SWIPE_VX = 400; // velocity threshold
    return Gesture.Pan()
      .activeOffsetX([-12, 12])
      .failOffsetY([-16, 16])
  .onEnd((e: PanGestureHandlerEventPayload) => {
        const parent = navigation.getParent?.();
        const state = parent?.getState?.();
        if (!parent || !state) return;

        const routes = state.routes;
        const currentIndex = state.index ?? 0;

        // swipe left -> next
        if (e.translationX <= -SWIPE_TX && Math.abs(e.velocityX) > SWIPE_VX) {
          const next = Math.min(currentIndex + 1, routes.length - 1);
          if (next !== currentIndex) parent.navigate(routes[next].name as never);
        }

        // swipe right -> prev
        if (e.translationX >= SWIPE_TX && Math.abs(e.velocityX) > SWIPE_VX) {
          const prev = Math.max(currentIndex - 1, 0);
          if (prev !== currentIndex) parent.navigate(routes[prev].name as never);
        }
      });
  }, [navigation]);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        // Keep the component mounted across focus changes and avoid using a toggling key
        // so it doesn't re-mount and flicker.
        // Only animate on first mount, never on subsequent tab switches.
        entering={hasMountedRef.current ? undefined : FadeInDown.duration(180)}
        layout={Layout.springify().damping(16).stiffness(180)}
        style={styles.root}
      >
        <View style={styles.content}>{children}</View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  content: { flex: 1 },
});
