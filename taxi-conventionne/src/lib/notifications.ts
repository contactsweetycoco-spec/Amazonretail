import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Demande l'autorisation d'envoyer des notifications et enregistre le jeton
 * du téléphone sur le profil, pour être prévenu des nouvelles courses.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (!Device.isDevice) return; // Les simulateurs ne reçoivent pas de push.

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('courses', {
      name: 'Nouvelles courses',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  let { granted } = await Notifications.getPermissionsAsync();
  if (!granted) ({ granted } = await Notifications.requestPermissionsAsync());
  if (!granted) return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return; // Renseigné après `eas init`.

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
}
