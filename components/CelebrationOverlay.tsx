import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, Text, Pressable, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  cancelAnimation
} from 'react-native-reanimated';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMedia } from '@/types/database';

const CONFETTI_COLORS = [
  '#ffd700', // Gold
  '#00ff88', // CRT glow green
  '#00ffc8', // Cyan
  '#ff007f', // Cyber Pink
  '#ff5e00', // Retro Orange
  '#3b82f6', // Sky Blue
];

type ParticleConfig = {
  id: number;
  color: string;
  size: number;
  shape: string;
  startX: number;
  delay: number;
  duration: number;
  drift: number;
};

function ConfettiParticle({ config, screenHeight }: { config: ParticleConfig; screenHeight: number }) {
  const y = useSharedValue(-30);
  const xOffset = useSharedValue(0);
  const rotation = useSharedValue(0);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    y.value = withDelay(
      config.delay,
      withTiming(screenHeight + 40, {
        duration: config.duration,
        easing: Easing.linear,
      })
    );

    xOffset.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(config.drift, { duration: config.duration * 0.4, easing: Easing.inOut(Easing.ease) }),
          withTiming(-config.drift, { duration: config.duration * 0.4, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    rotation.value = withDelay(
      config.delay,
      withTiming(360 * (Math.random() > 0.5 ? 3 : -3), {
        duration: config.duration,
        easing: Easing.linear,
      })
    );

    opacity.value = withDelay(
      config.delay + config.duration * 0.7,
      withTiming(0, { duration: config.duration * 0.3 })
    );

    return () => {
      cancelAnimation(y);
      cancelAnimation(xOffset);
      cancelAnimation(rotation);
      cancelAnimation(opacity);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: y.value },
        { translateX: xOffset.value },
        { rotate: `${rotation.value}deg` },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        animatedStyle,
        {
          left: `${config.startX}%`,
          backgroundColor: config.color,
          width: config.size,
          height: config.shape === 'square' ? config.size : config.size * 0.7,
          borderRadius: config.shape === 'circle' ? config.size / 2 : 2,
        },
      ]}
    />
  );
}

type CelebrationOverlayProps = {
  item: CollectionItemWithMedia;
  onClose: () => void;
};

export function CelebrationOverlay({ item, onClose }: CelebrationOverlayProps) {
  const { height: screenHeight } = useWindowDimensions();
  const media = item.movies || item.shows;

  const isGrail = item.is_grail;
  const glowColor = isGrail ? '#ffd700' : '#00ff88';

  const cardScale = useSharedValue(0.4);
  const cardOpacity = useSharedValue(0);
  
  const auraScale = useSharedValue(1);
  const auraOpacity = useSharedValue(0.4);

  useEffect(() => {
    cardScale.value = withSpring(1, { damping: 11, stiffness: 85 });
    cardOpacity.value = withTiming(1, { duration: 400 });

    auraScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    auraOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    return () => {
      cancelAnimation(cardScale);
      cancelAnimation(cardOpacity);
      cancelAnimation(auraScale);
      cancelAnimation(auraOpacity);
    };
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
    opacity: cardOpacity.value,
  }));

  const auraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: auraScale.value }],
    opacity: auraOpacity.value,
  }));

  const particles = useMemo(() => {
    return Array.from({ length: 90 }).map((_, idx) => {
      const color = CONFETTI_COLORS[idx % CONFETTI_COLORS.length];
      const size = Math.random() * 9 + 6;
      const shape = Math.random() > 0.5 ? 'circle' : 'square';
      const startX = Math.random() * 100;
      const delay = Math.random() * 1500;
      const duration = Math.random() * 2000 + 2500;
      const drift = Math.random() * 80 - 40;
      return {
        id: idx,
        color,
        size,
        shape,
        startX,
        delay,
        duration,
        drift,
      };
    });
  }, []);

  const posterUrl = item.custom_poster_url || getPosterUrl(media?.poster_path || null);

  return (
    <View style={[StyleSheet.absoluteFillObject, { zIndex: 9999 }]} className="items-center justify-center">
      {/* 1. Frosted Glass Backdrop */}
      <BlurView intensity={35} tint="dark" style={StyleSheet.absoluteFillObject} />
      
      {/* Dark overlay base to guarantee contrast */}
      <View style={StyleSheet.absoluteFillObject} className="bg-black/85" />

      {/* 2. Confetti Rain */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none" className="z-10">
        {particles.map((p) => (
          <ConfettiParticle key={p.id} config={p} screenHeight={screenHeight} />
        ))}
      </View>

      {/* 3. Main Celebration Dialog Container */}
      <Animated.View 
        style={[cardStyle]} 
        className="w-full max-w-sm px-6 items-center justify-center z-20"
      >
        {/* Glow Aura behind card */}
        <Animated.View
          style={[
            auraStyle,
            {
              shadowColor: glowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 35,
              borderColor: glowColor,
              borderWidth: 1.5,
              position: 'absolute',
              width: 175,
              height: 255,
              borderRadius: 16,
              zIndex: -1,
              backgroundColor: `${glowColor}10`, // very transparent color
            }
          ]}
        />

        {/* Celebration Title */}
        <View className="mb-6 items-center">
          <Text 
            className="font-mono text-center tracking-[0.2em] font-black text-2xl"
            style={{ 
              color: glowColor,
              textShadowColor: `${glowColor}80`,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 10
            }}
          >
            {isGrail ? '🏆 GRAIL ATTAINED!' : '🎉 WISHLIST ACQUIRED!'}
          </Text>
          <Text className="text-neutral-500 font-mono text-[10px] uppercase mt-2 tracking-widest">
            {isGrail ? 'Ultimate Collection Milestone' : 'Format Added To The Stacks'}
          </Text>
        </View>

        {/* Movie/Show Poster Card */}
        <View 
          className="bg-neutral-900 rounded-2xl overflow-hidden border-2 mb-6"
          style={{ 
            borderColor: glowColor,
            width: 160,
            height: 240,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 10
          }}
        >
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center bg-neutral-850 p-4">
              <Text className="text-neutral-500 font-mono text-xs text-center">NO IMAGE</Text>
            </View>
          )}
        </View>

        {/* Item Metadata */}
        <Text className="text-white text-xl font-bold text-center mb-2 px-2" numberOfLines={2}>
          {(media as any)?.title || (media as any)?.name}
        </Text>
        
        <View className="flex-row gap-2 items-center justify-center mb-10">
          <View 
            className="px-3 py-1 rounded border"
            style={{ 
              borderColor: `${glowColor}40`,
              backgroundColor: `${glowColor}05`
            }}
          >
            <Text className="font-mono text-xs font-bold" style={{ color: glowColor }}>
              {item.format.toUpperCase()}
            </Text>
          </View>
          {item.edition && (
            <Text className="text-neutral-400 font-mono text-xs max-w-[150px]" numberOfLines={1}>
              • {item.edition}
            </Text>
          )}
        </View>

        {/* Dismiss Button */}
        <Pressable
          onPress={onClose}
          className="w-full py-4 rounded-xl items-center border active:opacity-80"
          style={{
            borderColor: glowColor,
            backgroundColor: `${glowColor}15`,
            shadowColor: glowColor,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 10,
          }}
        >
          <Text 
            className="font-mono font-bold text-base tracking-wider"
            style={{ color: glowColor }}
          >
            {isGrail ? 'SWEET!' : 'LFG!'}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: 0,
  },
});
