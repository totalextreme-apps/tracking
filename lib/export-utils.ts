
import type { CollectionItemWithMedia } from '@/types/database';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export function generateCsv(items: CollectionItemWithMedia[]): string {
  const headers = [
    'TMDB ID',
    'Title',
    'Media Type',
    'Season',
    'Release Date',
    'Format',
    'Status',
    'Edition',
    'Condition',
    'Rating',
    'Notes',
    'Grail',
    'On Display',
    'Added At',
  ];

  const escapeCsv = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val);
    // Escape quotes by doubling them and wrap in quotes
    return `"${s.replace(/"/g, '""')}"`;
  };

  const rows = items.map((item) => {
    const movie = item.movies;
    const show = item.shows;
    const title = movie?.title || show?.name || `[ORPHANED] ID: ${item.movie_id || item.show_id || item.id}`;
    const tmdbId = movie?.tmdb_id || show?.tmdb_id || 'N/A';
    const releaseDate = movie?.release_date || show?.first_air_date || 'N/A';

    return [
      escapeCsv(tmdbId),
      escapeCsv(title),
      escapeCsv(item.media_type),
      escapeCsv(item.season_number),
      escapeCsv(releaseDate),
      escapeCsv(item.format),
      escapeCsv(item.status),
      escapeCsv(item.edition),
      escapeCsv(item.condition),
      escapeCsv(item.rating),
      escapeCsv(item.notes),
      escapeCsv(item.is_grail ? 'Yes' : 'No'),
      escapeCsv(item.is_on_display ? 'Yes' : 'No'),
      escapeCsv(item.created_at),
    ].join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export async function exportCollection(items: CollectionItemWithMedia[]) {
  if (items.length === 0) {
    throw new Error('No items to export');
  }

  const csvContent = generateCsv(items);
  const filename = `tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
  if (Platform.OS === 'web') {
    // Web: Create a Blob and trigger download via anchor tag
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  const fileUri = FileSystem.documentDirectory + filename;

  await FileSystem.writeAsStringAsync(fileUri, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export Collection',
    UTI: 'public.comma-separated-values-text',
  });
}
