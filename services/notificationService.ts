import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Pepite } from '@/types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function setupNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform - skipping setup');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission not granted');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('pepites', {
        name: 'Pépites détectées',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        sound: 'default',
        enableVibrate: true,
        enableLights: true,
        lightColor: '#FFD700',
      });
    }

    console.log('[Notifications] Setup complete');
    return true;
  } catch (error) {
    console.error('[Notifications] Setup error:', error);
    return false;
  }
}

export async function sendPepiteFoundNotification(pepites: Pepite[]): Promise<void> {
  if (pepites.length === 0) return;

  const totalProfit = pepites.reduce((sum, p) => sum + p.profit, 0);
  const formattedProfit = totalProfit.toLocaleString('fr-FR');
  const source = pepites[0]?.source ?? 'Shopping';

  if (Platform.OS !== 'web') {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise(resolve => setTimeout(resolve, 100));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise(resolve => setTimeout(resolve, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await new Promise(resolve => setTimeout(resolve, 80));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      console.log('[Notifications] Haptics error:', e);
    }
  }

  if (Platform.OS === 'web') {
    console.log(`[Notifications] Web: ${pepites.length} pépites trouvées (+${formattedProfit}€)`);
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Scan terminé 💰`,
        body: `${pepites.length} pépite${pepites.length > 1 ? 's' : ''} détectée${pepites.length > 1 ? 's' : ''} sur ${source} ! (+${formattedProfit}€ potentiels)`,
        data: { pepiteIds: pepites.map(p => p.id) },
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'pepites' } : {}),
      },
      trigger: null,
    });

    console.log(`[Notifications] Sent: ${pepites.length} pepites, +${formattedProfit}€`);
  } catch (error) {
    console.error('[Notifications] Send error:', error);
  }
}

/**
 * Programme une notification quotidienne à 9h : "Vous avez X scans disponibles"
 */
export async function scheduleDailyReminder(scansAvailable: number, tier: string): Promise<void> {
  if (Platform.OS === 'web') return;

  // Annuler l'ancienne notif quotidienne
  await Notifications.cancelScheduledNotificationAsync('daily-reminder').catch(() => {});

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-reminder',
      content: {
        title: '🔍 Vos scans sont prêts !',
        body: `Vous avez ${scansAvailable} scans disponibles aujourd'hui. Trouvez la prochaine pépite !`,
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'pepites' } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 9,
        minute: 0,
      },
    });
    console.log('[Notifications] Daily reminder scheduled at 9:00');
  } catch (error) {
    console.error('[Notifications] Daily reminder error:', error);
  }
}

/**
 * Annuler la notification quotidienne (quand l'utilisateur désactive les notifs)
 */
export async function cancelDailyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync('daily-reminder').catch(() => {});
}
