import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../src/auth';
import { Button, Card, ErrorText, Field } from '../src/components/ui';
import { colors, spacing } from '../src/theme';

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
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.panel}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Ionicons name="chevron-back" size={16} color={colors.textDim} />
            <Text style={styles.backText}>Back to sign in</Text>
          </Pressable>

          <Text style={styles.headline}>Create a citizen account</Text>
          <Text style={styles.sub}>
            A citizen account is all you need to report a leak. WASAC technicians and operations
            staff are given accounts by their supervisor.
          </Text>

          <Card style={{ gap: spacing.md }}>
            <Field label="Full name" icon="person-outline" value={form.full_name}
                   onChangeText={set('full_name')} placeholder="Uwase Aline" />
            <Field label="Phone number" icon="call-outline" value={form.phone}
                   onChangeText={set('phone')} placeholder="078…"
                   keyboardType="phone-pad" autoCapitalize="none" />
            <Field label="District" icon="location-outline" value={form.district}
                   onChangeText={set('district')} placeholder="Gasabo"
                   hint="Used to route your reports to the right WASAC zone." />
            <Field label="Password" icon="lock-closed-outline" value={form.password}
                   onChangeText={set('password')} placeholder="At least 6 characters"
                   secureTextEntry />
            <ErrorText>{error}</ErrorText>
            <Button label="Create account" icon="arrow-forward" onPress={submit} loading={busy} />
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md },
  panel: { width: '100%', maxWidth: 440, gap: spacing.md },

  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { color: colors.textDim, fontSize: 13 },

  headline: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.6,
    marginTop: spacing.sm,
  },
  sub: { color: colors.textMuted, fontSize: 13.5, lineHeight: 20 },
});
