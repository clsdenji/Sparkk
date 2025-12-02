import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

export default function Goodbye() {
  const router = useRouter();
  const a1 = useRef(new Animated.Value(-60)).current;
  const a2 = useRef(new Animated.Value(-120)).current;
  const a3 = useRef(new Animated.Value(-200)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(a1, { toValue: width + 60, duration: 2000, useNativeDriver: true }),
      Animated.timing(a2, { toValue: width + 60, duration: 2200, useNativeDriver: true }),
      Animated.timing(a3, { toValue: width + 60, duration: 2400, useNativeDriver: true }),
    ]).start();

    const t = setTimeout(() => {
      router.replace('/auth/LoginPage');
    }, 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.message}>We hate to see you go..</Text>

      <View style={styles.carsRow} pointerEvents="none">
        <Animated.Text style={[styles.car, { transform: [{ translateX: a1 }, { scaleX: -1 }] }]}>🚗</Animated.Text>
        <Animated.Text style={[styles.car, { transform: [{ translateX: a2 }, { scaleX: -1 }] }]}>🚙</Animated.Text>
        <Animated.Text style={[styles.car, { transform: [{ translateX: a3 }, { scaleX: -1 }] }]}>🚘</Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  message: { color: '#FFD166', fontSize: 22, fontWeight: '700', marginBottom: 24 },
  carsRow: { width: '100%', height: 40, overflow: 'hidden' },
  car: { position: 'absolute', fontSize: 28 },
});
