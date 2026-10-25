export type Profile = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  company: string | null;
  ads_number: string;
  pro_card_number: string;
  cpam_conventionne: boolean;
  verified: boolean;
  is_admin: boolean;
  push_token: string | null;
  notify_radius_km: number;
  created_at: string;
};

export type DriverLocation = {
  driver_id: string;
  latitude: number;
  longitude: number;
  available: boolean;
  updated_at: string;
};

export type RideStatus = 'open' | 'accepted' | 'en_route' | 'on_board' | 'completed' | 'cancelled';

export type RideType =
  | 'assis'
  | 'aller_retour'
  | 'consultation'
  | 'hospitalisation'
  | 'dialyse'
  | 'autre';

export type Ride = {
  id: string;
  created_by: string;
  pickup_label: string;
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  dropoff_label: string;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  scheduled_at: string;
  ride_type: RideType;
  round_trip: boolean;
  notes: string | null;
  status: RideStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  voucher_sent_at: string | null;
  notified_at: string | null;
  created_at: string;
  updated_at: string;
};

export const RIDE_TYPE_LABELS: Record<RideType, string> = {
  assis: 'Transport assis',
  aller_retour: 'Aller-retour',
  consultation: 'Consultation',
  hospitalisation: 'Hospitalisation',
  dialyse: 'Dialyse',
  autre: 'Autre',
};

export const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  open: 'Disponible',
  accepted: 'Acceptée',
  en_route: 'En route',
  on_board: 'Patient à bord',
  completed: 'Terminée',
  cancelled: 'Annulée',
};
