import { useSound } from '@/context/SoundContext';
import { getCustomArt } from '@/lib/custom-art-storage';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMovie } from '@/types/database';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { GlossyCard } from './GlossyCard';
import { HaloEffect } from './HaloEffect';
import { SaleSticker } from './SaleSticker';
import { StickerOverlay } from './StickerOverlay';
import { VHSCard } from './VHSCard';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FORMAT_ORDER: Record<string, number> = {
  '4K': 5,
  BluRay: 4,
  DVD: 3,
  VHS: 2,
  Digital: 1,
};

const FORMAT_COLORS: Record<string, string> = {
  '4K': 'bg-yellow-500',
  BluRay: 'bg-blue-500',
  DVD: 'bg-purple-500',
  VHS: 'bg-red-500',
  Digital: 'bg-green-500',
};

function sortByQuality(items: CollectionItemWithMovie[]): CollectionItemWithMovie[] {
  return [...items].sort(
    (a, b) => (FORMAT_ORDER[b.format] ?? 0) - (FORMAT_ORDER[a.format] ?? 0)
  );
}

type StackCardProps = {
  stack: CollectionItemWithMovie[];
  onAcquiredPress?: (item: CollectionItemWithMovie) => void;
  onLongPress?: (item: CollectionItemWithMovie) => void;
  onPress?: () => void;
  onToggleFavorite?: (item: CollectionItemWithMovie) => void;
  width?: number;
  height?: number;
  stackOffset?: number;
  mode?: 'grid' | 'list';
};

const DEFAULT_CARD_WIDTH = 100;
const DEFAULT_CARD_HEIGHT = 150;
const DEFAULT_OFFSET = 4;

export function StackCard({
  stack,
  onAcquiredPress,
  onLongPress,
  onPress: onCardPress,
  onToggleFavorite,
  width = DEFAULT_CARD_WIDTH,
  height = DEFAULT_CARD_HEIGHT,
  stackOffset = DEFAULT_OFFSET,
  mode = 'grid'
}: StackCardProps) {
  const defaultSorted = useMemo(() => sortByQuality(stack), [stack]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastTapRef = useRef<number>(0);
  const { playSound } = useSound();
  const [customArtUri, setCustomArtUri] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!activeId) return defaultSorted;
    const activeItem = defaultSorted.find((i) => i.id === activeId);
    if (!activeItem) return defaultSorted;
    return [activeItem, ...defaultSorted.filter((i) => i.id !== activeId)];
  }, [defaultSorted, activeId]);

  const topItem = sorted[0];
  const movie = topItem.movies!;
  const isPhysical = topItem.format !== 'Digital';
  const isWishlist = topItem.status === 'wishlist';
  const isGrail = topItem.is_grail;
  const isOnDisplay = topItem.is_on_display;
  const tmdbPosterUrl = getPosterUrl(movie.poster_path);
  const posterUrl = customArtUri || tmdbPosterUrl;

  // Load custom art for top item (web only)
  useEffect(() => {
    if (Platform.OS !== 'web' || !topItem) return;

    getCustomArt(topItem.id)
      .then((uri: string | null) => setCustomArtUri(uri))
      .catch(() => setCustomArtUri(null));
  }, [topItem.id]);

  const tiltX = useSharedValue(0);
  const tiltY = useSharedValue(0);
  const grailPulse = useSharedValue(1);

  useEffect(() => {
    if (isGrail) {
      grailPulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      );
    }
  }, [isGrail]);

  const handlePress = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      onToggleFavorite?.(topItem);
      lastTapRef.current = 0; // Reset to prevent triple-tap triggering
    } else {
      // Single tap
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          // No second tap came, it's a single tap
          playSound('click');
          onCardPress?.();
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const onPressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tiltX.value = withSpring(6);
    tiltY.value = withSpring(-4);
  };

  const onPressOut = () => {
    tiltX.value = withSpring(0);
    tiltY.value = withSpring(0);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateX: `${interpolate(tiltY.value, [0, 10], [0, 6])}deg` },
      { rotateY: `${interpolate(tiltX.value, [0, 10], [0, -6])}deg` },
      { scale: isGrail ? grailPulse.value : 1 },
    ],
    opacity: isWishlist ? 0.6 : 1,
  }));

  // Border Logic
  // Wrapper: Only Dashed/Wishlist (if not grail? No, user wants grail border on image)
  // StackCard Wrapper actually doesn't use cardWrapperStyle much, it uses 'cardBorderStyle'.
  // We need to REMOVE yellow border from Wrapper if it was there.
  const cardBorderStyle = isGrail
    ? {} // No border on wrapper for Grail
    : isWishlist
      ? {} // Dashed border is handled by inner view or here? Inner view has it.
      : {};

  if (mode === 'list') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        onLongPress={() => onLongPress?.(topItem)}
        delayLongPress={500}
        style={[{
          width: width,
          height: height,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#171717',
          borderRadius: 8,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isWishlist ? '#404040' : '#262626',
          borderStyle: isWishlist ? 'dashed' : 'solid',
        }, isWishlist ? { opacity: 0.6 } : {}]}
      >
        {/* Thumbnail Section */}
        <View style={{ height: '100%', aspectRatio: 2 / 3, backgroundColor: '#262626' }}>
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-neutral-600 text-[10px] font-mono p-1 text-center">
                {movie.title.substring(0, 4)}
              </Text>
            </View>
          )}

          {isGrail && (
            <View className="absolute top-0 right-0 p-1 bg-amber-500 rounded-bl">
              <FontAwesome name="star" size={8} color="black" />
            </View>
          )}
        </View>

        {/* Info Section */}
        <View className="flex-1 px-3 py-1 justify-center">
          <Text className="text-white font-bold text-sm leading-4" numberOfLines={1}>
            {movie.title.toUpperCase()}
          </Text>
          <Text className="text-neutral-500 font-mono text-[10px] my-0.5">
            {movie.release_date?.substring(0, 4) || '????'}
          </Text>

          {/* Format Coins */}
          <View className="flex-row gap-1.5 mt-1 flex-wrap">
            {defaultSorted.map(item => (
              <View key={item.id} className="items-center">
                <View
                  className={`w-5 h-5 rounded-full items-center justify-center ${FORMAT_COLORS[item.format] || 'bg-neutral-700'}`}
                  style={{
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.3,
                    shadowRadius: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 2
                  }}
                >
                  <Text style={{ fontSize: 6, fontWeight: 'bold', color: 'white' }}>
                    {item.format === '4K' ? '4K' :
                      item.format === 'BluRay' ? 'BR' :
                        item.format === 'DVD' ? 'DVD' :
                          item.format === 'VHS' ? 'VHS' : 'DIG'}
                  </Text>
                  {item.edition && (
                    <Text style={{ fontSize: 7, color: 'white', opacity: 0.6 }}>
                      •
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Favorite Icon */}
        {isOnDisplay && (
          <View className="pr-4">
            <FontAwesome name="thumb-tack" size={12} color="#f59e0b" style={{ transform: [{ rotate: '45deg' }] }} />
          </View>
        )}
      </AnimatedPressable>
    );
  }

  if (isPhysical) {
    // Physical stack: cards peeking out from behind
    return (
      <AnimatedPressable
        onPress={handlePress}
        onLongPress={() => onLongPress?.(topItem)}
        delayLongPress={500}
        onPressIn={isWishlist ? undefined : onPressIn}
        onPressOut={isWishlist ? undefined : onPressOut}
        style={[
          animatedStyle,
          { width: width + stackOffset * (sorted.length - 1), margin: 6 },
        ]}
      >
        <View className="items-center">
          <View className="relative" style={{ width: width, height: height + (sorted.length - 1) * stackOffset * 0.5 }}>
            {/* Sticker Overlays */}
            {isOnDisplay && !isWishlist && <StickerOverlay visible={isOnDisplay} size={40} />}
            {isGrail && isWishlist && <SaleSticker visible={true} size={40} />}

            {/* Poster Image */}
            <View
              className={`rounded-lg overflow-hidden relative bg-neutral-800 ${isWishlist ? 'border-2 border-dashed border-neutral-600' : ''}`}
              style={{
                width: '100%',
                height: '100%',
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

              {/* GRAIL BORDER OVERLAY - Absolute to sit ON TOP of image */}
              {isGrail && (
                <View
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderWidth: 3,
                    borderColor: '#ffd700',
                    borderRadius: 8,
                    zIndex: 30
                  }}
                  pointerEvents="none"
                />
              )}
            </View>
            {isWishlist && (
              <View
                className="absolute inset-0 rounded-xl z-20"
                style={{
                  backgroundColor: 'rgba(100,100,100,0.35)',
                }}
              />
            )}
            {sorted.map((item, idx) => {
              const offset = idx * stackOffset;
              const itemMovie = item.movies!;
              const url = getPosterUrl(itemMovie.poster_path);
              const isVHS = item.format === 'VHS';
              const isDisc = ['DVD', 'BluRay', '4K'].includes(item.format);

              // Fix: If this is the top item and it's a wishlist item, skip rendering the physical card overlay.
              // We want to show the underlying "Wishlist Placeholder" (View at line 180) which has the correct
              // dashed border (or Yellow Grail border) and opacity styling.
              if (idx === 0 && isWishlist) return null;

              const itemStyle = {
                position: 'absolute' as const,
                left: offset,
                top: offset * 0.5,
                width: width,
                height: height,
                zIndex: sorted.length - idx,
              };

              if (isVHS) {
                return <VHSCard key={item.id} posterUrl={url} style={itemStyle} />;
              }
              if (isDisc) {
                return <GlossyCard key={item.id} posterUrl={url} format={item.format} style={itemStyle} />;
              }

              return (
                <View
                  key={item.id}
                  className="absolute bg-neutral-900 rounded-xl overflow-hidden"
                  style={{
                    ...itemStyle,
                    shadowColor: '#000',
                    shadowOffset: { width: 2, height: 4 },
                    shadowOpacity: 0.4,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  {url ? (
                    <Image
                      source={{ uri: url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center bg-neutral-800">
                      <Text className="text-neutral-500 font-mono text-xs text-center px-2">
                        {itemMovie.title}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <Text
            className="text-white font-mono text-sm mt-3 text-center"
            numberOfLines={2}
          >
            {movie.title}
          </Text>
          <View className="flex-row flex-wrap justify-center gap-1 mt-2">
            {defaultSorted.map((item) => (
              <Pressable
                key={item.id}
                onPress={(e) => {
                  e.stopPropagation();
                  playSound('click');
                  setActiveId(item.id);
                }}
                className={`px-2 py-0.5 rounded flex-row items-center gap-1 ${FORMAT_COLORS[item.format] || 'bg-neutral-700'}`}
              >
                <Text className="text-white font-mono text-[10px] font-bold">
                  {item.format}
                </Text>
                {item.edition && (
                  <Text className="text-white/60 font-mono text-[9px]">
                    •
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </AnimatedPressable>
    );
  }

  // Digital: single card with glowing border
  return (
    <AnimatedPressable
      onPress={handlePress}
      onLongPress={() => onLongPress?.(topItem)}
      delayLongPress={500}
      onPressIn={isWishlist ? undefined : onPressIn}
      onPressOut={isWishlist ? undefined : onPressOut}
      style={[animatedStyle, { width: width, margin: 6 }, cardBorderStyle]}
    >
      <View className="items-center" style={{ position: 'relative' }}>
        {/* Halo Effect for Favorited Digital Items */}
        {isOnDisplay && !isWishlist && (
          <HaloEffect visible={true} size={width + 20} />
        )}

        <View
          className="rounded-xl overflow-hidden relative"
          style={{
            width: width,
            height: height,
            borderWidth: isWishlist ? 2 : 3,
            borderStyle: isWishlist ? 'dashed' : 'solid',
            borderColor: isWishlist ? '#6b7280' : 'rgba(0, 255, 136, 0.8)',
            shadowColor: isWishlist ? '#000' : '#00ff88',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: isWishlist ? 0.3 : 0.9,
            shadowRadius: isWishlist ? 8 : 16,
            elevation: 12,
          }}
        >
          {isWishlist && (
            <View
              className="absolute inset-0 rounded-xl z-10"
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

          {/* Format Logo for Digital */}
          <Image
            source={require('@/assets/images/overlays/formats/Digital.png')}
            style={{ position: 'absolute', bottom: 6, right: 6, width: 40, height: 25, opacity: 0.9 }}
            contentFit="contain"
          />
        </View>
        <Text
          className="text-white font-mono text-xs mt-2 text-center"
          numberOfLines={1}
        >
          {movie.title}
        </Text>

        {/* Format Selectors for Digital too! */}
        <View className="flex-row flex-wrap justify-center gap-1 mt-2">
          {defaultSorted.map((item) => (
            <Pressable
              key={item.id}
              onPress={(e) => {
                e.stopPropagation();
                playSound('click');
                setActiveId(item.id);
              }}
              className={`px-2 py-0.5 rounded flex-row items-center gap-1 ${FORMAT_COLORS[item.format] || 'bg-neutral-700'}`}
            >
              <Text className="text-white font-mono text-[10px] font-bold">
                {item.format}
              </Text>
              {item.edition && (
                <Text className="text-white/60 font-mono text-[9px]">
                  •
                </Text>
              )}
            </Pressable>
          ))}
        </View>

        <View className="mt-1 px-2 py-0.5 bg-emerald-900/80 rounded">
          <Text className="text-emerald-200 font-mono text-[10px]">
            {topItem.digital_provider ?? 'Digital'}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}
