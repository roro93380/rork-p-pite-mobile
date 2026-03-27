import { Stack } from 'expo-router';
import React from 'react';
import Colors from '@/constants/colors';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.gold,
        headerTitleStyle: { color: Colors.text, fontWeight: '600' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="api-key" options={{ title: 'Clé API Gemini' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="trash" options={{ title: 'Corbeille' }} />
      <Stack.Screen name="help" options={{ title: 'Aide & Support' }} />
    </Stack>
  );
}
