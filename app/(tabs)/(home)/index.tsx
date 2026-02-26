import React, { useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scan, Pickaxe } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import LogoHeader from '@/components/LogoHeader';
import PepiteCard from '@/components/PepiteCard';
import EmptyState from '@/components/EmptyState';
import GoldButton from '@/components/GoldButton';
import { usePepite } from '@/providers/PepiteProvider';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    activePepites,
    isScanning,
    toggleFavorite,
    trashPepite,
    startScan,
    isLoading,
  } = usePepite();

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    if (isScanning) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isScanning, pulseAnim]);

  const handleScan = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    router.push('/merchants');
  }, [router]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const isEmpty = activePepites.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <LogoHeader size="medium" />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Mes Chasses</Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScan}
          activeOpacity={0.8}
          testID="scan-button"
        >
          <Scan size={16} color="#000" />
          <Text style={styles.scanButtonText}>+ SCAN</Text>
        </TouchableOpacity>
      </View>

      {isEmpty ? (
        <EmptyState
          icon={<Pickaxe size={64} color={Colors.gold} strokeWidth={1.5} />}
          title="Aucune chasse en cours"
          subtitle="Votre tableau de bord attend sa première pépite. Lancez un scan pour commencer !"
          actionLabel="Lancer ma première chasse"
          onAction={handleScan}
        />
      ) : (
        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.gold}
            />
          }
        >
          {activePepites.map((pepite) => (
            <PepiteCard
              key={pepite.id}
              pepite={pepite}
              onToggleFavorite={toggleFavorite}
              onTrash={trashPepite}
            />
          ))}
          <View style={styles.feedEnd} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800' as const,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  scanButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800' as const,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  feedEnd: {
    height: 40,
  },
});
