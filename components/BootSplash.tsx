import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Colors from '@/constants/colors';

type BootSplashProps = {
  onReady?: () => void;
};

export default function BootSplash({ onReady }: BootSplashProps) {
  const didNotifyReadyRef = useRef(false);

  const handleLayout = (_event: LayoutChangeEvent) => {
    if (didNotifyReadyRef.current) {
      return;
    }

    didNotifyReadyRef.current = true;
    onReady?.();
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      <View style={styles.content}>
        <Image
          source={require('@/assets/images/logo.png')}
          resizeMode="contain"
          style={styles.logo}
        />
        <Text style={styles.slogan}>Détectez les meilleures affaires</Text>
        <ActivityIndicator size="small" color={Colors.gold} style={styles.spinner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 190,
    height: 64,
  },
  slogan: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  spinner: {
    marginTop: 18,
  },
});