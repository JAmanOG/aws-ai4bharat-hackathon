import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../theme/colors';

interface AvatarProps {
  name: string;
  uri?: string;
  size?: number;
  style?: ViewStyle | ViewStyle[];
}

export default function Avatar({ name, uri, size = 40, style }: AvatarProps) {
  const initials = name
    ? name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    : '?';

  // Deterministic color based on name
  const colorsList = ['#F87171', '#60A5FA', '#34D399', '#FBBF24', '#A78BFA', '#F472B6'];
  const colorIndex = name ? name.length % colorsList.length : 0;
  const bgColor = colorsList[colorIndex];

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }, style]}>
      {uri ? (
        <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  image: {
    resizeMode: 'cover',
  },
  text: {
    fontWeight: '800',
    color: '#fff',
  },
});
