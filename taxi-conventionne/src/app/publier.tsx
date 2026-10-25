import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Card, Field } from '../components/ui';
import { useAuth } from '../lib/auth';
import { formatDateTime } from '../lib/format';
import { errorMessage, supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import { RIDE_TYPE_LABELS, type RideType } from '../lib/types';

/** Convertit "Hôpital Pitié-Salpêtrière, Paris" en coordonnées (sur le téléphone). */
async function geocode(label: string) {
  try {
    const [hit] = await Location.geocodeAsync(label);
    return hit ? { latitude: hit.latitude, longitude: hit.longitude } : null;
  } catch {
    return null;
  }
}

function nextQuarterHour() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

export default function Publier() {
  const { session } = useAuth();
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [date, setDate] = useState(nextQuarterHour);
  const [rideType, setRideType] = useState<RideType>('assis');
  const [roundTrip, setRoundTrip] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  function pickAndroid() {
    DateTimePickerAndroid.open({
      value: date,
      mode: 'date',
      minimumDate: new Date(),
      onValueChange: (_e, day) => {
        DateTimePickerAndroid.open({
          value: day,
          mode: 'time',
          is24Hour: true,
          onValueChange: (_e2, time) => setDate(time),
        });
      },
    });
  }

  async function publish() {
    if (!pickup.trim() || !dropoff.trim()) {
      Alert.alert('Champs manquants', 'Indiquez le lieu de départ et la destination.');
      return;
    }
    setLoading(true);
    const [from, to] = await Promise.all([geocode(pickup), geocode(dropoff)]);
    const { data, error } = await supabase
      .from('rides')
      .insert({
        created_by: session!.user.id,
        pickup_label: pickup.trim(),
        pickup_latitude: from?.latitude ?? null,
        pickup_longitude: from?.longitude ?? null,
        dropoff_label: dropoff.trim(),
        dropoff_latitude: to?.latitude ?? null,
        dropoff_longitude: to?.longitude ?? null,
        scheduled_at: date.toISOString(),
        ride_type: rideType,
        round_trip: roundTrip,
        notes: notes.trim() || null,
      })
      .select()
      .single();
    setLoading(false);

    if (error) {
      Alert.alert('Publication impossible', errorMessage(error));
      return;
    }
    // Prévient les chauffeurs (sans bloquer si les notifications ne sont pas déployées).
    supabase.functions.invoke('notify-new-ride', { body: { rideId: data.id } }).catch(() => {});
    router.replace(`/course/${data.id}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Card style={styles.warning}>
        <Text style={styles.warningText}>
          🔒 Pas de nom de patient ni d'information médicale. Indiquez seulement une ville, un
          quartier ou un établissement. Le bon de transport sera envoyé par mail au chauffeur qui
          accepte.
        </Text>
      </Card>

      <Field
        label="Départ *"
        placeholder="Ex. : Montreuil centre, ou Clinique X, Lyon 3e"
        value={pickup}
        onChangeText={setPickup}
      />
      <Field
        label="Destination *"
        placeholder="Ex. : Hôpital Y, Paris 13e"
        value={dropoff}
        onChangeText={setDropoff}
      />

      <Text style={styles.label}>Date et heure de prise en charge *</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={date}
          mode="datetime"
          display="compact"
          locale="fr-FR"
          minimumDate={new Date()}
          onValueChange={(_e, d) => setDate(d)}
          style={{ alignSelf: 'flex-start', marginBottom: 14 }}
        />
      ) : (
        <Pressable onPress={pickAndroid} style={styles.dateButton}>
          <Text style={styles.dateText}>📅 {formatDateTime(date.toISOString())}</Text>
        </Pressable>
      )}

      <Text style={styles.label}>Type de transport</Text>
      <View style={styles.chips}>
        {(Object.keys(RIDE_TYPE_LABELS) as RideType[]).map((t) => (
          <Pressable key={t} onPress={() => setRideType(t)} style={[styles.chip, rideType === t && styles.chipActive]}>
            <Text style={[styles.chipText, rideType === t && { color: '#fff' }]}>{RIDE_TYPE_LABELS[t]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.label}>Retour à prévoir</Text>
        <Switch value={roundTrip} onValueChange={setRoundTrip} />
      </View>

      <Field
        label="Remarque (facultatif)"
        placeholder="Ex. : fauteuil pliable, attente sur place ~1 h"
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={300}
      />

      <Button title="Publier la course" onPress={publish} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  warning: { backgroundColor: '#FFF8E6', borderColor: '#F5D88A', marginBottom: 16 },
  warningText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  dateButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  dateText: { fontSize: 16, color: colors.text, textTransform: 'capitalize' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '600', color: colors.text },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
});
