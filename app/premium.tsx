import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Crown, Check, Zap, Shield, Infinity } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import LogoHeader from '@/components/LogoHeader';
import GoldButton from '@/components/GoldButton';
import { useAuth } from '@/contexts/AuthContext';
import { startCheckout, openCustomerPortal, PlanId } from '@/services/stripeService';

interface PlanFeature {
  label: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: string;
  period: string;
  features: PlanFeature[];
  highlighted: boolean;
}

const plans: Plan[] = [
  {
    name: 'GOLD',
    price: '9,99€',
    period: '/ mois',
    highlighted: true,
    features: [
      { label: '50 Scans / jour', included: true },
      { label: 'Analyse Prioritaire', included: true },
      { label: 'Clé API incluse', included: true },
    ],
  },
  {
    name: 'PLATINUM',
    price: '29,99€',
    period: '/ mois',
    highlighted: false,
    features: [
      { label: 'Scans Illimités', included: true },
      { label: 'Analyse Prioritaire', included: true },
      { label: 'Clé API incluse', included: true },
      { label: 'Mode Multi-App', included: true },
    ],
  },
];

export default function PremiumScreen() {
  const router = useRouter();
  const { isPremium, profile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubscribe = useCallback(async (planName: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const planId: PlanId = planName === 'GOLD' ? 'gold' : 'platinum';
    setLoading(true);
    const { success, error } = await startCheckout(planId);
    setLoading(false);

    if (error) {
      Alert.alert('Erreur', error);
      return;
    }

    // Le navigateur a été fermé → rafraîchir le profil pour vérifier le statut
    await refreshProfile();
    if (profile?.subscription_tier !== 'free') {
      Alert.alert('Merci !', 'Votre abonnement est maintenant actif. 🎉');
    }
  }, [refreshProfile, profile]);

  const handleRestore = useCallback(async () => {
    setLoading(true);
    await refreshProfile();
    setLoading(false);

    if (profile?.subscription_tier && profile.subscription_tier !== 'free') {
      Alert.alert('Abonnement trouvé', `Votre abonnement ${profile.subscription_tier.toUpperCase()} est actif.`);
    } else {
      Alert.alert('Restauration', 'Aucun abonnement actif trouvé.');
    }
  }, [refreshProfile, profile]);

  const handleManage = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setLoading(true);
    const { error } = await openCustomerPortal();
    setLoading(false);
    if (error) {
      Alert.alert('Erreur', error);
    }
    // Refresh profile after returning from portal
    await refreshProfile();
  }, [refreshProfile]);

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.gold,
        }}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <LogoHeader size="medium" />

        <Text style={styles.heading}>Passez au niveau supérieur</Text>
        <Text style={styles.subheading}>
          Vous avez atteint votre limite de scans gratuits.{'\n'}Débloquez tout
          le potentiel de Pépite.
        </Text>

        {plans.map((plan) => (
          <View
            key={plan.name}
            style={[
              styles.planCard,
              plan.highlighted && styles.planCardHighlighted,
            ]}
          >
            <View style={styles.planHeader}>
              <Text
                style={[
                  styles.planName,
                  plan.highlighted && styles.planNameGold,
                ]}
              >
                {plan.name}
              </Text>
              <View style={styles.priceRow}>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planPeriod}>{plan.period}</Text>
              </View>
            </View>

            {plan.features.map((feature, idx) => (
              <View key={idx} style={styles.featureRow}>
                <View style={styles.checkCircle}>
                  <Check size={14} color={Colors.gold} strokeWidth={3} />
                </View>
                <Text style={styles.featureText}>{feature.label}</Text>
              </View>
            ))}

            <GoldButton
              title={plan.highlighted ? "S'abonner" : "S'abonner"}
              onPress={() => handleSubscribe(plan.name)}
              variant={plan.highlighted ? 'filled' : 'outlined'}
              style={styles.subscribeButton}
            />
          </View>
        ))}

        <Text style={styles.secureText}>
          Paiement sécurisé par Stripe. Annulation facile.
        </Text>

        {isPremium && (
          <TouchableOpacity onPress={handleManage} style={styles.restoreLink}>
            <Text style={styles.manageText}>Gérer mon abonnement</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity onPress={handleRestore} style={styles.restoreLink}>
          <Text style={styles.restoreText}>Restaurer les achats</Text>
        </TouchableOpacity>

        {loading && (
          <ActivityIndicator
            color={Colors.gold}
            size="large"
            style={{ marginTop: 16 }}
          />
        )}
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
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 16,
  },
  heading: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800' as const,
    marginTop: 12,
  },
  subheading: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  planCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
  },
  planCardHighlighted: {
    borderColor: Colors.gold,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    color: Colors.textSecondary,
    fontSize: 22,
    fontWeight: '900' as const,
    letterSpacing: 1,
  },
  planNameGold: {
    color: Colors.gold,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  planPrice: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
  },
  planPeriod: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  subscribeButton: {
    marginTop: 8,
  },
  secureText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  restoreLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  restoreText: {
    color: Colors.textSecondary,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  manageText: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
