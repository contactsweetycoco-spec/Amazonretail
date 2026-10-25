import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { RideCard } from '../../components/RideCard';
import { Empty } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useRides } from '../../lib/data';
import { colors } from '../../lib/theme';

type Tab = 'acceptees' | 'donnees';

export default function MesCourses() {
  const { session } = useAuth();
  const { rides, loading, refresh } = useRides();
  const [tab, setTab] = useState<Tab>('acceptees');
  const me = session?.user.id;

  const list = useMemo(() => {
    const mine = rides.filter((r) => (tab === 'acceptees' ? r.accepted_by === me : r.created_by === me));
    // Courses en cours d'abord, puis l'historique (plus récent en premier).
    const active = mine.filter((r) => r.status !== 'completed' && r.status !== 'cancelled');
    const done = mine.filter((r) => r.status === 'completed' || r.status === 'cancelled').reverse();
    return [...active, ...done];
  }, [rides, tab, me]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.segment}>
        {(
          [
            ['acceptees', "J'ai accepté"],
            ['donnees', "J'ai donné"],
          ] as const
        ).map(([key, label]) => (
          <Pressable key={key} onPress={() => setTab(key)} style={[styles.seg, tab === key && styles.segActive]}>
            <Text style={[styles.segText, tab === key && styles.segTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <RideCard ride={item} />}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        ListEmptyComponent={
          loading ? undefined : (
            <Empty text={tab === 'acceptees' ? "Vous n'avez accepté aucune course." : "Vous n'avez donné aucune course."} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.border,
    borderRadius: 10,
    padding: 3,
  },
  seg: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segActive: { backgroundColor: colors.card },
  segText: { fontWeight: '600', color: colors.muted },
  segTextActive: { color: colors.text },
});
