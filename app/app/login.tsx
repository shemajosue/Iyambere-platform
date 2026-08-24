import { useState } from 'react';
import { Link, router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../src/auth';
import { Button, Card, ErrorText, Field, Muted, Screen, Title } from '../src/components/ui';
import { colors, spacing } from '../src/theme';

export default function Login() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    setBusy(true);
    try {
      await signIn(phone.trim(), password);
      // The gate at "/" would work too, but going straight there avoids a flash.
      router.replace('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Title>Iyambere</Title>
        <Muted>
          Report a water leak in seconds. Every report is pinned to its exact location and
          tracked until the repair is verified.
        </Muted>
      </View>

      <Card>
        <Field
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          placeholder="0780000001"
          keyboardType="phone-pad"
          autoCapitalize="none"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          secureTextEntry
        />
        <ErrorText>{error}</ErrorText>
        <Button label="Sign in" onPress={submit} loading={busy} />

        <Link href="/register" asChild>
          <Text style={styles.link}>New here? Create a citizen account</Text>
        </Link>
      </Card>

      <Card>
        <Text style={styles.demoTitle}>Demo accounts — password “iyambere”</Text>
        <Muted>0780000001 — citizen</Muted>
        <Muted>0780000002 — technician</Muted>
        <Muted>0780000003 — WASAC operations</Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingVertical: spacing.lg, gap: spacing.sm },
  link: {
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  demoTitle: { fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
});
