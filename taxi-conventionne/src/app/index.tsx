import { Redirect } from 'expo-router';

import { useAuth } from '../lib/auth';

export default function Index() {
  const { session, profile } = useAuth();
  if (!session) return <Redirect href="/login" />;
  if (!profile?.verified) return <Redirect href="/pending" />;
  return <Redirect href="/carte" />;
}
