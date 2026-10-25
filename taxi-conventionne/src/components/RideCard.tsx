import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { distanceKm, formatDateTime, formatDistance, type LatLng } from '../lib/format';
import { colors } from '../lib/theme';
import { RIDE_STATUS_LABELS, RIDE_TYPE_LABELS, type Ride, type RideStatus } from '../lib/types';
import { Badge, Card } from './ui';

export const STATUS_COLORS: Record<RideStatus, string> = {
  open: colors.primary,
  accepted: colors.warning,
  en_route: colors.warning,
  on_board: colors.success,
  completed: colors.muted,
  cancelled: colors.danger,
};

export function RideCard({ ride, from }: { ride: Ride; from?: LatLng | null }) {
  const pickup =
    ride.pickup_latitude != null && ride.pickup_longitude != null
      ? { latitude: ride.pickup_latitude, longitude: ride.pickup_longitude }
      : null;
  const distance = from && pickup ? distanceKm(from, pickup) : null;

  return (
    <Pressable onPress={() => router.push(`/course/${ride.id}`)}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.when}>{formatDateTime(ride.scheduled_at)}</Text>
          <Badge label={RIDE_STATUS_LABELS[ride.status]} color={STATUS_COLORS[ride.status]} />
        </View>
        <Text style={styles.place}>📍 {ride.pickup_label}</Text>
        <Text style={styles.place}>🏁 {ride.dropoff_label}</Text>
        <View style={styles.row}>
          <Text style={styles.meta}>
            {RIDE_TYPE_LABELS[ride.ride_type]}
            {ride.round_trip ? ' · aller-retour' : ''}
          </Text>
          {distance != null ? <Text style={styles.meta}>à {formatDistance(distance)}</Text> : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  when: { fontSize: 16, fontWeight: '700', color: colors.text, textTransform: 'capitalize' },
  place: { fontSize: 15, color: colors.text },
  meta: { fontSize: 13, color: colors.muted },
});
