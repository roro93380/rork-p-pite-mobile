import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import { Gift, Copy, Users, Zap, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { supabase } from '@/services/supabaseClient';

async function callReferral(action: string, referral_code?: string) {
  const { data, error } = await supabase.functions.invoke('referral', {
    body: { action, referral_code },
  });
  if (error) throw new Error(error.message);
  return data;
}

export default function ReferralScreen() {
  const [myCode, setMyCode] = useState('');
  const [referralsCount, setReferralsCount] = useState(0);
  const [bonusCredits, setBonusCredits] = useState(0);
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [codeData, statsData] = await Promise.all([
        callReferral('get_my_code'),
        callReferral('get_stats'),
      ]);
      setMyCode(codeData.code);
      setReferralsCount(codeData.referrals_count);
      setBonusCredits(statsData.active_bonus_credits);
    } catch (err) {
      console.error('Referral load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleShare = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const shareText = `Rejoins Pépite et détecte les meilleures affaires ! Utilise mon code ${myCode} pour +3 scans bonus 🎁\nhttps://app-pepite.web.app`;
    try {
      await Share.share({ message: shareText });
    } catch {}
  };

  const handleCopy = async () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Use Share as clipboard fallback (no expo-clipboard dep)
    await handleShare();
    setMessage('Code copié !');
    setTimeout(() => setMessage(''), 2000);
  };

  const handleApply = async () => {
    if (!inputCode.trim()) return;
    setApplying(true);
    setMessage('');
    try {
      const result = await callReferral('apply_code', inputCode.trim());
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage(result.message);
      setInputCode('');
      loadData();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ title: 'Inviter un ami' }} />
        <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Inviter un ami' }} />

      {/* Hero */}
      <View style={styles.hero}>
        <Gift size={48} color={Colors.gold} />
        <Text style={styles.heroTitle}>Parrainez vos amis</Text>
        <Text style={styles.heroSubtitle}>
          +3 scans bonus pendant 7 jours pour vous ET votre filleul
        </Text>
      </View>

      {/* Mon code */}
      <View style={styles.card}>
        <Text style={styles.label}>Mon code parrain</Text>
        <View style={styles.codeRow}>
          <Text style={styles.codeText}>{myCode}</Text>
          <TouchableOpacity onPress={handleCopy} style={styles.copyBtn}>
            <Copy size={18} color={Colors.gold} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>📤 Partager mon lien</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Users size={22} color={Colors.gold} />
          <Text style={styles.statValue}>{referralsCount}</Text>
          <Text style={styles.statLabel}>Filleuls</Text>
        </View>
        <View style={styles.statCard}>
          <Zap size={22} color={Colors.gold} />
          <Text style={styles.statValue}>{bonusCredits}</Text>
          <Text style={styles.statLabel}>Scans bonus</Text>
        </View>
      </View>

      {/* Appliquer un code */}
      <View style={styles.card}>
        <Text style={styles.label}>{"J'ai un code parrain"}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="PEP-XXXXXX"
            placeholderTextColor={Colors.textMuted}
            value={inputCode}
            onChangeText={(t) => setInputCode(t.toUpperCase())}
            autoCapitalize="characters"
          />
          <TouchableOpacity
            onPress={handleApply}
            disabled={applying || !inputCode.trim()}
            style={[styles.applyBtn, (!inputCode.trim() || applying) && { opacity: 0.5 }]}
          >
            {applying ? (
              <ActivityIndicator size="small" color={Colors.gold} />
            ) : (
              <ArrowRight size={20} color={Colors.gold} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Message */}
      {message ? (
        <Text style={styles.message}>{message}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 12,
  },
  heroSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    marginBottom: 16,
  },
  label: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  codeText: {
    flex: 1,
    color: Colors.gold,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 2,
  },
  copyBtn: {
    padding: 8,
  },
  shareBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  statValue: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 14,
    color: Colors.text,
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  applyBtn: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: 14,
  },
  message: {
    color: Colors.gold,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
