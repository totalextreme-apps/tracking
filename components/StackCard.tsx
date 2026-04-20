import { useSound } from '@/context/SoundContext';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMedia } from '@/types/database';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BootlegSticker } from './BootlegSticker';
import { GlossyCard } from './GlossyCard';
import { NowStreamingSticker } from './NowStreamingSticker';
import { SaleSticker } from './SaleSticker';
import { TradeSticker } from './TradeSticker';
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

function sortByQuality(items: CollectionItemWithMedia[]): CollectionItemWithMedia[] {
  return [...items].sort(
    (a, b) => (FORMAT_ORDER[b.format] ?? 0) - (FORMAT_ORDER[a.format] ?? 0)
  );
}

type StackCardProps = {
  stack: CollectionItemWithMedia[];
  onAcquiredPress?: (item: CollectionItemWithMedia) => void;
  onLongPress?: (item: CollectionItemWithMedia) => void;
  onPress?: () => void;
  onToggleFavorite?: (item: CollectionItemWithMedia) => void;
  onRatePress?: (rating: number) => void;
  width?: number;
  height?: number;
  stackOffset?: number;
  mode?: 'grid' | 'list';
  activeFormatFilter?: string | null;
};

const DEFAULT_CARD_WIDTH = 100;
const DEFAULT_CARD_HEIGHT = 150;

const getStackTransforms = (idx: number) => {
  if (idx === 0) return { rotate: '0deg', left: 0, top: 0 };
  
  const rotations = ['-6deg', '5deg', '-4deg', '7deg', '-5deg', '4deg'];
  const shiftsX = [-5, 7, -4, 6, -6, 5];
  const shiftsY = [6, 12, 18, 24, 30, 36]; // Increasing Y significantly to build bolder depth
  
  const r = rotations[(idx - 1) % rotations.length];
  const x = shiftsX[(idx - 1) % shiftsX.length];
  const y = shiftsY[(idx - 1) % shiftsY.length];
  
  return { rotate: r, left: x, top: y };
};

export function StackCard({
  stack,
  onAcquiredPress,
  onLongPress,
  onPress: onCardPress,
  onToggleFavorite,
  onRatePress,
  width = DEFAULT_CARD_WIDTH,
  height = DEFAULT_CARD_HEIGHT,
  stackOffset, // Kept to not break signature, but unused
  mode = 'grid',
  activeFormatFilter = null
}: StackCardProps) {
  const defaultSorted = useMemo(() => {
    const qualitySorted = sortByQuality(stack);
    if (!activeFormatFilter) return qualitySorted;

    const matching = [];
    const others = [];
    for (const item of qualitySorted) {
      if (activeFormatFilter === 'BOOTLEG' && item.is_bootleg) {
        matching.push(item);
      } else if (item.format === activeFormatFilter) {
        matching.push(item);
      } else {
        others.push(item);
      }
    }
    return [...matching, ...others];
  }, [stack, activeFormatFilter]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const lastTapRef = useRef<number>(0);
  const { playSound } = useSound();
  const [customArtUri, setCustomArtUri] = useState<string | null>(null);

  const sorted = useMemo(() => {
    // Deduplicate "Digital" formats - only keep the first one
    const uniqueItems: CollectionItemWithMedia[] = [];
    const hasDigital = false;

    // First, get the sorted list as usual
    let items = [...defaultSorted];

    // If activeId is set, move it to front
    if (activeId) {
      const activeItem = items.find((i) => i.id === activeId);
      if (activeItem) {
        items = [activeItem, ...items.filter((i) => i.id !== activeId)];
      }
    }

    // Aggressive deduplication: One coin per unique "Format + Edition" combo
    const seenKeys = new Set();
    const result: CollectionItemWithMedia[] = [];

    for (const originalItem of items) {
      // Clone to avoid mutating original data
      const item = { ...originalItem };

      let fmt = item.format.trim();

      // Normalize ANY string containing "digital" to exactly "Digital"
      // This works for "Digital 4K", "Digital HD", "Digital Copy", etc.
      // FORCE the format to 'Digital' so it gets generic Green color lookup
      if (fmt.toLowerCase().includes('digital')) {
        fmt = 'Digital';
        item.format = 'Digital';
      }

      // Key off Normalized Format + Edition
      const edition = (item.edition || '').trim().toLowerCase();
      const key = `${fmt}|${edition}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        result.push(item);
      } else {
        // If we already added this format/edition, but THIS duplicate is a bootleg, tag the coin so the sticker appears!
        const existing = result.find(i => `${i.format.trim()}|${(i.edition || '').trim().toLowerCase()}` === key || (`Digital|${(i.edition || '').trim().toLowerCase()}` === key && i.format.toLowerCase().includes('digital')));
        if (existing && item.is_bootleg) {
          existing.is_bootleg = true;
        }
      }
    }

    return result;
  }, [defaultSorted, activeId]);

  const topItem = sorted[0];
  const media = topItem.movies || topItem.shows;
  
  const isPhysical = topItem.format !== 'Digital';
  const isWishlist = topItem.status === 'wishlist';
  const isGrail = topItem.is_grail;
  const isOnDisplay = topItem.is_on_display;
  const tmdbPosterUrl = media ? getPosterUrl(media.poster_path) : null;
  const hasCustomPoster = sorted.some(i => !!i.custom_poster_url);
  const posterUrl = sorted.find(i => !!i.custom_poster_url)?.custom_poster_url || tmdbPosterUrl;

  // Calculate Aspect Ratio based on Top Item
  const isBluRay = topItem.format === 'BluRay' || topItem.format === '4K';

  // Use format-specific ratios only for custom covers
  // Standard posters use 2/3 ratio to prevent cropping
  const aspectRatio = hasCustomPoster
    ? (topItem.format === 'VHS' ? 0.57 : isBluRay ? 0.78 : 0.71)
    : (topItem.format === 'Digital' ? 2 / 3 : 2 / 3); // Digital is already 2/3

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
      playSound('peel');
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
    // Disable bounce effect for Digital items
    if (!isPhysical) return;

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
        <View style={{ height: '100%', aspectRatio, backgroundColor: '#262626' }}>
          {topItem.format === 'VHS' ? (
            <VHSCard posterUrl={posterUrl} isCustom={!!topItem.custom_poster_url} isBootleg={topItem.is_bootleg} style={{ width: '100%', height: '100%' }} />
          ) : ['DVD', 'BluRay', '4K'].includes(topItem.format) ? (
            <GlossyCard posterUrl={posterUrl} format={topItem.format as any} isCustom={!!topItem.custom_poster_url} isBootleg={topItem.is_bootleg} style={{ width: '100%', height: '100%' }} />
          ) : posterUrl ? (
            <View style={{ width: '100%', height: '100%' }}>
              <Image
                source={{ uri: posterUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
              {topItem.is_bootleg && <BootlegSticker size={20} />}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-neutral-600 text-[10px] font-mono p-1 text-center">
                {topItem.movies?.title || topItem.shows?.name}
              </Text>
            </View>
          )}
        </View>
        {/* Info Section */}
        <View className="flex-1 px-3 py-1 justify-center">
          <View className="flex-row mb-1">
             {topItem.rating ? (
               [...Array(5)].map((_, i) => (
                 <Pressable key={i} onPress={(e) => { e.stopPropagation(); onRatePress?.(i + 1); }} hitSlop={5}>
                   <FontAwesome name={i < topItem.rating! ? 'star' : 'star-o'} size={12} color={i < topItem.rating! ? '#f59e0b' : '#404040'} style={{ marginRight: 2 }} />
                 </Pressable>
               ))
             ) : (
               [...Array(5)].map((_, i) => (
                 <Pressable key={i} onPress={(e) => { e.stopPropagation(); onRatePress?.(i + 1); }} hitSlop={5}>
                   <FontAwesome name="star-o" size={12} color="#404040" style={{ marginRight: 2 }} />
                 </Pressable>
               ))
             )}
          </View>
          <Text className="text-neutral-500 font-mono text-[10px] my-0.5">
            {topItem.movies?.release_date?.substring(0, 4) || topItem.shows?.first_air_date?.substring(0, 4) || '????'}
            {topItem.media_type === 'tv' && ` • S${topItem.season_number}`}
          </Text>

          {/* Format Coins */}
          <View className="flex-row gap-1.5 mt-1 flex-wrap">
            {sorted.map(item => (
              <View key={item.id} className="items-center">
                <View
                  className={`px-1.5 h-4 rounded items-center justify-center ${FORMAT_COLORS[item.format] || 'bg-neutral-700'}`}
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
                  <Text style={{ fontSize: 7, fontWeight: 'bold', color: 'white', fontFamily: 'SpaceMono' }}>
                    {item.format === 'BluRay' ? 'Blu-ray' : item.format}
                  </Text>
                  {item.is_bootleg && (
                    <Image source={require('@/assets/images/overlays/boot_sticker.png')} style={{ width: 10, height: 10, marginLeft: 2 }} contentFit="contain" />
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
    // Physical stack: cards peeking out from behind ONLY if multiple items exist
    if (sorted.length > 1) {
      const maxShiftY = getStackTransforms(sorted.length - 1).top;
      const paddingBuffer = 15;
      const containerHeight = (width / aspectRatio) + maxShiftY + paddingBuffer;

      return (
        <AnimatedPressable
          onPress={handlePress}
          onLongPress={() => onLongPress?.(topItem)}
          delayLongPress={500}
          onPressIn={isWishlist ? undefined : onPressIn}
          onPressOut={isWishlist ? undefined : onPressOut}
          style={[
            animatedStyle,
            { width: width + 10, margin: 6 },
          ]}
        >
          <View className="items-center" style={{ paddingTop: 10 }}>
            <View className="relative" style={{ width: width, height: containerHeight }}>
              {/* Sticker Overlays */}
              {isOnDisplay && !isWishlist && <StickerOverlay visible={isOnDisplay} size={40} />}
              {topItem.for_sale && <SaleSticker visible={true} size={40} />}
              {topItem.for_trade && <TradeSticker visible={true} size={40} />}

              {sorted.map((item, idx) => {
                const transforms = getStackTransforms(idx);
                const itemMedia = item.movies || item.shows;
                const url = item.custom_poster_url || (itemMedia ? getPosterUrl(itemMedia.poster_path) : null);
                
                const itemStyle = {
                  position: 'absolute' as const,
                  left: transforms.left,
                  top: transforms.top,
                  transform: [{ rotate: transforms.rotate }],
                  width: width,
                  height: width / aspectRatio,
                  zIndex: sorted.length - idx,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.8,
                  shadowRadius: 8,
                  elevation: 10,
                };

                if (item.format === 'VHS') {
                  return <VHSCard key={item.id} posterUrl={url} isCustom={!!item.custom_poster_url} isBootleg={item.is_bootleg} style={itemStyle} />;
                }
                if (['DVD', 'BluRay', '4K'].includes(item.format)) {
                  return <GlossyCard key={item.id} posterUrl={url} format={item.format as any} isCustom={!!item.custom_poster_url} isBootleg={item.is_bootleg} style={itemStyle} />;
                }

                return (
                  <View key={item.id} className="absolute bg-neutral-900 rounded overflow-hidden" style={itemStyle}>
                    {url ? (
                      <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                    ) : (
                      <View className="flex-1 items-center justify-center">
                        <FontAwesome name="film" size={width * 0.25} color="#222" />
                      </View>
                    )}
                    {item.is_bootleg && <BootlegSticker size={30} />}
                  </View>
                );
              })}
            </View>
            <View className="flex-row w-[100%] justify-end items-center mt-2 px-1">
              <View className="flex-row flex-wrap justify-end gap-1 shrink">
                {sorted.map((item) => (
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
                      {item.format === 'BluRay' ? 'Blu-ray' : item.format}
                    </Text>
                    {item.is_bootleg && <Image source={require('@/assets/images/overlays/boot_sticker.png')} style={{ width: 12, height: 12 }} contentFit="contain" />}
                  </Pressable>
                ))}
              </View>
              {topItem.rating && (
                <View className="flex-row items-center ml-2 bg-black/60 px-1.5 py-0.5 rounded-sm">
                   <FontAwesome name="star" size={8} color="#f59e0b" />
                   <Text className="text-amber-500 font-mono text-[9px] font-bold ml-1">{topItem.rating}</Text>
                </View>
              )}
            </View>
          </View>
        </AnimatedPressable>
      );
    }

    // SINGLE PHYSICAL ITEM: Clean, no stack layers
    return (
      <AnimatedPressable
        onPress={handlePress}
        onLongPress={() => onLongPress?.(topItem)}
        delayLongPress={500}
        onPressIn={isWishlist ? undefined : onPressIn}
        onPressOut={isWishlist ? undefined : onPressOut}
        style={[animatedStyle, { width: width, margin: 6 }]}
      >
        <View className="relative">
          {isOnDisplay && !isWishlist && <StickerOverlay visible={isOnDisplay} size={40} />}
          {topItem.for_sale && <SaleSticker visible={true} size={40} />}
          {topItem.for_trade && <TradeSticker visible={true} size={40} />}
          
          <View className="bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800" style={{ width: width, height: width / aspectRatio }}>
            {posterUrl ? (
              <Image source={{ uri: posterUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <View className="flex-1 items-center justify-center p-2">
                <FontAwesome name="film" size={width * 0.4} color="#333" />
                <Text className="text-[10px] font-mono text-neutral-500 text-center mt-2 uppercase px-4 truncate">
                  {media ? (media.title || media.name) : `ID: ${topItem.movie_id || topItem.show_id}`}
                </Text>
              </View>
            )}
            {topItem.is_bootleg && <BootlegSticker size={30} />}

            {isGrail && (
              <View 
                className="absolute inset-0 border-[3px] border-yellow-400 rounded-sm"
                pointerEvents="none"
              />
            )}
            
            {isWishlist && (
              <View className="absolute inset-0 bg-black/40 border-2 border-dashed border-neutral-600 rounded-sm" />
            )}
          </View>

          <View className="flex-row w-[100%] justify-end items-center mt-2 px-1">
            <View className={`px-2 py-0.5 rounded flex-row items-center gap-1 ${FORMAT_COLORS[topItem.format] || 'bg-neutral-700'}`}>
              <Text className="text-white font-mono text-[10px] font-bold">
                {topItem.format === 'BluRay' ? 'Blu-ray' : topItem.format}
              </Text>
              {topItem.is_bootleg && <Image source={require('@/assets/images/overlays/boot_sticker.png')} style={{ width: 12, height: 12 }} contentFit="contain" />}
            </View>
            {topItem.rating && (
              <View className="flex-row items-center ml-2 bg-black/60 px-1.5 py-0.5 rounded-sm">
                 <FontAwesome name="star" size={8} color="#f59e0b" />
                 <Text className="text-amber-500 font-mono text-[9px] font-bold ml-1">{topItem.rating}</Text>
              </View>
            )}
          </View>
        </View>
      </AnimatedPressable>
    );
  }

  // Digital: single card with simplified border (No Glow)
  return (
    <AnimatedPressable
      onPress={handlePress}
      onLongPress={() => onLongPress?.(topItem)}
      delayLongPress={500}
      onPressIn={isWishlist ? undefined : onPressIn}
      onPressOut={isWishlist ? undefined : onPressOut}
      style={[
        animatedStyle,
        { width: width, margin: 6 },
        cardBorderStyle,
      ]}
    >
      <View className="items-center" style={{ position: 'relative' }}>
        {/* Halo Effect REMOVED/HIDDEN per user request */}

        <View
          className="rounded-xl overflow-hidden relative"
          style={{
            width: width,
            aspectRatio: 2 / 3,
            borderWidth: isWishlist ? 2 : 2, // Thicker border
            borderStyle: isWishlist ? 'dashed' : 'solid',
            borderColor: isWishlist ? '#6b7280' : '#00ff88', // Green Neon Border
            // Neon glow effect - only around poster image
            ...(!isWishlist && {
              shadowColor: '#00ff88',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 10,
              elevation: 8,
            })
          }}
        >
          {/* Sticker for Digital Grid */}
          {isOnDisplay && !isWishlist && (
            <NowStreamingSticker visible={true} size={40} />
          )}

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
            <View className="flex-1 items-center justify-center bg-neutral-800 p-2">
              <FontAwesome name="film" size={width * 0.4} color="#222" />
              <Text className="text-neutral-500 font-mono text-[10px] text-center mt-2 uppercase">
                {media ? (media.title || media.name) : `REPAIR PENDING: ${topItem.movie_id || topItem.show_id}`}
              </Text>
            </View>
          )}

          {/* Format Logo for Digital */}
          <Image
            source={require('@/assets/images/overlays/formats/Digital.png')}
            style={{ position: 'absolute', bottom: 6, right: 6, width: 40, height: 25, opacity: 0.9 }}
            contentFit="contain"
          />

          {/* Bootleg Sticker for Digital Grid */}
          {topItem.is_bootleg && <BootlegSticker size={30} />}
        </View>
        <View className="flex-row w-[100%] justify-end items-center mt-2 px-1">
          <View className="flex-row flex-wrap justify-end gap-1 shrink">
          {sorted.map((item) => (
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
                {item.format === 'BluRay' ? 'Blu-ray' : item.format}
              </Text>
              {item.is_bootleg && (
                <Image source={require('@/assets/images/overlays/boot_sticker.png')} style={{ width: 12, height: 12, marginLeft: 2 }} contentFit="contain" />
              )}
              {item.edition && (
                <Text className="text-white/60 font-mono text-[9px]">
                  •
                </Text>
              )}
            </Pressable>
          ))}
          </View>
        </View>

        {/* Digital Provider Badge - ONLY show if exists and is not just "Digital" */}
        {topItem.digital_provider && topItem.digital_provider !== 'Digital' && (
          <View className="mt-1 px-2 py-0.5 bg-emerald-900/80 rounded">
            <Text className="text-emerald-200 font-mono text-[10px]">
              {topItem.digital_provider}
            </Text>
          </View>
        )}
        {topItem.rating && (
          <View className="flex-row items-center ml-2 bg-black/60 px-1.5 py-0.5 rounded-sm border border-emerald-500/30">
             <FontAwesome name="star" size={8} color="#f59e0b" />
             <Text className="text-amber-500 font-mono text-[9px] font-bold ml-1">{topItem.rating}</Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}
