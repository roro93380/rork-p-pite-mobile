import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { Diamond, Scan, Brain, Bell, ExternalLink } from 'lucide-react-native';
import Colors from '@/constants/colors';

const steps = [
  {
    icon: <Scan size={24} color={Colors.gold} />,
    title: '1. Lancez un Scan',
    desc: 'Ouvrez votre app de shopping préférée (Leboncoin, Vinted...) puis lancez Pépite depuis le bouton + SCAN ou la tuile rapide.',
  },
  {
    icon: <Brain size={24} color={Colors.gold} />,
    title: '2. L\'IA analyse',
    desc: 'Pépite capture et analyse les annonces en temps réel grâce à l\'API Gemini pour identifier les bonnes affaires.',
  },
  {
    icon: <Diamond size={24} color={Colors.gold} />,
    title: '3. Découvrez vos Pépites',
    desc: 'Recevez une notification avec les résultats. Chaque pépite affiche le prix vendeur et le profit potentiel.',
  },
  {
    icon: <Bell size={24} color={Colors.gold} />,
    title: '4. Agissez vite',
    desc: 'Ouvrez directement l\'annonce depuis l\'app pour ne pas rater la bonne affaire.',
  },
];

export default function HelpScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Comment ça marche ?</Text>

      {steps.map((step, index) => (
        <View key={index} style={styles.stepCard}>
          <View style={styles.stepIcon}>{step.icon}</View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepDesc}>{step.desc}</Text>
          </View>
        </View>
      ))}

      <View style={styles.supportBlock}>
        <Text style={styles.supportTitle}>Besoin d'aide ?</Text>
        <Text style={styles.supportDesc}>
          Contactez notre support par email pour toute question.
        </Text>
        <TouchableOpacity
          style={styles.supportButton}
          onPress={() => Linking.openURL('mailto:support@pepite.io')}
        >
          <ExternalLink size={16} color="#000" />
          <Text style={styles.supportButtonText}>Contacter le support</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  heading: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800' as const,
    marginBottom: 24,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 6,
  },
  stepDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  supportBlock: {
    marginTop: 24,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.gold,
  },
  supportTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  supportDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    gap: 8,
  },
  supportButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700' as const,
  },
});
