import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Switch, Platform } from 'react-native';
import { Bell, BellOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePepite } from '@/providers/PepiteProvider';

export default function NotificationsScreen() {
  const { settings, updateSettings } = usePepite();

  const handleToggle = useCallback(
    (value: boolean) => {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
      }
      updateSettings({ notificationsEnabled: value });
    },
    [updateSettings]
  );

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.iconWrapper}>
          {settings.notificationsEnabled ? (
            <Bell size={40} color={Colors.gold} />
          ) : (
            <BellOff size={40} color={Colors.textMuted} />
          )}
        </View>
        <Text style={styles.heading}>
          {settings.notificationsEnabled
            ? 'Notifications activées'
            : 'Notifications désactivées'}
        </Text>
        <Text style={styles.description}>
          Recevez une alerte dès qu'une pépite est détectée après un scan.
        </Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Activer les notifications</Text>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: Colors.surfaceLight, true: Colors.goldDark }}
            thumbColor={settings.notificationsEnabled ? Colors.gold : '#888'}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  heading: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  toggleLabel: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500' as const,
  },
});
