import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Loads data, refreshes it whenever the screen comes back into focus, and
 * exposes a `reload` for after an action changes something.
 */
export function useApi<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setData(await loader());
      setError('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Fires on mount and again every time the screen is returned to.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, loading, reload };
}
