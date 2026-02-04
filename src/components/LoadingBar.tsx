import React, { useEffect, useRef } from 'react';
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
  
  useEffect(() => {
    if (isLoading) {
      // Reset y empezar desde 0
      progress.setValue(0);
      
      // Animación de carga progresiva (simula carga real)
      animationRef.current = Animated.sequence([
        // Inicio rápido: 0% a 30% en 0.5s
        Animated.timing(progress, {
          toValue: 30,
          duration: 500,
          useNativeDriver: false,
        }),
        // Progreso medio: 30% a 60% en 1s
        Animated.timing(progress, {
          toValue: 60,
          duration: 1000,
          useNativeDriver: false,
        }),
        // Se ralentiza: 60% a 80% en 1.5s
        Animated.timing(progress, {
          toValue: 80,
          duration: 1500,
          useNativeDriver: false,
        }),
        // Casi al final: 80% a 90% en 2s (esperando)
        Animated.timing(progress, {
          toValue: 90,
          duration: 2000,
          useNativeDriver: false,
        }),
      ]);
      
      animationRef.current.start();
    } else {
      // Detener animación en curso
      if (animationRef.current) {
        animationRef.current.stop();
      }
      
      // Completar rápidamente al 100% cuando la carga termina
      Animated.timing(progress, {
        toValue: 100,
        duration: 200,
        useNativeDriver: false,
      }).start(() => {
        // Resetear después de completar
        setTimeout(() => progress.setValue(0), 100);
      });
    }
    
    return () => {
      if (animationRef.current) {
        animationRef.current.stop();
      }
    };
  }, [isLoading]);
  
  // No mostrar si no está cargando
  if (!isLoading) return null;

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
