import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

import { api, ApiError } from '../../src/api';
import { useAuth } from '../../src/auth';
import { buildFormData, queueReport } from '../../src/offlineQueue';
import MapPanel from '../../src/components/MapPanel';
import { Button, Card, ErrorText, Field, Muted, Screen, Subtitle } from '../../src/components/ui';
import { colors, radius, severityColors, spacing } from '../../src/theme';

const SEVERITIES = [
  { key: 'low', label: 'Small', hint: 'A trickle or damp patch' },
  { key: 'medium', label: 'Steady', hint: 'Water running continuously' },
  { key: 'high', label: 'Burst', hint: 'Flooding or a strong jet' },
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

  // The location is the whole point of the report, so we ask for it up front.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Iyambere needs your location to pin the leak. Enable it in settings.');
        setLocating(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCoords({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocating(false);
    })();
  }, []);

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
      setError('Waiting for your location. Move outside if the signal is weak.');
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
    <Screen>
      <Card>
        <Subtitle>Where is the leak?</Subtitle>
        {locating ? (
          <Muted>Finding your location…</Muted>
        ) : coords ? (
          <>
            <MapPanel
              center={coords}
              markers={[{ id: 'me', ...coords, title: 'Leak location', severity }]}
              height={200}
            />
            <Muted>
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)} — captured from your
              phone's GPS.
            </Muted>
          </>
        ) : (
          <Muted>Location unavailable.</Muted>
        )}
      </Card>

      <Card>
        <Subtitle>Photo of the leak</Subtitle>
        <Muted>A picture lets WASAC judge the severity before a technician arrives.</Muted>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.preview} />}
        <Button
          label={photoUri ? 'Take a different photo' : 'Take a photo'}
          variant="secondary"
          onPress={takePhoto}
        />
      </Card>

      <Card>
        <Subtitle>How bad is it?</Subtitle>
        <View style={styles.severityRow}>
          {SEVERITIES.map((option) => {
            const selected = severity === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setSeverity(option.key)}
                style={[
                  styles.severity,
                  selected && {
                    borderColor: severityColors[option.key],
                    backgroundColor: `${severityColors[option.key]}14`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.severityLabel,
                    selected && { color: severityColors[option.key] },
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={styles.severityHint}>{option.hint}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Field
          label="Anything else WASAC should know?"
          value={description}
          onChangeText={setDescription}
          placeholder="Near the market entrance, water crossing the road…"
          multiline
        />
        <ErrorText>{error}</ErrorText>
        <Button label="Send report" onPress={submit} loading={busy} disabled={!coords} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.border },
  severityRow: { flexDirection: 'row', gap: spacing.sm },
  severity: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  severityLabel: { fontWeight: '700', color: colors.text, fontSize: 14 },
  severityHint: { fontSize: 11, color: colors.muted, lineHeight: 15 },
});
