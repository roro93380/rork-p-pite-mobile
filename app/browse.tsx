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
import { ArrowLeft, Scan, Square, Zap, Shield, Video, CheckCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { usePepite } from '@/providers/PepiteProvider';

const SCAN_TIPS = [
  'Scrollez lentement pour de meilleurs r\u00e9sultats',
  'Passez bien sur chaque annonce',
  'Restez sur les pages avec des prix visibles',
  'Prenez votre temps, l\'IA capture tout',
  'Concentrez-vous sur les bonnes cat\u00e9gories',
  'Chaque scroll est analys\u00e9 par l\'IA',
  'L\'IA d\u00e9tecte les marges d\u00e8s 8%',
];

const ANALYSIS_STEPS = [
  'Captures envoy\u00e9es \u00e0 Gemini',
  'Analyse des annonces d\u00e9tect\u00e9es',
  '\u00c9valuation des prix du march\u00e9',
  'Calcul des marges de revente',
  'S\u00e9lection des meilleures p\u00e9pites',
];

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
    var selectors = [
      '[data-qa-id="aditem_container"]',
      '[data-testid*="ad"]',
      '[class*="AdCard"]',
      '[class*="aditem"]',
      '.oa-card',
      'article',
      '[class*="ItemBox"]',
      '[class*="item-card"]',
      '[class*="product-card"]',
      '[class*="ProductCard"]',
      '[class*="listing-card"]',
      '[class*="feed-grid"] > div',
      '[class*="catalog"] [class*="item"]',
      '[class*="search-result"]',
      '[class*="annonce"]',
      '[class*="Card"][class*="item"]',
      'a[href*="/item/"]',
      'a[href*="/annonce/"]',
      'a[href*="/product/"]',
      'a[href*="/offres/"]'
    ];
    var cards = document.querySelectorAll(selectors.join(', '));
    if (cards.length === 0) {
      cards = document.querySelectorAll('[class*="card"], [class*="item"], [class*="product"]');
    }
    if (cards.length === 0) {
      cards = document.querySelectorAll('li a[href]');
    }
    var seen = {};
    var maxItems = Math.min(cards.length, 30);
    for (var i = 0; i < maxItems; i++) {
      var card = cards[i];
      var title = '';
      var price = '';
      var link = '';
      var img = '';
      var titleEls = card.querySelectorAll('h2, h3, h4, [class*="title"], [class*="Title"], [class*="name"], [class*="Name"], [data-qa-id="aditem_title"], [data-testid*="title"], p[class*="text"]');
      for (var t = 0; t < titleEls.length; t++) {
        var txt = titleEls[t].innerText.trim();
        if (txt.length > 3 && txt.length < 200) { title = txt; break; }
      }
      var priceEls = card.querySelectorAll('[class*="price"], [class*="Price"], [class*="cost"], [data-qa-id="aditem_price"], [data-testid*="price"]');
      for (var p = 0; p < priceEls.length; p++) {
        var ptxt = priceEls[p].innerText.trim();
        if (ptxt.match(/\\d/) && ptxt.length < 30) { price = ptxt; break; }
      }
      if (!price) {
        var allSpans = card.querySelectorAll('span, p, div');
        for (var s = 0; s < allSpans.length; s++) {
          var stxt = allSpans[s].innerText.trim();
          if (stxt.match(/\\d+.*\u20ac/) || stxt.match(/\u20ac.*\\d+/)) { price = stxt; break; }
        }
      }
      var linkEl = card.tagName === 'A' ? card : card.querySelector('a[href]');
      if (linkEl && linkEl.href) link = linkEl.href;
      var imgEl = card.querySelector('img[src]');
      if (imgEl) img = imgEl.src || imgEl.dataset.src || imgEl.dataset.lazySrc || '';
      if (!img) {
        var bgEl = card.querySelector('[style*="background-image"]');
        if (bgEl) {
          var bgMatch = bgEl.style.backgroundImage.match(/url\\(["']?([^"')]+)["']?\\)/);
          if (bgMatch) img = bgMatch[1];
        }
      }
      var key = title + price;
      if ((title || price) && !seen[key]) {
        seen[key] = true;
        items.push({ title: title, price: price, link: link, image: img });
      }
    }
    var pageTitle = document.title || '';
    var metaDesc = '';
    var metaEl = document.querySelector('meta[name="description"]');
    if (metaEl) metaDesc = metaEl.getAttribute('content') || '';
    var bodyText = document.body ? document.body.innerText : '';
    bodyText = bodyText.replace(/\\s+/g, ' ').substring(0, 8000);
    var result = {
      type: 'content',
      url: window.location.href,
      pageTitle: pageTitle,
      metaDescription: metaDesc,
      items: items,
      bodyText: bodyText
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(result));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'content', error: e.message, url: window.location.href, items: [], bodyText: document.body ? document.body.innerText.substring(0, 8000) : '', pageTitle: document.title || '' }));
  }
})();
true;
`;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
];

async function fetchPageContentWeb(pageUrl: string): Promise<string> {
  console.log('[Browse] Fetching page content for web:', pageUrl);
  
  for (const proxy of CORS_PROXIES) {
    try {
      const fetchUrl = proxy + encodeURIComponent(pageUrl);
      console.log(`[Browse] Trying proxy: ${proxy.substring(0, 40)}...`);
      const response = await fetch(fetchUrl, { 
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) {
        console.log(`[Browse] Proxy returned ${response.status}`);
        continue;
      }
      
      const html = await response.text();
      if (!html || html.length < 100) {
        console.log(`[Browse] Proxy returned too short response: ${html?.length ?? 0} chars`);
        continue;
      }
      
      console.log(`[Browse] Web fetch SUCCESS via proxy, ${html.length} chars`);
      const content = parseHtmlToContent(html, pageUrl);
      console.log(`[Browse] Parsed content: ${content.length} chars`);
      return content;
    } catch (e: any) {
      console.log(`[Browse] Proxy failed: ${e?.message ?? e}`);
    }
  }

  try {
    console.log('[Browse] Trying direct fetch...');
    const response = await fetch(pageUrl, { 
      signal: AbortSignal.timeout(8000),
      mode: 'cors',
    });
    if (response.ok) {
      const html = await response.text();
      if (html && html.length > 100) {
        console.log(`[Browse] Direct fetch success, ${html.length} chars`);
        return parseHtmlToContent(html, pageUrl);
      }
    } else {
      console.log(`[Browse] Direct fetch returned ${response.status}`);
    }
  } catch (e: any) {
    console.log(`[Browse] Direct fetch failed: ${e?.message ?? e}`);
  }

  try {
    console.log('[Browse] Trying no-cors fetch...');
    const response = await fetch(pageUrl, { 
      signal: AbortSignal.timeout(8000),
      mode: 'no-cors',
    });
    const html = await response.text();
    if (html && html.length > 100) {
      console.log(`[Browse] No-cors fetch got ${html.length} chars`);
      return parseHtmlToContent(html, pageUrl);
    }
  } catch (e: any) {
    console.log(`[Browse] No-cors fetch failed: ${e?.message ?? e}`);
  }

  console.log('[Browse] ALL fetch methods failed for', pageUrl);
  return '';
}

function parseHtmlToContent(html: string, pageUrl: string): string {
  let content = `URL: ${pageUrl}\n`;
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    content += `Page: ${titleMatch[1].trim()}\n`;
  }
  
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (metaMatch) {
    content += `Description: ${metaMatch[1].trim()}\n`;
  }
  
  content += '\nContenu extrait:\n';
  
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&amp;/g, '&')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const pricePattern = /\d+[.,]?\d*\s*€|€\s*\d+[.,]?\d*/g;
  const prices = text.match(pricePattern);
  if (prices && prices.length > 0) {
    content += `\nPrix détectés: ${prices.slice(0, 30).join(', ')}\n`;
  }

  const imgMatches: string[] = [];
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*/gi;
  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null && imgMatches.length < 15) {
    const src = imgMatch[1];
    if (src && !src.includes('data:') && !src.includes('pixel') && !src.includes('tracking') && src.length > 20) {
      imgMatches.push(src);
    }
  }
  if (imgMatches.length > 0) {
    content += `\nImages produits: ${imgMatches.join('\n')}\n`;
  }
  
  const linkMatches: string[] = [];
  const linkRegex = /<a[^>]*href=["']([^"']*(?:annonce|item|product|listing|offre)[^"']*)["'][^>]*/gi;
  let linkMatch;
  while ((linkMatch = linkRegex.exec(html)) !== null && linkMatches.length < 20) {
    linkMatches.push(linkMatch[1]);
  }
  if (linkMatches.length > 0) {
    content += `\nLiens annonces: ${linkMatches.join('\n')}\n`;
  }
  
  content += `\nTexte de la page:\n${text.substring(0, 8000)}`;
  
  console.log(`[Browse] Parsed content: ${content.length} chars, ${prices?.length ?? 0} prices, ${imgMatches.length} images, ${linkMatches.length} links`);
  return content;
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
  const [currentTipIndex, setCurrentTipIndex] = useState<number>(0);
  const [analysisStep, setAnalysisStep] = useState<number>(0);
  const tipFadeAnim = useRef(new Animated.Value(1)).current;
  const analysisProgressAnim = useRef(new Animated.Value(0)).current;

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

      const tipInterval = setInterval(() => {
        Animated.timing(tipFadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
          setCurrentTipIndex((prev) => (prev + 1) % SCAN_TIPS.length);
          Animated.timing(tipFadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        });
      }, 4000);

      return () => {
        clearInterval(captureInterval);
        clearInterval(contentInterval);
        clearInterval(tipInterval);
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
        setAnalysisStep((prev) => {
          if (prev < ANALYSIS_STEPS.length - 1) return prev + 1;
          return prev;
        });
      }, 4000);

      return () => clearInterval(stepInterval);
    }
  }, [showResults, isAnalyzing]);

  useEffect(() => {
    if (showResults && !isAnalyzing && lastScanResults.length > 0) {
      console.log(`[Browse] Analysis complete: ${lastScanResults.length} pepites found`);
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
      console.log('[Browse] Scan error:', scanError);
      analysisProgressAnim.setValue(1);
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

  const fetchWebContent = useCallback(async () => {
    if (Platform.OS === 'web' && url) {
      console.log('[Browse] === Web platform: fetching page content via proxy ===');
      console.log('[Browse] URL:', url);
      try {
        const content = await fetchPageContentWeb(url);
        if (content && content.length > 50) {
          extractedContentRef.current = content;
          setExtractedContent(content);
          console.log(`[Browse] ✅ Web content fetched: ${content.length} chars`);
          console.log(`[Browse] Content preview: ${content.substring(0, 200)}`);
        } else {
          console.log('[Browse] ⚠️ Web content fetch returned insufficient data:', content?.length ?? 0, 'chars');
        }
      } catch (e: any) {
        console.log('[Browse] ❌ Web content fetch error:', e?.message ?? e);
      }
    }
  }, [url]);

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
    setCurrentTipIndex(0);
    startScan();

    if (Platform.OS === 'web') {
      console.log('[Browse] Web: starting content fetch loop');
      fetchWebContent();
      const webFetchInterval = setInterval(() => {
        console.log('[Browse] Web: refetching content...');
        fetchWebContent();
      }, 8000);
      setTimeout(() => clearInterval(webFetchInterval), 35000);
    } else {
      initHtml2Canvas();
      setTimeout(() => extractPageContent(), 2000);
    }
  }, [startScan, name, settings.geminiApiKey, extractPageContent, initHtml2Canvas, router, fetchWebContent]);

  const doStopScan = useCallback(async () => {
    console.log('[Browse] === doStopScan called ===');
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }, 100);
      captureScreenshot();
      extractPageContent();
    } else {
      console.log('[Browse] Web: doing final content fetch before stop...');
      await fetchWebContent();
    }

    setTimeout(() => {
      const merchantName = name ?? 'Shopping';
      let content = extractedContentRef.current;
      const screenshots = [...screenshotsRef.current];

      console.log('[Browse] ============ SCAN STOP SUMMARY ============');
      console.log(`[Browse] Merchant: ${merchantName}`);
      console.log(`[Browse] Platform: ${Platform.OS}`);
      console.log(`[Browse] Scan duration: ${scanTimeRef.current}s`);
      console.log(`[Browse] Screenshots captured: ${screenshots.length}`);
      console.log(`[Browse] Text content length: ${content.length} chars`);
      if (screenshots.length > 0) {
        console.log(`[Browse] Total screenshot data: ${Math.round(screenshots.reduce((s, f) => s + f.length, 0) / 1024)}KB`);
      }
      if (content.length > 0) {
        console.log(`[Browse] Content preview: ${content.substring(0, 300)}`);
      }

      if (content.length === 0 && screenshots.length === 0) {
        console.warn('[Browse] ⚠️ WARNING: No content and no screenshots captured!');
        console.log('[Browse] Building fallback context from URL and merchant info...');
        content = `URL analysée: ${url ?? 'inconnue'}\nMarchand: ${merchantName}\nPlateforme: ${source ?? 'inconnue'}\n\nATTENTION: Le contenu de la page n'a pas pu être extrait (restrictions cross-origin). L'analyse est basée uniquement sur l'URL fournie. Si tu ne peux pas analyser le contenu réel, retourne {"pepites": []}.`;
        extractedContentRef.current = content;
        console.log('[Browse] Fallback content created:', content.length, 'chars');
      }

      console.log('[Browse] ============ SENDING TO GEMINI ============');
      console.log(`[Browse] Mode: ${screenshots.length > 0 ? 'VIDEO (' + screenshots.length + ' frames)' : 'TEXT-ONLY'}`);
      
      setScanning(false);
      setShowResults(true);
      overlayFade.setValue(0);
      stopScan(merchantName, content, screenshots);
    }, 800);
  }, [stopScan, name, url, source, extractPageContent, captureScreenshot, fetchWebContent]);

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

                <Text style={styles.analyzingSubtext}>
                  Gemini analyse {screenshotsRef.current.length} captures · {formatTime(scanTimeRef.current)} de scan
                </Text>
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
  tipText: {
    color: Colors.gold,
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'right',
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
    padding: 28,
    alignItems: 'center',
    gap: 8,
  },
  analyzingEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  analyzingText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
    marginBottom: 12,
  },
  analyzingSubtext: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  analysisProgressBar: {
    width: '100%',
    height: 5,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  analysisProgressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 3,
  },
  analysisSteps: {
    alignSelf: 'stretch',
    gap: 14,
  },
  analysisStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
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
  stepLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  stepLabelDone: {
    color: Colors.success,
  },
  stepLabelActive: {
    color: Colors.gold,
    fontWeight: '600' as const,
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
