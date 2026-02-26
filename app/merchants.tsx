import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Globe } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { MERCHANTS, Merchant } from '@/mocks/merchants';

function MerchantRow({ merchant, onPress, index }: { merchant: Merchant; onPress: (m: Merchant) => void; index: number }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 3, useNativeDriver: true }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.merchantCard}
        onPress={() => onPress(merchant)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        testID={`merchant-${merchant.id}`}
      >
        <View style={[styles.merchantIcon, { backgroundColor: merchant.color + '20' }]}>
          <Text style={styles.merchantEmoji}>{merchant.logo}</Text>
        </View>
        <View style={styles.merchantInfo}>
          <Text style={styles.merchantName}>{merchant.name}</Text>
          <Text style={styles.merchantCategory}>{merchant.description}</Text>
        </View>
        <View style={styles.merchantArrow}>
          <ChevronRight size={18} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MerchantsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleSelectMerchant = useCallback((merchant: Merchant) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    console.log('[Merchants] Selected:', merchant.name, merchant.url);
    router.push({
      pathname: '/browse',
      params: { url: merchant.url, name: merchant.name, source: merchant.id },
    });
  }, [router]);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Choisir une source</Text>
          <Text style={styles.headerSubtitle}>Où voulez-vous chasser ?</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeader}>
          <Globe size={14} color={Colors.gold} />
          <Text style={styles.sectionTitle}>PLATEFORMES DISPONIBLES</Text>
        </View>

        {MERCHANTS.map((merchant, index) => (
          <MerchantRow
            key={merchant.id}
            merchant={merchant}
            onPress={handleSelectMerchant}
            index={index}
          />
        ))}

        <View style={styles.hint}>
          <Text style={styles.hintText}>
            Sélectionnez un marchand pour ouvrir son site.{'\n'}
            Lancez ensuite le scan pour détecter les pépites pendant votre navigation.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
  },
  headerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  sectionTitle: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '700' as const,
    letterSpacing: 1.5,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  merchantIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantEmoji: {
    fontSize: 24,
  },
  merchantInfo: {
    flex: 1,
    marginLeft: 14,
  },
  merchantName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  merchantCategory: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  merchantArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  hintText: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
});
