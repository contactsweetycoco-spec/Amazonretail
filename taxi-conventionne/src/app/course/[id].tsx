import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { STATUS_COLORS } from '../../components/RideCard';
import { Badge, Button, Card } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { fetchProfile } from '../../lib/data';
import { formatDateTime } from '../../lib/format';
import { errorMessage, supabase } from '../../lib/supabase';
import { colors } from '../../lib/theme';
import { RIDE_STATUS_LABELS, RIDE_TYPE_LABELS, type Profile, type Ride, type RideStatus } from '../../lib/types';

const NEXT_STEP: Partial<Record<RideStatus, { status: RideStatus; label: string }>> = {
  accepted: { status: 'en_route', label: '🚕 Je pars chercher le patient' },
  en_route: { status: 'on_board', label: '🧍 Patient à bord' },
  on_board: { status: 'completed', label: '✅ Course terminée' },
};

function openDirections(label: string, lat: number | null, lng: number | null) {
  const destination = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(label);
  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`);
}

export default function CourseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const me = session?.user.id;
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [giver, setGiver] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('rides').select('*').eq('id', id).maybeSingle();
    const r = data as Ride | null;
    setRide(r);
    setLoading(false);
    if (r) {
      setGiver(await fetchProfile(r.created_by));
      setDriver(r.accepted_by ? await fetchProfile(r.accepted_by) : null);
    }
  }, [id]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`ride-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides', filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, load]);

  async function run(fn: string, args: Record<string, unknown>, success?: string) {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) Alert.alert('Action impossible', errorMessage(error));
    else if (success) Alert.alert(success);
    await load();
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  if (!ride) {
    return (
      <View style={styles.container}>
        <Text style={styles.gone}>Cette course n'est plus disponible (déjà prise par un autre chauffeur ou annulée).</Text>
        <Button title="Retour" onPress={() => router.back()} />
      </View>
    );
  }

  const isGiver = ride.created_by === me;
  const isDriver = ride.accepted_by === me;
  const finished = ride.status === 'completed' || ride.status === 'cancelled';
  const next = isDriver ? NEXT_STEP[ride.status] : undefined;
  const hasPickup = ride.pickup_latitude != null && ride.pickup_longitude != null;
  const hasDropoff = ride.dropoff_latitude != null && ride.dropoff_longitude != null;

  function sendVoucherByMail() {
    if (!driver) return;
    const subject = `Bon de transport – course du ${formatDateTime(ride!.scheduled_at)}`;
    const body =
      `Bonjour ${driver.full_name},\n\n` +
      `Vous trouverez en pièce jointe le bon de transport pour la course :\n` +
      `${ride!.pickup_label} → ${ride!.dropoff_label}\n` +
      `le ${formatDateTime(ride!.scheduled_at)}.\n\n` +
      `Cordialement,\n${giver?.full_name ?? ''}`;
    Linking.openURL(
      `mailto:${driver.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {hasPickup ? (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: ride.pickup_latitude!,
            longitude: ride.pickup_longitude!,
            latitudeDelta: 0.2,
            longitudeDelta: 0.2,
          }}
        >
          <Marker coordinate={{ latitude: ride.pickup_latitude!, longitude: ride.pickup_longitude! }} title="Départ" pinColor={colors.primary} />
          {hasDropoff ? (
            <Marker coordinate={{ latitude: ride.dropoff_latitude!, longitude: ride.dropoff_longitude! }} title="Destination" pinColor={colors.danger} />
          ) : null}
        </MapView>
      ) : null}

      <Card style={{ gap: 8 }}>
        <View style={styles.row}>
          <Text style={styles.when}>{formatDateTime(ride.scheduled_at)}</Text>
          <Badge label={RIDE_STATUS_LABELS[ride.status]} color={STATUS_COLORS[ride.status]} />
        </View>
        <Text style={styles.place}>📍 {ride.pickup_label}</Text>
        <Text style={styles.place}>🏁 {ride.dropoff_label}</Text>
        <Text style={styles.meta}>
          {RIDE_TYPE_LABELS[ride.ride_type]}
          {ride.round_trip ? ' · retour à prévoir' : ''}
        </Text>
        {ride.notes ? <Text style={styles.notes}>💬 {ride.notes}</Text> : null}
      </Card>

      {giver ? (
        <Contact title="Donneur d'ordre" person={giver} showActions={isDriver || (!isGiver && ride.status === 'open')} />
      ) : null}
      {driver ? <Contact title="Chauffeur" person={driver} showActions={isGiver} /> : null}

      {/* ---------- Chauffeur qui consulte une course ouverte ---------- */}
      {ride.status === 'open' && !isGiver ? (
        <Button
          title="Accepter la course"
          variant="success"
          loading={busy}
          onPress={() => run('accept_ride', { p_ride_id: ride.id }, 'Course acceptée ! Le donneur d\'ordre va vous envoyer le bon par mail.')}
        />
      ) : null}

      {/* ---------- Donneur d'ordre ---------- */}
      {isGiver && driver && !finished ? (
        <Card style={{ gap: 10 }}>
          <Text style={styles.sectionTitle}>Bon de transport</Text>
          <Text style={styles.meta}>
            {ride.voucher_sent_at
              ? `✅ Marqué comme envoyé le ${formatDateTime(ride.voucher_sent_at)}`
              : `À envoyer par mail à ${driver.email}, en pièce jointe.`}
          </Text>
          <Button title="✉️ Ouvrir un mail pour le bon" variant="secondary" onPress={sendVoucherByMail} />
          {!ride.voucher_sent_at ? (
            <Button title="J'ai envoyé le bon" loading={busy} onPress={() => run('mark_voucher_sent', { p_ride_id: ride.id })} />
          ) : null}
        </Card>
      ) : null}

      {isGiver && !finished ? (
        <Button
          title="Annuler la course"
          variant="danger"
          loading={busy}
          onPress={() =>
            Alert.alert('Annuler la course ?', 'Le chauffeur sera informé.', [
              { text: 'Non', style: 'cancel' },
              { text: 'Oui, annuler', style: 'destructive', onPress: () => run('update_ride_status', { p_ride_id: ride.id, p_status: 'cancelled' }) },
            ])
          }
        />
      ) : null}

      {/* ---------- Chauffeur qui a accepté ---------- */}
      {isDriver && !finished ? (
        <>
          <Card>
            <Text style={styles.meta}>
              {ride.voucher_sent_at
                ? '✅ Le donneur d\'ordre a envoyé le bon de transport par mail.'
                : '⏳ En attente du bon de transport par mail.'}
            </Text>
          </Card>
          {next ? (
            <Button
              title={next.label}
              loading={busy}
              onPress={() => run('update_ride_status', { p_ride_id: ride.id, p_status: next.status })}
            />
          ) : null}
          <Button
            title="🧭 Itinéraire"
            variant="secondary"
            onPress={() =>
              ride.status === 'on_board'
                ? openDirections(ride.dropoff_label, ride.dropoff_latitude, ride.dropoff_longitude)
                : openDirections(ride.pickup_label, ride.pickup_latitude, ride.pickup_longitude)
            }
          />
          {ride.status === 'accepted' || ride.status === 'en_route' ? (
            <Button
              title="Me désister"
              variant="danger"
              onPress={() =>
                Alert.alert('Se désister ?', 'La course redeviendra disponible pour les autres chauffeurs.', [
                  { text: 'Non', style: 'cancel' },
                  {
                    text: 'Oui',
                    style: 'destructive',
                    onPress: async () => {
                      await run('update_ride_status', { p_ride_id: ride.id, p_status: 'open' });
                      router.back();
                    },
                  },
                ])
              }
            />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function Contact({ title, person, showActions }: { title: string; person: Profile; showActions: boolean }) {
  return (
    <Card style={{ gap: 6 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.place}>
        {person.full_name}
        {person.company ? ` · ${person.company}` : ''}
      </Text>
      {showActions ? (
        <View style={styles.row}>
          <Button title="📞 Appeler" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`tel:${person.phone}`)} />
          <View style={{ width: 8 }} />
          <Button title="💬 SMS" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(`sms:${person.phone}`)} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12, paddingBottom: 48 },
  map: { height: 200, borderRadius: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  when: { fontSize: 18, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  place: { fontSize: 16, color: colors.text },
  meta: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  notes: { fontSize: 14, color: colors.text },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  gone: { fontSize: 16, color: colors.text, textAlign: 'center', marginVertical: 24 },
});
