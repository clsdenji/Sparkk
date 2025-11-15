import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Location from "expo-location";
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from '@/components/useColorScheme';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',  // Ensure the default route is set
};

// Prevent splash screen auto-hide
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const [locationPermissionGranted, setLocationPermissionGranted] = useState<boolean | null>(null);

  // Check for font loading errors
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Hide the splash screen once the fonts are loaded
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  // Check for location permission
  useEffect(() => {
    const checkLocationPermission = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermissionGranted(status === 'granted');
    };
    checkLocationPermission();
  }, []);

  // Return nothing until fonts are loaded or permission check is done
  if (!loaded || locationPermissionGranted === null) return null;

  return <RootLayoutNav locationPermissionGranted={locationPermissionGranted} />;
}

function RootLayoutNav({ locationPermissionGranted }: { locationPermissionGranted: boolean }) {
  const colorScheme = useColorScheme();  // Custom hook for detecting theme

  // Force a black background for all navigation scenes to avoid white flashes
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: '#000',
      card: '#000',
      border: '#111',
      primary: baseTheme.colors.primary,
      text: baseTheme.colors.text,
      notification: baseTheme.colors.notification,
    },
  } as typeof baseTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <Stack screenOptions={{ animation: 'fade' }}>
          {/* Define stack screens and apply fade transition */}
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          {locationPermissionGranted ? (
            <Stack.Screen name="login" options={{ headerShown: false }} />
          ) : (
            <Stack.Screen name="userPermissionLocation" options={{ headerShown: false }} />
          )}
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '' }} />
        </Stack>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
