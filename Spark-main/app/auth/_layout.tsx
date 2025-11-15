import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* All auth screens (LoginPage, ForgotPassword, NewPassword) will have no header */}
    </Stack>
  );
}
