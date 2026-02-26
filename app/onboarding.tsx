import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Video, Bell, Layers, Diamond, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import GoldButton from '@/components/GoldButton';
import LogoHeader from '@/components/LogoHeader';
import { usePepite } from '@/providers/PepiteProvider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OnboardingScreen() {
  const router = useRouter();
  const { completeOnboarding } = usePepite();
  const [step, setStep] = useState<number>(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = useCallback(
    (nextStep: number) => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setTimeout(() => setStep(nextStep), 150);
    },
    [fadeAnim]
  );

  const handleNext = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (step < 2) {
      animateTransition(step + 1);
    } else {
      completeOnboarding();
      router.replace('/');
    }
  }, [step, animateTransition, completeOnboarding, router]);

  const renderStep0 = () => (
    <View style={styles.stepContainer}>
      <LogoHeader size="large" />
      <View style={styles.centerContent}>
        <Diamond size={80} color={Colors.gold} strokeWidth={1.5} />
        <Text style={styles.heroTitle}>Trouvez des{'\n'}pépites cachées</Text>
        <Text style={styles.heroSubtitle}>
          Scannez vos apps de shopping.{'\n'}Notre IA détecte les bonnes affaires{'\n'}que tout le monde rate.
        </Text>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <ScrollView style={styles.scrollStep} contentContainerStyle={styles.stepContainer} bounces={false}>
      <LogoHeader size="medium" />
      <Text style={styles.permTitle}>
        Autorisez Pépite{'\n'}pour commencer à{'\n'}chasser
      </Text>
      <Text style={styles.permSubtitle}>
        Nous avons besoin de quelques permissions pour que l'IA puisse détecter les bonnes affaires en arrière-plan. C'est 100% sécurisé.
      </Text>
      <View style={styles.permList}>
        <View style={styles.permItem}>
          <View style={styles.permIcon}>
            <Video size={24} color={Colors.gold} />
          </View>
          <View style={styles.permTextBlock}>
            <Text style={styles.permItemTitle}>Enregistrement de l'écran</Text>
            <Text style={styles.permItemDesc}>
              Pour analyser les annonces dans vos apps de shopping.
            </Text>
          </View>
        </View>
        <View style={styles.permItem}>
          <View style={styles.permIcon}>
            <Bell size={24} color={Colors.gold} />
          </View>
          <View style={styles.permTextBlock}>
            <Text style={styles.permItemTitle}>Notifications</Text>
            <Text style={styles.permItemDesc}>
              Pour vous alerter dès qu'une pépite est trouvée.
            </Text>
          </View>
        </View>
        <View style={styles.permItem}>
          <View style={styles.permIcon}>
            <Layers size={24} color={Colors.gold} />
          </View>
          <View style={styles.permTextBlock}>
            <Text style={styles.permItemTitle}>Superposition (Overlay)</Text>
            <Text style={styles.permItemDesc}>
              Pour afficher le contrôleur flottant pendant le scan.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  const renderStep2 = () => (
    <ScrollView style={styles.scrollStep} contentContainerStyle={styles.stepContainer} bounces={false}>
      <LogoHeader size="medium" />
      <Text style={styles.permTitle}>
        Dernière étape :{'\n'}Activez le Scanner
      </Text>
      <Text style={styles.tutoSubtitle}>
        Pour lancer une chasse, vous devez ajouter le raccourci Pépite à vos tuiles rapides.
      </Text>
      <View style={styles.tutoSteps}>
        <View style={styles.tutoStep}>
          <View style={styles.tutoNumber}>
            <Text style={styles.tutoNumberText}>1</Text>
          </View>
          <Text style={styles.tutoText}>
            Déroulez vos raccourcis deux fois.
          </Text>
        </View>
        <View style={styles.tutoStep}>
          <View style={styles.tutoNumber}>
            <Text style={styles.tutoNumberText}>2</Text>
          </View>
          <Text style={styles.tutoText}>
            Appuyez sur le crayon (Modifier).
          </Text>
        </View>
        <View style={styles.tutoStep}>
          <View style={styles.tutoNumber}>
            <Text style={styles.tutoNumberText}>3</Text>
          </View>
          <Text style={styles.tutoText}>
            Glissez "Scan Pépite" dans vos tuiles actives.
          </Text>
        </View>
      </View>
    </ScrollView>
  );

  const buttonLabels = [
    'Commencer',
    'Accorder les permissions',
    "C'est fait, je suis prêt !",
  ];

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
      </Animated.View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.dot, step === i && styles.dotActive]}
            />
          ))}
        </View>
        <GoldButton title={buttonLabels[step]} onPress={handleNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  scrollStep: {
    flex: 1,
  },
  stepContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 36,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 42,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
  permTitle: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 38,
  },
  permSubtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  permList: {
    marginTop: 36,
    gap: 24,
  },
  permItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  permIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTextBlock: {
    flex: 1,
  },
  permItemTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  permItemDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  tutoSubtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  tutoSteps: {
    marginTop: 36,
    gap: 20,
  },
  tutoStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  tutoNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tutoNumberText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800' as const,
  },
  tutoText: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceLight,
  },
  dotActive: {
    backgroundColor: Colors.gold,
    width: 24,
  },
});
