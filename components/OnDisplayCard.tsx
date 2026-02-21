import { useSound } from '@/context/SoundContext';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMovie } from '@/types/database';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring
} from 'react-native-reanimated';
import { GlossyCard } from './GlossyCard';
import { NowStreamingSticker } from './NowStreamingSticker';
import { SaleSticker } from './SaleSticker';
import { StickerOverlay } from './StickerOverlay';
import { VHSCard } from './VHSCard';


type OnDisplayCardProps = {
  item: CollectionItemWithMovie;
  scale?: number;
  onSingleTapAction?: () => void;
  onLongPressAction?: () => void;
  onToggleFavorite?: (item: CollectionItemWithMovie) => void;
};

export function OnDisplayCard({ item, scale = 1.5, onSingleTapAction, onLongPressAction, onToggleFavorite }: OnDisplayCardProps) {
  const { playSound } = useSound();
  const movie = item.movies!;
  const isPhysical = item.format !== 'Digital';
  const isWishlist = item.status === 'wishlist';
  const isGrail = item.is_grail;
  const tmdbPosterUrl = getPosterUrl(movie.poster_path);
  const posterUrl = item.custom_poster_url || tmdbPosterUrl;

  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const grailPulse = useSharedValue(1);

  // Manual Gesture State
  const lastTapRef = useRef<number>(0);
  const singleTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // DOUBLE TAP DETECTED
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      console.log('MANUAL: Double Tap Detected');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound('peel');

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (onToggleFavorite) {
        onToggleFavorite(item);
      }

      lastTapRef.current = 0; // Reset
    } else {
      // SINGLE TAP CANDIDATE
      lastTapRef.current = now;

      // Wait to see if a second tap comes
      singleTapTimeoutRef.current = setTimeout(() => {
        console.log('MANUAL: Single Tap Confirmed');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Trigger Animation
        tiltX.value = withSequence(withSpring(5), withSpring(0));
        tiltY.value = withSequence(withSpring(-3), withSpring(0));

        if (onSingleTapAction) {
          onSingleTapAction();
        }
        singleTapTimeoutRef.current = null;
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleLongPress = () => {
    console.log('MANUAL: Long Press Detected');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onLongPressAction) {
      onLongPressAction();
    }
  };

  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
    };
  }, []);

  /* Animation Disabled per User Request
  if (isGrail) {
    grailPulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 800 }),
        withTiming(1, { duration: 800 })
      ),
      -1,
      true
    );
  }
  */

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateX: `${interpolate(tiltY.value, [0, 10], [0, 8])}deg` },
      { rotateY: `${interpolate(tiltX.value, [0, 10], [0, -8])}deg` },
      { scale: scale * (isGrail ? grailPulse.value : 1) },
    ],
    opacity: isWishlist && !isGrail ? 0.6 : 1, // Disable ghosting for Grails
  }));

  // Border Logic:
  // Wishlist (Non-Grail) -> Dashed Grey on Wrapper
  // Grail -> No Border on Wrapper (Moved to Image)
  // Standard -> No Border
  const cardWrapperStyle = isWishlist && !isGrail
    ? [{ borderWidth: 2, borderStyle: 'dashed' as const, borderColor: '#6b7280', borderRadius: 12 }]
    : [];

  // Unified Width: 100 for proper spacing (Digital was too wide at 180)
  const baseWidth = 100;
  const layoutWidth = baseWidth * scale + 16;
  const contentHeight = (isPhysical ? 250 : 180) * scale; // Increased base and made scale-aware

  // Ensure wrapper has explicit dimensions to prevent collapse
  const wrapperStyle = {
    width: layoutWidth,
    alignItems: 'center' as const,
    marginHorizontal: 4,
    justifyContent: 'flex-end' as const,
    minHeight: contentHeight,
    overflow: 'visible' as const,
  };

  const CardContent = () => {
    // Format Logo mapping for physical cards
    const getPhysicalLogo = (format: string) => {
      switch (format) {
        case 'VHS': return require('@/assets/images/overlays/formats/VHS.png');
        case 'DVD': return require('@/assets/images/overlays/formats/DVD.png');
        case 'BluRay': return require('@/assets/images/overlays/formats/BluRay.png');
        case '4K': return require('@/assets/images/overlays/formats/4K Ultra.png');
        default: return null;
      }
    };

    // Unified Layout for both Physical and Digital
    return (
      <View className="items-center" style={{ overflow: 'visible', width: 100 }}>
        {isPhysical ? (
          item.format === 'VHS' ? (
            <VHSCard
              posterUrl={posterUrl}
              isCustom={!!item.custom_poster_url}
              style={{
                width: 100,
                // GRAIL BORDER logic (Physical Only)
                borderWidth: isGrail ? 2 : 0,
                borderColor: '#ffd700',
              }}
            />
          ) : (
            <GlossyCard
              posterUrl={posterUrl}
              format={item.format as any}
              isCustom={!!item.custom_poster_url}
              style={{
                width: 100,
                // GRAIL BORDER logic (Physical Only)
                borderWidth: isGrail ? 2 : 0,
                borderColor: '#ffd700',
              }}
            />
          )
        ) : (
          /* Digital Poster Image */
          <View
            className="bg-neutral-900 rounded-lg overflow-hidden relative"
            style={{
              width: 100,
              aspectRatio: 2 / 3, // Force standard poster ratio for Digital
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.7,
              shadowRadius: 20,
              elevation: 12,
              borderWidth: !isWishlist ? 2 : 0,
              borderColor: '#00ff88', // Green for Digital
            }}
          >
            {posterUrl ? (
              <Image
                source={{ uri: posterUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <View className="flex-1 items-center justify-center bg-neutral-800">
                <Text className="text-neutral-500 font-mono text-xs text-center px-2">
                  {movie.title}
                </Text>
              </View>
            )}

            {/* Format Logo for Digital */}
            <Image
              source={require('@/assets/images/overlays/formats/Digital.png')}
              style={{ position: 'absolute', bottom: 6, right: 6, width: 30, height: 18, opacity: 0.9, zIndex: 40 }}
              contentFit="contain"
            />
          </View>
        )}

        {/* Sticker Overlays on top of the card wrapper */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, pointerEvents: 'none' }}>
          {/* Physical: Staff Pick */}
          {item.is_on_display && isPhysical && !isWishlist && <StickerOverlay visible={true} size={40} />}
          {/* Digital: Now Streaming */}
          {item.is_on_display && !isPhysical && !isWishlist && <NowStreamingSticker visible={true} size={32} scale={0.55} />}
        </View>

        {
          isGrail && isWishlist && (
            <SaleSticker visible={true} size={40} />
          )
        }

        <View style={{ height: 'auto', minHeight: 60, width: 100, marginTop: 8, alignItems: 'center', justifyContent: 'flex-start' }}>
          <Text
            className="text-white font-mono text-xs text-center leading-3"
            numberOfLines={2}
            style={{ marginBottom: 4 }}
          >
            {movie.title}
          </Text>
          <View className="px-2 py-1 rounded mt-1 bg-amber-900/80">
            <Text className="font-mono text-[10px] text-amber-200">
              {isPhysical ? item.format : (item.digital_provider || 'Digital')}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={wrapperStyle}>
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={500}
        hitSlop={10}
      >
        <Animated.View
          style={[
            animatedStyle,
            { width: baseWidth },
            ...cardWrapperStyle,
          ]}
        >
          <CardContent />
        </Animated.View>
      </Pressable>
    </View>
  );
}
