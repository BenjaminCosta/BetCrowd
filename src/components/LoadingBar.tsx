import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

interface LoadingBarProps {
  isLoading: boolean;
}

export const LoadingBar: React.FC<LoadingBarProps> = ({ isLoading }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track visibility independently: stay mounted until the 100% fill animation
  // finishes so the bar never disappears mid-fill when isLoading goes false.
  const [visible, setVisible] = useState(isLoading);

  useEffect(() => {
    if (isLoading) {
      setVisible(true);
      progress.setValue(0);
      if (animationRef.current) { animationRef.current.stop(); animationRef.current = null; }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }

      animationRef.current = Animated.sequence([
        Animated.timing(progress, { toValue: 30, duration: 500, useNativeDriver: false }),
        Animated.timing(progress, { toValue: 60, duration: 1000, useNativeDriver: false }),
        Animated.timing(progress, { toValue: 80, duration: 1500, useNativeDriver: false }),
        Animated.timing(progress, { toValue: 90, duration: 2000, useNativeDriver: false }),
      ]);
      animationRef.current.start();
    } else {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
      // Animate to 100% first, then hide — avoids abrupt disappearance mid-fill
      const completionAnim = Animated.timing(progress, {
        toValue: 100,
        duration: 220,
        useNativeDriver: false,
      });
      animationRef.current = completionAnim;
      completionAnim.start(({ finished }) => {
        animationRef.current = null;
        if (finished) {
          timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            setVisible(false);
            progress.setValue(0);
          }, 80);
        }
      });
    }

    return () => {
      if (animationRef.current) { animationRef.current.stop(); animationRef.current = null; }
      if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    };
  }, [isLoading]);

  if (!visible) return null;

  const width = progress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.progressBar, { width }]}>
        <LinearGradient
          colors={Gradients.primary as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 1000,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  progressBar: {
    height: '100%',
  },
  gradient: {
    height: '100%',
    width: '100%',
  },
});
