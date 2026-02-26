import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Key,
  Lightbulb,
  Bell,
  Info,
  Trash2,
  Crown,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import LogoHeader from '@/components/LogoHeader';
import { usePepite } from '@/providers/PepiteProvider';

interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}

function SettingsRow({ icon, label, onPress, trailing }: SettingsRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowTrailing}>
        {trailing || <ChevronRight size={20} color={Colors.gold} />}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, updateSettings } = usePepite();

  const handleToggleNotifications = useCallback(
    (value: boolean) => {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
      }
      updateSettings({ notificationsEnabled: value });
    },
    [updateSettings]
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <LogoHeader size="medium" />
      <Text style={styles.title}>Réglages</Text>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <SettingsRow
          icon={<Key size={22} color={Colors.gold} />}
          label="Clé API Gemini"
          onPress={() => router.push('/settings/api-key')}
        />
        <View style={styles.separator} />

        <SettingsRow
          icon={<Lightbulb size={22} color={Colors.gold} />}
          label="Comment ça marche ?"
          onPress={() => router.push('/settings/help')}
        />
        <View style={styles.separator} />

        <SettingsRow
          icon={<Bell size={22} color={Colors.gold} />}
          label="Notifications"
          trailing={
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: Colors.surfaceLight, true: Colors.goldDark }}
              thumbColor={
                settings.notificationsEnabled ? Colors.gold : '#888'
              }
            />
          }
        />
        <View style={styles.separator} />

        <SettingsRow
          icon={<Trash2 size={22} color={Colors.gold} />}
          label="Corbeille"
          onPress={() => router.push('/settings/trash')}
        />
        <View style={styles.separator} />

        <SettingsRow
          icon={<Crown size={22} color={Colors.gold} />}
          label="Passer Premium"
          onPress={() => router.push('/premium')}
        />
        <View style={styles.separator} />

        <SettingsRow
          icon={<Info size={22} color={Colors.gold} />}
          label="À propos & Support"
          onPress={() => router.push('/settings/help')}
        />

        <View style={styles.versionBlock}>
          <Text style={styles.versionText}>Pépite.io v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800' as const,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500' as const,
  },
  rowTrailing: {
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.divider,
  },
  versionBlock: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
});
