import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Pepite, AppSettings, ScanSession } from '@/types';
import { MOCK_PEPITES } from '@/mocks/pepites';
import { analyzeWithGemini, analyzeWithGeminiVideo, generateFallbackPepites } from '@/services/scanService';
import { setupNotifications, sendPepiteFoundNotification } from '@/services/notificationService';

const STORAGE_KEYS = {
  PEPITES: 'pepite_items',
  SETTINGS: 'pepite_settings',
  ONBOARDING: 'pepite_onboarding_done',
  SCAN_SESSIONS: 'pepite_scan_sessions',
} as const;

const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: '',
  notificationsEnabled: true,
  hasCompletedOnboarding: false,
};

export const [PepiteProvider, usePepite] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [pepites, setPepites] = useState<Pepite[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanTimer, setScanTimer] = useState<number>(0);
  const [lastScanResults, setLastScanResults] = useState<Pepite[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSessions, setScanSessions] = useState<ScanSession[]>([]);

  useEffect(() => {
    setupNotifications().then((granted) => {
      console.log('[PepiteProvider] Notifications setup:', granted ? 'granted' : 'denied');
    });
  }, []);

  const pepitesQuery = useQuery({
    queryKey: ['pepites'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PEPITES);
      if (stored) {
        return JSON.parse(stored) as Pepite[];
      }
      await AsyncStorage.setItem(STORAGE_KEYS.PEPITES, JSON.stringify(MOCK_PEPITES));
      return MOCK_PEPITES;
    },
  });

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) {
        return JSON.parse(stored) as AppSettings;
      }
      return DEFAULT_SETTINGS;
    },
  });

  const scanSessionsQuery = useQuery({
    queryKey: ['scan_sessions'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.SCAN_SESSIONS);
      if (stored) {
        return JSON.parse(stored) as ScanSession[];
      }
      return [];
    },
  });

  useEffect(() => {
    if (scanSessionsQuery.data) {
      setScanSessions(scanSessionsQuery.data);
    }
  }, [scanSessionsQuery.data]);

  useEffect(() => {
    if (pepitesQuery.data) {
      setPepites(pepitesQuery.data);
    }
  }, [pepitesQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data);
    }
  }, [settingsQuery.data]);

  const savePepitesMutation = useMutation({
    mutationFn: async (items: Pepite[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.PEPITES, JSON.stringify(items));
      return items;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pepites'] });
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (newSettings: AppSettings) => {
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
      return newSettings;
    },
    onSuccess: (data) => {
      setSettings(data);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  const toggleFavorite = useCallback((id: string) => {
    setPepites((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
      );
      savePepitesMutation.mutate(updated);
      return updated;
    });
  }, []);

  const trashPepite = useCallback((id: string) => {
    setPepites((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, isTrashed: true, isFavorite: false } : p
      );
      savePepitesMutation.mutate(updated);
      return updated;
    });
  }, []);

  const restorePepite = useCallback((id: string) => {
    setPepites((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, isTrashed: false } : p
      );
      savePepitesMutation.mutate(updated);
      return updated;
    });
  }, []);

  const deletePepite = useCallback((id: string) => {
    setPepites((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePepitesMutation.mutate(updated);
      return updated;
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...partial };
    setSettings(newSettings);
    saveSettingsMutation.mutate(newSettings);
  }, [settings]);

  const completeOnboarding = useCallback(() => {
    updateSettings({ hasCompletedOnboarding: true });
  }, [updateSettings]);

  const addPepites = useCallback((newPepites: Pepite[]) => {
    setPepites((prev) => {
      const updated = [...newPepites, ...prev];
      savePepitesMutation.mutate(updated);
      return updated;
    });
  }, []);

  const scanMutation = useMutation({
    mutationFn: async ({ merchantName, pageContent, screenshots, extractedItems }: { merchantName: string; pageContent: string; screenshots?: string[]; extractedItems?: Array<{title: string; link: string; image: string; price: string}> }) => {
      console.log('[PepiteProvider] ============ SCAN MUTATION START ============');
      console.log(`[PepiteProvider] Merchant: ${merchantName}`);
      console.log(`[PepiteProvider] API key present: ${settings.geminiApiKey.length > 0} (${settings.geminiApiKey.length} chars)`);
      console.log(`[PepiteProvider] Screenshots: ${screenshots?.length ?? 0}`);
      console.log(`[PepiteProvider] Text content: ${pageContent.length} chars`);
      console.log(`[PepiteProvider] Extracted items: ${extractedItems?.length ?? 0}`);
      if (pageContent.length > 0) {
        console.log(`[PepiteProvider] Text preview: ${pageContent.substring(0, 200)}`);
      } else {
        console.warn('[PepiteProvider] ⚠️ EMPTY page content!');
      }

      if (!settings.geminiApiKey || settings.geminiApiKey.trim().length === 0) {
        throw new Error('Clé API Gemini non configurée. Allez dans Réglages > Clé API pour la configurer.');
      }

      let results: any[] = [];
      if (screenshots && screenshots.length > 0) {
        console.log(`[PepiteProvider] → VIDEO mode with ${screenshots.length} frames`);
        results = await analyzeWithGeminiVideo(settings.geminiApiKey, merchantName, screenshots, pageContent);
        console.log(`[PepiteProvider] ✅ VIDEO analysis returned ${results.length} pepites`);
      } else {
        console.log('[PepiteProvider] → TEXT-ONLY mode (no screenshots)');
        results = await analyzeWithGemini(settings.geminiApiKey, merchantName, pageContent);
        console.log(`[PepiteProvider] ✅ TEXT analysis returned ${results.length} pepites`);
      }

      // Enrichir les pépites avec les URLs et images des items extrait
      if (extractedItems && extractedItems.length > 0) {
        console.log(`[PepiteProvider] 🔍 Starting enrichment with ${extractedItems.length} extracted items...`);
        console.log(`[PepiteProvider] Items to match against:`, extractedItems.map(i => i.title).join(' | '));
        
        results = results.map((pepite) => {
          // Fonction de matching par titre améliorée (fuzzy)
          let matchingItem = null;
          let bestMatchScore = 0;

          for (const item of extractedItems) {
            // Extraire les mots clés significatifs (> 3 chars)
            const pepiteWords = pepite.title.toLowerCase().split(/[\s,\-()]+/).filter((w: string) => w.length > 3);
            const itemWords = item.title.toLowerCase().split(/[\s,\-()]+/).filter((w: string) => w.length > 3);
            
            // Compter les mots en commun
            const commonWords = pepiteWords.filter((w: string) => itemWords.some(iw => iw.includes(w) || w.includes(iw)));
            const matchScore = commonWords.length;
            
            // Match si au moins 2 mots clés en commun, ou si les premiers 25 chars correspondent
            const firstCharsMatch = pepite.title.toLowerCase().substring(0, 25) === item.title.toLowerCase().substring(0, 25);
            const isGoodMatch = matchScore >= 2 || firstCharsMatch;
            
            if (isGoodMatch && matchScore > bestMatchScore) {
              bestMatchScore = matchScore;
              matchingItem = item;
            }
          }

          if (matchingItem && bestMatchScore >= 2) {
            console.log(`[PepiteProvider] 🔗 Matched "${pepite.title}" → ${matchingItem.link} (score: ${bestMatchScore})`);
            return {
              ...pepite,
              adUrl: matchingItem.link,
              adImageUrl: matchingItem.image,
            };
          } else {
            console.log(`[PepiteProvider] ❌ No match for "${pepite.title}" (checked ${extractedItems.length} items, best score: ${bestMatchScore})`);
          }
          return pepite;
        });
      } else {
        console.log('[PepiteProvider] ℹ️ No extracted items available for enrichment');
      }

      return results;
    },
    onSuccess: async (results) => {
      console.log(`[PepiteProvider] ============ SCAN SUCCESS: ${results.length} pepites ============`);
      results.forEach((p, i) => {
        console.log(`[PepiteProvider]   #${i + 1}: ${p.title} | ${p.sellerPrice}€ → ${p.estimatedValue}€`);
      });
      setLastScanResults(results);

      if (results.length > 0) {
        addPepites(results);
        if (settings.notificationsEnabled) {
          await sendPepiteFoundNotification(results);
        }
      }

      // Sauvegarder la session de scan
      try {
        const session: ScanSession = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          duration: 0,
          pepitesFound: results.length,
          totalProfit: results.reduce((sum, p) => sum + (p.profit ?? 0), 0),
          source: results[0]?.source ?? 'Inconnu',
        };
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.SCAN_SESSIONS);
        const sessions: ScanSession[] = stored ? JSON.parse(stored) : [];
        const updated = [session, ...sessions].slice(0, 200); // garder max 200 sessions
        await AsyncStorage.setItem(STORAGE_KEYS.SCAN_SESSIONS, JSON.stringify(updated));
        setScanSessions(updated);
        queryClient.invalidateQueries({ queryKey: ['scan_sessions'] });
      } catch (e) {
        console.log('[PepiteProvider] Error saving scan session:', e);
      }

      setScanError(null);
    },
    onError: (error: Error) => {
      console.error('[PepiteProvider] ============ SCAN ERROR ============');
      console.error('[PepiteProvider] Error:', error.message);
      console.error('[PepiteProvider] Stack:', error.stack);
      setScanError(error.message ?? 'Erreur lors de l\'analyse. Veuillez réessayer.');
    },
  });

  const startScan = useCallback(() => {
    setIsScanning(true);
    setScanTimer(0);
    setLastScanResults([]);
    setScanError(null);
  }, []);

  const stopScan = useCallback((merchantName: string, pageContent: string, screenshots?: string[], extractedItems?: Array<{title: string; link: string; image: string; price: string}>) => {
    setIsScanning(false);
    setScanTimer(0);
    console.log('[PepiteProvider] ============ STOP SCAN → LAUNCHING ANALYSIS ============');
    console.log(`[PepiteProvider] Merchant: ${merchantName}`);
    console.log(`[PepiteProvider] Content: ${pageContent.length} chars`);
    console.log(`[PepiteProvider] Items received: ${extractedItems?.length ?? 0}`);
    scanMutation.mutate({ merchantName, pageContent, screenshots, extractedItems });
  }, [scanMutation]);

  const activePepites = useMemo(
    () => pepites.filter((p) => !p.isTrashed),
    [pepites]
  );

  const favoritePepites = useMemo(
    () => pepites.filter((p) => p.isFavorite && !p.isTrashed),
    [pepites]
  );

  const trashedPepites = useMemo(
    () => pepites.filter((p) => p.isTrashed),
    [pepites]
  );

  // Stats de scan calculées
  const scanStats = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const scansToday = scanSessions.filter(s => new Date(s.date) >= startOfDay).length;
    const scansThisWeek = scanSessions.filter(s => new Date(s.date) >= startOfWeek).length;
    const scansThisMonth = scanSessions.filter(s => new Date(s.date) >= startOfMonth).length;
    const totalScans = scanSessions.length;

    const favProfit = favoritePepites.reduce((sum, p) => sum + (p.profit ?? 0), 0);
    const totalPepitesAnalyzed = activePepites.length;

    const topSource = scanSessions.length > 0
      ? Object.entries(
          scanSessions.reduce((acc: Record<string, number>, s) => {
            acc[s.source] = (acc[s.source] ?? 0) + 1;
            return acc;
          }, {})
        ).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
      : '—';

    const bestDeal = favoritePepites.reduce<Pepite | null>((best, p) =>
      (!best || p.profit > best.profit) ? p : best, null
    );

    const avgProfit = totalPepitesAnalyzed > 0
      ? activePepites.reduce((sum, p) => sum + (p.profit ?? 0), 0) / totalPepitesAnalyzed
      : 0;

    return {
      scansToday,
      scansThisWeek,
      scansThisMonth,
      totalScans,
      favProfit,
      totalPepitesAnalyzed,
      topSource,
      bestDeal,
      avgProfit,
    };
  }, [scanSessions, favoritePepites, activePepites]);

  const getPepiteById = useCallback(
    (id: string) => pepites.find((p) => p.id === id),
    [pepites]
  );

  return {
    pepites,
    activePepites,
    favoritePepites,
    trashedPepites,
    settings,
    isScanning,
    scanTimer,
    setScanTimer,
    isLoading: pepitesQuery.isLoading || settingsQuery.isLoading,
    isAnalyzing: scanMutation.isPending,
    lastScanResults,
    scanError,
    scanSessions,
    scanStats,
    toggleFavorite,
    trashPepite,
    restorePepite,
    deletePepite,
    addPepites,
    updateSettings,
    completeOnboarding,
    startScan,
    stopScan,
    getPepiteById,
  };
});
