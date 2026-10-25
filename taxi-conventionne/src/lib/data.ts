import { useCallback, useEffect, useState } from 'react';

import { supabase } from './supabase';
import type { DriverLocation, Profile, Ride } from './types';

/**
 * Courses visibles par l'utilisateur (ouvertes + les siennes), mises à jour
 * en temps réel. Les règles de visibilité sont appliquées côté serveur (RLS).
 */
export function useRides() {
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('rides')
      .select('*')
      .order('scheduled_at', { ascending: true });
    setRides((data as Ride[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`rides-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { rides, loading, refresh };
}

export type DriverOnMap = DriverLocation & {
  profiles: Pick<Profile, 'full_name' | 'phone' | 'company'> | null;
};

/** Chauffeurs disponibles sur la carte, en temps réel. */
export function useAvailableDrivers() {
  const [drivers, setDrivers] = useState<DriverOnMap[]>([]);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('driver_locations')
      .select('*, profiles(full_name, phone, company)')
      .eq('available', true);
    setDrivers((data as DriverOnMap[]) ?? []);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`drivers-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, refresh)
      .subscribe();
    // Rafraîchit aussi périodiquement pour retirer les positions trop anciennes.
    const timer = setInterval(refresh, 60_000);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { drivers, refresh };
}

/** Coordonnées publiques d'un chauffeur (nom, téléphone, mail). */
export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  return data as Profile | null;
}
