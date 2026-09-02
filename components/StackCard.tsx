import { useSound } from '@/context/SoundContext';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { useReactions } from '@/hooks/useReactions';
import { ReactionSummary } from './ReactionSummary';
import { ReactionPicker } from './ReactionPicker';
import { getPosterUrl } from '@/lib/dummy-data';
import type { CollectionItemWithMedia } from '@/types/database';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View, Platform } from 'react-native';
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
import { GrailSticker } from './GrailSticker';
import { GenreSticker } from './GenreSticker';

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
  isReadOnly?: boolean;
};

const DEFAULT_CARD_WIDTH = 100;
const DEFAULT_CARD_HEIGHT = 150;

const getStackTransforms = (idx: number) => {
  if (idx === 0) return { rotate: '0deg', left: 0, top: 0 };
  
  const rotations = ['-3deg', '3deg', '-2deg', '4deg', '-3deg', '2deg'];
  const shiftsX = [-3, 3, -2, 3, -3, 2];
  const shiftsY = [5, 10, 15, 20, 25, 30];
  
  const r = rotations[(idx - 1) % rotations.length];
  const x = shiftsX[(idx - 1) % shiftsX.length];
  const y = shiftsY[(idx - 1) % shiftsY.length];
  
  return { rotate: r, left: x, top: y };
};

function SeasonSticker({ season, size = 30 }: { season: number; size?: number }) {
  const rotation = useMemo(() => Math.random() * 20 - 10, []);
  
  return (
    <View
      style={{
        position: 'absolute',
        top: 6,
        right: -3,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#f59e0b', // CRT gold/amber
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: `${rotation}deg` }],
        zIndex: 90,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 2,
        elevation: 5,
      }}
      pointerEvents="none"
    >
      <Text
        style={{
          color: '#000000',
          fontSize: 8.5,
          fontWeight: '900',
          textAlign: 'center',
          fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif-condensed',
          letterSpacing: -0.4,
        }}
      >
        S{season}
      </Text>
    </View>
  );
}

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
  activeFormatFilter = null,
  isReadOnly = false,
}: StackCardProps) {
  const defaultSorted = useMemo(() => {
    const qualitySorted = sortByQuality(stack);
    if (!activeFormatFilter) return qualitySorted;

    const matching = [];
    const others = [];
    for (const item of qualitySorted) {
      const normalizedFilter = (activeFormatFilter || '').replace(/[^a-z0-9]/g, '').toLowerCase();
      const itemFmt = (item.format || '').replace(/[^a-z0-9]/g, '').toLowerCase();
      if (activeFormatFilter === 'BOOTLEG' && item.is_bootleg) {
        matching.push(item);
      } else if (normalizedFilter && itemFmt.includes(normalizedFilter)) {
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
  const { genreStickersEnabled } = useSettings();
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
  const primaryGenre = media?.custom_genre || media?.genres?.[0]?.name;
  const { userId } = useAuth();
  const [pickerVisible, setPickerVisible] = useState(false);
  const { reactions, toggleReaction } = useReactions('collection_item_id', topItem?.id);
  
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

  const maxShiftY = sorted.length > 1 ? getStackTransforms(sorted.length - 1).top : 0;
  const paddingBuffer = sorted.length > 1 ? 15 : 0;
  const posterContainerHeight = (width / aspectRatio) + maxShiftY + paddingBuffer;

  const renderInfoBox = () => {
    return (
      <View 
        className="bg-neutral-900/60 border border-neutral-800/60 rounded-xl p-2.5 mt-3 w-full"
        style={{ minHeight: 68, justifyContent: 'space-between', alignItems: 'center' }}
      >
        {/* Title */}
        <Text 
          className="text-white font-mono text-[9px] font-bold text-center" 
          numberOfLines={2} 
          style={{ minHeight: 24, width: '100%', lineHeight: 12 }}
        >
          {media 
            ? (topItem.media_type === 'tv' && topItem.season_number 
                ? `${(media as any).name} (Season ${topItem.season_number})`
                : ((media as any).title || (media as any).name))
            : `ID: ${topItem.movie_id || topItem.show_id}`}
        </Text>

        {/* Format & Rating row */}
        <View className="flex-row w-full justify-center items-center mt-1.5 gap-1.5 flex-wrap">
          {sorted.map((item) => (
            <Pressable
              key={item.id}
              onPress={(e) => {
                e.stopPropagation();
                if (!isReadOnly) playSound('click');
                setActiveId(item.id);
              }}
              className={`px-1.5 py-0.5 rounded flex-row items-center gap-1 ${FORMAT_COLORS[item.format] || 'bg-neutral-700'}`}
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.3,
                shadowRadius: 1,
              }}
            >
              <Text className="text-white font-mono text-[8px] font-bold">
                {item.format === 'BluRay' ? 'Blu-ray' : item.format}
              </Text>
              {item.is_bootleg && (
                <Image source={require('@/assets/images/overlays/boot_sticker.png')} style={{ width: 10, height: 10 }} contentFit="contain" />
              )}
            </Pressable>
          ))}
          {topItem.rating && (
            <View className="flex-row items-center bg-black/60 px-1 py-0.5 rounded-sm border border-neutral-800">
               <FontAwesome name="star" size={8} color="#f59e0b" />
               <Text className="text-amber-500 font-mono text-[8px] font-bold ml-0.5">{topItem.rating}</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

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

    if (!isReadOnly && now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      playSound('peel');
      onToggleFavorite?.(topItem);
      lastTapRef.current = 0; // Reset to prevent triple-tap triggering
    } else {
      // Single tap
      lastTapRef.current = now;
      if (isReadOnly) {
        // Just navigate immediately or with a short delay but NO SOUND/HAPTICS
        onCardPress?.();
      } else {
        setTimeout(() => {
          if (lastTapRef.current === now) {
            // No second tap came, it's a single tap
            playSound('click');
            onCardPress?.();
          }
        }, DOUBLE_TAP_DELAY);
      }
    }
  };

  const onPressIn = () => {
    // Disable bounce effect for Digital items or Read-Only mode
    if (!isPhysical || isReadOnly) return;

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
    opacity: 1,
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
        onLongPress={() => isReadOnly ? setPickerVisible(true) : onLongPress?.(topItem)}
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
          borderColor: isGrail ? '#ffd700' : isWishlist ? '#404040' : '#262626',
          borderStyle: isWishlist && !isGrail ? 'dashed' : 'solid',
        }]}
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
          <Text className="text-white font-bold text-sm leading-tight" numberOfLines={2}>
            {media 
              ? (topItem.media_type === 'tv' && topItem.season_number 
                  ? `${(media as any).name} (Season ${topItem.season_number})`
                  : ((media as any).title || (media as any).name))
              : `ID: ${topItem.movie_id || topItem.show_id}`}
          </Text>
          <View className="flex-row my-1">
              {topItem.rating ? (
                [...Array(5)].map((_, i) => (
                  <View key={i} style={{ marginRight: 2 }}>
                    <FontAwesome name={i < topItem.rating! ? 'star' : 'star-o'} size={12} color={i < topItem.rating! ? '#f59e0b' : '#404040'} />
                  </View>
                ))
              ) : (
                [...Array(5)].map((_, i) => (
                  <View key={i} style={{ marginRight: 2 }}>
                    <FontAwesome name="star-o" size={10} color="#333" />
                  </View>
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
          {userId && isReadOnly && (
            <ReactionSummary
              reactions={reactions}
              currentUserId={userId}
              onReact={(emoji) => toggleReaction({ userId, emoji })}
              onShowPicker={() => setPickerVisible(true)}
            />
          )}
        </View>

        {/* Favorite / Grail Icon */}
        {isOnDisplay && !isWishlist && (
          <View className="pr-4">
            <FontAwesome name="thumb-tack" size={12} color="#f59e0b" style={{ transform: [{ rotate: '45deg' }] }} />
          </View>
        )}
        {isGrail && isWishlist && (
          <View className="pr-4">
            <FontAwesome name="trophy" size={12} color="#f59e0b" />
          </View>
        )}
        {userId && isReadOnly && (
          <ReactionPicker
            visible={pickerVisible}
            onClose={() => setPickerVisible(false)}
            onSelect={(emoji) => toggleReaction({ userId, emoji })}
            currentReaction={reactions.find(r => r.user_id === userId)?.reaction_type}
          />
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
          onLongPress={() => isReadOnly ? setPickerVisible(true) : onLongPress?.(topItem)}
          delayLongPress={500}
          onPressIn={isWishlist ? undefined : onPressIn}
          onPressOut={isWishlist ? undefined : onPressOut}
          style={[
            animatedStyle,
            { width: width, alignSelf: 'center' },
          ]}
        >
          <View className="items-center" style={{ paddingTop: 10 }}>
            <View style={{ width: width, height: posterContainerHeight, justifyContent: 'flex-end', alignItems: 'center' }}>
              <View className="relative" style={{ width: width, height: containerHeight }}>
                {/* Sticker Overlays */}
                {primaryGenre && genreStickersEnabled && <GenreSticker genre={primaryGenre} />}
                {topItem.media_type === 'tv' && topItem.season_number && <SeasonSticker season={topItem.season_number} />}
                {isOnDisplay && !isWishlist && <StickerOverlay visible={isOnDisplay} size={40} />}
                {topItem.for_sale && <SaleSticker visible={true} size={40} />}
                {topItem.for_trade && <TradeSticker visible={true} size={40} />}
                {isGrail && isWishlist && <GrailSticker visible={true} size={40} />}

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
                    borderWidth: (idx === 0 && isGrail && isWishlist) ? 2 : 1,
                    borderColor: (idx === 0 && isGrail && isWishlist) ? '#ffd700' : 'rgba(255,255,255,0.15)',
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
          </View>
          {renderInfoBox()}
          {userId && isReadOnly && (
            <ReactionSummary
              reactions={reactions}
              currentUserId={userId}
              onReact={(emoji) => toggleReaction({ userId, emoji })}
              onShowPicker={() => setPickerVisible(true)}
            />
          )}
        </View>
        {userId && isReadOnly && (
          <ReactionPicker
            visible={pickerVisible}
            onClose={() => setPickerVisible(false)}
            onSelect={(emoji) => toggleReaction({ userId, emoji })}
            currentReaction={reactions.find(r => r.user_id === userId)?.reaction_type}
          />
        )}
      </AnimatedPressable>
    );
    }

    // SINGLE PHYSICAL ITEM: Clean, no stack layers
    return (
      <AnimatedPressable
        onPress={handlePress}
        onLongPress={() => isReadOnly ? setPickerVisible(true) : onLongPress?.(topItem)}
        delayLongPress={500}
        onPressIn={isWishlist ? undefined : onPressIn}
        onPressOut={isWishlist ? undefined : onPressOut}
        style={[animatedStyle, { width: width, alignSelf: 'center' }]}
      >
        <View style={{ width: width, alignItems: 'center' }}>
          <View style={{ width: width, height: posterContainerHeight, justifyContent: 'flex-end', alignItems: 'center' }}>
            <View className="relative" style={{ width: width, height: width / aspectRatio }}>
              {primaryGenre && genreStickersEnabled && <GenreSticker genre={primaryGenre} />}
              {topItem.media_type === 'tv' && topItem.season_number && <SeasonSticker season={topItem.season_number} />}
              {isOnDisplay && !isWishlist && <StickerOverlay visible={isOnDisplay} size={40} />}
              {topItem.for_sale && <SaleSticker visible={true} size={40} />}
              {topItem.for_trade && <TradeSticker visible={true} size={40} />}
              {isGrail && isWishlist && <GrailSticker visible={true} size={40} />}
              {/* THE CARD ASSET */}
              {topItem.format === 'VHS' ? (
                <VHSCard 
                  posterUrl={posterUrl} 
                  isCustom={!!topItem.custom_poster_url} 
                  isBootleg={topItem.is_bootleg} 
                  style={{ width: width, height: width / aspectRatio }} 
                />
              ) : ['DVD', 'BluRay', '4K'].includes(topItem.format) ? (
                <GlossyCard 
                  posterUrl={posterUrl} 
                  format={topItem.format as any} 
                  isCustom={!!topItem.custom_poster_url} 
                  isBootleg={topItem.is_bootleg} 
                  style={{ width: width, height: width / aspectRatio }} 
                />
              ) : (
                <View className="bg-neutral-900 rounded-lg overflow-hidden border border-neutral-800" style={{ width: width, height: width / aspectRatio }}>
                  {posterUrl ? (
                    <Image source={{ uri: posterUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                  ) : (
                    <View className="flex-1 items-center justify-center p-2">
                      <FontAwesome name="film" size={width * 0.4} color="#333" />
                      <Text className="text-[10px] font-mono text-neutral-500 text-center mt-2 uppercase px-4 truncate">
                        {media 
                          ? (topItem.media_type === 'tv' && topItem.season_number 
                              ? `${(media as any).name} (Season ${topItem.season_number})`
                              : ((media as any).title || (media as any).name))
                          : `ID: ${topItem.movie_id || topItem.show_id}`}
                      </Text>
                    </View>
                  )}
                  {topItem.is_bootleg && <BootlegSticker size={30} />}
                </View>
              )}

              {isGrail && (
                <View 
                  className="absolute inset-0 border-[3px] border-yellow-400 rounded-sm"
                  pointerEvents="none"
                  style={{ zIndex: 50 }}
                />
              )}
              
              {isWishlist && !isGrail && (
                <View className="absolute inset-0 bg-black/5 border-2 border-dashed border-neutral-600 rounded-sm" style={{ zIndex: 60 }} />
              )}
            </View>
          </View>
          {renderInfoBox()}
          {userId && isReadOnly && (
            <ReactionSummary
              reactions={reactions}
              currentUserId={userId}
              onReact={(emoji) => toggleReaction({ userId, emoji })}
              onShowPicker={() => setPickerVisible(true)}
            />
          )}
        </View>
        {userId && isReadOnly && (
          <ReactionPicker
            visible={pickerVisible}
            onClose={() => setPickerVisible(false)}
            onSelect={(emoji) => toggleReaction({ userId, emoji })}
            currentReaction={reactions.find(r => r.user_id === userId)?.reaction_type}
          />
        )}
      </AnimatedPressable>
    );
  }

  // Digital: single card with simplified border (No Glow)
  return (
    <AnimatedPressable
      onPress={handlePress}
      onLongPress={() => isReadOnly ? setPickerVisible(true) : onLongPress?.(topItem)}
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
        <View style={{ width: width, height: posterContainerHeight, justifyContent: 'flex-end', alignItems: 'center' }}>
          <View style={{ position: 'relative' }}>
            {primaryGenre && genreStickersEnabled && <GenreSticker genre={primaryGenre} />}
            {topItem.media_type === 'tv' && topItem.season_number && <SeasonSticker season={topItem.season_number} />}

            <View
              className="rounded-xl overflow-hidden relative"
              style={{
                width: width,
                aspectRatio: 2 / 3,
                borderWidth: 2, // Thicker border
                borderStyle: isWishlist && !isGrail ? 'dashed' : 'solid',
                borderColor: isGrail ? '#ffd700' : isWishlist ? '#6b7280' : '#00ff88', // Green Neon Border
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

              {isWishlist && !isGrail && (
                <View
                  className="absolute inset-0 rounded-xl z-10"
                  style={{ backgroundColor: 'rgba(100,100,100,0.05)' }}
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
                    {media 
                      ? (topItem.media_type === 'tv' && topItem.season_number 
                          ? `${(media as any).name} (Season ${topItem.season_number})`
                          : ((media as any).title || (media as any).name))
                      : `REPAIR PENDING: ${topItem.movie_id || topItem.show_id}`}
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
            {/* Grail sticker for wishlist items */}
            {isGrail && isWishlist && <GrailSticker visible={true} size={40} />}
          </View>
        </View>
        {renderInfoBox()}
        {userId && isReadOnly && (
          <ReactionSummary
            reactions={reactions}
            currentUserId={userId}
            onReact={(emoji) => toggleReaction({ userId, emoji })}
            onShowPicker={() => setPickerVisible(true)}
          />
        )}
        
        {/* Digital Provider Badge - ONLY show if exists and is not just "Digital" */}
        {topItem.digital_provider && topItem.digital_provider !== 'Digital' && (
          <View className="mt-1.5 px-2 py-0.5 bg-emerald-900/80 rounded">
            <Text className="text-emerald-200 font-mono text-[10px]">
              {topItem.digital_provider}
            </Text>
          </View>
        )}
        {userId && isReadOnly && (
          <ReactionPicker
            visible={pickerVisible}
            onClose={() => setPickerVisible(false)}
            onSelect={(emoji) => toggleReaction({ userId, emoji })}
            currentReaction={reactions.find(r => r.user_id === userId)?.reaction_type}
          />
        )}
      </View>
    </AnimatedPressable>
  );
}
