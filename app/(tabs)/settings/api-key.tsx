import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { KeyRound } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import GoldButton from '@/components/GoldButton';
import { usePepite } from '@/providers/PepiteProvider';

export default function ApiKeyScreen() {
  const { settings, updateSettings } = usePepite();
  const [apiKey, setApiKey] = useState<string>(settings.geminiApiKey);

  const handleSave = useCallback(() => {
    if (!apiKey.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer une clé API valide.');
      return;
    }
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    updateSettings({ geminiApiKey: apiKey.trim() });
    Alert.alert('Succès', 'Votre clé API a été enregistrée.');
  }, [apiKey, updateSettings]);

  const handleHelp = useCallback(() => {
    Linking.openURL('https://aistudio.google.com/app/apikey');
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.heading}>Configuration de l'IA</Text>
        <Text style={styles.description}>
          Entrez votre clé API Gemini pour permettre à Pépite d'analyser les
          images et de trouver les bonnes affaires. C'est sécurisé et gratuit
          pour un usage personnel.
        </Text>

        <View style={styles.inputContainer}>
          <View style={styles.inputIcon}>
            <KeyRound size={20} color={Colors.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Collez votre clé API ici (ex: AIzaSy...)"
            placeholderTextColor={Colors.textMuted}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            testID="api-key-input"
          />
        </View>

        <GoldButton
          title="Valider et Activer l'IA"
          onPress={handleSave}
          style={styles.saveButton}
        />

        <TouchableOpacity onPress={handleHelp} style={styles.helpLink}>
          <Text style={styles.helpText}>Où trouver ma clé API ?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  heading: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '800' as const,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 16,
  },
  saveButton: {
    marginBottom: 16,
  },
  helpLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  helpText: {
    color: Colors.gold,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
