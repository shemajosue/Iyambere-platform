import { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '../src/auth';
import { Button, Card, ErrorText, Field, Muted, Screen } from '../src/components/ui';

export default function Register() {
  const { register } = useAuth();
  const [form, setForm] = useState({ full_name: '', phone: '', district: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await register({ ...form, phone: form.phone.trim() });
      router.replace('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card>
        <Muted>
          A citizen account is all you need to report a leak. WASAC technicians and operations
          staff are given accounts by their supervisor.
        </Muted>
      </Card>

      <Card>
        <Field label="Full name" value={form.full_name} onChangeText={set('full_name')}
               placeholder="Uwase Aline" />
        <Field label="Phone number" value={form.phone} onChangeText={set('phone')}
               placeholder="078..." keyboardType="phone-pad" autoCapitalize="none" />
        <Field label="District" value={form.district} onChangeText={set('district')}
               placeholder="Gasabo" />
        <Field label="Password" value={form.password} onChangeText={set('password')}
               placeholder="At least 6 characters" secureTextEntry />
        <ErrorText>{error}</ErrorText>
        <Button label="Create account" onPress={submit} loading={busy} />
      </Card>
    </Screen>
  );
}
