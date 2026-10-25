import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { RideCard } from '../../components/RideCard';
import { Button, Empty } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useRides } from '../../lib/data';
import { distanceKm } from '../../lib/format';
import { colors } from '../../lib/theme';
import { useTracking } from '../../lib/tracking';

const RADIUS_OPTIONS = [10, 30, 50, null] as const;

export default function Courses() {
  const { session } = useAuth();
  const { position } = useTracking();
  const { rides, loading, refresh } = useRides();
  const [radius, setRadius] = useState<(typeof RADIUS_OPTIONS)[number]>(null);

  const list = useMemo(() => {
    const now = Date.now() - 60 * 60 * 1000;
    return rides
      .filter((r) => r.status === 'open' && r.created_by !== session?.user.id)
      .filter((r) => new Date(r.scheduled_at).getTime() > now)
      .filter((r) => {
        if (!radius || !position || r.pickup_latitude == null || r.pickup_longitude == null) return true;
        return distanceKm(position, { latitude: r.pickup_latitude, longitude: r.pickup_longitude }) <= radius;
      });
  }, [rides, session?.user.id, radius, position]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.filters}>
        {RADIUS_OPTIONS.map((r) => (
          <Pressable
            key={String(r)}
            onPress={() => setRadius(r)}
            style={[styles.chip, radius === r && styles.chipActive]}
            disabled={!position && r !== null}
          >
            <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>
              {r ? `< ${r} km` : 'Toutes'}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RideCard ride={item} from={position} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          loading ? undefined : <Empty text="Aucune course disponible pour le moment. Vous serez prévenu par notification." />
        }
      />
      <Button title="＋ Donner une course" onPress={() => router.push('/publier')} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  cta: { position: 'absolute', left: 16, right: 16, bottom: 16 },
});
