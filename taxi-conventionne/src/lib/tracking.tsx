import * as Location from 'expo-location';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { useAuth } from './auth';
import type { LatLng } from './format';
import { supabase } from './supabase';

type TrackingState = {
  /** Le chauffeur est visible sur la carte des autres. */
  available: boolean;
  setAvailable: (value: boolean) => Promise<void>;
  /** Dernière position connue de ce téléphone (même si non disponible). */
  position: LatLng | null;
};

const TrackingContext = createContext<TrackingState | null>(null);

/**
 * Partage la position du chauffeur uniquement quand il est "disponible".
 * La position n'est envoyée que lorsque l'app est ouverte (premier plan) :
 * elle disparaît de la carte des autres après 15 min sans mise à jour.
 */
export function TrackingProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const [available, setAvailableState] = useState(false);
  const [position, setPosition] = useState<LatLng | null>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  // Position initiale pour calculer les distances, si l'autorisation existe déjà.
  useEffect(() => {
    (async () => {
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) return;
      const last = await Location.getLastKnownPositionAsync();
      if (last) setPosition({ latitude: last.coords.latitude, longitude: last.coords.longitude });
    })();
  }, []);

  useEffect(() => {
    if (!available || !userId) return;
    let cancelled = false;

    (async () => {
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 30_000, distanceInterval: 100 },
        async ({ coords }) => {
          const p = { latitude: coords.latitude, longitude: coords.longitude };
          setPosition(p);
          await supabase.from('driver_locations').upsert({
            driver_id: userId,
            ...p,
            available: true,
            updated_at: new Date().toISOString(),
          });
        },
      );
      if (cancelled) watcher.current.remove();
    })();

    return () => {
      cancelled = true;
      watcher.current?.remove();
      watcher.current = null;
    };
  }, [available, userId]);

  // Déconnexion ou compte non validé : on coupe le partage.
  useEffect(() => {
    if (!profile?.verified) setAvailableState(false);
  }, [profile?.verified]);

  async function setAvailable(value: boolean) {
    if (!userId) return;
    if (value) {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Localisation refusée',
          'Autorisez la localisation dans les réglages du téléphone pour apparaître sur la carte.',
        );
        return;
      }
      setAvailableState(true);
    } else {
      setAvailableState(false);
      await supabase
        .from('driver_locations')
        .update({ available: false, updated_at: new Date().toISOString() })
        .eq('driver_id', userId);
    }
  }

  return (
    <TrackingContext.Provider value={{ available, setAvailable, position }}>
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking(): TrackingState {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking doit être utilisé dans <TrackingProvider>');
  return ctx;
}
