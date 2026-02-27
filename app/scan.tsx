import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { AlertCircle, CheckCircle, Globe, ChevronLeft, StopCircle, Search } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { WebView } from 'react-native-webview';
import { captureRef } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import GoldButton from '@/components/GoldButton';
import { usePepite } from '@/providers/PepiteProvider';
import { MERCHANTS } from '@/mocks/merchants';
import { ExtractedAd, getAdExtractionScript } from '@/services/scanService';

const CAPTURE_INTERVAL_MS = 2500;
const SCAN_DURATION_LIMIT = 30;

const SCAN_TIPS = [
  'Scrollez lentement pour de meilleurs résultats',
  'Passez bien sur chaque annonce',
  'Restez sur les pages avec des prix visibles',
  'Prenez votre temps, l\'IA capture tout',
  'Concentrez-vous sur les bonnes catégories',
];

const ANALYSIS_STEPS = [
  'Préparation des captures',
  'Envoi à Gemini',
  'Analyse des annonces détectées',
  'Évaluation des prix du marché',
  'Sélection des meilleures pépites',
];

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startScan, stopScan, isScanning, isAnalyzing, lastScanResults, scanError, settings } = usePepite();

  const [phase, setPhase] = useState<'setup' | 'recording' | 'analyzing' | 'done' | 'error'>('setup');
  const [selectedUrl, setSelectedUrl] = useState<string>('');
  const [selectedMerchant, setSelectedMerchant] = useState<string>('');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [timer, setTimer] = useState<number>(0);
  const [captureCount, setCaptureCount] = useState<number>(0);
  const [currentTipIndex, setCurrentTipIndex] = useState<number>(0);
  const [analysisStep, setAnalysisStep] = useState<number>(0);

  const webViewRef = useRef<View>(null);
  const webViewInstanceRef = useRef<any>(null);
  const screenshotsRef = useRef<string[]>([]);
  const extractedAdsRef = useRef<ExtractedAd[]>([]);
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const extractIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCapturingRef = useRef<boolean>(false);

  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const tipFadeAnim = useRef(new Animated.Value(1)).current;

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
    }
  }, []);

  useEffect(() => {
    if (phase !== 'recording') return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();

    timerIntervalRef.current = setInterval(() => {
      setTimer((t) => t + 1);
    }, 1000);

    const tipInterval = setInterval(() => {
      Animated.timing(tipFadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setCurrentTipIndex((prev) => (prev + 1) % SCAN_TIPS.length);
        Animated.timing(tipFadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    }, 4000);

    return () => {
      pulse.stop();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      clearInterval(tipInterval);
    };
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
      setAnalysisStep(0);
      progressAnim.setValue(0);

      const loopDots = Animated.loop(
        Animated.sequence([
          Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(dotAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
        ])
      );
      loopDots.start();

      Animated.timing(progressAnim, {
        toValue: 0.9,
        duration: 25000,
        useNativeDriver: false,
      }).start();

      const stepInterval = setInterval(() => {
        setAnalysisStep((prev) => {
          if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
          return prev;
        });
      }, 4000);

      return () => {
        loopDots.stop();
        clearInterval(stepInterval);
      };
    }
  }, [phase]);

  const captureScreenshot = useCallback(async () => {
    if (isCapturingRef.current || !webViewRef.current) return;
    isCapturingRef.current = true;

    try {
      const base64 = await captureRef(webViewRef, {
        format: 'jpg',
        quality: 0.5,
        result: 'base64',
      });

      if (base64 && base64.length > 100) {
        screenshotsRef.current.push(base64);
        setCaptureCount(screenshotsRef.current.length);
        console.log(`[ScanScreen] Captured frame #${screenshotsRef.current.length} (${Math.round(base64.length / 1024)}KB)`);
      }
    } catch (err) {
      console.warn('[ScanScreen] Capture failed:', err);
    } finally {
      isCapturingRef.current = false;
    }
  }, []);

  const injectExtractionScript = useCallback(() => {
    if (webViewInstanceRef.current && Platform.OS !== 'web') {
      webViewInstanceRef.current.injectJavaScript(getAdExtractionScript());
    }
  }, []);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'EXTRACTED_ADS' && Array.isArray(data.ads)) {
        const newAds = data.ads as ExtractedAd[];
        if (newAds.length > 0) {
          const existingIds = new Set(extractedAdsRef.current.map(a => a.url || a.title));
          let addedCount = 0;
          for (const ad of newAds) {
            const key = ad.url || ad.title;
            if (!existingIds.has(key)) {
              existingIds.add(key);
              extractedAdsRef.current.push(ad);
              addedCount++;
            }
          }
          const total = extractedAdsRef.current.length;
          extractedAdsRef.current = extractedAdsRef.current.slice(0, 50).map((ad, i) => ({ ...ad, id: `ad_${i}` }));
          if (addedCount > 0) {
            console.log(`[ScanScreen] Extracted +${addedCount} ads (total: ${total})`);
          }
        }
      }
    } catch (err) {
      console.warn('[ScanScreen] WebView message parse error:', err);
    }
  }, []);

  const startRecording = useCallback((url: string, merchantName: string) => {
    console.log(`[ScanScreen] Starting recording for ${merchantName} at ${url}`);
    setSelectedUrl(url);
    setSelectedMerchant(merchantName);
    screenshotsRef.current = [];
    extractedAdsRef.current = [];
    setCaptureCount(0);
    setTimer(0);
    setPhase('recording');
    startScan();

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    setTimeout(() => {
      captureIntervalRef.current = setInterval(() => {
        captureScreenshot();
      }, CAPTURE_INTERVAL_MS);

      extractIntervalRef.current = setInterval(() => {
        injectExtractionScript();
      }, 3000);
    }, 2000);
  }, [startScan, captureScreenshot, injectExtractionScript]);

  const handleMerchantSelect = useCallback((merchant: typeof MERCHANTS[0]) => {
    startRecording(merchant.url, merchant.name);
  }, [startRecording]);

  const handleCustomUrl = useCallback(() => {
    let url = customUrl.trim();
    if (!url) return;
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    const hostname = url.replace(/^https?:\/\//, '').split('/')[0];
    startRecording(url, hostname);
  }, [customUrl, startRecording]);

  const handleStop = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }

    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
    }
    if (extractIntervalRef.current) {
      clearInterval(extractIntervalRef.current);
      extractIntervalRef.current = null;
    }

    injectExtractionScript();

    setTimeout(() => {
      const frames = [...screenshotsRef.current];
      const ads = [...extractedAdsRef.current];
      console.log(`[ScanScreen] Stopping scan after ${timer}s with ${frames.length} frames and ${ads.length} extracted ads`);
      ads.forEach((ad, i) => {
        console.log(`[ScanScreen]   ad_${i}: "${ad.title}" ${ad.price}€`);
      });

      setPhase('analyzing');
      stopScan(selectedMerchant, '', frames, ads);
    }, 500);
  }, [stopScan, timer, selectedMerchant, injectExtractionScript]);

  const handleViewResults = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleRetry = useCallback(() => {
    setPhase('setup');
    setTimer(0);
    setCaptureCount(0);
    screenshotsRef.current = [];
    progressAnim.setValue(0);
  }, [progressAnim]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

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

      {phase === 'setup' && (
        <View style={[styles.setupView, { paddingTop: insets.top + 12 }]}>
          <View style={styles.setupHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.setupTitle}>Scanner un site</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.setupSubtitle}>
            Choisissez un site, naviguez sur les annonces, et l'IA capture automatiquement votre écran.
          </Text>

          <View style={styles.urlInputRow}>
            <View style={styles.urlInputContainer}>
              <Globe size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.urlInput}
                placeholder="Entrez une URL..."
                placeholderTextColor={Colors.textMuted}
                value={customUrl}
                onChangeText={setCustomUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                onSubmitEditing={handleCustomUrl}
              />
            </View>
            <TouchableOpacity
              style={[styles.goBtn, !customUrl.trim() && styles.goBtnDisabled]}
              onPress={handleCustomUrl}
              disabled={!customUrl.trim()}
            >
              <Search size={18} color={Colors.background} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Sites populaires</Text>

          <ScrollView style={styles.merchantList} showsVerticalScrollIndicator={false}>
            {MERCHANTS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.merchantRow}
                onPress={() => handleMerchantSelect(m)}
                activeOpacity={0.7}
              >
                <View style={[styles.merchantIcon, { backgroundColor: m.color + '20' }]}>
                  <Text style={styles.merchantEmoji}>{m.logo}</Text>
                </View>
                <View style={styles.merchantInfo}>
                  <Text style={styles.merchantName}>{m.name}</Text>
                  <Text style={styles.merchantDesc}>{m.description}</Text>
                </View>
                <ChevronLeft size={18} color={Colors.textMuted} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      )}

      {phase === 'recording' && (
        <View style={styles.recordingContainer}>
          <View
            ref={webViewRef}
            style={styles.webViewContainer}
            collapsable={false}
          >
            {Platform.OS === 'web' ? (
              <View style={styles.webFallback}>
                <Globe size={48} color={Colors.textMuted} />
                <Text style={styles.webFallbackText}>
                  Le scan WebView n'est pas disponible sur le web.{'\n'}Utilisez l'app mobile (Expo Go).
                </Text>
              </View>
            ) : (
              <WebView
                ref={webViewInstanceRef}
                source={{ uri: selectedUrl }}
                style={styles.webView}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
                onMessage={handleWebViewMessage}
                onLoadEnd={() => {
                  setTimeout(() => injectExtractionScript(), 1500);
                }}
                renderLoading={() => (
                  <View style={styles.webViewLoading}>
                    <ActivityIndicator size="large" color={Colors.gold} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                  </View>
                )}
              />
            )}
          </View>

          <View style={[styles.recordingOverlayTop, { top: insets.top }]}>
            <Animated.View style={[styles.recDot, { opacity: pulseAnim }]} />
            <Text style={styles.recLabel}>REC</Text>
            <Text style={styles.recTimer}>{formatTimer(timer)}</Text>
          </View>

          <View style={styles.recordingTimerBar}>
            <View style={[styles.timerBarFill, { width: `${progressPercent}%` as any }]} />
          </View>

          <View style={[styles.recordingOverlayBottom, { bottom: insets.bottom + 12 }]}>
            <Animated.Text style={[styles.tipText, { opacity: tipFadeAnim }]}>
              💡 {SCAN_TIPS[currentTipIndex]}
            </Animated.Text>

            <TouchableOpacity
              style={styles.stopBtn}
              onPress={handleStop}
              activeOpacity={0.8}
            >
              <StopCircle size={24} color="#fff" />
              <Text style={styles.stopBtnText}>Arrêter le scan</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {phase === 'analyzing' && (
        <View style={styles.analyzingView}>
          <View style={styles.analyzingIconContainer}>
            <Animated.View style={[styles.analyzingDot, { opacity: dotAnim }]} />
            <Text style={styles.analyzingEmoji}>🧠</Text>
          </View>

          <Text style={styles.analyzingTitle}>Analyse en cours...</Text>

          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          <View style={styles.stepsContainer}>
            {ANALYSIS_STEPS.map((step, i) => {
              const isDone = i < analysisStep;
              const isActive = i === analysisStep;
              return (
                <View key={i} style={styles.stepRow}>
                  <View style={[
                    styles.stepDotContainer,
                    isDone && styles.stepDotDone,
                    isActive && styles.stepDotActive,
                  ]}>
                    {isDone ? (
                      <CheckCircle size={14} color={Colors.success} />
                    ) : isActive ? (
                      <ActivityIndicator size="small" color={Colors.gold} />
                    ) : (
                      <View style={styles.stepDotEmpty} />
                    )}
                  </View>
                  <Text style={[
                    styles.stepTextBase,
                    isDone && styles.stepTextDone,
                    isActive && styles.stepTextActiveLabel,
                  ]}>
                    {step}
                  </Text>
                </View>
              );
            })}
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
              : 'Essayez de scroller plus lentement sur les annonces.'}
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
          {lastScanResults.length === 0 && (
            <GoldButton
              title="Réessayer"
              onPress={handleRetry}
              variant="outlined"
              style={styles.retryButtonDone}
            />
          )}
        </View>
      )}

      {phase === 'error' && (
        <View style={styles.errorView}>
          <AlertCircle size={64} color={Colors.danger} />
          <Text style={styles.errorTitle}>Erreur d'analyse</Text>
          <Text style={styles.errorSubtitle}>
            {scanError ?? 'Une erreur est survenue. Veuillez réessayer.'}
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
  setupView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700' as const,
  },
  setupSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
    textAlign: 'center',
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  urlInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    gap: 10,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  urlInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
  },
  goBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goBtnDisabled: {
    opacity: 0.4,
  },
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 12,
  },
  merchantList: {
    flex: 1,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    gap: 14,
  },
  merchantIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantEmoji: {
    fontSize: 22,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600' as const,
  },
  merchantDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  recordingContainer: {
    flex: 1,
  },
  webViewContainer: {
    flex: 1,
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  webFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 32,
  },
  webFallbackText: {
    color: Colors.textMuted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  recordingOverlayTop: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    zIndex: 10,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.recording,
  },
  recLabel: {
    color: Colors.recording,
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  recTimer: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700' as const,
    flex: 1,
  },

  recordingTimerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
  },
  timerBarFill: {
    height: '100%',
    backgroundColor: Colors.gold,
  },
  recordingOverlayBottom: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
    gap: 10,
    zIndex: 10,
  },
  tipText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500' as const,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
    textAlign: 'center',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.recording,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  stopBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700' as const,
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
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDotContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
  },
  stepDotActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  stepDotEmpty: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
    opacity: 0.4,
  },
  stepTextBase: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500' as const,
  },
  stepTextDone: {
    color: Colors.success,
  },
  stepTextActiveLabel: {
    color: Colors.gold,
    fontWeight: '600' as const,
  },
  scanDurationNote: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 20,
    textAlign: 'center',
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
  retryButtonDone: {
    width: '100%',
    marginTop: 12,
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
