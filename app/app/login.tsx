import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth';
import { Button, Card, ErrorText, Field, Label } from '../src/components/ui';
import { colors, radius, spacing, tint } from '../src/theme';

const DEMO = [
  { phone: '0780000001', role: 'Citizen', detail: 'Report a leak, track the ticket' },
  { phone: '0780000002', role: 'Technician', detail: 'Accept jobs, close out repairs' },
  { phone: '0780000003', role: 'WASAC operations', detail: 'Dispatch, registry, pressure' },
];

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
      router.replace('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function useDemo(demoPhone: string) {
    setPhone(demoPhone);
    setPassword('iyambere');
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.panel}>
          <View style={styles.brandRow}>
            <View style={styles.mark}>
              <Ionicons name="water" size={20} color={colors.bg} />
            </View>
            <View>
              <Text style={styles.wordmark}>Iyambere</Text>
              <Text style={styles.tagline}>Water infrastructure operations</Text>
            </View>
          </View>

          <Text style={styles.headline}>
            Every leak, pinned to the spot it was found.
          </Text>
          <Text style={styles.sub}>
            Report a burst in seconds. WASAC sees the exact location, dispatches a technician,
            and the ticket stays open until the repair is verified.
          </Text>

          <Card style={{ gap: spacing.md, marginTop: spacing.sm }}>
            <Field
              label="Phone number"
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              placeholder="0780000001"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            <Field
              label="Password"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              secureTextEntry
              onSubmitEditing={submit}
            />
            <ErrorText>{error}</ErrorText>
            <Button label="Sign in" icon="arrow-forward" onPress={submit} loading={busy} />
            <Pressable onPress={() => router.push('/register')}>
              <Text style={styles.link}>New here? Create a citizen account</Text>
            </Pressable>
          </Card>

          <View style={{ gap: spacing.sm }}>
            <Label>Demo accounts · password “iyambere”</Label>
            {DEMO.map((account) => (
              <Pressable
                key={account.phone}
                onPress={() => useDemo(account.phone)}
                style={({ pressed, hovered }: any) => [
                  styles.demo,
                  (pressed || hovered) && { borderColor: tint(colors.accent, 0.4) },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.demoRole}>{account.role}</Text>
                  <Text style={styles.demoDetail}>{account.detail}</Text>
                </View>
                <Text style={styles.demoPhone}>{account.phone}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  panel: { width: '100%', maxWidth: 440, gap: spacing.md },

  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { color: colors.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3 },
  tagline: { color: colors.textMuted, fontSize: 12 },

  headline: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.7,
    marginTop: spacing.sm,
  },
  sub: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20 },

  link: { color: colors.accent, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  demo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  demoRole: { color: colors.text, fontSize: 13, fontWeight: '600' },
  demoDetail: { color: colors.textMuted, fontSize: 11.5 },
  demoPhone: { color: colors.textDim, fontSize: 12, fontVariant: ['tabular-nums'] },
});
