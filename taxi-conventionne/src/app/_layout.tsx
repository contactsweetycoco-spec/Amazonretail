import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AuthProvider, useAuth } from '../lib/auth';
import { registerForPushNotifications } from '../lib/notifications';
import { colors } from '../lib/theme';
import { TrackingProvider } from '../lib/tracking';

export default function RootLayout() {
  return (
    <AuthProvider>
      <TrackingProvider>
        <StatusBar style="dark" />
        <Navigation />
      </TrackingProvider>
    </AuthProvider>
  );
}

function Navigation() {
  const { loading, session, profile } = useAuth();
  const verified = !!session && !!profile?.verified;
  const lastNotification = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (verified && session) registerForPushNotifications(session.user.id).catch(() => {});
  }, [verified, session]);

  // Appui sur une notification "nouvelle course" : ouvre la course.
  useEffect(() => {
    const rideId = lastNotification?.notification.request.content.data?.rideId;
    if (verified && typeof rideId === 'string') router.push(`/course/${rideId}`);
  }, [verified, lastNotification]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Inscription chauffeur' }} />
      </Stack.Protected>

      <Stack.Protected guard={!!session && !verified}>
        <Stack.Screen name="pending" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={verified}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="publier" options={{ title: 'Donner une course', presentation: 'modal' }} />
        <Stack.Screen name="course/[id]" options={{ title: 'Course' }} />
        <Stack.Screen name="admin" options={{ title: 'Validation des chauffeurs' }} />
      </Stack.Protected>
    </Stack>
  );
}
