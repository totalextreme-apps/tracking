import { getCustomArt } from '@/lib/custom-art-storage';
import { getBackdropUrl, getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMovie } from '@/types/database';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring
} from 'react-native-reanimated';
import { NowStreamingSticker } from './NowStreamingSticker';
import { SaleSticker } from './SaleSticker';
import { StickerOverlay } from './StickerOverlay';

type OnDisplayCardProps = {
  item: CollectionItemWithMovie;
  scale?: number;
  // Renamed to be explicit
  onSingleTapAction?: () => void;
  onLongPressAction?: () => void;
  onToggleFavorite?: (item: CollectionItemWithMovie) => void;
};

export function OnDisplayCard({ item, scale = 1.5, onSingleTapAction, onLongPressAction, onToggleFavorite }: OnDisplayCardProps) {
  const movie = item.movies!;
  const isPhysical = item.format !== 'Digital';
  const isWishlist = item.status === 'wishlist';
  const isGrail = item.is_grail;
  const tmdbPosterUrl = getPosterUrl(movie.poster_path);
  const backdropUrl = getBackdropUrl(movie.backdrop_path);
  const [customArtUri, setCustomArtUri] = useState<string | null>(null);
  const posterUrl = customArtUri || tmdbPosterUrl;

  // Load custom art (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !item?.id) return;

    getCustomArt(item.id)
      .then((uri: string | null) => setCustomArtUri(uri))
      .catch(() => setCustomArtUri(null));
  }, [item.id]);

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

  const baseWidth = isPhysical ? 100 : 180;
  const layoutWidth = baseWidth * scale + 16;
  const contentHeight = isPhysical ? 230 : 160;

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
        {/* Poster Image */}
        <View
          className="bg-neutral-900 rounded-lg overflow-hidden relative"
          style={{
            width: 100,
            height: 150,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.7,
            shadowRadius: 20,
            elevation: 12,
            // GRAIL BORDER logic preserved
            borderWidth: isGrail ? 2 : (isPhysical ? 0 : 2), // Digital keeps green border
            borderColor: isGrail ? '#ffd700' : 'rgba(0, 255, 136, 0.8)', // Green for digital
          }}
        >
          {/* Sticker Logic */}
          {/* Physical: Staff Pick */}
          {item.is_on_display && isPhysical && !isWishlist && <StickerOverlay visible={true} size={40} />}
          {/* Digital: Now Streaming */}
          {item.is_on_display && !isPhysical && !isWishlist && <NowStreamingSticker visible={true} size={40} />}

          {isWishlist && (
            <View
              className="absolute inset-0 rounded-lg z-10"
              style={{ backgroundColor: 'rgba(100,100,100,0.35)' }}
            />
          )}

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

          {/* Format Logo Overlay for Physical */}
          {isPhysical && getPhysicalLogo(item.format) && (
            <Image
              source={getPhysicalLogo(item.format)}
              style={{ position: 'absolute', bottom: 6, right: 6, width: 30, height: 18, opacity: 0.9, zIndex: 40 }}
              contentFit="contain"
            />
          )}

          {/* Digital Gradient Overlay */}
          {!isPhysical && (
            <View
              className="absolute bottom-0 left-0 right-0 h-12"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            />
          )}
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
          <View className={`px-3 py-1 rounded mt-1 ${isPhysical ? 'bg-amber-900/80' : 'bg-emerald-900/80'}`}>
            <Text className={`font-mono text-[10px] ${isPhysical ? 'text-amber-200' : 'text-emerald-200'}`}>
              {item.digital_provider || item.format}
            </Text>
          </View>
        </View >
      </View >
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
