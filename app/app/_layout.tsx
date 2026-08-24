import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/auth';
import { colors } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.primary },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Iyambere' }} />
          <Stack.Screen name="register" options={{ title: 'Create an account' }} />
          <Stack.Screen name="citizen/index" options={{ title: 'My reports' }} />
          <Stack.Screen name="citizen/report" options={{ title: 'Report a leak' }} />
          <Stack.Screen name="technician/index" options={{ title: 'My jobs' }} />
          <Stack.Screen name="ops/index" options={{ title: 'Network operations' }} />
          <Stack.Screen name="ops/pipes" options={{ title: 'Pipeline registry' }} />
          <Stack.Screen name="ops/pressure" options={{ title: 'Pressure and EPANET' }} />
          <Stack.Screen name="report/[id]" options={{ title: 'Report' }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
