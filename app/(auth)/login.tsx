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
import { Mail, Lock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import GoldButton from '@/components/GoldButton';
import LogoHeader from '@/components/LogoHeader';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);

    if (error) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Erreur de connexion', error);
    } else {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [email, password, signIn]);

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

        <Text style={styles.title}>Connexion</Text>
        <Text style={styles.subtitle}>
          Retrouvez toutes vos pépites synchronisées
        </Text>

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
            placeholder="Mot de passe"
            placeholderTextColor={Colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
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
            title="Se connecter"
            onPress={handleLogin}
            style={styles.button}
          />
        )}

        <TouchableOpacity
          onPress={() => router.push('/forgot-password' as any)}
          style={styles.forgotLink}
        >
          <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.replace('/register' as any)}
          style={styles.switchLink}
        >
          <Text style={styles.switchText}>
            Pas encore de compte ?{' '}
            <Text style={styles.switchTextBold}>Créer un compte</Text>
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
  forgotLink: {
    marginTop: 16,
    alignItems: 'center',
  },
  forgotText: {
    color: Colors.textSecondary,
    fontSize: 14,
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
