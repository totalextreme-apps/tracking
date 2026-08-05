import React, { useMemo } from 'react';
import { Platform, Text, View } from 'react-native';

const genreColors: Record<string, { bg: string; text: string }> = {
  'Horror': { bg: '#84cc16', text: '#000000' }, // Lime Green
  'Science Fiction': { bg: '#ea580c', text: '#000000' }, // Orange-Red
  'Action': { bg: '#eab308', text: '#000000' }, // Yellow
  'Comedy': { bg: '#ec4899', text: '#000000' }, // Pink
  'Drama': { bg: '#3b82f6', text: '#ffffff' }, // Blue
  'Thriller': { bg: '#a855f7', text: '#ffffff' }, // Purple
  'Romance': { bg: '#f43f5e', text: '#ffffff' }, // Rose
  'Adventure': { bg: '#06b6d4', text: '#000000' }, // Cyan
  'Fantasy': { bg: '#10b981', text: '#000000' }, // Emerald
  'Mystery': { bg: '#6366f1', text: '#ffffff' }, // Indigo
  'Documentary': { bg: '#78716c', text: '#ffffff' }, // Stone
  'Animation': { bg: '#14b8a6', text: '#000000' }, // Teal
  'Family': { bg: '#f97316', text: '#000000' }, // Orange
  'Crime': { bg: '#ef4444', text: '#ffffff' }, // Red
  'Music': { bg: '#f472b6', text: '#000000' }, // Light Pink
  'Western': { bg: '#b45309', text: '#ffffff' }, // Amber
  'History': { bg: '#78350f', text: '#ffffff' }, // Brown
  'War': { bg: '#451a03', text: '#ffffff' }, // Dark Brown
};

const displayNameMap: Record<string, string> = {
  'Science Fiction': 'SCI-FI',
  'Documentary': 'DOCS',
  'Action & Adventure': 'ACTION',
  'Sci-Fi & Fantasy': 'SCI-FI',
  'War & Politics': 'WAR',
};

type GenreStickerProps = {
  genre?: string | null;
  size?: number;
};

export function GenreSticker({ genre, size = 32 }: GenreStickerProps) {
  const rotation = useMemo(() => Math.random() * 20 - 10, []);

  if (!genre) return null;

  const normalizedGenre = genre.trim();
  const colors = genreColors[normalizedGenre] || { bg: '#737373', text: '#ffffff' };
  const displayName = (displayNameMap[normalizedGenre] || normalizedGenre).toUpperCase();

  return (
    <View
      style={{
        position: 'absolute',
        top: 6,
        left: -3,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ rotate: `${rotation}deg` }],
        zIndex: 90,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 2,
        elevation: 5,
        padding: 2,
      }}
      pointerEvents="none"
    >
      <Text
        style={{
          color: colors.text,
          fontSize: displayName.length > 8 ? 5.5 : displayName.length > 5 ? 6.5 : 8,
          fontWeight: '900',
          textAlign: 'center',
          fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif-condensed',
          letterSpacing: -0.2,
          lineHeight: displayName.length > 8 ? 6.5 : displayName.length > 5 ? 7.5 : 9,
        }}
        numberOfLines={2}
      >
        {displayName}
      </Text>
    </View>
  );
}
