import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Square, Zap, Shield, Video, CheckCircle } from 'lucide-react-native';
import { captureRef } from 'react-native-view-shot';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePepite } from '@/providers/PepiteProvider';

const SCAN_TIPS = [
  'Scrollez lentement pour de meilleurs résultats',
  'Laissez les images charger à l\'écran',
  'Restez sur les pages avec des prix visibles',
  'Prenez votre temps, l\'IA capture tout',
  'Arrêtez-vous 1 seconde sur les annonces intéressantes',
  'Chaque scroll est analysé par l\'IA',
];

const ANALYSIS_STEPS = [
  'Captures envoyées à Gemini',
  'Analyse des annonces détectées',
  'Évaluation des prix du marché',
  'Calcul des marges de revente',
  'Sélection des meilleures pépites',
];

const SCAN_DURATION_LIMIT = 30;
const MAX_SCREENSHOTS = 10;

// ============================================================================
// 🛡️ SCRIPT 1 : ÉVASION PRE-DOM & FETCH SNIFFER (Injecté AVANT le chargement)
// ============================================================================
const EVASION_AND_SNIFFER_JS = `
(function() {
  try {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    
    const keysToHide = ['__REACT_DEVTOOLS_GLOBAL_HOOK__', 'cdc_adoQpoasnfa76pfcZLmcfl'];
    keysToHide.forEach(key => delete window[key]);

    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      try {
        const clone = response.clone();
        clone.text().then(text => {
          if (text.includes('price') && (text.includes('ad_id') || text.includes('item_id') || text.includes('url'))) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'INTERCEPTED_API_DATA',
                url: args[0],
                payload: text.substring(0, 3500) // Extrait ciblé pour l'IA
              }));
            }
          }
        }).catch(() => {});
      } catch (e) {}
      return response;
    };
  } catch(e) {}
})();
true;
`;

// ============================================================================
// 🛡️ SCRIPT 2 : EXTRACTION FURTIVE (Intersection Observer, injecté APRÈS chargement)
// ============================================================================
const STEALTH_EXTRACT_JS = `
(function() {
  try {
    const initDelay = Math.floor(Math.random() * 1200) + 800;
    setTimeout(() => {
      let pendingItems = [];
      const seenUrls = new Set();
      
      const sendToApp = () => {
        if (pendingItems.length > 0 && window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'STEALTH_DATA',
            url: window.location.href,
            pageTitle: document.title || '',
            items: pendingItems
          }));
          pendingItems = [];
        }
      };
      
      setInterval(sendToApp, 2500);

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            const linkEl = el.tagName === 'A' ? el : el.querySelector('a[href]');
            if (linkEl && linkEl.href) {
              const link = linkEl.href;
              if (link.startsWith('http') && !seenUrls.has(link)) {
                seenUrls.add(link);
                const visibleText = el.innerText ? el.innerText.replace(/\\s+/g, ' ').trim().substring(0, 150) : '';
                pendingItems.push({ link: link, text: visibleText });
              }
            }
          }
        });
      }, { root: null, rootMargin: '100px', threshold: 0.1 });

      const observeVisible = () => {
        const elements = document.querySelectorAll('a[href*="/item/"], a[href*="/annonce/"], [data-testid*="ad"], [class*="aditem"], [class*="card"]');
        elements.forEach(el => observer.observe(el));
      };

      observeVisible();
      const mutationObserver = new MutationObserver(() => requestAnimationFrame(observeVisible));
      mutationObserver.observe(document.body, { childList: true, subtree: true });

    }, initDelay);
  } catch(e) {}
})();
true;
`;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
];

async function fetchPageContentWeb(pageUrl: string): Promise<string> {
  // Gardé tel quel pour la compatibilité web
  return '';
}

let WebViewComponent: React.ComponentType<any> | null = null;
if (Platform.OS !== 'web') {
  try {
    WebViewComponent = require('react-native-webview').default;
  } catch (e) {
    console.log('[Browse] WebView not available');
  }
}

export default function BrowseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { url, name, source } = useLocalSearchParams<{ url: string; name: string; source: string; }>();

  const { startScan, stopScan, isAnalyzing, lastScanResults, scanError, settings } = usePepite();

  const [scanning, setScanning] = useState<boolean>(false);
  const [scanTime, setScanTime] = useState<number>(0);
  const [pageLoaded, setPageLoaded] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [extractedContent, setExtractedContent] = useState<string>('');

  const [currentTipIndex, setCurrentTipIndex] = useState<number>(0);
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const [screenshotCount, setScreenshotCount] = useState<number>(0);

  const tipFadeAnim = useRef(new Animated.Value(1)).current;
  const analysisProgressAnim = useRef(new Animated.Value(0)).current;

  const webViewRef = useRef<any>(null);
  const webViewContainerRef = useRef<View>(null);
  const isCapturingRef = useRef<boolean>(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanBarAnim = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const overlayFade = useRef(new Animated.Value(0)).current;
  const extractedContentRef = useRef<string>('');
  const scanTimeRef = useRef<number>(0);
  const screenshotsRef = useRef<string[]>([]);

  // Horloge du scan
  useEffect(() => {
    if (scanning) {
      const interval = setInterval(() => {
        setScanTime((t) => {
          const next = t + 1;
          scanTimeRef.current = next;
          return next;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [scanning]);

  useEffect(() => {
    if (scanning && scanTime >= SCAN_DURATION_LIMIT) {
      doStopScan();
    }
  }, [scanning, scanTime]);

  // Jitter humain pour les captures d'écran
  useEffect(() => {
    let isMounted = true;
    let captureTimer: NodeJS.Timeout;
    let tipTimer: NodeJS.Timeout;

    if (scanning) {
      captureTimer = setTimeout(() => captureScreenshot(), 1500);

      const captureRandomly = () => {
        if (!isMounted || !scanning) return;
        captureScreenshot();
        const nextDelay = Math.floor(Math.random() * 1500) + 2500; 
        captureTimer = setTimeout(captureRandomly, nextDelay);
      };

      captureTimer = setTimeout(captureRandomly, 4000);

      const rotateTip = () => {
        if (!isMounted || !scanning) return;
        Animated.timing(tipFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          setCurrentTipIndex((prev) => (prev + 1) % SCAN_TIPS.length);
          Animated.timing(tipFadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        });
        tipTimer = setTimeout(rotateTip, 4000);
      };
      tipTimer = setTimeout(rotateTip, 4000);
    }

    return () => {
      isMounted = false;
      clearTimeout(captureTimer);
      clearTimeout(tipTimer);
    };
  }, [scanning]);

  // Animations UI
  useEffect(() => {
    if (scanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();

      Animated.timing(scanBarAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    } else {
      Animated.timing(scanBarAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
  }, [scanning]);

  useEffect(() => {
    if (showResults && isAnalyzing) {
      setAnalysisStep(0);
      analysisProgressAnim.setValue(0);
      Animated.timing(overlayFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();

      Animated.timing(analysisProgressAnim, {
        toValue: 0.9,
        duration: 25000,
        useNativeDriver: false,
      }).start();

      const stepInterval = setInterval(() => {
        setAnalysisStep((prev) => (prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev));
      }, 4000);

      return () => clearInterval(stepInterval);
    }
  }, [showResults, isAnalyzing]);

  useEffect(() => {
    if (showResults && !isAnalyzing && lastScanResults.length > 0) {
      analysisProgressAnim.setValue(1);
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
    }
  }, [isAnalyzing, lastScanResults, showResults]);

  useEffect(() => {
    if (showResults && !isAnalyzing && lastScanResults.length === 0 && !scanError) {
      analysisProgressAnim.setValue(1);
      setAnalysisStep(ANALYSIS_STEPS.length - 1);
    }
  }, [isAnalyzing, lastScanResults, showResults, scanError]);

  useEffect(() => {
    if (showResults && scanError) {
      analysisProgressAnim.setValue(1);
    }
  }, [scanError, showResults]);

  const captureScreenshot = useCallback(async () => {
    if (Platform.OS === 'web' || !webViewContainerRef.current || isCapturingRef.current || screenshotsRef.current.length >= MAX_SCREENSHOTS) return;
    isCapturingRef.current = true;
    try {
      const base64 = await captureRef(webViewContainerRef, { format: 'jpg', quality: 0.5, result: 'base64' });
      if (base64 && base64.length > 500) {
        screenshotsRef.current.push(base64);
        setScreenshotCount(screenshotsRef.current.length);
      }
    } catch (e) {
      console.log('[Browse] Native capture failed');
    } finally {
      isCapturingRef.current = false;
    }
  }, []);

  // Centralisation des données furtives interceptées
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      let newContext = '';

      if (data.type === 'INTERCEPTED_API_DATA') {
        newContext = `\n[Données API interceptées furtivement]:\n${data.payload}\n---\n`;
      } else if (data.type === 'STEALTH_DATA' && data.items) {
        data.items.forEach((item: any) => {
          newContext += `[Vue Écran] URL: ${item.link} | Texte: ${item.text}\n`;
        });
      }

      if (newContext) {
        extractedContentRef.current += newContext;
        // Protection mémoire : on garde les 25000 derniers caractères max
        if (extractedContentRef.current.length > 25000) {
          extractedContentRef.current = extractedContentRef.current.substring(extractedContentRef.current.length - 25000);
        }
        setExtractedContent(extractedContentRef.current);
      }
    } catch (e) {}
  }, []);

  const handleStartScan = useCallback(() => {
    if (!settings.geminiApiKey || settings.geminiApiKey.trim().length === 0) {
      Alert.alert(
        'Clé API requise',
        'Configurez votre clé API Gemini dans Réglages > Clé API pour activer le scan.',
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Configurer', onPress: () => router.push('/settings/api-key' as any) },
        ]
      );
      return;
    }

    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    setScanning(true);
    setScanTime(0);
    scanTimeRef.current = 0;
    setExtractedContent('');
    extractedContentRef.current = `Contexte de Navigation : URL de base = ${url}\n\n`;
    screenshotsRef.current = [];
    setScreenshotCount(0);
    setCurrentTipIndex(0);
    startScan();

    if (Platform.OS !== 'web' && webViewRef.current) {
      try { webViewRef.current.injectJavaScript(STEALTH_EXTRACT_JS); } catch (e) {}
    }
  }, [startScan, name, settings.geminiApiKey, router, url]);

  const doStopScan = useCallback(async () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      captureScreenshot();
    } 

    setTimeout(() => {
      const merchantName = name ?? 'Shopping';
      let content = extractedContentRef.current;
      const screenshots = [...screenshotsRef.current];

      if (content.length < 50 && screenshots.length === 0) {
        content = `URL analysée: ${url ?? 'inconnue'}\nMarchand: ${merchantName}\n\nATTENTION: Sécurité renforcée. Analyse basée uniquement sur l'URL.`;
      }

      setScanning(false);
      setShowResults(true);
      overlayFade.setValue(0);
      stopScan(merchantName, content, screenshots);
    }, 800);
  }, [stopScan, name, url, source]);

  const handleStopScan = useCallback(() => doStopScan(), [doStopScan]);
  const handleViewResults = useCallback(() => router.replace('/'), [router]);
  const handleBack = useCallback(() => scanning ? handleStopScan() : router.back(), [scanning, router, handleStopScan]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const scanBarHeight = scanBarAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] });
  const progressPercent = Math.min((scanTime / SCAN_DURATION_LIMIT) * 100, 100);
  const totalProfit = lastScanResults.reduce((sum, p) => sum + p.profit, 0);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.urlBar}>
          <Shield size={12} color={Colors.success} />
          <Text style={styles.urlText} numberOfLines={1}>{name ?? 'Navigation'}</Text>
        </View>

        {!scanning ? (
          <TouchableOpacity style={styles.scanStartBtn} onPress={handleStartScan} activeOpacity={0.8}>
            <Video size={16} color="#000" />
            <Text style={styles.scanStartText}>SCAN</Text>
          </TouchableOpacity>
        ) : (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity style={styles.scanStopBtn} onPress={handleStopScan} activeOpacity={0.8}>
              <Square size={14} color="#fff" />
              <Text style={styles.scanStopText}>STOP</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      <Animated.View style={[styles.scanIndicatorBar, { height: scanBarHeight }]}>
        {scanning && (
          <View style={styles.scanIndicatorContent}>
            <View style={styles.scanIndicatorLeft}>
              <Animated.View style={[styles.recDotSmall, { opacity: dotOpacity }]} />
              <Text style={styles.scanIndicatorText}>REC · {formatTime(scanTime)}</Text>
            </View>
            <View style={styles.scanMeta}>
              <Animated.Text style={[styles.tipText, { opacity: tipFadeAnim }]} numberOfLines={1}>
                {SCAN_TIPS[currentTipIndex]}
              </Animated.Text>
              <View style={styles.progressMini}>
                <View style={[styles.progressMiniFill, { width: `${progressPercent}%` as any }]} />
              </View>
            </View>
          </View>
        )}
      </Animated.View>

      <View style={styles.webviewContainer}>
        {Platform.OS !== 'web' && WebViewComponent ? (
          <View ref={webViewContainerRef} style={styles.webviewInner} collapsable={false}>
          <WebViewComponent
            ref={webViewRef}
            source={{ uri: url ?? 'https://www.leboncoin.fr' }}
            style={styles.webview}
            userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1"
            applicationNameForUserAgent="Safari/604.1"
            injectedJavaScriptBeforeContentLoaded={EVASION_AND_SNIFFER_JS}
            onLoadEnd={() => setPageLoaded(true)}
            onMessage={handleWebViewMessage}
            startInLoadingState
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={styles.loadingText}>Connexion furtive à {name}...</Text>
              </View>
            )}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
          />
          </View>
        ) : (
          <View style={styles.webFallback}>
            {Platform.OS === 'web' ? (
              <iframe
                src={url ?? 'https://www.leboncoin.fr'}
                style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#fff' } as any}
                onLoad={() => setPageLoaded(true)}
              />
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.gold} />
              </View>
            )}
          </View>
        )}

        {scanning && (
          <View style={styles.scanOverlayEdge} pointerEvents="none">
            <View style={styles.scanEdgeTop} />
            <View style={styles.scanEdgeBottom} />
            <View style={styles.scanEdgeLeft} />
            <View style={styles.scanEdgeRight} />
            <View style={styles.recBadgeOverlay}>
              <View style={styles.recBadge}>
                <View style={styles.recBadgeDot} />
                <Text style={styles.recBadgeText}>REC</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {showResults && (
        <Animated.View style={[styles.resultsOverlay, { opacity: overlayFade }]}>
          <View style={styles.resultsCard}>
            {isAnalyzing ? (
              <View style={styles.analyzingContainer}>
                <Text style={styles.analyzingEmoji}>🧠</Text>
                <Text style={styles.analyzingText}>Analyse en cours...</Text>

                <View style={styles.analysisProgressBar}>
                  <Animated.View
                    style={[
                      styles.analysisProgressFill,
                      {
                        width: analysisProgressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      },
                    ]}
                  />
                </View>

                <View style={styles.analysisSteps}>
                  {ANALYSIS_STEPS.map((step, i) => {
                    const isActive = i === analysisStep;
                    const isDone = i < analysisStep;
                    return (
                      <View key={i} style={styles.analysisStepRow}>
                        <View style={[
                          styles.stepDot,
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
                          styles.stepLabel,
                          isDone && styles.stepLabelDone,
                          isActive && styles.stepLabelActive,
                        ]}>
                          {step}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : scanError ? (
              <View style={styles.resultContent}>
                <Text style={styles.resultEmoji}>⚠️</Text>
                <Text style={styles.resultTitle}>Erreur</Text>
                <Text style={styles.resultSubtext}>{scanError}</Text>
                <TouchableOpacity
                  style={styles.resultActionBtn}
                  onPress={() => { setShowResults(false); overlayFade.setValue(0); }}
                >
                  <Text style={styles.resultActionText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            ) : lastScanResults.length === 0 ? (
              <View style={styles.resultContent}>
                <Text style={styles.resultEmoji}>🔍</Text>
                <Text style={styles.resultTitle}>Aucune pépite</Text>
                <Text style={styles.resultSubtext}>
                  Aucune bonne affaire détectée. Scrollez davantage pour alimenter l'IA.
                </Text>
                <TouchableOpacity
                  style={styles.resultActionBtn}
                  onPress={() => { setShowResults(false); overlayFade.setValue(0); }}
                >
                  <Text style={styles.resultActionText}>Continuer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.resultContent}>
                <Text style={styles.resultEmoji}>💰</Text>
                <Text style={styles.resultTitle}>
                  {lastScanResults.length} pépite{lastScanResults.length > 1 ? 's' : ''} trouvée{lastScanResults.length > 1 ? 's' : ''} !
                </Text>
                <Text style={styles.resultProfit}>
                  +{totalProfit.toLocaleString('fr-FR')}€ de profit potentiel
                </Text>

                <View style={styles.resultsList}>
                  {lastScanResults.slice(0, 3).map((p) => (
                    <View key={p.id} style={styles.resultRow}>
                      <Text style={styles.resultRowTitle} numberOfLines={1}>{p.title}</Text>
                      <Text style={styles.resultRowProfit}>+{p.profit.toLocaleString('fr-FR')}€</Text>
                    </View>
                  ))}
                  {lastScanResults.length > 3 && (
                    <Text style={styles.moreText}>
                      +{lastScanResults.length - 3} autre{lastScanResults.length - 3 > 1 ? 's' : ''}
                    </Text>
                  )}
                </View>

                <TouchableOpacity style={styles.resultActionBtn} onPress={handleViewResults}>
                  <Zap size={16} color="#000" />
                  <Text style={styles.resultActionText}>Voir les résultats</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.continueBtn} onPress={() => { setShowResults(false); overlayFade.setValue(0); }}>
                  <Text style={styles.continueBtnText}>Continuer à naviguer</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#0A0A0A', gap: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.divider },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surfaceLight, alignItems: 'center', justifyContent: 'center' },
  urlBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceLight, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, gap: 6 },
  urlText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500', flex: 1 },
  scanStartBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.gold, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, gap: 5 },
  scanStartText: { color: '#000', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  scanStopBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.recording, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, gap: 5 },
  scanStopText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  scanIndicatorBar: { backgroundColor: 'rgba(255, 59, 48, 0.12)', overflow: 'hidden', borderBottomWidth: 1, borderBottomColor: 'rgba(255, 59, 48, 0.25)' },
  scanIndicatorContent: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 12 },
  scanIndicatorLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDotSmall: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.recording },
  scanIndicatorText: { color: Colors.recording, fontSize: 13, fontWeight: '700' },
  scanMeta: { flex: 1, gap: 6, alignItems: 'flex-end' },
  tipText: { color: Colors.gold, fontSize: 11, fontWeight: '600', textAlign: 'right' },
  progressMini: { width: '100%', height: 3, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' },
  progressMiniFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 2 },
  webviewContainer: { flex: 1, position: 'relative' },
  webview: { flex: 1 },
  webviewInner: { flex: 1 },
  webFallback: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  scanOverlayEdge: { ...StyleSheet.absoluteFillObject },
  scanEdgeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: Colors.recording, opacity: 0.7 },
  scanEdgeBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: Colors.recording, opacity: 0.7 },
  scanEdgeLeft: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, backgroundColor: Colors.recording, opacity: 0.7 },
  scanEdgeRight: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 3, backgroundColor: Colors.recording, opacity: 0.7 },
  recBadgeOverlay: { position: 'absolute', top: 12, right: 12 },
  recBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 59, 48, 0.9)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, gap: 5 },
  recBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  recBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  resultsOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  resultsCard: { width: '100%', maxWidth: 380, backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: Colors.cardBorder, overflow: 'hidden' },
  analyzingContainer: { padding: 28, alignItems: 'center', gap: 8 },
  analyzingEmoji: { fontSize: 40, marginBottom: 4 },
  analyzingText: { color: Colors.text, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  analyzingSubtext: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 12 },
  analysisProgressBar: { width: '100%', height: 5, backgroundColor: Colors.surfaceLight, borderRadius: 3, overflow: 'hidden', marginBottom: 20 },
  analysisProgressFill: { height: '100%', backgroundColor: Colors.gold, borderRadius: 3 },
  analysisSteps: { alignSelf: 'stretch', gap: 14 },
  analysisStepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: 'rgba(0, 200, 83, 0.15)' },
  stepDotActive: { backgroundColor: 'rgba(255, 215, 0, 0.15)' },
  stepDotEmpty: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.textMuted, opacity: 0.4 },
  stepLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  stepLabelDone: { color: Colors.success },
  stepLabelActive: { color: Colors.gold, fontWeight: '600' },
  resultContent: { padding: 28, alignItems: 'center' },
  resultEmoji: { fontSize: 48, marginBottom: 12 },
  resultTitle: { color: Colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  resultProfit: { color: Colors.gold, fontSize: 16, fontWeight: '700', marginBottom: 20 },
  resultSubtext: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  resultsList: { alignSelf: 'stretch', backgroundColor: Colors.surfaceLight, borderRadius: 12, padding: 14, marginBottom: 20, gap: 10 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultRowTitle: { color: Colors.text, fontSize: 13, fontWeight: '500', flex: 1, marginRight: 10 },
  resultRowProfit: { color: Colors.gold, fontSize: 15, fontWeight: '800' },
  moreText: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2 },
  resultActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.gold, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, gap: 8, alignSelf: 'stretch' },
  resultActionText: { color: '#000', fontSize: 15, fontWeight: '700' },
  continueBtn: { marginTop: 12, paddingVertical: 12 },
  continueBtnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
});