import React, { useEffect, useRef } from 'react';
import {
  Modal as RNModal,
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Pressable,
  Platform,
  ViewStyle,
  KeyboardAvoidingView,
} from 'react-native';
import { colors } from '../../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  type?: 'center' | 'bottom';
  containerStyle?: ViewStyle;
}

export const Modal = ({
  visible,
  onClose,
  children,
  title,
  type = 'bottom',
  containerStyle,
}: ModalProps) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(animatedValue, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [type === 'bottom' ? 400 : 100, 0],
  });

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  return (
    <RNModal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="none"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Animated.View style={[styles.backdropBackground, {
            opacity: animatedValue.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.4]
            })
          }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.container,
            type === 'bottom' ? styles.bottomContainer : styles.centerContainer,
            {
              opacity,
              transform: [{ translateY }, { scale }],
            },
            containerStyle,
          ]}
        >
          {type === 'bottom' && <View style={styles.handle} />}
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  container: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  bottomContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: 200,
  },
  centerContainer: {
    margin: 20,
    borderRadius: 24,
    alignSelf: 'center',
    width: '90%',
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
});
