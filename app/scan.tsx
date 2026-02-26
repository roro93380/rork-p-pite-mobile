import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Radio, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import GoldButton from '@/components/GoldButton';
import { usePepite } from '@/providers/PepiteProvider';

const SCAN_DURATION_LIMIT = 30;

export default function ScanScreen() {
  const router = useRouter();
  const { startScan, stopScan, isScanning, isAnalyzing, lastScanResults, scanError, settings } = usePepite();
  const [timer, setTimer] = useState<number>(0);
  const [phase, setPhase] = useState<'recording' | 'analyzing' | 'done' | 'error'>(
    'recording'
  );

  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const ringScale = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!settings.geminiApiKey || settings.geminiApiKey.trim().length === 0) {
      Alert.alert(
        'Clé API requise',
        'Configurez votre clé API Gemini dans Réglages > Clé API pour activer le scan.',
        [
          { text: 'Retour', onPress: () => router.back() },
          { text: 'Configurer', onPress: () => router.replace('/settings/api-key' as any) },
        ]
      );
      return;
    }

    startScan();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, { toValue: 1.3, duration: 1500, useNativeDriver: true }),
        Animated.timing(ringScale, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    ring.start();

    return () => {
      pulse.stop();
      ring.stop();
    };
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;
    const interval = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase === 'recording' && timer >= SCAN_DURATION_LIMIT) {
      console.log(`[ScanScreen] Auto-stop: ${SCAN_DURATION_LIMIT}s reached`);
      handleStop();
    }
  }, [timer, phase]);

  useEffect(() => {
    if (phase === 'analyzing' && !isAnalyzing && lastScanResults.length > 0) {
      console.log('[ScanScreen] Analysis complete, showing results');
      progressAnim.setValue(1);
      setPhase('done');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [isAnalyzing, lastScanResults, phase]);

  useEffect(() => {
    if (phase === 'analyzing' && !isAnalyzing && lastScanResults.length === 0 && !scanError) {
      const checkTimeout = setTimeout(() => {
        if (!isAnalyzing && lastScanResults.length === 0 && !scanError) {
          setPhase('done');
        }
      }, 2000);
      return () => clearTimeout(checkTimeout);
    }
  }, [isAnalyzing, lastScanResults, scanError, phase]);

  useEffect(() => {
    if (phase === 'analyzing' && scanError) {
      console.log('[ScanScreen] Scan error detected:', scanError);
      setPhase('error');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
  }, [scanError, phase]);

  useEffect(() => {
    if (phase === 'analyzing') {
      const loopDots = Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
        ])
      );
      loopDots.start();

      Animated.timing(progressAnim, {
        toValue: 0.85,
        duration: 15000,
        useNativeDriver: false,
      }).start();

      return () => {
        loopDots.stop();
      };
    }
  }, [phase]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleStop = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    console.log(`[ScanScreen] Stopping scan after ${timer}s`);
    setPhase('analyzing');
    stopScan('Shopping', '');
  }, [stopScan, timer]);

  const handleViewResults = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleRetry = useCallback(() => {
    setPhase('recording');
    setTimer(0);
    progressAnim.setValue(0);
    startScan();
  }, [startScan, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const totalProfit = lastScanResults.reduce((sum, p) => sum + p.profit, 0);
  const formattedProfit = totalProfit.toLocaleString('fr-FR');
  const progressPercent = Math.min((timer / SCAN_DURATION_LIMIT) * 100, 100);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {phase === 'recording' && (
        <View style={styles.recordingView}>
          <View style={styles.recIndicator}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>SCAN EN COURS</Text>
          </View>

          <View style={styles.circleContainer}>
            <Animated.View
              style={[
                styles.outerRing,
                {
                  transform: [{ scale: ringScale }],
                  opacity: pulseAnim,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.middleRing,
                { opacity: pulseAnim },
              ]}
            />
            <View style={styles.innerCircle}>
              <Radio size={40} color={Colors.recording} />
              <Text style={styles.timerText}>{formatTimer(timer)}</Text>
            </View>
          </View>

          <View style={styles.timerBar}>
            <View style={[styles.timerBarFill, { width: `${progressPercent}%` as any }]} />
          </View>
          <Text style={styles.timerLimit}>
            Arrêt auto dans {SCAN_DURATION_LIMIT - timer}s
          </Text>

          <Text style={styles.instructions}>
            Naviguez dans votre app de shopping.{'\n'}Pépite analyse en temps réel via Gemini.
          </Text>

          <GoldButton
            title="Arrêter le scan"
            onPress={handleStop}
            variant="outlined"
            style={styles.stopButton}
          />
        </View>
      )}

      {phase === 'analyzing' && (
        <View style={styles.analyzingView}>
          <View style={styles.analyzingIconContainer}>
            <Animated.View style={[styles.analyzingDot, { opacity: dotAnim }]} />
            <Text style={styles.analyzingEmoji}>🔍</Text>
          </View>

          <Text style={styles.analyzingTitle}>Analyse Gemini...</Text>
          <Text style={styles.analyzingSubtitle}>
            L'expert IA analyse les annonces pour détecter les pépites cachées.
          </Text>

          <View style={styles.progressBar}>
            <Animated.View
              style={[styles.progressFill, { width: progressWidth }]}
            />
          </View>

          <View style={styles.stepsContainer}>
            <Text style={styles.stepText}>✓ Scan terminé ({formatTimer(timer)})</Text>
            <Text style={styles.stepTextActive}>⟳ Analyse par Gemini 1.5 Flash...</Text>
            <Text style={styles.stepTextPending}>○ Calcul des profits potentiels</Text>
          </View>
        </View>
      )}

      {phase === 'done' && (
        <View style={styles.doneView}>
          <Text style={styles.doneEmoji}>{lastScanResults.length > 0 ? '💰' : '🔍'}</Text>
          <Text style={styles.doneTitle}>
            {lastScanResults.length > 0 ? 'Scan terminé !' : 'Aucune pépite'}
          </Text>
          <Text style={styles.doneSubtitle}>
            {lastScanResults.length > 0
              ? `${lastScanResults.length} pépite${lastScanResults.length > 1 ? 's' : ''} détectée${lastScanResults.length > 1 ? 's' : ''}\n+${formattedProfit}€ de profit potentiel`
              : 'Essayez de naviguer vers plus d\'annonces pour trouver des pépites.'}
          </Text>

          {lastScanResults.length > 0 && (
            <View style={styles.resultsSummary}>
              {lastScanResults.slice(0, 3).map((p) => (
                <View key={p.id} style={styles.resultRow}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{p.title}</Text>
                  <Text style={styles.resultProfit}>+{p.profit.toLocaleString('fr-FR')}€</Text>
                </View>
              ))}
              {lastScanResults.length > 3 && (
                <Text style={styles.moreResults}>
                  +{lastScanResults.length - 3} autre{lastScanResults.length - 3 > 1 ? 's' : ''} pépite{lastScanResults.length - 3 > 1 ? 's' : ''}
                </Text>
              )}
            </View>
          )}

          <GoldButton
            title={lastScanResults.length > 0 ? 'Voir les résultats' : 'Retour'}
            onPress={handleViewResults}
            style={styles.resultsButton}
          />
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.errorView}>
          <AlertCircle size={64} color={Colors.danger} />
          <Text style={styles.errorTitle}>Erreur d'analyse</Text>
          <Text style={styles.errorSubtitle}>
            {scanError ?? 'Une erreur est survenue lors de l\'analyse. Veuillez réessayer.'}
          </Text>

          <GoldButton
            title="Réessayer"
            onPress={handleRetry}
            style={styles.retryButton}
          />
          <GoldButton
            title="Retour"
            onPress={handleViewResults}
            variant="outlined"
            style={styles.backButton}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  recordingView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  recIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 60,
  },
  recDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.recording,
  },
  recText: {
    color: Colors.recording,
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 2,
  },
  circleContainer: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  outerRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  middleRing: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  innerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.card,
    borderWidth: 3,
    borderColor: Colors.recording,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 4,
  },
  timerBar: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  timerBarFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  timerLimit: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 24,
  },
  instructions: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  stopButton: {
    width: '100%',
  },
  analyzingView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  analyzingIconContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  analyzingDot: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  analyzingEmoji: {
    fontSize: 40,
  },
  analyzingTitle: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800' as const,
    marginBottom: 12,
  },
  analyzingSubtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 40,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 32,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  stepsContainer: {
    alignSelf: 'stretch',
    gap: 12,
  },
  stepText: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  stepTextActive: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '600' as const,
  },
  stepTextPending: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '400' as const,
  },
  doneView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  doneEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  doneTitle: {
    color: Colors.gold,
    fontSize: 30,
    fontWeight: '800' as const,
    marginBottom: 12,
  },
  doneSubtitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  resultsSummary: {
    alignSelf: 'stretch',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 10,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500' as const,
    flex: 1,
    marginRight: 12,
  },
  resultProfit: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  moreResults: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  resultsButton: {
    width: '100%',
  },
  errorView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: Colors.danger,
    fontSize: 24,
    fontWeight: '800' as const,
    marginTop: 20,
    marginBottom: 12,
  },
  errorSubtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryButton: {
    width: '100%',
    marginBottom: 12,
  },
  backButton: {
    width: '100%',
  },
});
