import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { Heart, Trash2, ExternalLink } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import { Pepite } from '@/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;

interface PepiteCardProps {
  pepite: Pepite;
  onToggleFavorite: (id: string) => void;
  onTrash: (id: string) => void;
  showTrashAction?: boolean;
}

export default React.memo(function PepiteCard({
  pepite,
  onToggleFavorite,
  onTrash,
  showTrashAction = true,
}: PepiteCardProps) {
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePress = useCallback(() => {
    router.push(`/detail/${pepite.id}`);
  }, [pepite.id, router]);

  const handleFavorite = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onToggleFavorite(pepite.id);
  }, [pepite.id, onToggleFavorite]);

  const handleTrash = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    onTrash(pepite.id);
  }, [pepite.id, onTrash]);

  const handleOpenLink = useCallback(() => {
    Linking.openURL(pepite.sourceUrl);
  }, [pepite.sourceUrl]);

  const formatPrice = (price: number) => {
    return price.toLocaleString('fr-FR') + '€';
  };

  return (
    <Animated.View
      style={[styles.container, { transform: [{ scale: scaleAnim }] }]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID={`pepite-card-${pepite.id}`}
      >
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: pepite.image }}
            style={styles.image}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.priceOverlay}>
            <Text style={styles.sellerPrice}>
              Prix Vendeur: {formatPrice(pepite.sellerPrice)}
            </Text>
            <Text style={styles.profit}>+{formatPrice(pepite.profit)}</Text>
          </View>
          <View style={styles.sourceTag}>
            <Text style={styles.sourceText}>{pepite.source}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.openButton}
          onPress={handleOpenLink}
          activeOpacity={0.8}
        >
          <ExternalLink size={16} color="#000" />
          <Text style={styles.openButtonText}>Ouvrir l'annonce</Text>
        </TouchableOpacity>

        <View style={styles.iconActions}>
          <TouchableOpacity
            onPress={handleFavorite}
            style={styles.iconButton}
            testID={`favorite-${pepite.id}`}
          >
            <Heart
              size={22}
              color={pepite.isFavorite ? Colors.gold : Colors.textSecondary}
              fill={pepite.isFavorite ? Colors.gold : 'transparent'}
            />
          </TouchableOpacity>

          {showTrashAction && (
            <TouchableOpacity
              onPress={handleTrash}
              style={styles.iconButton}
              testID={`trash-${pepite.id}`}
            >
              <Trash2 size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 0.85,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  priceOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sellerPrice: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '500' as const,
  },
  profit: {
    color: Colors.gold,
    fontSize: 32,
    fontWeight: '900' as const,
    letterSpacing: -0.5,
  },
  sourceTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  sourceText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '600' as const,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  openButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  openButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  iconActions: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
  },
});
