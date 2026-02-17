
import type { CollectionItemWithMovie } from '@/types/database';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export function generateCsv(items: CollectionItemWithMovie[]): string {
  const headers = [
    'TMDB ID',
    'Title',
    'Release Date',
    'Format',
    'Status',
    'Condition',
    'Notes',
    'Grail',
    'On Display',
    'Added At',
  ];

  const rows = items.map((item) => {
    const movie = item.movies;
    return [
      movie?.tmdb_id ?? '',
      `"${(movie?.title ?? '').replace(/"/g, '""')}"`, // Escape quotes
      movie?.release_date ?? '',
      item.format,
      item.status,
      `"${(item.condition ?? '').replace(/"/g, '""')}"`,
      `"${(item.notes ?? '').replace(/"/g, '""')}"`,
      item.is_grail ? 'Yes' : 'No',
      item.is_on_display ? 'Yes' : 'No',
      item.created_at,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

export async function exportCollection(items: CollectionItemWithMovie[]) {
  if (items.length === 0) {
    throw new Error('No items to export');
  }

  const csvContent = generateCsv(items);
  const filename = `tracking_export_${new Date().toISOString().split('T')[0]}.csv`;
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
