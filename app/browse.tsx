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
import { ArrowLeft, Scan, Square, Zap, Shield, Video } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePepite } from '@/providers/PepiteProvider';

const SCAN_DURATION_LIMIT = 30;
const SCREENSHOT_INTERVAL = 4000;
const MAX_SCREENSHOTS = 8;

const INIT_HTML2CANVAS_JS = `
(function() {
  if (window._h2cLoaded) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'h2c_ready' }));
    return;
  }
  if (window._h2cLoading) return;
  window._h2cLoading = true;
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  s.onload = function() {
    window._h2cLoaded = true;
    window._h2cLoading = false;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'h2c_ready' }));
  };
  s.onerror = function() {
    window._h2cLoading = false;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'h2c_error', error: 'Failed to load html2canvas' }));
  };
  document.head.appendChild(s);
})();
true;
`;

const CAPTURE_SCREENSHOT_JS = `
(function() {
  if (!window.html2canvas) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'screenshot_error', error: 'html2canvas not loaded' }));
    return;
  }
  try {
    html2canvas(document.body, {
      width: window.innerWidth,
      height: window.innerHeight,
      x: 0,
      y: window.scrollY,
      scale: 0.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      imageTimeout: 3000
    }).then(function(canvas) {
      var dataUrl = canvas.toDataURL('image/jpeg', 0.4);
      var base64 = dataUrl.split(',')[1] || '';
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'screenshot', data: base64, size: base64.length }));
    }).catch(function(err) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'screenshot_error', error: err.message }));
    });
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'screenshot_error', error: e.message }));
  }
})();
true;
`;

const CONTENT_EXTRACT_JS = `
(function() {
  try {
    var items = [];
    var cards = document.querySelectorAll('[data-qa-id="aditem_container"], .oa-card, article, [class*="card"], [class*="item"], [class*="product"], [class*="listing"], [class*="annonce"]');
    if (cards.length === 0) {
      cards = document.querySelectorAll('a[href*="annonce"], a[href*="item"], a[href*="product"], li');
    }
    var maxItems = Math.min(cards.length, 20);
    for (var i = 0; i < maxItems; i++) {
      var card = cards[i];
      var title = '';
      var price = '';
      var link = '';
      var img = '';
      var titleEl = card.querySelector('h2, h3, [class*="title"], [class*="Title"], [data-qa-id="aditem_title"]');
      if (titleEl) title = titleEl.innerText.trim();
      var priceEl = card.querySelector('[class*="price"], [class*="Price"], [data-qa-id="aditem_price"], span[class*="\\u20ac"]');
      if (priceEl) price = priceEl.innerText.trim();
      var linkEl = card.tagName === 'A' ? card : card.querySelector('a');
      if (linkEl) link = linkEl.href || '';
      var imgEl = card.querySelector('img');
      if (imgEl) img = imgEl.src || imgEl.dataset.src || '';
      if (title || price) {
        items.push({ title: title, price: price, link: link, image: img });
      }
    }
    var pageTitle = document.title || '';
    var metaDesc = '';
    var metaEl = document.querySelector('meta[name="description"]');
    if (metaEl) metaDesc = metaEl.getAttribute('content') || '';
    var result = {
      type: 'content',
      url: window.location.href,
      pageTitle: pageTitle,
      metaDescription: metaDesc,
      items: items,
      bodyText: document.body ? document.body.innerText.substring(0, 5000) : ''
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(result));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'content', error: e.message, url: window.location.href, items: [], bodyText: '', pageTitle: document.title || '' }));
  }
})();
true;
`;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  const { url, name, source } = useLocalSearchParams<{
    url: string;
    name: string;
    source: string;
  }>();

  const { startScan, stopScan, isAnalyzing, lastScanResults, scanError, settings } = usePepite();

  const [scanning, setScanning] = useState<boolean>(false);
  const [scanTime, setScanTime] = useState<number>(0);
  const [pageLoaded, setPageLoaded] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [extractedContent, setExtractedContent] = useState<string>('');
  const [h2cReady, setH2cReady] = useState<boolean>(false);
  const [frameCount, setFrameCount] = useState<number>(0);

  const webViewRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanBarAnim = useRef(new Animated.Value(0)).current;
  const dotOpacity = useRef(new Animated.Value(1)).current;
  const overlayFade = useRef(new Animated.Value(0)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);
  const dotRef = useRef<Animated.CompositeAnimation | null>(null);
  const extractedContentRef = useRef<string>('');
  const scanTimeRef = useRef<number>(0);
  const screenshotsRef = useRef<string[]>([]);

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
      console.log(`[Browse] Auto-stop: ${SCAN_DURATION_LIMIT}s reached`);
      doStopScan();
    }
  }, [scanning, scanTime]);

  useEffect(() => {
    if (scanning) {
      captureScreenshot();

      const captureInterval = setInterval(() => {
        captureScreenshot();
      }, SCREENSHOT_INTERVAL);

      const contentInterval = setInterval(() => {
        extractPageContent();
      }, 8000);

      return () => {
        clearInterval(captureInterval);
        clearInterval(contentInterval);
      };
    }
  }, [scanning]);

  useEffect(() => {
    if (scanning) {
      const p = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      p.start();
      pulseRef.current = p;

      const d = Animated.loop(
        Animated.sequence([
          Animated.timing(dotOpacity, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(dotOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      d.start();
      dotRef.current = d;

      Animated.timing(scanBarAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();

      return () => {
        p.stop();
        d.stop();
      };
    } else {
      Animated.timing(scanBarAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }
  }, [scanning]);

  useEffect(() => {
    if (showResults && !isAnalyzing && lastScanResults.length > 0) {
      console.log(`[Browse] Analysis complete: ${lastScanResults.length} pepites found`);
      Animated.timing(overlayFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [isAnalyzing, lastScanResults, showResults]);

  useEffect(() => {
    if (showResults && scanError) {
      console.log('[Browse] Scan error:', scanError);
      Animated.timing(overlayFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [scanError, showResults]);

  const initHtml2Canvas = useCallback(() => {
    if (Platform.OS !== 'web' && webViewRef.current) {
      try {
        webViewRef.current.injectJavaScript(INIT_HTML2CANVAS_JS);
        console.log('[Browse] Injected html2canvas init script');
      } catch (e) {
        console.log('[Browse] Failed to inject html2canvas:', e);
      }
    }
  }, []);

  const captureScreenshot = useCallback(() => {
    if (Platform.OS !== 'web' && webViewRef.current && screenshotsRef.current.length < MAX_SCREENSHOTS) {
      try {
        webViewRef.current.injectJavaScript(CAPTURE_SCREENSHOT_JS);
        console.log(`[Browse] Capturing frame ${screenshotsRef.current.length + 1}/${MAX_SCREENSHOTS}`);
      } catch (e) {
        console.log('[Browse] Failed to capture screenshot:', e);
      }
    }
  }, []);

  const extractPageContent = useCallback(() => {
    if (Platform.OS !== 'web' && webViewRef.current) {
      try {
        webViewRef.current.injectJavaScript(CONTENT_EXTRACT_JS);
        console.log('[Browse] Injected content extraction JS');
      } catch (e) {
        console.log('[Browse] Failed to inject JS:', e);
      }
    }
  }, []);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'h2c_ready') {
        console.log('[Browse] html2canvas loaded and ready');
        setH2cReady(true);
        return;
      }

      if (data.type === 'h2c_error') {
        console.log('[Browse] html2canvas load error:', data.error);
        return;
      }

      if (data.type === 'screenshot') {
        if (data.data && data.data.length > 100 && screenshotsRef.current.length < MAX_SCREENSHOTS) {
          screenshotsRef.current.push(data.data);
          setFrameCount(screenshotsRef.current.length);
          console.log(`[Browse] Screenshot captured: frame ${screenshotsRef.current.length}, ${Math.round(data.size / 1024)}KB`);
        }
        return;
      }

      if (data.type === 'screenshot_error') {
        console.log('[Browse] Screenshot capture error:', data.error);
        return;
      }

      if (data.type === 'content' || data.items) {
        console.log(`[Browse] Extracted: ${data.items?.length ?? 0} items from ${data.pageTitle}`);

        let content = `Page: ${data.pageTitle}\nURL: ${data.url}\n`;
        if (data.metaDescription) {
          content += `Description: ${data.metaDescription}\n`;
        }
        content += '\nAnnonces trouvées:\n';

        if (data.items && data.items.length > 0) {
          data.items.forEach((item: any, i: number) => {
            content += `\n--- Annonce ${i + 1} ---\n`;
            if (item.title) content += `Titre: ${item.title}\n`;
            if (item.price) content += `Prix: ${item.price}\n`;
            if (item.link) content += `Lien: ${item.link}\n`;
            if (item.image) content += `Image: ${item.image}\n`;
          });
        }

        if (data.bodyText) {
          content += `\nContenu de la page:\n${data.bodyText.substring(0, 3000)}`;
        }

        extractedContentRef.current = content;
        setExtractedContent(content);
        console.log(`[Browse] Content extracted: ${content.length} chars`);
      }
    } catch (e) {
      console.log('[Browse] Failed to parse WebView message:', e);
    }
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

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    console.log(`[Browse] Starting VIDEO scan on ${name}`);
    setScanning(true);
    setScanTime(0);
    scanTimeRef.current = 0;
    setExtractedContent('');
    extractedContentRef.current = '';
    screenshotsRef.current = [];
    setFrameCount(0);
    startScan();

    initHtml2Canvas();
    setTimeout(() => extractPageContent(), 2000);
  }, [startScan, name, settings.geminiApiKey, extractPageContent, initHtml2Canvas, router]);

  const doStopScan = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 100);
    }

    captureScreenshot();
    extractPageContent();

    setTimeout(() => {
      const merchantName = name ?? 'Shopping';
      const content = extractedContentRef.current;
      const screenshots = [...screenshotsRef.current];

      console.log(`[Browse] Stopping VIDEO scan after ${scanTimeRef.current}s`);
      console.log(`[Browse] Captured ${screenshots.length} frames`);
      console.log(`[Browse] Extracted ${content.length} chars of text`);
      console.log(`[Browse] Total screenshot data: ${Math.round(screenshots.reduce((s, f) => s + f.length, 0) / 1024)}KB`);

      setScanning(false);
      setShowResults(true);
      overlayFade.setValue(0);
      stopScan(merchantName, content, screenshots);
    }, 800);
  }, [stopScan, name, extractPageContent, captureScreenshot]);

  const handleStopScan = useCallback(() => {
    doStopScan();
  }, [doStopScan]);

  const handleViewResults = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handleBack = useCallback(() => {
    if (scanning) {
      handleStopScan();
    } else {
      router.back();
    }
  }, [scanning, router, handleStopScan]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const scanBarHeight = scanBarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  const progressPercent = Math.min((scanTime / SCAN_DURATION_LIMIT) * 100, 100);
  const totalProfit = lastScanResults.reduce((sum, p) => sum + p.profit, 0);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={20} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.urlBar}>
          <Shield size={12} color={Colors.success} />
          <Text style={styles.urlText} numberOfLines={1}>
            {name ?? 'Navigation'}
          </Text>
        </View>

        {!scanning ? (
          <TouchableOpacity
            style={styles.scanStartBtn}
            onPress={handleStartScan}
            activeOpacity={0.8}
            testID="start-scan-btn"
          >
            <Video size={16} color="#000" />
            <Text style={styles.scanStartText}>SCAN</Text>
          </TouchableOpacity>
        ) : (
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.scanStopBtn}
              onPress={handleStopScan}
              activeOpacity={0.8}
              testID="stop-scan-btn"
            >
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
              <Text style={styles.scanIndicatorText}>
                REC · {formatTime(scanTime)}
              </Text>
            </View>
            <View style={styles.scanMeta}>
              <View style={styles.frameBadge}>
                <Video size={10} color={Colors.gold} />
                <Text style={styles.frameCountText}>{frameCount} frames</Text>
              </View>
              <View style={styles.progressMini}>
                <View style={[styles.progressMiniFill, { width: `${progressPercent}%` as any }]} />
              </View>
            </View>
          </View>
        )}
      </Animated.View>

      <View style={styles.webviewContainer}>
        {Platform.OS !== 'web' && WebViewComponent ? (
          <WebViewComponent
            ref={webViewRef}
            source={{ uri: url ?? 'https://www.leboncoin.fr' }}
            style={styles.webview}
            onLoadEnd={() => {
              console.log('[Browse] Page loaded');
              setPageLoaded(true);
              initHtml2Canvas();
            }}
            onMessage={handleWebViewMessage}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={styles.loadingText}>Chargement de {name}...</Text>
              </View>
            )}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
          />
        ) : (
          <View style={styles.webFallback}>
            {Platform.OS === 'web' ? (
              <iframe
                src={url ?? 'https://www.leboncoin.fr'}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  backgroundColor: '#fff',
                } as any}
                onLoad={() => setPageLoaded(true)}
              />
            ) : (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={styles.loadingText}>Chargement...</Text>
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
                <ActivityIndicator size="large" color={Colors.gold} />
                <Text style={styles.analyzingText}>Analyse vidéo Gemini...</Text>
                <Text style={styles.analyzingSubtext}>
                  L'expert IA analyse {screenshotsRef.current.length} captures d'écran
                </Text>
                <View style={styles.analyzeStats}>
                  <View style={styles.analyzeStat}>
                    <Text style={styles.analyzeStatValue}>{screenshotsRef.current.length}</Text>
                    <Text style={styles.analyzeStatLabel}>Frames</Text>
                  </View>
                  <View style={styles.analyzeStatDivider} />
                  <View style={styles.analyzeStat}>
                    <Text style={styles.analyzeStatValue}>{formatTime(scanTimeRef.current)}</Text>
                    <Text style={styles.analyzeStatLabel}>Durée</Text>
                  </View>
                  <View style={styles.analyzeStatDivider} />
                  <View style={styles.analyzeStat}>
                    <Text style={styles.analyzeStatValue}>{Math.round(screenshotsRef.current.reduce((s, f) => s + f.length, 0) / 1024)}K</Text>
                    <Text style={styles.analyzeStatLabel}>Données</Text>
                  </View>
                </View>
              </View>
            ) : scanError ? (
              <View style={styles.resultContent}>
                <Text style={styles.resultEmoji}>⚠️</Text>
                <Text style={styles.resultTitle}>Erreur</Text>
                <Text style={styles.resultSubtext}>{scanError}</Text>
                <TouchableOpacity
                  style={styles.resultActionBtn}
                  onPress={() => {
                    setShowResults(false);
                    overlayFade.setValue(0);
                  }}
                >
                  <Text style={styles.resultActionText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            ) : lastScanResults.length === 0 ? (
              <View style={styles.resultContent}>
                <Text style={styles.resultEmoji}>🔍</Text>
                <Text style={styles.resultTitle}>Aucune pépite</Text>
                <Text style={styles.resultSubtext}>
                  Aucune bonne affaire détectée cette fois. Essayez de naviguer vers plus d'annonces.
                </Text>
                <TouchableOpacity
                  style={styles.resultActionBtn}
                  onPress={() => {
                    setShowResults(false);
                    overlayFade.setValue(0);
                  }}
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

                <TouchableOpacity
                  style={styles.resultActionBtn}
                  onPress={handleViewResults}
                  testID="view-results-btn"
                >
                  <Zap size={16} color="#000" />
                  <Text style={styles.resultActionText}>Voir les résultats</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={() => {
                    setShowResults(false);
                    overlayFade.setValue(0);
                  }}
                >
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
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#0A0A0A',
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.divider,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  urlBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 6,
  },
  urlText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
  },
  scanStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  scanStartText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  scanStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.recording,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  scanStopText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800' as const,
    letterSpacing: 0.5,
  },
  scanIndicatorBar: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 59, 48, 0.25)',
  },
  scanIndicatorContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 12,
  },
  scanIndicatorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.recording,
  },
  scanIndicatorText: {
    color: Colors.recording,
    fontSize: 13,
    fontWeight: '700' as const,
  },
  scanMeta: {
    flex: 1,
    gap: 6,
    alignItems: 'flex-end',
  },
  frameBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,215,0,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  frameCountText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '700' as const,
  },
  progressMini: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressMiniFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  webviewContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
  },
  webFallback: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  scanOverlayEdge: {
    ...StyleSheet.absoluteFillObject,
  },
  scanEdgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.recording,
    opacity: 0.7,
  },
  scanEdgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.recording,
    opacity: 0.7,
  },
  scanEdgeLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.recording,
    opacity: 0.7,
  },
  scanEdgeRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 3,
    backgroundColor: Colors.recording,
    opacity: 0.7,
  },
  recBadgeOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  recBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  recBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  recBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800' as const,
    letterSpacing: 1,
  },
  resultsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  resultsCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
  },
  analyzingContainer: {
    padding: 32,
    alignItems: 'center',
    gap: 10,
  },
  analyzingText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 8,
  },
  analyzingSubtext: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  analyzeStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  analyzeStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  analyzeStatValue: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '800' as const,
  },
  analyzeStatLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '500' as const,
  },
  analyzeStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.divider,
  },
  resultContent: {
    padding: 28,
    alignItems: 'center',
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  resultTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginBottom: 6,
  },
  resultProfit: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 20,
  },
  resultSubtext: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  resultsList: {
    alignSelf: 'stretch',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultRowTitle: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500' as const,
    flex: 1,
    marginRight: 10,
  },
  resultRowProfit: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: '800' as const,
  },
  moreText: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  resultActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.gold,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
    alignSelf: 'stretch',
  },
  resultActionText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700' as const,
  },
  continueBtn: {
    marginTop: 12,
    paddingVertical: 12,
  },
  continueBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
});
