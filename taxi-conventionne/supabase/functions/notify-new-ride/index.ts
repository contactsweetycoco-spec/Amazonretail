// Supabase Edge Function (Deno) : prévient les chauffeurs quand une course est publiée.
//
// Appelée par l'application juste après la publication d'une course
// (déployée par `npm run supabase:setup`). Elle vérifie que l'appelant est
// bien l'auteur de la course et n'envoie les notifications qu'une seule fois.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Ride = {
  id: string;
  created_by: string;
  pickup_label: string;
  dropoff_label: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  scheduled_at: string;
};

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
  const { data: auth } = await supabase.auth.getUser(jwt);
  if (!auth.user) return json({ error: 'Non connecté' }, 401);

  const { rideId } = (await req.json()) as { rideId?: string };
  if (!rideId) return json({ error: 'rideId manquant' }, 400);

  // Réserve l'envoi : une seule fois par course, et seulement par son auteur.
  const { data: ride } = await supabase
    .from('rides')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', rideId)
    .eq('created_by', auth.user.id)
    .eq('status', 'open')
    .is('notified_at', null)
    .select()
    .maybeSingle<Ride>();
  if (!ride) return json({ notified: 0 });

  const { data: drivers, error } = await supabase
    .from('profiles')
    .select('id, push_token, notify_radius_km, driver_locations(latitude, longitude, updated_at)')
    .eq('verified', true)
    .not('push_token', 'is', null)
    .neq('id', ride.created_by);
  if (error) return json({ error: error.message }, 500);

  // Si on connaît la position récente du chauffeur et le lieu de départ,
  // on ne prévient que ceux qui sont dans leur rayon choisi.
  // Sinon (chauffeur hors ligne), on le prévient quand même.
  const recent = Date.now() - 2 * 60 * 60 * 1000;
  const targets = (drivers ?? []).filter((d) => {
    const loc = Array.isArray(d.driver_locations) ? d.driver_locations[0] : d.driver_locations;
    if (!loc || ride.pickup_latitude == null || ride.pickup_longitude == null) return true;
    if (new Date(loc.updated_at).getTime() < recent) return true;
    return (
      distanceKm(loc.latitude, loc.longitude, ride.pickup_latitude, ride.pickup_longitude) <=
      d.notify_radius_km
    );
  });

  const when = new Date(ride.scheduled_at).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const messages = targets.map((d) => ({
    to: d.push_token,
    sound: 'default',
    channelId: 'courses',
    title: 'Nouvelle course disponible',
    body: `${ride.pickup_label} → ${ride.dropoff_label} · ${when}`,
    data: { rideId: ride.id },
  }));

  // L'API Expo accepte 100 messages par requête.
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }

  return json({ notified: messages.length });
});
