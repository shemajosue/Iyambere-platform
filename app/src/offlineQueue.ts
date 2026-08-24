import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { api } from './api';

const KEY = 'iyambere.pendingReports';

export type PendingReport = {
  latitude: number;
  longitude: number;
  description: string;
  severity: string;
  district: string;
  photoUri: string | null;
  queuedAt: string;
};

/**
 * Rwanda's rural distribution zones are exactly where leaks go unreported the
 * longest, and exactly where mobile data is least reliable. A report composed
 * out of coverage is held on the device and sent the moment the app can reach
 * the server again — the citizen never has to remember to try twice.
 */
export async function getPending(): Promise<PendingReport[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function queueReport(report: PendingReport) {
  const pending = await getPending();
  pending.push(report);
  await AsyncStorage.setItem(KEY, JSON.stringify(pending));
}

/**
 * Attaches a picked image to a form. The picker hands back a blob URL on web
 * and a file URI on native, so each platform needs its own shape.
 */
export async function attachPhoto(form: FormData, photoUri: string | null) {
  if (!photoUri) return form;

  if (Platform.OS === 'web') {
    const blob = await fetch(photoUri).then((r) => r.blob());
    form.append('photo', blob, 'leak.jpg');
  } else {
    form.append('photo', { uri: photoUri, name: 'leak.jpg', type: 'image/jpeg' } as any);
  }
  return form;
}

/** A form carrying only a photo — used for the technician's repair close-out. */
export function buildPhotoForm(photoUri: string | null) {
  return attachPhoto(new FormData(), photoUri);
}

export function buildFormData(report: Omit<PendingReport, 'queuedAt'>) {
  const form = new FormData();
  form.append('latitude', String(report.latitude));
  form.append('longitude', String(report.longitude));
  form.append('description', report.description);
  form.append('severity', report.severity);
  form.append('district', report.district);
  return attachPhoto(form, report.photoUri);
}

/** Sends everything that was queued while offline. Returns how many went through. */
export async function flushQueue(): Promise<number> {
  const pending = await getPending();
  if (!pending.length) return 0;

  const stillPending: PendingReport[] = [];
  let sent = 0;

  for (const report of pending) {
    try {
      await api.createReport(await buildFormData(report));
      sent++;
    } catch {
      stillPending.push(report);
    }
  }

  await AsyncStorage.setItem(KEY, JSON.stringify(stillPending));
  return sent;
}
