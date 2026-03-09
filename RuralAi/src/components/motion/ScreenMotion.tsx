import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";

const ENTER_DURATION_MS = 240;

export function useScreenMotion() {
  const isFocused = useIsFocused();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isFocused) {
      return undefined;
    }

    opacity.setValue(0.92);
    translateY.setValue(12);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: ENTER_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: ENTER_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    animation.start();

    return () => {
      animation.stop();
    };
  }, [isFocused, opacity, translateY]);

  return {
    opacity,
    transform: [{ translateY }],
  };
}

export function withScreenMotion<P extends object>(Component: React.ComponentType<P>) {
  function MotionWrappedScreen(props: P) {
    const motionStyle = useScreenMotion();

    return (
      <Animated.View style={[styles.container, motionStyle]}>
        <Component {...props} />
      </Animated.View>
    );
  }

  MotionWrappedScreen.displayName = `WithScreenMotion(${Component.displayName || Component.name || "Screen"})`;

  return MotionWrappedScreen;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
