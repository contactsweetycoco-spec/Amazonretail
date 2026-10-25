import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { useAuth } from '../../lib/auth';
import { useAvailableDrivers, useRides } from '../../lib/data';
import { colors } from '../../lib/theme';
import { useTracking } from '../../lib/tracking';

// Centre par défaut : la France entière.
const FRANCE = { latitude: 46.6, longitude: 2.4, latitudeDelta: 9, longitudeDelta: 9 };

export default function Carte() {
  const { session } = useAuth();
  const { available, setAvailable, position } = useTracking();
  const { drivers } = useAvailableDrivers();
  const { rides } = useRides();

  const otherDrivers = drivers.filter((d) => d.driver_id !== session?.user.id);
  const openRides = useMemo(
    () => rides.filter((r) => r.status === 'open' && r.pickup_latitude != null && r.pickup_longitude != null),
    [rides],
  );

  const region = position ? { ...position, latitudeDelta: 0.25, longitudeDelta: 0.25 } : FRANCE;

  return (
    <View style={{ flex: 1 }}>
      <MapView style={StyleSheet.absoluteFill} initialRegion={region} showsUserLocation showsMyLocationButton>
        {otherDrivers.map((d) => (
          <Marker
            key={d.driver_id}
            coordinate={{ latitude: d.latitude, longitude: d.longitude }}
            title={d.profiles?.full_name ?? 'Chauffeur'}
            description={d.profiles?.phone ? `📞 ${d.profiles.phone}` : undefined}
            pinColor={colors.success}
          />
        ))}
        {openRides.map((r) => (
          <Marker
            key={r.id}
            coordinate={{ latitude: r.pickup_latitude!, longitude: r.pickup_longitude! }}
            title={`Course : ${r.pickup_label} → ${r.dropoff_label}`}
            description="Touchez pour voir le détail"
            pinColor={colors.primary}
            onCalloutPress={() => router.push(`/course/${r.id}`)}
          />
        ))}
      </MapView>

      <View style={styles.panel}>
        <View style={{ flex: 1 }}>
          <Text style={styles.status}>{available ? '🟢 Disponible' : '⚪ Indisponible'}</Text>
          <Text style={styles.sub}>
            {available
              ? 'Votre position est visible par les autres chauffeurs.'
              : 'Activez pour apparaître sur la carte.'}
          </Text>
          <Text style={styles.sub}>
            {otherDrivers.length} chauffeur(s) dispo · {openRides.length} course(s) sur la carte
          </Text>
        </View>
        <Switch value={available} onValueChange={setAvailable} />
      </View>

      <Pressable style={styles.fab} onPress={() => router.push('/publier')}>
        <Text style={styles.fabText}>＋ Donner une course</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  status: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  fab: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 14,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
