import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform,
  Alert,
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
  LogOut,
  User,
  UserX,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import LogoHeader from '@/components/LogoHeader';
import { usePepite } from '@/providers/PepiteProvider';
import { useAuth } from '@/contexts/AuthContext';

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
  const { profile, signOut, user, deleteAccount } = useAuth();

  const handleToggleNotifications = useCallback(
    (value: boolean) => {
      if (Platform.OS !== 'web') {
        Haptics.selectionAsync();
      }
      updateSettings({ notificationsEnabled: value });
    },
    [updateSettings]
  );

  const handleLogout = useCallback(() => {
    Alert.alert('Déconnexion', 'Voulez-vous vraiment vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter',
        style: 'destructive',
        onPress: async () => {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          await signOut();
        },
      },
    ]);
  }, [signOut]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes vos données seront supprimées définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmation',
              'Êtes-vous vraiment sûr ? Il n\'y a pas de retour en arrière possible.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Oui, supprimer',
                  style: 'destructive',
                  onPress: async () => {
                    if (Platform.OS !== 'web') {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    }
                    const { error } = await deleteAccount();
                    if (error) {
                      Alert.alert('Erreur', error);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [deleteAccount]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <LogoHeader size="medium" />
      <Text style={styles.title}>Réglages</Text>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Account section */}
        <View style={styles.accountCard}>
          <View style={styles.accountAvatar}>
            <User size={24} color={Colors.gold} />
          </View>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName} numberOfLines={1}>
              {profile?.full_name || 'Utilisateur'}
            </Text>
            <Text style={styles.accountEmail} numberOfLines={1}>
              {user?.email || ''}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <LogOut size={20} color={Colors.danger} />
          </TouchableOpacity>
        </View>

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

        <View style={styles.separator} />
        <SettingsRow
          icon={<UserX size={22} color={Colors.danger} />}
          label="Supprimer mon compte"
          onPress={handleDeleteAccount}
          trailing={<ChevronRight size={20} color={Colors.danger} />}
        />
        <View style={{ height: 40 }} />
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
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  accountAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  accountEmail: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  logoutButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
