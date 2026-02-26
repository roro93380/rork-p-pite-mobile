import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Heart } from 'lucide-react-native';
import Colors from '@/constants/colors';
import LogoHeader from '@/components/LogoHeader';
import PepiteCard from '@/components/PepiteCard';
import EmptyState from '@/components/EmptyState';
import { usePepite } from '@/providers/PepiteProvider';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { favoritePepites, toggleFavorite, trashPepite } = usePepite();

  const isEmpty = favoritePepites.length === 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <LogoHeader size="medium" />
      <Text style={styles.title}>Pépites Sauvegardées</Text>

      {isEmpty ? (
        <EmptyState
          icon={<Heart size={64} color={Colors.gold} strokeWidth={1.5} />}
          title="Aucun favori"
          subtitle="Sauvegardez vos meilleures trouvailles en appuyant sur le coeur."
        />
      ) : (
        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
        >
          {favoritePepites.map((pepite) => (
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
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800' as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
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
