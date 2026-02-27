import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  Heart,
  Trash2,
  ExternalLink,
  Tag,
  Calendar,
  Store,
  TrendingUp,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import GoldButton from '@/components/GoldButton';
import { usePepite } from '@/providers/PepiteProvider';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getPepiteById, toggleFavorite, trashPepite } = usePepite();

  const pepite = getPepiteById(id ?? '');

  const handleFavorite = useCallback(() => {
    if (!pepite) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    toggleFavorite(pepite.id);
  }, [pepite, toggleFavorite]);

  const handleTrash = useCallback(() => {
    if (!pepite) return;
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    trashPepite(pepite.id);
    router.back();
  }, [pepite, trashPepite, router]);

  const handleOpenLink = useCallback(() => {
    if (!pepite) return;
    const url = pepite.sourceUrl;
    if (!url || !url.startsWith('http')) {
      Alert.alert('Lien indisponible', 'L\'URL de cette annonce n\'a pas pu être récupérée par l\'IA.');
      return;
    }
    Linking.openURL(url).catch(() => {
      Alert.alert('Erreur', 'Impossible d\'ouvrir ce lien.');
    });
  }, [pepite]);

  if (!pepite) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Détail' }} />
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Pépite introuvable</Text>
        </View>
      </View>
    );
  }

  const formatPrice = (price: number) =>
    price.toLocaleString('fr-FR') + '€';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const profitMargin = Math.round(
    (pepite.profit / pepite.sellerPrice) * 100
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.gold,
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleFavorite} style={styles.headerBtn}>
                <Heart
                  size={22}
                  color={pepite.isFavorite ? Colors.gold : Colors.textSecondary}
                  fill={pepite.isFavorite ? Colors.gold : 'transparent'}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleTrash} style={styles.headerBtn}>
                <Trash2 size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: pepite.image }}
            style={styles.image}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.priceOverlay}>
            <Text style={styles.sellerPriceLabel}>Prix Vendeur</Text>
            <Text style={styles.sellerPrice}>
              {formatPrice(pepite.sellerPrice)}
            </Text>
          </View>
        </View>

        <View style={styles.profitBanner}>
          <TrendingUp size={20} color="#000" />
          <Text style={styles.profitText}>
            Profit estimé : +{formatPrice(pepite.profit)}
          </Text>
          <View style={styles.profitBadge}>
            <Text style={styles.profitBadgeText}>+{profitMargin}%</Text>
          </View>
        </View>

        <Text style={styles.title}>{pepite.title}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Store size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{pepite.source}</Text>
          </View>
          <View style={styles.metaItem}>
            <Tag size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{pepite.category}</Text>
          </View>
          <View style={styles.metaItem}>
            <Calendar size={14} color={Colors.textSecondary} />
            <Text style={styles.metaText}>{formatDate(pepite.scanDate)}</Text>
          </View>
        </View>

        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionTitle}>Analyse IA</Text>
          <Text style={styles.descriptionText}>{pepite.description}</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Prix vendeur</Text>
            <Text style={styles.statValue}>
              {formatPrice(pepite.sellerPrice)}
            </Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Valeur estimée</Text>
            <Text style={[styles.statValue, { color: Colors.gold }]}>
              {formatPrice(pepite.estimatedValue)}
            </Text>
          </View>
        </View>

        <GoldButton
          title="Ouvrir l'annonce"
          onPress={handleOpenLink}
          style={styles.actionButton}
        />

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerBtn: {
    padding: 4,
  },
  content: {
    paddingBottom: 40,
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.85,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  priceOverlay: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sellerPriceLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  sellerPrice: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800' as const,
  },
  profitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    marginHorizontal: 16,
    marginTop: -20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    zIndex: 10,
  },
  profitText: {
    flex: 1,
    color: '#000',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  profitBadge: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  profitBadgeText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800' as const,
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
    paddingHorizontal: 16,
    marginTop: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  descriptionCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  descriptionTitle: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  descriptionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  statValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
  },
  actionButton: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  bottomSpacer: {
    height: 20,
  },
});
