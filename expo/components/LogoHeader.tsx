import React from 'react';
import { View, StyleSheet, Image } from 'react-native';

interface LogoHeaderProps {
  size?: 'small' | 'medium' | 'large';
}

export default React.memo(function LogoHeader({ size = 'medium' }: LogoHeaderProps) {
  const logoSize = size === 'large' ? 180 : size === 'medium' ? 140 : 100;
  const logoHeight = logoSize * 0.35;

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/logo.png')}
        style={{ width: logoSize, height: logoHeight }}
        resizeMode="contain"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 4,
  },
});
