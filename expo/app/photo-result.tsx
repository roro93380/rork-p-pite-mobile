import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart, ScanSearch, Camera, ExternalLink, Globe, ImageOff } from 'lucide-react-native';
import Colors from '@/constants/colors';
import LogoHeader from '@/components/LogoHeader';
import { usePepite } from '@/providers/PepiteProvider';

export interface PhotoReference {
  source: string;
  title: string;
  description: string;
  price: number;
  url: string;
  imageUrl: string;
}

export interface PhotoEstimation {
  title: string;
  buyPrice: number;
  sellPrice: number;
  profit: number;
  score: number;
  description: string;
  condition: string;
  year: string;
  rarity: string;
  references: PhotoReference[];
}

function ReferenceProductCard({ reference, onPress }: { reference: PhotoReference; onPress: () => void }) {
  const [imgError, setImgError] = useState(false);
  const hasImage = !!(reference.imageUrl && reference.imageUrl.startsWith('http') && !imgError);

  return (
    <TouchableOpacity style={styles.productCard} onPress={onPress} activeOpacity={0.7}>
      {hasImage ? (
        <Image
          source={{ uri: reference.imageUrl }}
          style={styles.productCardImage}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.productCardImage, styles.productCardImagePlaceholder]}>
          <ImageOff size={24} color={Colors.textSecondary} />
        </View>
      )}
      <View style={styles.productCardInfo}>
        <Text style={styles.productCardTitle} numberOfLines={2}>
          {reference.title || reference.source}
        </Text>
        {reference.description ? (
          <Text style={styles.productCardDesc} numberOfLines={2}>{reference.description}</Text>
        ) : null}
        <View style={styles.productCardFooter}>
          <Text style={styles.productCardPrice}>{reference.price.toLocaleString('fr-FR')}€</Text>
          <View style={styles.productCardSite}>
            <Globe size={12} color={Colors.textSecondary} />
            <Text style={styles.productCardSiteText}>{reference.source}</Text>
            <ExternalLink size={12} color={Colors.gold} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function PhotoResultScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, imageUri } = useLocalSearchParams<{ data: string; imageUri: string }>();
  const { addPepites } = usePepite();

  const estimation: PhotoEstimation | null = useMemo(() => {
    try {
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }, [data]);

  if (!estimation) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={styles.errorText}>Aucune estimation disponible</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const scoreLabel = estimation.score >= 8 ? 'Pépite' : estimation.score >= 6 ? 'Bon Plan' : 'Correct';
  const scoreProgress = Math.min(estimation.score / 10, 1);

  const sourcesText = estimation.references.length > 0
    ? estimation.references.map(r => r.source).join(', ')
    : 'Gemini AI';

  const handleSave = () => {
    const now = new Date().toISOString();
    addPepites([{
      id: `photo-${Date.now()}`,
      title: estimation.title,
      sellerPrice: estimation.buyPrice,
      estimatedValue: estimation.sellPrice,
      profit: estimation.profit,
      source: 'Scan Photo',
      sourceUrl: '',
      category: 'Photo Scan',
      description: estimation.description,
      image: imageUri || '',
      scanDate: now,
      isFavorite: false,
      isTrashed: false,
    }]);
    router.replace('/(tabs)' as any);
  };

  const handleSearch = () => {
    const query = encodeURIComponent(estimation.title);
    router.push({ pathname: '/browse', params: { url: `https://www.google.com/search?q=${query}+prix`, name: estimation.title, source: 'Recherche' } });
  };

  const handleOpenReference = useCallback((url: string) => {
    if (url && url.startsWith('http')) {
      Linking.openURL(url);
    } else {
      const query = encodeURIComponent(estimation.title);
      Linking.openURL(`https://www.google.com/search?q=${query}`);
    }
  }, [estimation.title]);

  const handleNewScan = () => {
    router.replace('/photo-scan' as any);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <LogoHeader size="medium" />
        <Text style={styles.pageTitle}>Estimation de l'Objet</Text>

        {/* Product row */}
        <View style={styles.productRow}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.productImage} />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]} />
          )}
          <Text style={styles.productName}>{estimation.title}</Text>
        </View>

        {/* Object Price (hero) */}
        <Text style={styles.priceHero}>{estimation.buyPrice.toLocaleString('fr-FR')}€</Text>
        <Text style={styles.priceHeroLabel}>Prix estimé de l'objet</Text>

        {/* Price details */}
        <View style={styles.priceCards}>
          <View style={styles.priceCard}>
            <Text style={styles.priceCardLabel}>Revente estimée</Text>
            <Text style={styles.priceCardValue}>{estimation.sellPrice.toLocaleString('fr-FR')}€</Text>
          </View>
          <View style={[styles.priceCard, styles.priceCardProfit]}>
            <Text style={styles.priceCardLabel}>Bénéfice potentiel</Text>
            <Text style={[styles.priceCardValue, { color: Colors.success }]}>+{estimation.profit.toLocaleString('fr-FR')}€</Text>
          </View>
        </View>

        {/* Score bar */}
        <View style={styles.scoreContainer}>
          <View style={styles.scoreBar}>
            <View style={[styles.scoreBarFill, { width: `${scoreProgress * 100}%` }]} />
          </View>
          <Text style={styles.scoreValue}>{estimation.score}/10</Text>
        </View>
        <Text style={styles.scoreLabel}>Score de Pépite - {scoreLabel}</Text>

        {/* AI analysis */}
        <View style={styles.analysisBlock}>
          <Text style={styles.analysisText}>
            Analyse d'IA basée sur {estimation.references.length} sources ({sourcesText})
          </Text>
          <Text style={styles.analysisText}>État : {estimation.condition}</Text>
          <Text style={styles.analysisText}>Année suggérée: {estimation.year}</Text>
          <Text style={styles.analysisText}>Indices de rareté: {estimation.rarity}</Text>
        </View>

        {/* Reference products as rich product cards */}
        {estimation.references.length > 0 && (
          <View style={styles.referencesBlock}>
            <Text style={styles.referencesTitle}>Produits de référence</Text>
            <Text style={styles.referencesSubtitle}>Produits similaires trouvés en ligne — cliquez pour voir</Text>
            {estimation.references.map((ref, i) => (
              <ReferenceProductCard
                key={i}
                reference={ref}
                onPress={() => handleOpenReference(ref.url)}
              />
            ))}
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleSave} activeOpacity={0.8}>
            <Heart size={22} color={Colors.gold} />
            <Text style={styles.actionBtnText}>Enregistrer la{'\n'}Pépite</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnFilled]} onPress={handleSearch} activeOpacity={0.8}>
            <ScanSearch size={22} color="#000" />
            <Text style={[styles.actionBtnText, styles.actionBtnTextFilled]}>Ouvrir la{'\n'}Recherche</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleNewScan} activeOpacity={0.8}>
            <Camera size={22} color={Colors.gold} />
            <Text style={styles.actionBtnText}>Nouveau{'\n'}Scan</Text>
          </TouchableOpacity>
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
  },
  pageTitle: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 20,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  productImage: {
    width: 140,
    height: 140,
    borderRadius: 12,
    backgroundColor: Colors.card,
  },
  productImagePlaceholder: {
    backgroundColor: Colors.card,
  },
  productName: {
    flex: 1,
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
  },
  priceHero: {
    color: Colors.text,
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 2,
  },
  priceHeroLabel: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  priceCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  priceCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  priceCardProfit: {
    borderColor: 'rgba(34,197,94,0.3)',
    backgroundColor: 'rgba(34,197,94,0.06)',
  },
  priceCardLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  priceCardValue: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 24,
    marginBottom: 8,
  },
  scoreBar: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.card,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 6,
    backgroundColor: Colors.success,
  },
  scoreValue: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 50,
    textAlign: 'right',
  },
  scoreLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  analysisBlock: {
    gap: 6,
    marginBottom: 16,
  },
  analysisText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  referencesBlock: {
    marginBottom: 24,
    gap: 10,
  },
  referencesTitle: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 0,
  },
  referencesSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  productCardImage: {
    width: 100,
    height: 100,
    backgroundColor: Colors.surfaceLight,
  },
  productCardImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCardInfo: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  productCardTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  productCardDesc: {
    color: Colors.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  productCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  productCardPrice: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '900',
  },
  productCardSite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  productCardSiteText: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    gap: 8,
  },
  actionBtnFilled: {
    backgroundColor: Colors.gold,
  },
  actionBtnText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
  actionBtnTextFilled: {
    color: '#000',
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 100,
  },
  retryBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: 20,
  },
  retryBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
});
