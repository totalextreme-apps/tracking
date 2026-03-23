import { useSound } from '@/context/SoundContext';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMedia } from '@/types/database';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring
} from 'react-native-reanimated';
import { BootlegSticker } from './BootlegSticker';
import { GlossyCard } from './GlossyCard';
import { NowStreamingSticker } from './NowStreamingSticker';
import { SaleSticker } from './SaleSticker';
import { StickerOverlay } from './StickerOverlay';
import { VHSCard } from './VHSCard';


type OnDisplayCardProps = {
  item: CollectionItemWithMedia;
  scale?: number;
  onSingleTapAction?: () => void;
  onLongPressAction?: () => void;
  onToggleFavorite?: (item: CollectionItemWithMedia) => void;
  onRatePress?: (rating: number) => void;
};

export function OnDisplayCard({ item, scale = 1.5, onSingleTapAction, onLongPressAction, onToggleFavorite, onRatePress }: OnDisplayCardProps) {
  const { playSound } = useSound();
  const media = item.movies || item.shows;
  if (!media) return null;

  const isPhysical = item.format !== 'Digital';
  const isWishlist = item.status === 'wishlist';
  const isGrail = item.is_grail;
  const tmdbPosterUrl = getPosterUrl(media?.poster_path);
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound('peel');

      if (onToggleFavorite) {
        onToggleFavorite(item);
      }

      lastTapRef.current = 0; // Reset
    } else {
      // SINGLE TAP CANDIDATE
      lastTapRef.current = now;

      // Wait to see if a second tap comes
      singleTapTimeoutRef.current = setTimeout(() => {
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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateX: `${interpolate(tiltY.value, [0, 10], [0, 8])}deg` },
      { rotateY: `${interpolate(tiltX.value, [0, 10], [0, -8])}deg` },
      { scale: scale * (isGrail ? grailPulse.value : 1) },
    ],
    opacity: isWishlist && !isGrail ? 0.6 : 1,
  }));

  const cardWrapperStyle = isWishlist && !isGrail
    ? [{ borderWidth: 2, borderStyle: 'dashed' as const, borderColor: '#6b7280', borderRadius: 12 }]
    : [];

  const baseWidth = 100;
  const layoutWidth = baseWidth * scale + 10;
  const contentHeight = (isPhysical ? 180 : 160) * scale;

  const wrapperStyle = {
    width: layoutWidth,
    alignItems: 'center' as const,
    marginHorizontal: 2,
    justifyContent: 'center' as const,
    height: contentHeight,
    overflow: 'visible' as const,
  };

  const CardContent = () => {
    return (
      <View className="items-center" style={{ overflow: 'visible', width: 100 }}>
        {isPhysical ? (
          item.format === 'VHS' ? (
            <VHSCard
              posterUrl={posterUrl}
              isCustom={!!item.custom_poster_url}
              isBootleg={item.is_bootleg}
              style={{
                width: 100,
                borderWidth: isGrail ? 2 : 0,
                borderColor: '#ffd700',
              }}
            />
          ) : (
            <GlossyCard
              posterUrl={posterUrl}
              format={item.format as any}
              isCustom={!!item.custom_poster_url}
              isBootleg={item.is_bootleg}
              style={{
                width: 100,
                borderWidth: isGrail ? 2 : 0,
                borderColor: '#ffd700',
              }}
            />
          )
        ) : (
          <View
            className="bg-neutral-900 rounded-lg overflow-hidden relative"
            style={{
              width: 100,
              aspectRatio: 2 / 3,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.7,
              shadowRadius: 20,
              elevation: 12,
              borderWidth: !isWishlist ? 2 : 2,
              borderColor: isGrail ? '#ffd700' : '#00ff88',
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
                  {item.movies?.title || item.shows?.name}
                </Text>
              </View>
            )}

            <Image
              source={require('@/assets/images/overlays/formats/Digital.png')}
              style={{ position: 'absolute', bottom: 6, right: 6, width: 30, height: 18, opacity: 0.9, zIndex: 40 }}
              contentFit="contain"
            />
          </View>
        )}

        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150, zIndex: 100, pointerEvents: 'none' }}>
          {/* Pick sticker for owned items */}
          {item.is_on_display && !isWishlist && (
            isPhysical
              ? <StickerOverlay visible={true} size={40} />
              : <NowStreamingSticker visible={true} size={32} scale={0.55} />
          )}

          {/* Grail sticker for wishlist items */}
          {item.is_grail && isWishlist && (
            <SaleSticker visible={true} size={40} />
          )}

          {/* Bootleg Sticker - Digital ONLY */}
          {!isPhysical && item.is_bootleg && <BootlegSticker size={30} />}
        </View>

        <View style={{ height: 'auto', minHeight: 18, width: 100, marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* STAR RATING LEFT */}
          <View className="flex-row">
            {item.rating ? (
              [...Array(5)].map((_, i) => (
                <Pressable key={i} onPress={(e) => { e.stopPropagation(); onRatePress?.(i + 1); }} hitSlop={5}>
                  <FontAwesome name={i < item.rating! ? 'star' : 'star-o'} size={8} color={i < item.rating! ? '#f59e0b' : '#404040'} style={{ marginRight: 1 }} />
                </Pressable>
              ))
            ) : (
              [...Array(5)].map((_, i) => (
                <Pressable key={i} onPress={(e) => { e.stopPropagation(); onRatePress?.(i + 1); }} hitSlop={5}>
                  <FontAwesome name="star-o" size={8} color="#404040" style={{ marginRight: 1 }} />
                </Pressable>
              ))
            )}
          </View>
          
          {/* LABELS RIGHT */}
          <View className="flex-row gap-0.5 justify-end items-center shrink">
            <View className="px-1 py-0.5 rounded bg-amber-900/80">
              <Text className="font-mono text-[7px] text-amber-200 uppercase whitespace-nowrap" numberOfLines={1}>
                {isPhysical ? (item.format === 'BluRay' ? 'Blu-ray' : item.format) : (item.digital_provider || 'Digital')}
              </Text>
            </View>
            {item.media_type === 'tv' && (
              <View className="px-1 py-0.5 rounded bg-blue-900/80">
                <Text className="font-mono text-[7px] text-blue-200 whitespace-nowrap" numberOfLines={1}>
                  S{item.season_number}
                </Text>
              </View>
            )}
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
