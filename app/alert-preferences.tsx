import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, X, Save, Bell } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/services/supabaseClient';

export default function AlertPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [minMargin, setMinMargin] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isPlatinum = profile?.subscription_tier === 'platinum';

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('alert_keywords, alert_min_margin')
        .eq('id', user.id)
        .single();
      if (data) {
        setKeywords(data.alert_keywords || []);
        setMinMargin(data.alert_min_margin ?? 20);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleAddKeyword = useCallback(() => {
    const kw = newKeyword.trim().toLowerCase();
    if (!kw || keywords.includes(kw)) return;
    setKeywords(prev => [...prev, kw]);
    setNewKeyword('');
  }, [newKeyword, keywords]);

  const handleRemoveKeyword = useCallback((kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
  }, []);

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ alert_keywords: keywords, alert_min_margin: minMargin })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      Alert.alert('Erreur', 'Impossible de sauvegarder les préférences');
    } else {
      Alert.alert('Succès', 'Préférences d\'alertes sauvegardées');
    }
  }, [user, keywords, minMargin]);

  if (!isPlatinum) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>  
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alertes personnalisées</Text>
        </View>
        <View style={styles.lockedContainer}>
          <Bell size={48} color={Colors.gold} />
          <Text style={styles.lockedTitle}>Fonctionnalité Platinum</Text>
          <Text style={styles.lockedDesc}>
            Recevez des alertes quand une pépite correspond à vos critères.
            Disponible avec le plan Platinum.
          </Text>
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/premium')}>
            <Text style={styles.upgradeBtnText}>Voir les plans</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.gold} style={{ marginTop: 60 }} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alertes personnalisées</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <Text style={styles.sectionTitle}>Mots-clés surveillés</Text>
        <Text style={styles.sectionDesc}>
          Ajoutez des mots-clés pour être alerté quand une pépite correspond.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={newKeyword}
            onChangeText={setNewKeyword}
            placeholder="ex: iPhone, PS5, vélo..."
            placeholderTextColor={Colors.textSecondary}
            onSubmitEditing={handleAddKeyword}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddKeyword}>
            <Plus size={20} color={Colors.background} />
          </TouchableOpacity>
        </View>

        <View style={styles.tagsContainer}>
          {keywords.map(kw => (
            <View key={kw} style={styles.tag}>
              <Text style={styles.tagText}>{kw}</Text>
              <TouchableOpacity onPress={() => handleRemoveKeyword(kw)}>
                <X size={14} color={Colors.gold} />
              </TouchableOpacity>
            </View>
          ))}
          {keywords.length === 0 && (
            <Text style={styles.emptyText}>Aucun mot-clé configuré</Text>
          )}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Marge minimum</Text>
        <Text style={styles.sectionDesc}>
          Ne recevoir des alertes que pour les pépites avec au moins {minMargin}% de marge.
        </Text>

        <View style={styles.sliderRow}>
          {[5, 10, 15, 20, 25, 30, 40, 50].map(val => (
            <TouchableOpacity
              key={val}
              style={[styles.marginBtn, minMargin === val && styles.marginBtnActive]}
              onPress={() => setMinMargin(val)}
            >
              <Text style={[styles.marginBtnText, minMargin === val && styles.marginBtnTextActive]}>
                {val}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.background} />
          ) : (
            <Save size={18} color={Colors.background} />
          )}
          <Text style={styles.saveBtnText}>Sauvegarder</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { marginRight: 12 },
  headerTitle: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  content: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginTop: 16 },
  sectionDesc: { color: Colors.textSecondary, fontSize: 13, marginTop: 4, marginBottom: 12 },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: { color: Colors.gold, fontSize: 13, fontWeight: '600' },
  emptyText: { color: Colors.textSecondary, fontSize: 13 },
  sliderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  marginBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  marginBtnActive: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderColor: Colors.gold,
  },
  marginBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  marginBtnTextActive: {
    color: Colors.gold,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 32,
  },
  saveBtnText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
  lockedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  lockedTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginTop: 16 },
  lockedDesc: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  upgradeBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 20,
  },
  upgradeBtnText: { color: Colors.background, fontSize: 15, fontWeight: '700' },
});
