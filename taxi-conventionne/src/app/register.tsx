import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Field } from '../components/ui';
import { errorMessage, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';

export default function Register() {
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    company: '',
    ads_number: '',
    pro_card_number: '',
  });
  const [conventionne, setConventionne] = useState(true);
  const [loading, setLoading] = useState(false);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    const required: (keyof typeof form)[] = ['full_name', 'phone', 'email', 'password', 'ads_number', 'pro_card_number'];
    if (required.some((k) => !form[k].trim())) {
      Alert.alert('Champs manquants', 'Merci de remplir tous les champs obligatoires (*).');
      return;
    }
    if (form.password.length < 8) {
      Alert.alert('Mot de passe', 'Le mot de passe doit faire au moins 8 caractères.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        // Le profil est créé côté serveur à partir de ces informations.
        data: {
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          company: form.company.trim() || null,
          ads_number: form.ads_number.trim(),
          pro_card_number: form.pro_card_number.trim(),
          cpam_conventionne: conventionne,
        },
      },
    });
    setLoading(false);

    if (error) {
      Alert.alert('Inscription impossible', errorMessage(error));
    } else if (!data.session) {
      Alert.alert('Vérifiez vos mails', 'Cliquez sur le lien de confirmation reçu, puis connectez-vous.');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Votre compte sera vérifié par un administrateur (carte pro, ADS, convention CPAM) avant de
        pouvoir donner ou accepter des courses.
      </Text>

      <Field label="Nom et prénom *" value={form.full_name} onChangeText={set('full_name')} />
      <Field label="Téléphone *" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field
        label="Adresse mail *"
        hint="C'est à cette adresse que vous recevrez les bons de transport."
        value={form.email}
        onChangeText={set('email')}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Field label="Mot de passe *" value={form.password} onChangeText={set('password')} secureTextEntry />
      <Field label="Société (facultatif)" value={form.company} onChangeText={set('company')} />
      <Field label="N° d'autorisation de stationnement (ADS) *" value={form.ads_number} onChangeText={set('ads_number')} />
      <Field label="N° de carte professionnelle *" value={form.pro_card_number} onChangeText={set('pro_card_number')} />

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Taxi conventionné CPAM</Text>
        <Switch value={conventionne} onValueChange={setConventionne} />
      </View>

      <Button title="Créer mon compte" onPress={submit} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48 },
  intro: { color: colors.muted, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
});
