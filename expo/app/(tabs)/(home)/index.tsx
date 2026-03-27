import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Alert,
  Modal,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scan, Pickaxe, Star, Trash2, Zap, Globe, Camera, X, Clock, Download } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import LogoHeader from '@/components/LogoHeader';
import PepiteCard from '@/components/PepiteCard';
import EmptyState from '@/components/EmptyState';
import { usePepite } from '@/providers/PepiteProvider';
import { useAuth } from '@/contexts/AuthContext';
import { getSubscriptionStatus } from '@/services/stripeService';
import { Pepite } from '@/types';

type MarginFilter = 'all' | '10' | '20' | '30';

const MARGIN_FILTERS: { key: MarginFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: '10', label: '✅ Bon plan 10-20%' },
  { key: '20', label: '🔥 Bonne marge 20-30%' },
  { key: '30', label: '💎 Pépite +30%' },
];

function getScanBannerState(scansToday: number, dailyLimit: number) {
  const safeLimit = Math.max(dailyLimit, 1);
  const usedRatio = Math.min(scansToday / safeLimit, 1);
  const remaining = Math.max(0, safeLimit - scansToday);

  if (remaining === 0) {
    return {
      remaining,
      usedRatio,
      label: `Limite atteinte aujourd'hui (${scansToday} utilisés)`,
      tone: 'danger' as const,
    };
  }

  if (usedRatio >= 0.66) {
    return {
      remaining,
      usedRatio,
      label: `${remaining} scan${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''} aujourd'hui (${scansToday} utilisé${scansToday > 1 ? 's' : ''})`,
      tone: 'warning' as const,
    };
  }

  return {
    remaining,
    usedRatio,
    label: `${remaining} scan${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''} aujourd'hui (${scansToday} utilisé${scansToday > 1 ? 's' : ''})`,
    tone: 'healthy' as const,
  };
}

function getMarginPct(p: Pepite) {
  return p.sellerPrice > 0
    ? ((p.estimatedValue - p.sellerPrice) / p.sellerPrice) * 100
    : 0;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const bottomSpacing = insets.bottom + 24;
  const router = useRouter();
  const {
    activePepites,
    toggleFavorite,
    trashPepite,
    scanStats,
  } = usePepite();
  const { profile } = useAuth();

  // Limites de scans par jour selon le plan
  const SCAN_LIMITS: Record<string, number> = { free: 3, gold: 10, platinum: 30 };
  const tier = profile?.subscription_tier || 'free';
  const dailyLimit = SCAN_LIMITS[tier] || SCAN_LIMITS.free;
  const scanBannerState = getScanBannerState(scanStats.scansToday, dailyLimit);

  const [refreshing, setRefreshing] = React.useState(false);
  const [filterMargin, setFilterMargin] = useState<MarginFilter>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [showScanPopup, setShowScanPopup] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    const loadTrial = async () => {
      try {
        const data = await getSubscriptionStatus();
        if (data?.subscription?.status === 'trialing' && data.subscription.trial_end) {
          const now = Date.now() / 1000;
          const diff = Math.ceil((data.subscription.trial_end - now) / 86400);
          if (diff > 0) setTrialDaysLeft(diff);
        }
      } catch {}
    };
    loadTrial();
  }, [profile]);

  const PLAN_LABELS: Record<string, string> = { free: 'Gratuit', gold: 'Gold', platinum: 'Platinum' };
  const planLabel = PLAN_LABELS[tier] || 'Gratuit';

  // Sources uniques
  const uniqueSources = useMemo(() => {
    const sources = [...new Set(activePepites.map((p) => p.source))];
    return sources;
  }, [activePepites]);

  // Pépites filtrées — tiers exclusifs pour la marge
  const filteredPepites = useMemo(() => {
    return activePepites.filter((p) => {
      const pct = getMarginPct(p);
      const marginOk =
        filterMargin === 'all' ? true :
        filterMargin === '30' ? pct >= 30 :
        filterMargin === '20' ? pct >= 20 && pct < 30 :
        filterMargin === '10' ? pct >= 10 && pct < 20 : true;
      const sourceOk = filterSource === 'all' || p.source === filterSource;
      return marginOk && sourceOk;
    });
  }, [activePepites, filterMargin, filterSource]);

  const handleScan = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    setShowScanPopup(true);
  }, []);

  const handleScanWeb = useCallback(() => {
    setShowScanPopup(false);
    router.push('/merchants');
  }, [router]);

  const handleScanPhoto = useCallback(() => {
    setShowScanPopup(false);
    router.push('/photo-scan' as any);
  }, [router]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const handleBulkFavorite = useCallback(() => {
    Alert.alert(
      '⭐ Tout mettre en favoris',
      `Ajouter les ${filteredPepites.length} pépites affichées aux favoris ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => {
            filteredPepites.forEach((p) => {
              if (!p.isFavorite) toggleFavorite(p.id);
            });
          },
        },
      ]
    );
  }, [filteredPepites, toggleFavorite]);

  const handleBulkTrash = useCallback(() => {
    Alert.alert(
      '🗑️ Tout supprimer',
      `Supprimer les ${filteredPepites.length} pépites affichées ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            filteredPepites.forEach((p) => trashPepite(p.id));
          },
        },
      ]
    );
  }, [filteredPepites, trashPepite]);

  const handleExportCSV = useCallback(async () => {
    if (filteredPepites.length === 0) return;
    const headers = ['Nom', 'Prix vendeur', 'Valeur estimée', 'Profit', 'Source', 'Catégorie'];
    const rows = filteredPepites.map(p => [
      (p.title || '').replace(/[",]/g, ' '),
      String(p.sellerPrice || ''),
      String(p.estimatedValue || ''),
      String(p.profit || ''),
      p.source || '',
      p.category || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    try {
      await Share.share({ message: csv, title: 'Export pépites CSV' });
    } catch {}
  }, [filteredPepites]);

  const isEmpty = activePepites.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <LogoHeader size="medium" />

      <View style={styles.headerRow}>
        <Text style={styles.title}>Mes Chasses</Text>
        <View style={styles.headerActions}>
          {scanStats.streakDays > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakText}>{scanStats.streakDays}j</Text>
            </View>
          )}
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
      </View>

      {/* Scans restants aujourd'hui */}
      <TouchableOpacity
        style={[
          styles.scanLimitBanner,
          scanBannerState.tone === 'warning' && styles.scanLimitBannerWarning,
          scanBannerState.tone === 'danger' && styles.scanLimitBannerDanger,
        ]}
        onPress={() => scanBannerState.remaining === 0 ? router.push('/premium' as any) : null}
        activeOpacity={scanBannerState.remaining === 0 ? 0.7 : 1}
      >
        <View style={styles.scanLimitMeter}>
          {scanStats.scansToday > 0 && (
            <View
              style={[
                styles.scanLimitMeterFill,
                { width: `${Math.max(scanBannerState.usedRatio * 100, 8)}%` },
                scanBannerState.tone === 'warning' && styles.scanLimitMeterFillWarning,
                scanBannerState.tone === 'danger' && styles.scanLimitMeterFillDanger,
              ]}
            />
          )}
        </View>
        <View style={styles.scanLimitContent}>
          <Zap
            size={14}
            color={
              scanBannerState.tone === 'danger'
                ? '#FF6B6B'
                : scanBannerState.tone === 'warning'
                  ? '#FFB84D'
                  : Colors.gold
            }
          />
          <Text
            style={[
              styles.scanLimitText,
              scanBannerState.tone === 'warning' && styles.scanLimitTextWarning,
              scanBannerState.tone === 'danger' && styles.scanLimitTextDanger,
            ]}
            >
              {scanBannerState.label} · {planLabel}
        </Text>
      </View>
      </TouchableOpacity>

      {/* Trial countdown */}
      {trialDaysLeft !== null && (
        <TouchableOpacity
          style={styles.trialBanner}
          onPress={() => router.push('/premium' as any)}
          activeOpacity={0.7}
        >
          <Clock size={14} color={Colors.gold} />
          <Text style={styles.trialBannerText}>
            Essai gratuit : {trialDaysLeft} jour{trialDaysLeft > 1 ? 's' : ''} restant{trialDaysLeft > 1 ? 's' : ''}
          </Text>
        </TouchableOpacity>
      )}

      {!isEmpty && (
        <>
          {/* Filtre marge */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.filterScroll}
          >
            {MARGIN_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterPill, filterMargin === f.key && styles.filterPillActive]}
                onPress={() => setFilterMargin(f.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, filterMargin === f.key && styles.filterPillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Filtre source */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            style={styles.filterScroll}
          >
            <TouchableOpacity
              style={[styles.filterPill, filterSource === 'all' && styles.filterPillActive]}
              onPress={() => setFilterSource('all')}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterPillText, filterSource === 'all' && styles.filterPillTextActive]}>
                Toutes sources
              </Text>
            </TouchableOpacity>
            {uniqueSources.map((src) => (
              <TouchableOpacity
                key={src}
                style={[styles.filterPill, filterSource === src && styles.filterPillActive]}
                onPress={() => setFilterSource(src)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, filterSource === src && styles.filterPillTextActive]}>
                  {src}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Barre d'actions groupées */}
          <View style={styles.bulkRow}>
            <Text style={styles.resultCount}>{filteredPepites.length} résultat{filteredPepites.length !== 1 ? 's' : ''}</Text>
            <View style={styles.bulkActions}>
              <TouchableOpacity style={styles.bulkBtn} onPress={handleBulkFavorite} activeOpacity={0.8}>
                <Star size={14} color={Colors.gold} />
                <Text style={styles.bulkBtnText}>Tout favoris</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bulkBtn, styles.bulkBtnDanger]} onPress={handleBulkTrash} activeOpacity={0.8}>
                <Trash2 size={14} color={Colors.danger} />
                <Text style={[styles.bulkBtnText, styles.bulkBtnTextDanger]}>Tout supprimer</Text>
              </TouchableOpacity>
              {tier !== 'free' && (
                <TouchableOpacity style={styles.bulkBtn} onPress={handleExportCSV} activeOpacity={0.8}>
                  <Download size={14} color={Colors.gold} />
                  <Text style={styles.bulkBtnText}>Export</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </>
      )}

      {isEmpty ? (
        <EmptyState
          icon={<Pickaxe size={64} color={Colors.gold} strokeWidth={1.5} />}
          title="Aucune chasse en cours"
          subtitle="Votre tableau de bord attend sa première pépite. Lancez un scan pour commencer !"
          actionLabel="Lancer ma première chasse"
          onAction={handleScan}
          premiumLabel={tier === 'free' ? 'Essayer Gold — 7 jours gratuits' : undefined}
          onPremium={tier === 'free' ? () => router.push('/premium' as any) : undefined}
        />
      ) : filteredPepites.length === 0 ? (
        <View style={styles.noResult}>
          <Text style={styles.noResultText}>Aucune pépite pour ces filtres</Text>
          <TouchableOpacity onPress={() => { setFilterMargin('all'); setFilterSource('all'); }}>
            <Text style={styles.noResultReset}>Réinitialiser les filtres</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.gold} />
          }
        >
          {filteredPepites.map((pepite) => (
            <PepiteCard
              key={pepite.id}
              pepite={pepite}
              onToggleFavorite={toggleFavorite}
              onTrash={trashPepite}
            />
          ))}
          <View style={[styles.feedEnd, { height: bottomSpacing }]} />
        </ScrollView>
      )}

      {/* Popup choix mode de scan */}
      <Modal
        visible={showScanPopup}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowScanPopup(false)}
      >
        <View style={styles.popupOverlay}>
          <View style={styles.popupCard}>
            <Text style={styles.popupTitle}>Choisissez votre mode de scan</Text>

            <TouchableOpacity style={styles.popupBtn} onPress={handleScanWeb} activeOpacity={0.8}>
              <Globe size={22} color="#000" />
              <Text style={styles.popupBtnText}>Scan Web</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.popupBtn} onPress={handleScanPhoto} activeOpacity={0.8}>
              <Camera size={22} color="#000" />
              <Text style={styles.popupBtnText}>Scan Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.popupCancel} onPress={() => setShowScanPopup(false)} activeOpacity={0.7}>
              <Text style={styles.popupCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 10,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800' as const,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B0015',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF6B0030',
    gap: 4,
  },
  streakEmoji: {
    fontSize: 14,
  },
  streakText: {
    color: '#FF6B00',
    fontSize: 13,
    fontWeight: '700' as const,
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
  filterScroll: {
    flexGrow: 0,
    marginBottom: 6,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  filterPillActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  filterPillText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  filterPillTextActive: {
    color: '#000',
  },
  bulkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  resultCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600' as const,
  },
  bulkActions: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  bulkBtnDanger: {
    borderColor: Colors.danger + '40',
  },
  bulkBtnText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  bulkBtnTextDanger: {
    color: Colors.danger,
  },
  noResult: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  noResultText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  noResultReset: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  feedEnd: {
    height: 40,
  },
  scanLimitBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.gold + '30',
    overflow: 'hidden',
  },
  scanLimitBannerWarning: {
    borderColor: '#FFB84D55',
    backgroundColor: '#FFB84D10',
  },
  scanLimitBannerDanger: {
    borderColor: '#FF6B6B40',
    backgroundColor: '#FF6B6B10',
  },
  scanLimitMeter: {
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  scanLimitMeterFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: Colors.gold,
  },
  scanLimitMeterFillWarning: {
    backgroundColor: '#FFB84D',
  },
  scanLimitMeterFillDanger: {
    backgroundColor: '#FF6B6B',
  },
  scanLimitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanLimitText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600' as const,
    flex: 1,
  },
  scanLimitTextWarning: {
    color: '#FFD08A',
  },
  scanLimitTextDanger: {
    color: '#FF6B6B',
  },
  trialBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.gold + '15',
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trialBannerText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  popupCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    gap: 14,
  },
  popupTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginBottom: 4,
  },
  popupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  popupBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  popupCancel: {
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 2,
  },
  popupCancelText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});


