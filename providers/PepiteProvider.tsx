import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { Pepite, AppSettings, ScanSession } from '@/types';
import { MOCK_PEPITES } from '@/mocks/pepites';
import { analyzeWithGemini, analyzeWithGeminiVideo, generateFallbackPepites } from '@/services/scanService';
import { setupNotifications, sendPepiteFoundNotification, registerRemotePushToken } from '@/services/notificationService';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { markBootTrace, measureBootStep } from '@/services/bootPerformance';
import {
  insertPepites as insertPepitesRemote,
  updatePepiteStatus,
  deletePepiteRemote,
  emptyTrashRemote,
  fetchAllPepites,
} from '@/services/pepiteDbService';
import { fetchAllScans } from '@/services/scanDbService';

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

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const [PepiteProvider, usePepite] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [pepites, setPepites] = useState<Pepite[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanTimer, setScanTimer] = useState<number>(0);
  const [lastScanResults, setLastScanResults] = useState<Pepite[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSessions, setScanSessions] = useState<ScanSession[]>([]);
  const [hasSynced, setHasSynced] = useState<boolean>(false);
  const [syncRetryTick, setSyncRetryTick] = useState<number>(0);
  const pendingScanIdRef = useRef<string | null>(null);
  const isInitialSyncingRef = useRef<boolean>(false);

  /** Helper: get Supabase user id (null if not logged in) */
  const getUserId = useCallback(async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  }, []);

  useEffect(() => {
    if (!settings.notificationsEnabled) {
      return;
    }

    const timer = setTimeout(() => {
      markBootTrace('notifications:setup:start');
      setupNotifications().then((granted) => {
        measureBootStep('notifications:setup:done', 'notifications:setup:start');
        console.log('[PepiteProvider] Notifications setup:', granted ? 'granted' : 'denied');
        if (granted && session?.user?.id) {
          registerRemotePushToken();
        }
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, [settings.notificationsEnabled, session?.user?.id]);

  const pepitesQuery = useQuery({
    queryKey: ['pepites', session?.user?.id ?? 'anon'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.PEPITES);
      if (stored) {
        return JSON.parse(stored) as Pepite[];
      }
      if (session?.user?.id) {
        return [];
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
    queryKey: ['scan_sessions', session?.user?.id ?? 'anon'],
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

  /* ── Initial sync: pull remote pepites + scans + profile on login ── */
  useEffect(() => {
    const userId = session?.user?.id;

    if (!userId) {
      setHasSynced(false);
      return;
    }

    if (hasSynced || isInitialSyncingRef.current) return;
    let cancelled = false;
    isInitialSyncingRef.current = true;

    (async () => {
      if (cancelled) return;

      markBootTrace('pepite-sync:start');

      try {
        // 1. Pull profile → sync API key & onboarding state
        const [profileResult, remotePepites, remoteScans] = await Promise.all([
          supabase
            .from('profiles')
            .select('gemini_api_key, onboarding_completed')
            .eq('id', userId)
            .single(),
          fetchAllPepites(userId),
          fetchAllScans(userId),
        ]);

        if (cancelled) return;

        const profile = profileResult.data;

        if (profile) {
          setSettings((prev) => {
            const updates: Partial<AppSettings> = {};
            // If remote has an API key and local doesn't, use remote
            if (profile.gemini_api_key && !prev.geminiApiKey) {
              updates.geminiApiKey = profile.gemini_api_key;
            }
            // If remote onboarding is done, mark local as done too
            if (profile.onboarding_completed && !prev.hasCompletedOnboarding) {
              updates.hasCompletedOnboarding = true;
            }
            if (Object.keys(updates).length === 0) return prev;
            const merged = { ...prev, ...updates };
            AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
            return merged;
          });
        }

        // 2. Pull remote pepites — add new ones AND update statuses of existing ones
        if (remotePepites.length > 0) {
          setPepites((prev) => {
            const localMap = new Map(prev.map((p) => [p.id, p]));
            let changed = false;

            // Update existing pepites with remote status
            const updatedLocal = prev.map((lp) => {
              const remote = remotePepites.find((rp) => rp.id === lp.id);
              if (remote && (lp.isFavorite !== remote.isFavorite || lp.isTrashed !== remote.isTrashed)) {
                changed = true;
                return { ...lp, isFavorite: remote.isFavorite, isTrashed: remote.isTrashed };
              }
              return lp;
            });

            // Add new pepites from remote
            const newFromRemote = remotePepites.filter((rp) => !localMap.has(rp.id));
            if (newFromRemote.length > 0) changed = true;

            if (!changed) return prev;
            const merged = [...updatedLocal, ...newFromRemote];
            AsyncStorage.setItem(STORAGE_KEYS.PEPITES, JSON.stringify(merged));
            return merged;
          });
        }

        // 3. Pull remote scans
        if (remoteScans.length > 0) {
          setScanSessions((prev) => {
            const localIds = new Set(prev.map((s) => s.id));
            const newFromRemote = remoteScans.filter((rs) => !localIds.has(rs.id));
            if (newFromRemote.length === 0) return prev;
            const merged = [...prev, ...newFromRemote].sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            AsyncStorage.setItem(STORAGE_KEYS.SCAN_SESSIONS, JSON.stringify(merged));
            return merged;
          });
        }

        // 4. Push local pepites that don't exist remotely
        const remoteIds = new Set(remotePepites.map((p) => p.id));
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.PEPITES);
        const localPepites: Pepite[] = stored ? JSON.parse(stored) : [];
        const localOnly = localPepites.filter((p) => !remoteIds.has(p.id));
        if (localOnly.length > 0) {
          await insertPepitesRemote(localOnly, userId);
        }

        // 5. Push local API key to profile if remote is empty
        if (!profile?.gemini_api_key && settings.geminiApiKey) {
          await supabase
            .from('profiles')
            .update({ gemini_api_key: settings.geminiApiKey })
            .eq('id', userId);
        }

        setTimeout(async () => {
          if (cancelled || !settings.notificationsEnabled) {
            return;
          }

          try {
            const { data: notifications } = await supabase
              .from('notifications')
              .select('*')
              .eq('user_id', userId)
              .eq('read', false)
              .order('created_at', { ascending: false })
              .limit(10);

            if (notifications && notifications.length > 0) {
              const { Platform } = require('react-native');
              const Notifications = require('expo-notifications');
              for (const n of notifications) {
                if (Platform.OS !== 'web') {
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: n.title,
                      body: n.message,
                      data: { link: n.link, updateUrl: n.link },
                      ...(n.type === 'update' ? { categoryIdentifier: 'update_available' } : {}),
                      ...(n.type === 'update' ? { channelId: 'updates' } : {}),
                      sound: 'default',
                    },
                    trigger: null,
                  });
                }

                await supabase
                  .from('notifications')
                  .update({ read: true })
                  .eq('id', n.id);
              }
              console.log(`[PepiteProvider] Showed ${notifications.length} remote notifications`);
            }
          } catch (notifErr) {
            console.warn('[PepiteProvider] Notification sync error:', notifErr);
          }
        }, 1500);

        setHasSynced(true);
        measureBootStep('pepite-sync:done', 'pepite-sync:start');
        console.log(`[PepiteProvider] Sync done: ${remotePepites.length} remote, ${localOnly.length} pushed`);
      } catch (e) {
        console.warn('[PepiteProvider] Sync error:', e);
        if (!cancelled) {
          setTimeout(() => {
            setSyncRetryTick((v) => v + 1);
          }, 2500);
        }
      } finally {
        isInitialSyncingRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasSynced, session?.user?.id, settings.geminiApiKey, settings.notificationsEnabled, syncRetryTick]);

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
      const target = prev.find((p) => p.id === id);
      const updated = prev.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
      );
      savePepitesMutation.mutate(updated);
      // Sync to Supabase
      if (target) {
        const newStatus = target.isFavorite ? 'new' : 'VALIDATED';
        updatePepiteStatus(id, newStatus as any);
      }
      return updated;
    });
  }, []);

  const trashPepite = useCallback((id: string) => {
    setPepites((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, isTrashed: true, isFavorite: false } : p
      );
      savePepitesMutation.mutate(updated);
      // Sync to Supabase
      updatePepiteStatus(id, 'dismissed');
      return updated;
    });
  }, []);

  const restorePepite = useCallback((id: string) => {
    setPepites((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, isTrashed: false } : p
      );
      savePepitesMutation.mutate(updated);
      // Sync to Supabase
      updatePepiteStatus(id, 'new');
      return updated;
    });
  }, []);

  const deletePepite = useCallback((id: string) => {
    setPepites((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      savePepitesMutation.mutate(updated);
      // Sync to Supabase
      deletePepiteRemote(id);
      return updated;
    });
  }, []);

  const emptyTrash = useCallback(() => {
    setPepites((prev) => {
      const updated = prev.filter((p) => !p.isTrashed);
      savePepitesMutation.mutate(updated);
      // Sync to Supabase
      getUserId().then((uid) => {
        if (uid) emptyTrashRemote(uid);
      });
      return updated;
    });
  }, [getUserId]);

  const updateSettings = useCallback((partial: Partial<AppSettings>) => {
    const newSettings = { ...settings, ...partial };
    setSettings(newSettings);
    saveSettingsMutation.mutate(newSettings);
  }, [settings]);

  const completeOnboarding = useCallback(() => {
    updateSettings({ hasCompletedOnboarding: true });
    // Sync to Supabase profile
    getUserId().then((uid) => {
      if (uid) {
        supabase.from('profiles').update({ onboarding_completed: true }).eq('id', uid);
      }
    });
  }, [updateSettings, getUserId]);

  const addPepites = useCallback((newPepites: Pepite[]) => {
    setPepites((prev) => {
      const updated = [...newPepites, ...prev];
      savePepitesMutation.mutate(updated);
      return updated;
    });
    // Sync to Supabase (fire-and-forget)
    getUserId().then((uid) => {
      if (uid) insertPepitesRemote(newPepites, uid);
    });
  }, [getUserId]);

  const scanMutation = useMutation({
    mutationFn: async ({ merchantName, pageContent, screenshots, extractedItems }: { merchantName: string; pageContent: string; screenshots?: string[]; extractedItems?: Array<{title: string; link: string; image: string; price: string}> }) => {
      console.log('[PepiteProvider] ============ SCAN MUTATION START ============');
      console.log(`[PepiteProvider] Merchant: ${merchantName}`);
      console.log(`[PepiteProvider] API key present: ${settings.geminiApiKey.length > 0} (${settings.geminiApiKey.length} chars)`);
      console.log(`[PepiteProvider] Screenshots: ${screenshots?.length ?? 0}`);
      console.log(`[PepiteProvider] Text content: ${pageContent.length} chars`);
      console.log(`[PepiteProvider] Extracted items: ${extractedItems?.length ?? 0}`);

      // Limites par plan
      const ITEMS_CAPS: Record<string, number> = { free: 30, gold: 50, platinum: 100 };
      const SCAN_LIMITS: Record<string, number> = { free: 3, gold: 10, platinum: 30 };

      // Récupérer le tier depuis le profil Supabase
      let userTier = 'free';
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id ?? null;
      if (!userId) {
        throw new Error('Session expirée. Veuillez vous reconnecter pour lancer un scan.');
      }

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', userId)
          .single();
        userTier = profileData?.subscription_tier || 'free';
      } catch (e) {
        console.warn('[PepiteProvider] Could not fetch tier, defaulting to free');
      }

      // Vérifier la limite quotidienne de scans AVANT l'analyse
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count, error: countError } = await supabase
        .from('scans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('scan_date', todayStart.toISOString());

      if (countError) {
        throw new Error('Impossible de vérifier votre quota de scans. Réessayez dans quelques secondes.');
      }

      const todayScans = count ?? 0;
      const dailyLimit = SCAN_LIMITS[userTier] || SCAN_LIMITS.free;
      console.log(`[PepiteProvider] 📊 Scans today: ${todayScans}/${dailyLimit} (${userTier})`);

      if (todayScans >= dailyLimit) {
        throw new Error(`Limite quotidienne atteinte (${todayScans}/${dailyLimit} scans). Passez au plan supérieur pour scanner davantage.`);
      }

      const MAX_ITEMS_PER_SCAN = ITEMS_CAPS[userTier] || ITEMS_CAPS.free;
      if (extractedItems && extractedItems.length > MAX_ITEMS_PER_SCAN) {
        console.log(`[PepiteProvider] ⚡ Capping items from ${extractedItems.length} to ${MAX_ITEMS_PER_SCAN} (${userTier})`);
        extractedItems = extractedItems.slice(0, MAX_ITEMS_PER_SCAN);
      }

      if (pageContent.length > 0) {
        console.log(`[PepiteProvider] Text preview: ${pageContent.substring(0, 200)}`);
      } else {
        console.warn('[PepiteProvider] ⚠️ EMPTY page content!');
      }

      if (!settings.geminiApiKey || settings.geminiApiKey.trim().length === 0) {
        throw new Error('Clé API Gemini non configurée. Allez dans Réglages > Clé API pour la configurer.');
      }

      // Insérer le scan dans Supabase AVANT l'analyse pour éviter les race conditions
      const preScanId = generateUuid();
      pendingScanIdRef.current = preScanId;
      const { error: preInsertError } = await supabase.from('scans').insert({
        id: preScanId,
        user_id: userId,
        source: merchantName,
        url: '',
        status: 'pending',
        pepites_count: 0,
        scan_date: new Date().toISOString(),
      });
      if (preInsertError) {
        pendingScanIdRef.current = null;
        throw new Error('Impossible de réserver un scan sur le serveur. Réessayez.');
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

      // Enrichir les pépites avec les URLs et images des items extraits
      if (extractedItems && extractedItems.length > 0) {
        console.log(`[PepiteProvider] 🔍 Starting enrichment with ${extractedItems.length} extracted items...`);
        
        const usedItemIndices = new Set<number>();
        
        // Normaliser un titre pour comparaison
        const normalize = (s: string): string =>
          s.toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüçœæ]/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Extraire les mots d'un titre normalisé
        const getWords = (s: string): string[] =>
          normalize(s).split(' ').filter(w => w.length > 0);
        
        // Trier les pépites : titre le plus long d'abord (plus facile à matcher précisément)
        const pepiteIndices = results.map((_: any, i: number) => i);
        pepiteIndices.sort((a: number, b: number) => results[b].title.length - results[a].title.length);
        
        const enrichedResults = [...results];
        
        for (const pepiteIdx of pepiteIndices) {
          const pepite = results[pepiteIdx];
          
          // Si Gemini a déjà fourni une URL valide, la garder directement
          if (pepite.adUrl && pepite.adUrl.startsWith('http') && pepite.adUrl.length > 30 && !pepite.adUrl.includes('/q/') && !pepite.adUrl.includes('/l/')) {
            console.log(`[PepiteProvider] ✅ Keeping Gemini URL for "${pepite.title}"`);
            continue;
          }
          
          const pepNorm = normalize(pepite.title);
          const pepWords = getWords(pepite.title);
          if (pepWords.length === 0) continue;
          
          let bestScore = 0;
          let bestIdx = -1;
          
          for (let idx = 0; idx < extractedItems.length; idx++) {
            if (usedItemIndices.has(idx)) continue;
            
            const item = extractedItems[idx];
            const itemNorm = normalize(item.title);
            const itemWords = getWords(item.title);
            
            // Score 1 : Containment (un titre contient l'autre) → très fiable
            let score = 0;
            if (itemNorm.includes(pepNorm) || pepNorm.includes(itemNorm)) {
              score = 100;
            }
            
            // Score 2 : Ratio de mots de la pépite trouvés dans l'item
            let matchedWords = 0;
            for (const pw of pepWords) {
              if (itemWords.some((iw: string) => iw === pw || iw.includes(pw) || pw.includes(iw))) {
                matchedWords++;
              }
            }
            const ratio = matchedWords / pepWords.length;
            score = Math.max(score, ratio * 100);
            
            // Score 3 : Premiers 25 chars identiques → quasi certain
            if (pepNorm.substring(0, 25) === itemNorm.substring(0, 25) && pepNorm.length >= 5) {
              score = Math.max(score, 95);
            }
            
            // Score 4 : Prix matching - si le prix correspond, bonus
            if (pepite.sellerPrice && item.price && item.price !== 'N/A') {
              const itemPriceStr = item.price.replace(/[^\d.,]/g, '').replace(',', '.');
              const itemPriceNum = parseFloat(itemPriceStr);
              if (!isNaN(itemPriceNum) && itemPriceNum > 0) {
                const priceDiff = Math.abs(itemPriceNum - pepite.sellerPrice) / pepite.sellerPrice;
                if (priceDiff < 0.05) {
                  score += 20;
                } else if (priceDiff < 0.15) {
                  score += 10;
                }
              }
            }
            
            // Score 5 : Description-based matching - quand le titre Gemini est court (ex: juste une marque "Frye"),
            // utiliser les mots-clés de la description Gemini pour matcher
            if (score < 50 && pepite.description && pepite.description.length > 10) {
              const descWords = getWords(pepite.description).filter((w: string) => w.length > 3);
              // Filtrer les mots trop communs
              const stopWords = new Set(['dans', 'pour', 'avec', 'plus', 'tres', 'cette', 'sont', 'etre', 'avoir', 'fait', 'bien', 'tout',
                'prix', 'marque', 'paire', 'excellent', 'qualite', 'revente', 'generalement', 'entre', 'environ', 'marge', 'profit',
                'potential', 'potentiel', 'etat', 'bonne', 'belle', 'from', 'with', 'that', 'this', 'they', 'will', 'been', 'have',
                'brand', 'price', 'good', 'great', 'sell', 'rare', 'very', 'high', 'condition', 'market', 'often', 'usually']);
              const significantDescWords = descWords.filter((w: string) => !stopWords.has(w));
              if (significantDescWords.length > 0) {
                let descMatched = 0;
                for (const dw of significantDescWords) {
                  if (itemWords.some((iw: string) => iw === dw || iw.includes(dw) || dw.includes(iw))) {
                    descMatched++;
                  }
                }
                const descRatio = descMatched / Math.min(significantDescWords.length, 8);
                // Cap at 70 to leave room for price bonus to push over threshold
                const descScore = Math.min(descRatio * 100, 70);
                score = Math.max(score, descScore);
              }
            }
            
            // Score 6 : Mot distinctif unique — un mot spécifique (≥6 chars) exact match = forte preuve
            // Ex: "sunglasses" (10 chars) dans "Ray-Ban Aviator Sunglasses" matche "jellgdrew mode sunglasses unisex..."
            if (score < 50) {
              for (const pw of pepWords) {
                if (pw.length >= 6 && itemWords.some((iw: string) => iw === pw)) {
                  score = Math.max(score, 50);
                  break;
                }
              }
            }
            
            if (score > bestScore) {
              bestScore = score;
              bestIdx = idx;
            }
          }
          
          // Seuil : au moins 50% des mots doivent matcher
          if (bestIdx >= 0 && bestScore >= 50) {
            usedItemIndices.add(bestIdx);
            const matchedItem = extractedItems[bestIdx];
            console.log(`[PepiteProvider] 🔗 Matched "${pepite.title}" → ${matchedItem.link} (${bestScore.toFixed(0)}%)`);
            enrichedResults[pepiteIdx] = {
              ...pepite,
              // image = champ utilisé par PepiteCard pour afficher la photo
              image: matchedItem.image || pepite.image,
              // sourceUrl = lien vers l'annonce (utilisé quand on clique)
              sourceUrl: matchedItem.link || pepite.sourceUrl,
              adUrl: matchedItem.link,
              adImageUrl: matchedItem.image,
            };
          } else {
            console.log(`[PepiteProvider] ❌ No match for "${pepite.title}" (best: ${bestScore.toFixed(0)}%)`);
          }
        }
        
        results = enrichedResults;
      } else {
        console.log('[PepiteProvider] ℹ️ No extracted items available for enrichment');
      }

      return { results, preScanId };
    },
    onSuccess: async ({ results, preScanId }) => {
      console.log(`[PepiteProvider] ============ SCAN SUCCESS: ${results.length} pepites ============`);
      results.forEach((p: any, i: number) => {
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
          id: preScanId,
          date: new Date().toISOString(),
          duration: 0,
          pepitesFound: results.length,
          totalProfit: results.reduce((sum: number, p: any) => sum + (p.profit ?? 0), 0),
          source: results[0]?.source ?? 'Inconnu',
        };
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.SCAN_SESSIONS);
        const sessions: ScanSession[] = stored ? JSON.parse(stored) : [];
        const updated = [session, ...sessions].slice(0, 200); // garder max 200 sessions
        await AsyncStorage.setItem(STORAGE_KEYS.SCAN_SESSIONS, JSON.stringify(updated));
        setScanSessions(updated);
        queryClient.invalidateQueries({ queryKey: ['scan_sessions'] });

        // Mettre à jour le scan dans Supabase (déjà inséré avant l'analyse)
        const uid = (await supabase.auth.getSession()).data.session?.user?.id;
        if (uid) {
          await supabase.from('scans').update({
            status: 'completed',
            pepites_count: results.length,
          }).eq('id', preScanId).eq('user_id', uid);
        }
      } catch (e) {
        console.log('[PepiteProvider] Error saving scan session:', e);
      }

      setScanError(null);
      pendingScanIdRef.current = null;
    },
    onError: async (error: Error) => {
      console.error('[PepiteProvider] ============ SCAN ERROR ============');
      console.error('[PepiteProvider] Error:', error.message);
      console.error('[PepiteProvider] Stack:', error.stack);

      // Supprimer le scan 'pending' pré-inséré si l'analyse a échoué
      if (pendingScanIdRef.current) {
        const uid = (await supabase.auth.getSession()).data.session?.user?.id;
        if (uid) {
          supabase.from('scans')
            .delete()
            .eq('id', pendingScanIdRef.current)
            .eq('user_id', uid)
            .eq('status', 'pending')
            .then(() => console.log('[PepiteProvider] 🗑️ Cleaned up pending scan'));
        }
        pendingScanIdRef.current = null;
      }

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
    emptyTrash,
    addPepites,
    updateSettings,
    completeOnboarding,
    startScan,
    stopScan,
    getPepiteById,
  };
});
