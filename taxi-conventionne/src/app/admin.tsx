import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Empty } from '../components/ui';
import { errorMessage, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import type { Profile } from '../lib/types';

/** Écran réservé aux administrateurs : valider les nouveaux chauffeurs. */
export default function Admin() {
  const [pending, setPending] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('verified', false)
      .order('created_at', { ascending: true });
    setPending((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function validate(p: Profile) {
    const { error } = await supabase.from('profiles').update({ verified: true }).eq('id', p.id);
    if (error) Alert.alert('Erreur', errorMessage(error));
    load();
  }

  return (
    <FlatList
      data={pending}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListEmptyComponent={loading ? undefined : <Empty text="Aucun chauffeur en attente de validation." />}
      renderItem={({ item: p }) => (
        <Card style={{ gap: 4 }}>
          <Text style={styles.name}>{p.full_name}</Text>
          {p.company ? <Text style={styles.line}>{p.company}</Text> : null}
          <Text style={styles.line}>📞 {p.phone} · ✉️ {p.email}</Text>
          <Text style={styles.line}>ADS : {p.ads_number}</Text>
          <Text style={styles.line}>Carte pro : {p.pro_card_number}</Text>
          <Text style={[styles.line, { color: p.cpam_conventionne ? colors.success : colors.danger }]}>
            {p.cpam_conventionne ? 'Se déclare conventionné CPAM' : 'Non conventionné CPAM'}
          </Text>
          <View style={{ marginTop: 8 }}>
            <Button
              title="Valider ce chauffeur"
              variant="success"
              onPress={() =>
                Alert.alert(
                  'Valider ?',
                  'Avez-vous vérifié la carte professionnelle, l\'ADS et la convention CPAM ?',
                  [
                    { text: 'Non', style: 'cancel' },
                    { text: 'Oui, valider', onPress: () => validate(p) },
                  ],
                )
              }
            />
          </View>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  line: { fontSize: 14, color: colors.text },
});
