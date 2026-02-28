import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Heart,
  BarChart2,
  TrendingUp,
  Zap,
  Star,
  Target,
  Calendar,
  Award,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import LogoHeader from '@/components/LogoHeader';
import PepiteCard from '@/components/PepiteCard';
import EmptyState from '@/components/EmptyState';
import { usePepite } from '@/providers/PepiteProvider';

function StatCard({
  icon,
  label,
  value,
  sub,
  gold,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  gold?: boolean;
}) {
  return (
    <View style={[styles.statCard, gold && styles.statCardGold]}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={[styles.statValue, gold && styles.statValueGold]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export default function MineScreen() {
  const insets = useSafeAreaInsets();
  const { favoritePepites, toggleFavorite, trashPepite, scanStats } = usePepite();

  const {
    scansToday,
    scansThisWeek,
    scansThisMonth,
    totalScans,
    favProfit,
    totalPepitesAnalyzed,
    topSource,
    bestDeal,
    avgProfit,
  } = scanStats;

  const isEmpty = favoritePepites.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <LogoHeader size="medium" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Titre */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>⛏️ La Mine</Text>
          <Text style={styles.titleSub}>Ton tableau de bord chineur</Text>
        </View>

        {/* Section: Scans */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Calendar size={16} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Activité de Scan</Text>
          </View>
          <View style={styles.statRow}>
            <StatCard
              icon={<Zap size={18} color={Colors.gold} />}
              label="Aujourd'hui"
              value={String(scansToday)}
            />
            <StatCard
              icon={<BarChart2 size={18} color={Colors.gold} />}
              label="Cette semaine"
              value={String(scansThisWeek)}
            />
            <StatCard
              icon={<Target size={18} color={Colors.gold} />}
              label="Ce mois"
              value={String(scansThisMonth)}
            />
          </View>
        </View>

        {/* Section: Bilan global */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingUp size={16} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Bilan Global</Text>
          </View>
          <View style={styles.statRow}>
            <StatCard
              icon={<Star size={18} color={Colors.gold} />}
              label="Pépites analysées"
              value={String(totalPepitesAnalyzed)}
            />
            <StatCard
              icon={<BarChart2 size={18} color={Colors.gold} />}
              label="Total scans"
              value={String(totalScans)}
            />
            <StatCard
              icon={<TrendingUp size={18} color={Colors.gold} />}
              label="Profit moyen"
              value={`${Math.round(avgProfit)}€`}
            />
          </View>

          {/* Top source + meilleure pépite */}
          <View style={styles.infoRow}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>🏆 Source favorite</Text>
              <Text style={styles.infoValue}>{topSource}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>💎 Meilleure trouvaille</Text>
              <Text style={styles.infoValue} numberOfLines={2}>
                {bestDeal ? `${bestDeal.title} (+${bestDeal.profit}€)` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Favoris */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heart size={16} color={Colors.gold} />
            <Text style={styles.sectionTitle}>Pépites Sauvegardées</Text>
          </View>

          {/* Bilan favoris */}
          <View style={styles.favBanner}>
            <View style={styles.favBannerItem}>
              <Text style={styles.favBannerValue}>{favoritePepites.length}</Text>
              <Text style={styles.favBannerLabel}>en favoris</Text>
            </View>
            <View style={styles.favBannerDivider} />
            <View style={styles.favBannerItem}>
              <Text style={[styles.favBannerValue, styles.favBannerProfit]}>
                +{Math.round(favProfit)}€
              </Text>
              <Text style={styles.favBannerLabel}>bénéf. potentiel</Text>
            </View>
          </View>

          {/* Liste des favoris */}
          {isEmpty ? (
            <EmptyState
              icon={<Heart size={48} color={Colors.gold} strokeWidth={1.5} />}
              title="Aucun favori"
              subtitle="Sauvegardez vos meilleures trouvailles en appuyant sur le cœur."
            />
          ) : (
            <View style={styles.favoritesList}>
              {favoritePepites.map((pepite) => (
                <PepiteCard
                  key={pepite.id}
                  pepite={pepite}
                  onToggleFavorite={toggleFavorite}
                  onTrash={trashPepite}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  titleRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800' as const,
  },
  titleSub: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statCardGold: {
    borderColor: Colors.gold + '60',
    backgroundColor: Colors.gold + '10',
  },
  statIcon: {
    marginBottom: 2,
  },
  statValue: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
  },
  statValueGold: {
    color: Colors.gold,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  statSub: {
    color: Colors.textMuted,
    fontSize: 9,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  infoCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 12,
    gap: 4,
  },
  infoLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  infoValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  favBanner: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.gold + '40',
    paddingVertical: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  favBannerItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  favBannerDivider: {
    width: 1,
    height: 36,
    backgroundColor: Colors.cardBorder,
  },
  favBannerValue: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800' as const,
  },
  favBannerProfit: {
    color: Colors.gold,
  },
  favBannerLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  favoritesList: {
    gap: 0,
  },
  footer: {
    height: 20,
  },
});
