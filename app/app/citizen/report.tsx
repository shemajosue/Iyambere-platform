import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { buildFormData, queueReport } from '../../src/offlineQueue';
import AppShell from '../../src/components/AppShell';
import MapPanel, { DEFAULT_CENTER } from '../../src/components/MapPanel';
import { Button, Card, ErrorText, Field, Label, Panel } from '../../src/components/ui';
import { colors, radius, severityStyles, spacing, tint } from '../../src/theme';

const SEVERITIES = [
  { key: 'low', label: 'Small', hint: 'A trickle or damp patch', icon: 'water-outline' },
  { key: 'medium', label: 'Steady', hint: 'Running continuously', icon: 'rainy-outline' },
  { key: 'high', label: 'Burst', hint: 'Flooding or a strong jet', icon: 'warning-outline' },
];

export default function NewReport() {
  const { user } = useAuth();
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [pinnedByHand, setPinnedByHand] = useState(false);

  // The location is the whole point of the report, so we ask for it up front.
  // If GPS is refused, unavailable or slow (indoors, a laptop in a meeting
  // room), the reporter can still tap the map to drop the pin themselves.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('denied');
        const position = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
        ]);
        if (!cancelled) {
          setCoords((current) => current ?? {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      } catch {
        // Fall through to the manual pin; nothing to report as an error.
      } finally {
        if (!cancelled) setLocating(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function pinByHand(point: { latitude: number; longitude: number }) {
    setCoords(point);
    setPinnedByHand(true);
    setError('');
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const picker = permission.granted
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const result = await picker({ quality: 0.6, allowsEditing: false });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function submit() {
    if (!coords) {
      setError('Tap the map to show where the leak is.');
      return;
    }

    setError('');
    setBusy(true);

    const payload = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      description,
      severity,
      district: user?.district ?? '',
      photoUri,
    };

    try {
      const report = await api.createReport(await buildFormData(payload));
      Alert.alert(
        'Report sent',
        `Your ticket is ${report.ticket_ref}. You can follow its progress from your reports.`
      );
      router.replace(`/report/${report.id}` as any);
    } catch (e: any) {
      // Out of coverage: hold it on the device and send it automatically later.
      if (e instanceof ApiError && e.message.includes('Cannot reach')) {
        await queueReport({ ...payload, queuedAt: new Date().toISOString() });
        Alert.alert(
          'Saved on your phone',
          'You are offline. This report will be sent automatically once you have a connection.'
        );
        router.replace('/citizen');
        return;
      }
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell
      title="Report a leak"
      subtitle="Three things: where it is, what it looks like, and how bad it is."
      back
    >
      <Panel
        title="Location"
        action={
          <View style={styles.gpsTag}>
            <Ionicons
              name={coords ? 'locate' : 'locate-outline'}
              size={12}
              color={coords ? colors.accent : colors.textMuted}
            />
            <Text style={[styles.gpsText, coords && { color: colors.accent }]}>
              {locating && !coords
                ? 'Locating…'
                : coords
                  ? pinnedByHand ? 'Pinned on map' : 'GPS locked'
                  : 'Tap the map'}
            </Text>
          </View>
        }
      >
        <MapPanel
          center={coords ?? DEFAULT_CENTER}
          zoom={coords ? 16 : 14}
          markers={coords ? [{ id: 'me', ...coords, title: 'Leak location', severity }] : []}
          onMapPress={pinByHand}
          height={240}
        />
        <Text style={styles.coords}>
          {coords
            ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} · tap the map to move the pin`
            : locating
              ? 'Finding your location… or tap the map where the leak is.'
              : 'Location is off. Tap the map exactly where the leak is.'}
        </Text>
      </Panel>

      <Panel title="Photo of the leak">
        <Text style={styles.help}>
          A picture lets WASAC judge the severity before a technician arrives.
        </Text>
        {photoUri ? (
          <View>
            <Image source={{ uri: photoUri }} style={styles.preview} />
            <Pressable onPress={() => setPhotoUri(null)} style={styles.clearPhoto} hitSlop={8}>
              <Ionicons name="close" size={14} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={takePhoto} style={styles.dropzone}>
            <Ionicons name="camera-outline" size={26} color={colors.textMuted} />
            <Text style={styles.dropzoneText}>Take a photo</Text>
          </Pressable>
        )}
        {photoUri && (
          <Button label="Take a different photo" variant="ghost" icon="camera-outline"
                  onPress={takePhoto} />
        )}
      </Panel>

      <Panel title="How bad is it?">
        <View style={styles.severityRow}>
          {SEVERITIES.map((option) => {
            const selected = severity === option.key;
            const tone = severityStyles[option.key].color;
            return (
              <Pressable
                key={option.key}
                onPress={() => setSeverity(option.key)}
                style={[
                  styles.severity,
                  selected && { borderColor: tone, backgroundColor: tint(tone, 0.1) },
                ]}
              >
                <Ionicons
                  name={option.icon as any}
                  size={18}
                  color={selected ? tone : colors.textMuted}
                />
                <Text style={[styles.severityLabel, selected && { color: tone }]}>
                  {option.label}
                </Text>
                <Text style={styles.severityHint}>{option.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </Panel>

      <Panel title="Details">
        <Label>Anything else WASAC should know?</Label>
        <Field
          value={description}
          onChangeText={setDescription}
          placeholder="Near the market entrance, water crossing the road…"
          multiline
        />
        <ErrorText>{error}</ErrorText>
        <Button label="Send report" icon="paper-plane-outline" onPress={submit}
                loading={busy} disabled={!coords} />
      </Panel>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  gpsTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gpsText: { fontSize: 11.5, fontWeight: '600', color: colors.textMuted },
  coords: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  help: { color: colors.textMuted, fontSize: 12.5, lineHeight: 18 },

  placeholder: {
    height: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  placeholderText: { color: colors.textMuted, fontSize: 12.5 },

  preview: { width: '100%', height: 210, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  clearPhoto: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,10,12,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropzone: {
    height: 140,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dropzoneText: { color: colors.textDim, fontSize: 13, fontWeight: '500' },

  severityRow: { flexDirection: 'row', gap: spacing.sm },
  severity: {
    flex: 1,
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  severityLabel: { fontWeight: '600', color: colors.text, fontSize: 13.5 },
  severityHint: { fontSize: 11, color: colors.textMuted, lineHeight: 15 },
});
