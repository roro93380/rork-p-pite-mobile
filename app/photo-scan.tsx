import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { ChevronLeft, Zap, ZapOff, Image as ImageIcon } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePepite } from '@/providers/PepiteProvider';
import { analyzePhotoWithGemini } from '@/services/scanService';
import { useAuth } from '@/contexts/AuthContext';

const ANALYSIS_STEPS = [
  { emoji: '📸', label: 'Capture de l\'image...' },
  { emoji: '🔍', label: 'Identification de l\'objet...' },
  { emoji: '🧠', label: 'Analyse IA en cours...' },
  { emoji: '💰', label: 'Estimation de la valeur marchande...' },
  { emoji: '📊', label: 'Recherche de références...' },
  { emoji: '✨', label: 'Préparation du résultat...' },
];

function AnalysisOverlay({ visible }: { visible: boolean }) {
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setCurrentStep(0);
      progressAnim.setValue(0);
      return;
    }

    // Cycle steps
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        const next = prev + 1;
        if (next >= ANALYSIS_STEPS.length) return prev;
        return next;
      });
    }, 2500);

    // Progress bar
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: ANALYSIS_STEPS.length * 2500,
      useNativeDriver: false,
    }).start();

    return () => clearInterval(interval);
  }, [visible]);

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [currentStep]);

  if (!visible) return null;

  const step = ANALYSIS_STEPS[currentStep] || ANALYSIS_STEPS[ANALYSIS_STEPS.length - 1];
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={analysisStyles.backdrop}>
        <View style={analysisStyles.card}>
          <Text style={analysisStyles.emoji}>{step.emoji}</Text>
          <Animated.Text style={[analysisStyles.label, { opacity: fadeAnim }]}>
            {step.label}
          </Animated.Text>
          <View style={analysisStyles.progressBg}>
            <Animated.View style={[analysisStyles.progressFill, { width: progressWidth }]} />
          </View>
          <Text style={analysisStyles.stepCount}>
            Étape {currentStep + 1}/{ANALYSIS_STEPS.length}
          </Text>
          <ActivityIndicator size="small" color={Colors.gold} style={{ marginTop: 12 }} />
        </View>
      </View>
    </Modal>
  );
}

const analysisStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.2)',
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  label: { color: Colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  progressBg: { width: '100%', height: 6, borderRadius: 3, backgroundColor: Colors.surfaceLight, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.gold },
  stepCount: { color: Colors.textSecondary, fontSize: 13, marginTop: 8 },
});

export default function PhotoScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [flashOn, setFlashOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const { settings, recordPhotoScan } = usePepite();
  const { profile } = useAuth();

  const checkDailyLimit = useCallback(async () => {
    try {
      // recordPhotoScan will throw if limit reached
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleCapture = useCallback(async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.7 });
      if (!photo?.base64) {
        Alert.alert('Erreur', 'Impossible de capturer la photo.');
        setCapturing(false);
        return;
      }
      const apiKey = settings?.geminiApiKey;
      if (!apiKey) {
        Alert.alert('Clé API manquante', 'Configurez votre clé Gemini dans les Réglages.');
        setCapturing(false);
        return;
      }
      setAnalyzing(true);
      const result = await analyzePhotoWithGemini(apiKey, photo.base64);
      // Record the photo scan in DB (counts toward daily limit)
      try {
        await recordPhotoScan(1, result.profit || 0);
      } catch (e: any) {
        setAnalyzing(false);
        setCapturing(false);
        Alert.alert('Limite atteinte', e.message);
        return;
      }
      setAnalyzing(false);
      router.replace({ pathname: '/photo-result' as any, params: { data: JSON.stringify(result), imageUri: photo.uri ?? '' } });
    } catch (e: any) {
      setAnalyzing(false);
      Alert.alert('Erreur d\'analyse', e.message || 'Réessayez.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, settings, router, recordPhotoScan]);

  const handleGallery = useCallback(async () => {
    if (capturing) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setCapturing(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      const apiKey = settings?.geminiApiKey;
      if (!apiKey) {
        Alert.alert('Clé API manquante', 'Configurez votre clé Gemini dans les Réglages.');
        setCapturing(false);
        return;
      }
      setAnalyzing(true);
      const analysis = await analyzePhotoWithGemini(apiKey, result.assets[0].base64);
      // Record the photo scan in DB
      try {
        await recordPhotoScan(1, analysis.profit || 0);
      } catch (e: any) {
        setAnalyzing(false);
        setCapturing(false);
        Alert.alert('Limite atteinte', e.message);
        return;
      }
      setAnalyzing(false);
      router.replace({ pathname: '/photo-result' as any, params: { data: JSON.stringify(analysis), imageUri: result.assets[0].uri ?? '' } });
    } catch (e: any) {
      setAnalyzing(false);
      Alert.alert('Erreur d\'analyse', e.message || 'Réessayez.');
    } finally {
      setCapturing(false);
    }
  }, [capturing, settings, router, recordPhotoScan]);

  // Permission handling
  if (!permission) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionTitle}>Accès Caméra Requis</Text>
          <Text style={styles.permissionText}>
            Pour scanner un objet, autorisez l'accès à la caméra.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Autoriser la Caméra</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelLink} onPress={() => router.back()}>
            <Text style={styles.cancelLinkText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        flash={flashOn ? 'on' : 'off'}
      />

      {/* Overlay */}
      <View style={[styles.overlay, { paddingTop: insets.top }]} pointerEvents="box-none">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Photo</Text>
          <View style={{ width: 44 }} />
        </View>

        <Text style={styles.subtitle}>Scannez un objet pour estimer sa valeur</Text>

        {/* Viewfinder */}
        <View style={styles.viewfinderContainer}>
          <View style={styles.viewfinder}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {/* Crosshair */}
            <View style={styles.crosshairH} />
            <View style={styles.crosshairV} />
          </View>
        </View>

        <Text style={styles.helperText}>Placez l'objet dans le cadre</Text>

        {/* Analysis steps overlay */}
        <AnalysisOverlay visible={analyzing} />

        {/* Bottom controls */}
        <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setFlashOn(f => !f)}
            activeOpacity={0.7}
          >
            {flashOn ? (
              <Zap size={24} color={Colors.gold} />
            ) : (
              <ZapOff size={24} color={Colors.gold} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.captureBtn}
            onPress={handleCapture}
            activeOpacity={0.8}
            disabled={capturing}
          >
            <View style={styles.captureBtnInner}>
              <Text style={styles.captureIcon}>🪨</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={handleGallery}
            activeOpacity={0.7}
            disabled={capturing}
          >
            <ImageIcon size={24} color={Colors.gold} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const VIEWFINDER_SIZE = 280;
const CORNER_SIZE = 40;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: Colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginTop: -8,
  },
  viewfinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: {
    width: VIEWFINDER_SIZE,
    height: VIEWFINDER_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: Colors.gold,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: Colors.gold,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderColor: Colors.gold,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderColor: Colors.gold,
    borderBottomRightRadius: 12,
  },
  crosshairH: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.gold + '80',
  },
  crosshairV: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: Colors.gold + '80',
  },
  helperText: {
    color: Colors.text,
    fontSize: 16,
    textAlign: 'center',
    marginTop: -4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  captureBtnInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.gold + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureIcon: {
    fontSize: 30,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: Colors.gold,
    fontSize: 16,
    fontWeight: '700',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  permissionText: {
    color: Colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
  },
  permissionBtn: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },
  permissionBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  cancelLink: {
    marginTop: 8,
  },
  cancelLinkText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
});
