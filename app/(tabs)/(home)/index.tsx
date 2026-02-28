import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Scan, Pickaxe, Star, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import LogoHeader from '@/components/LogoHeader';
import PepiteCard from '@/components/PepiteCard';
import EmptyState from '@/components/EmptyState';
import { usePepite } from '@/providers/PepiteProvider';
import { Pepite } from '@/types';

type MarginFilter = 'all' | '10' | '20' | '30';

const MARGIN_FILTERS: { key: MarginFilter; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: '10', label: '✅ Bon plan 10-20%' },
  { key: '20', label: '🔥 Bonne marge 20-30%' },
  { key: '30', label: '💎 Pépite +30%' },
];

function getMarginPct(p: Pepite) {
  return p.sellerPrice > 0
    ? ((p.estimatedValue - p.sellerPrice) / p.sellerPrice) * 100
    : 0;
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    activePepites,
    toggleFavorite,
    trashPepite,
  } = usePepite();

  const [refreshing, setRefreshing] = React.useState(false);
  const [filterMargin, setFilterMargin] = useState<MarginFilter>('all');
  const [filterSource, setFilterSource] = useState<string>('all');

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
    router.push('/merchants');
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
    paddingBottom: 10,
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
});


