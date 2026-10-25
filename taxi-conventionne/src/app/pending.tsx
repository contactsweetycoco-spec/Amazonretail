import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/ui';
import { useAuth } from '../lib/auth';
import { colors } from '../lib/theme';

export default function Pending() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>Compte en cours de validation</Text>
      <Text style={styles.text}>
        Bonjour {profile?.full_name || ''}. Un administrateur doit vérifier votre carte
        professionnelle, votre ADS et votre convention CPAM. Vous pourrez ensuite voir la carte et
        les courses.
      </Text>
      <View style={styles.actions}>
        <Button title="Vérifier à nouveau" onPress={check} loading={checking} />
        <Button title="Se déconnecter" variant="secondary" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  icon: { fontSize: 56, textAlign: 'center' },
  title: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: colors.text, marginVertical: 12 },
  text: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 22 },
  actions: { gap: 12, marginTop: 32 },
});
