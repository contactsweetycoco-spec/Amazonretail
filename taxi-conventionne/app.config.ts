import type { ConfigContext, ExpoConfig } from 'expo/config';

// Complète app.json : la clé Google Maps (obligatoire pour Android en production)
// est lue depuis la variable d'environnement GOOGLE_MAPS_API_KEY.
export default ({ config }: ConfigContext): ExpoConfig => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  return {
    ...(config as ExpoConfig),
    plugins: [
      ...(config.plugins ?? []),
      ...(key ? [['react-native-maps', { androidGoogleMapsApiKey: key, iosGoogleMapsApiKey: key }] as [string, unknown]] : []),
    ],
  };
};
