import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Trash2, RotateCcw, X } from 'lucide-react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import EmptyState from '@/components/EmptyState';
import { usePepite } from '@/providers/PepiteProvider';

export default function TrashScreen() {
  const { trashedPepites, restorePepite, deletePepite } = usePepite();

  const handleRestore = useCallback(
    (id: string) => {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      restorePepite(id);
    },
    [restorePepite]
  );

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert(
        'Supprimer définitivement',
        'Cette action est irréversible.',
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: () => {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning
                );
              }
              deletePepite(id);
            },
          },
        ]
      );
    },
    [deletePepite]
  );

  if (trashedPepites.length === 0) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon={<Trash2 size={64} color={Colors.gold} strokeWidth={1.5} />}
          title="Votre corbeille est vide"
          subtitle="Les éléments supprimés sont conservés pendant 30 jours avant d'être définitivement effacés."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {trashedPepites.map((pepite) => (
          <View key={pepite.id} style={styles.trashCard}>
            <Image
              source={{ uri: pepite.image }}
              style={styles.cardImage}
              contentFit="cover"
            />
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {pepite.title}
              </Text>
              <Text style={styles.cardProfit}>
                +{pepite.profit.toLocaleString('fr-FR')}€
              </Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={() => handleRestore(pepite.id)}
              >
                <RotateCcw size={18} color={Colors.gold} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(pepite.id)}
              >
                <X size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    gap: 12,
  },
  trashCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  cardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  cardProfit: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  restoreBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
