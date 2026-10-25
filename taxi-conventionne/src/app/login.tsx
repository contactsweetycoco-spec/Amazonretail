import { Link } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field } from '../components/ui';
import { errorMessage, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert('Connexion impossible', errorMessage(error));
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.logo}>🚕</Text>
          <Text style={styles.title}>Taxi Conventionné</Text>
          <Text style={styles.subtitle}>La bourse de courses entre chauffeurs</Text>

          <Field
            label="Adresse mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          <Button title="Se connecter" onPress={signIn} loading={loading} />

          <Link href="/register" style={styles.link}>
            Pas encore inscrit ? Créer un compte chauffeur
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  logo: { fontSize: 56, textAlign: 'center' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', color: colors.text },
  subtitle: { fontSize: 15, textAlign: 'center', color: colors.muted, marginBottom: 32 },
  link: { color: colors.primary, textAlign: 'center', marginTop: 20, fontSize: 15 },
});
