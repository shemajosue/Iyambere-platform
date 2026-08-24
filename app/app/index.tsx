import { Redirect } from 'expo-router';
import { useAuth, homeRoute } from '../src/auth';
import { Loading } from '../src/components/ui';

/** The entry point: send everyone to the screen their role starts on. */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) return <Loading />;
  if (!user) return <Redirect href="/login" />;
  return <Redirect href={homeRoute[user.role] as any} />;
}
