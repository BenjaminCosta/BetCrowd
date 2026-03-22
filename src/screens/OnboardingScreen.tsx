import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, BorderRadius, Spacing } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

interface OnboardingScreenProps {
  onFinish: () => void | Promise<void>;
}

type Slide = {
  id: string;
  image: number;
};

const SLIDES: Slide[] = [
  { id: 'slide-1', image: require('../../assets/slide1.png') },
  { id: 'slide-2', image: require('../../assets/slide2.png') },
  { id: 'slide-3', image: require('../../assets/slide3.png') },
];

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onFinish }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const backgroundColor = '#050505';
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<Slide>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const slides = useMemo(() => SLIDES, []);
  const isLastSlide = activeIndex === slides.length - 1;

  useEffect(() => {
    slides.forEach((slide) => {
      const resolved = Image.resolveAssetSource(slide.image);
      if (resolved?.uri) {
        Image.prefetch(resolved.uri).catch((error: unknown) => {
          if (__DEV__) console.warn('OnboardingScreen: asset preload error', error);
        });
      }
    });
  }, [slides]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.max(0, Math.min(nextIndex, slides.length - 1)));
  };

  const handleNext = async () => {
    if (isFinishing) return;
    if (isLastSlide) {
      setIsFinishing(true);
      try {
        await onFinish();
      } catch (e) {
        if (__DEV__) console.warn('OnboardingScreen: onFinish error', e);
      } finally {
        setIsFinishing(false);
      }
      return;
    }

    const nextIndex = activeIndex + 1;
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setActiveIndex(nextIndex);
  };

  const renderItem = useCallback(
    ({ item }: { item: Slide }) => (
      <View style={{ width, height }}>
        <Image
          source={item.image}
          style={[styles.slideImage, { backgroundColor }]}
          resizeMode="contain"
          fadeDuration={0}
        />
      </View>
    ),
    [backgroundColor, height, width],
  );

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        renderItem={renderItem}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={2}
        removeClippedSubviews
        extraData={width}
      />

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.lg,
          },
        ]}
      >
        <View style={styles.dotsRow}>
          {slides.map((slide, index) => {
            const isActive = index === activeIndex;
            return (
              <View
                key={slide.id}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive ? colors.primary : 'rgba(255,255,255,0.24)',
                    width: isActive ? 22 : 8,
                  },
                ]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleNext}
          disabled={isFinishing}
          style={[styles.button, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.buttonText}>{isLastSlide ? 'Empezar' : 'Siguiente'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default OnboardingScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  slideImage: {
    width: '100%',
    height: '100%',
    transform: [{ translateY: -24 }],
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: BorderRadius.full,
  },
  button: {
    minHeight: 54,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
