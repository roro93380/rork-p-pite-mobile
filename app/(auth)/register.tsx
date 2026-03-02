import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import GoldButton from '@/components/GoldButton';
import LogoHeader from '@/components/LogoHeader';
import { useAuth } from '@/contexts/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);

    if (error) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Erreur d\'inscription', error);
    } else {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Alert.alert(
        'Bienvenue !',
        'Votre compte a été créé avec succès.',
      );
    }
  }, [email, password, fullName, signUp]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <LogoHeader size="large" />

        <Text style={styles.title}>Créer un compte</Text>
        <Text style={styles.subtitle}>
          Synchronisez vos pépites sur tous vos appareils
        </Text>

        {/* Full name */}
        <View style={styles.inputContainer}>
          <View style={styles.inputIcon}>
            <User size={20} color={Colors.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Nom complet (optionnel)"
            placeholderTextColor={Colors.textMuted}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            textContentType="name"
          />
        </View>

        {/* Email */}
        <View style={styles.inputContainer}>
          <View style={styles.inputIcon}>
            <Mail size={20} color={Colors.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
        </View>

        {/* Password */}
        <View style={styles.inputContainer}>
          <View style={styles.inputIcon}>
            <Lock size={20} color={Colors.gold} />
          </View>
          <TextInput
            style={styles.input}
            placeholder="Mot de passe (min. 6 caractères)"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />
        </View>

        {loading ? (
          <ActivityIndicator
            color={Colors.gold}
            size="large"
            style={{ marginVertical: 24 }}
          />
        ) : (
          <GoldButton
            title="Créer mon compte"
            onPress={handleRegister}
            style={styles.button}
          />
        )}

        <TouchableOpacity
          onPress={() => router.replace('/login' as any)}
          style={styles.switchLink}
        >
          <Text style={styles.switchText}>
            Déjà un compte ?{' '}
            <Text style={styles.switchTextBold}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 24,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 14,
    marginBottom: 16,
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
  button: {
    marginTop: 8,
  },
  switchLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  switchTextBold: {
    color: Colors.gold,
    fontWeight: '700',
  },
});
