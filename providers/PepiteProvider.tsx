import { useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Pepite, AppSettings, ScanSession } from '@/types';
import { MOCK_PEPITES } from '@/mocks/pepites';
import { analyzeWithGemini, analyzeWithGeminiVideo, analyzeWithMapping, generateFallbackPepites, ExtractedAd } from '@/services/scanService';
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
    mutationFn: async ({ merchantName, pageContent, screenshots, extractedAds }: { merchantName: string; pageContent: string; screenshots?: string[]; extractedAds?: ExtractedAd[] }) => {
      console.log('[PepiteProvider] ============ SCAN MUTATION START ============');
      console.log(`[PepiteProvider] Merchant: ${merchantName}`);
      console.log(`[PepiteProvider] API key present: ${settings.geminiApiKey.length > 0} (${settings.geminiApiKey.length} chars)`);
      console.log(`[PepiteProvider] Screenshots: ${screenshots?.length ?? 0}`);
      console.log(`[PepiteProvider] Extracted ads: ${extractedAds?.length ?? 0}`);
      console.log(`[PepiteProvider] Text content: ${pageContent.length} chars`);

      if (!settings.geminiApiKey || settings.geminiApiKey.trim().length === 0) {
        throw new Error('Clé API Gemini non configurée. Allez dans Réglages > Clé API pour la configurer.');
      }

      const ads = extractedAds ?? [];

      if (screenshots && screenshots.length > 0) {
        console.log(`[PepiteProvider] → VIDEO+MAPPING mode (${screenshots.length} frames, ${ads.length} ads)`);
        const results = await analyzeWithGeminiVideo(settings.geminiApiKey, merchantName, screenshots, pageContent, ads);
        console.log(`[PepiteProvider] ✅ Analysis returned ${results.length} pepites`);
        return results;
      }

      if (ads.length > 0) {
        console.log(`[PepiteProvider] → MAPPING-ONLY mode (${ads.length} ads)`);
        const results = await analyzeWithMapping(settings.geminiApiKey, merchantName, ads);
        console.log(`[PepiteProvider] ✅ Mapping returned ${results.length} pepites`);
        return results;
      }

      console.log('[PepiteProvider] → TEXT-ONLY fallback');
      const results = await analyzeWithGemini(settings.geminiApiKey, merchantName, pageContent);
      console.log(`[PepiteProvider] ✅ TEXT analysis returned ${results.length} pepites`);
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

  const stopScan = useCallback((merchantName: string, pageContent: string, screenshots?: string[], extractedAds?: ExtractedAd[]) => {
    setIsScanning(false);
    setScanTimer(0);
    console.log('[PepiteProvider] ============ STOP SCAN → LAUNCHING ANALYSIS ============');
    console.log(`[PepiteProvider] Merchant: ${merchantName}`);
    console.log(`[PepiteProvider] Screenshots: ${screenshots?.length ?? 0}`);
    console.log(`[PepiteProvider] Extracted ads: ${extractedAds?.length ?? 0}`);
    scanMutation.mutate({ merchantName, pageContent, screenshots, extractedAds });
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
