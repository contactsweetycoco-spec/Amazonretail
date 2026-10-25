import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Card } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { errorMessage, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';

const RADII = [10, 30, 50, 100];

export default function Profil() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [saving, setSaving] = useState(false);
  if (!profile) return null;

  async function setRadius(km: number) {
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ notify_radius_km: km }).eq('id', profile!.id);
    setSaving(false);
    if (error) Alert.alert('Erreur', errorMessage(error));
    else refreshProfile();
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Card style={{ gap: 4 }}>
        <Text style={styles.name}>{profile.full_name}</Text>
        {profile.company ? <Text style={styles.line}>{profile.company}</Text> : null}
        <Text style={styles.line}>📞 {profile.phone}</Text>
        <Text style={styles.line}>✉️ {profile.email}</Text>
        <Text style={styles.line}>ADS : {profile.ads_number}</Text>
        <Text style={styles.line}>Carte pro : {profile.pro_card_number}</Text>
        <Text style={styles.line}>
          {profile.cpam_conventionne ? '✅ Conventionné CPAM' : '⚠️ Non conventionné CPAM'}
        </Text>
      </Card>

      <Text style={styles.section}>Me prévenir des courses à moins de</Text>
      <View style={styles.radii}>
        {RADII.map((km) => (
          <Pressable
            key={km}
            disabled={saving}
            onPress={() => setRadius(km)}
            style={[styles.chip, profile.notify_radius_km === km && styles.chipActive]}
          >
            <Text style={[styles.chipText, profile.notify_radius_km === km && { color: '#fff' }]}>{km} km</Text>
          </Pressable>
        ))}
      </View>

      <Card style={styles.notice}>
        <Text style={styles.noticeTitle}>🔒 Données de santé</Text>
        <Text style={styles.noticeText}>
          Ne saisissez jamais de nom de patient, de motif médical ni de bon de transport dans
          l'application. Les bons de transport s'envoient uniquement par mail, entre chauffeurs.
        </Text>
      </Card>

      {profile.is_admin ? (
        <Button title="Valider les nouveaux chauffeurs" variant="secondary" onPress={() => router.push('/admin')} />
      ) : null}
      <Button title="Se déconnecter" variant="danger" onPress={signOut} style={{ marginTop: 12 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  name: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  line: { fontSize: 15, color: colors.text },
  section: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
  radii: { flexDirection: 'row', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '600', color: colors.text },
  notice: { backgroundColor: '#FFF8E6', borderColor: '#F5D88A' },
  noticeTitle: { fontWeight: '700', color: colors.text, marginBottom: 4 },
  noticeText: { color: colors.text, fontSize: 14, lineHeight: 20 },
});
