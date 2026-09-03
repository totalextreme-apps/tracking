import React, { useState, useMemo } from 'react';
import { View, Text, Modal, Pressable, ScrollView, TextInput, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useLogWatchEvent, useUpdateCollectionItem } from '@/hooks/useCollection';
import { getPosterUrl, getBackdropUrl } from '@/lib/dummy-data';

type WatchLogModalProps = {
  visible: boolean;
  onClose: () => void;
  collection: any[];
  navigateToDetail: (item: any) => void;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function WatchLogModal({ visible, onClose, collection, navigateToDetail }: WatchLogModalProps) {
  const { userId } = useAuth();
  const { playSound } = useSound();
  const logWatchMutation = useLogWatchEvent(userId);

  // Filters
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM'>('ALL');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-indexed
  const [formatFilter, setFormatFilter] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'RECENT' | 'OLDEST' | 'MOST_VIEWED'>('RECENT');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract all distinct years from last_watched_at dates in collection
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    collection?.forEach((item: any) => {
      if (item.last_watched_at) {
        const y = new Date(item.last_watched_at).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [collection]);

  // Filtered watched items
  const filteredLog = useMemo(() => {
    if (!collection) return [];

    let items = collection.filter((i: any) => i.status === 'owned' && (i.last_watched_at || (i.watch_count && i.watch_count > 0)));

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((item: any) => {
        const title = item.media_type === 'movie' ? item.movies?.title : item.shows?.name;
        return title?.toLowerCase().includes(q);
      });
    }

    // Format filter
    if (formatFilter !== 'ALL') {
      items = items.filter((item: any) => item.format === formatFilter);
    }

    // Time filter
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (timeFilter === 'THIS_MONTH') {
      items = items.filter((item: any) => {
        if (!item.last_watched_at) return false;
        const d = new Date(item.last_watched_at);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      });
    } else if (timeFilter === 'THIS_YEAR') {
      items = items.filter((item: any) => {
        if (!item.last_watched_at) return false;
        const d = new Date(item.last_watched_at);
        return d.getFullYear() === currentYear;
      });
    } else if (timeFilter === 'CUSTOM') {
      items = items.filter((item: any) => {
        if (!item.last_watched_at) return false;
        const d = new Date(item.last_watched_at);
        return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth;
      });
    }

    // Sort order
    items = [...items].sort((a: any, b: any) => {
      if (sortOrder === 'RECENT') {
        const timeA = a.last_watched_at ? new Date(a.last_watched_at).getTime() : 0;
        const timeB = b.last_watched_at ? new Date(b.last_watched_at).getTime() : 0;
        return timeB - timeA;
      }
      if (sortOrder === 'OLDEST') {
        const timeA = a.last_watched_at ? new Date(a.last_watched_at).getTime() : Infinity;
        const timeB = b.last_watched_at ? new Date(b.last_watched_at).getTime() : Infinity;
        return timeA - timeB;
      }
      if (sortOrder === 'MOST_VIEWED') {
        return (b.watch_count || 0) - (a.watch_count || 0);
      }
      return 0;
    });

    return items;
  }, [collection, timeFilter, selectedYear, selectedMonth, formatFilter, sortOrder, searchQuery]);

  // Quick stats for filtered list
  const stats = useMemo(() => {
    const totalViews = filteredLog.reduce((acc, item) => acc + (item.watch_count || 1), 0);
    const formatCounts: Record<string, number> = {};
    filteredLog.forEach(item => {
      formatCounts[item.format] = (formatCounts[item.format] || 0) + 1;
    });
    let topFormat = 'None';
    let maxCount = 0;
    Object.entries(formatCounts).forEach(([fmt, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topFormat = fmt;
      }
    });

    return {
      titleCount: filteredLog.length,
      totalViews,
      topFormat
    };
  }, [filteredLog]);

  const handleQuickLogView = async (item: any) => {
    playSound('peel');
    try {
      await logWatchMutation.mutateAsync({
        itemId: item.id,
        currentWatchCount: item.watch_count || 0
      });
    } catch (e) {
      console.error('Failed to log watch event', e);
    }
  };

  const getFormatBadgeStyle = (format: string) => {
    switch (format) {
      case 'VHS': return 'bg-red-950/80 border-red-500/40 text-red-400';
      case 'DVD': return 'bg-purple-950/80 border-purple-500/40 text-purple-400';
      case 'BluRay': return 'bg-blue-950/80 border-blue-500/40 text-blue-400';
      case '4K': return 'bg-yellow-950/80 border-yellow-500/40 text-yellow-400';
      case 'Digital': return 'bg-green-950/80 border-green-500/40 text-green-400';
      default: return 'bg-neutral-800 border-neutral-700 text-neutral-300';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-neutral-950">
        {/* Header */}
        <View className="bg-neutral-900/90 border-b border-neutral-800 px-4 md:px-8 py-4 pt-12 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="bg-emerald-500/20 p-2.5 rounded-full border border-emerald-500/30">
              <Ionicons name="eye" size={22} color="#10b981" />
            </View>
            <View>
              <View className="flex-row items-center gap-2">
                <Text className="text-emerald-500 font-bold text-xl tracking-tighter uppercase" style={{ fontFamily: 'VCR_OSD_MONO' }}>
                  WATCH LOG
                </Text>
                <View className="bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/20">
                  <Text className="text-emerald-400 font-mono text-[9px] font-bold">OSD HIST</Text>
                </View>
              </View>
              <Text className="text-neutral-400 font-mono text-xs mt-0.5">
                {stats.titleCount} titles logged ({stats.totalViews} total views)
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => {
              playSound('click');
              onClose();
            }}
            className="bg-neutral-800 p-2.5 rounded-full border border-neutral-700 active:bg-neutral-700"
          >
            <Ionicons name="close" size={22} color="white" />
          </Pressable>
        </View>

        {/* Filter Controls Section */}
        <View className="bg-neutral-900/40 border-b border-neutral-800/80 p-4 px-4 md:px-8 gap-3">
          {/* Search Bar */}
          <View className="flex-row items-center bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
            <Ionicons name="search" size={16} color="#737373" style={{ marginRight: 8 }} />
            <TextInput
              className="flex-1 text-white font-mono text-xs"
              placeholder="Search watch log..."
              placeholderTextColor="#525252"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#737373" />
              </Pressable>
            )}
          </View>

          {/* Time Filter Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => { playSound('click'); setTimeFilter('ALL'); }}
                className={`px-3 py-1.5 rounded-lg border font-mono text-xs ${timeFilter === 'ALL' ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-neutral-900 border-neutral-800 text-neutral-400'}`}
              >
                <Text className={`font-mono text-xs font-bold ${timeFilter === 'ALL' ? 'text-emerald-400' : 'text-neutral-400'}`}>
                  ALL TIME
                </Text>
              </Pressable>

              <Pressable
                onPress={() => { playSound('click'); setTimeFilter('THIS_MONTH'); }}
                className={`px-3 py-1.5 rounded-lg border font-mono text-xs ${timeFilter === 'THIS_MONTH' ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-neutral-900 border-neutral-800 text-neutral-400'}`}
              >
                <Text className={`font-mono text-xs font-bold ${timeFilter === 'THIS_MONTH' ? 'text-emerald-400' : 'text-neutral-400'}`}>
                  THIS MONTH
                </Text>
              </Pressable>

              <Pressable
                onPress={() => { playSound('click'); setTimeFilter('THIS_YEAR'); }}
                className={`px-3 py-1.5 rounded-lg border font-mono text-xs ${timeFilter === 'THIS_YEAR' ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-neutral-900 border-neutral-800 text-neutral-400'}`}
              >
                <Text className={`font-mono text-xs font-bold ${timeFilter === 'THIS_YEAR' ? 'text-emerald-400' : 'text-neutral-400'}`}>
                  THIS YEAR
                </Text>
              </Pressable>

              <Pressable
                onPress={() => { playSound('click'); setTimeFilter('CUSTOM'); }}
                className={`px-3 py-1.5 rounded-lg border font-mono text-xs ${timeFilter === 'CUSTOM' ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-neutral-900 border-neutral-800 text-neutral-400'}`}
              >
                <Text className={`font-mono text-xs font-bold ${timeFilter === 'CUSTOM' ? 'text-emerald-400' : 'text-neutral-400'}`}>
                  CUSTOM MONTH/YEAR
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Custom Month/Year Selectors (Shown only when CUSTOM is selected) */}
          {timeFilter === 'CUSTOM' && (
            <View className="flex-row items-center gap-2 bg-neutral-900/90 p-3 rounded-lg border border-neutral-800 flex-wrap">
              <View className="flex-1 min-w-[140px]">
                <Text className="text-neutral-500 font-mono text-[9px] uppercase font-bold mb-1">SELECT YEAR</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {availableYears.map(yr => (
                    <Pressable
                      key={yr}
                      onPress={() => { playSound('click'); setSelectedYear(yr); }}
                      className={`mr-1.5 px-2.5 py-1 rounded border ${selectedYear === yr ? 'bg-amber-500/20 border-amber-500' : 'bg-neutral-800 border-neutral-700'}`}
                    >
                      <Text className={`font-mono text-xs ${selectedYear === yr ? 'text-amber-400 font-bold' : 'text-neutral-300'}`}>{yr}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View className="flex-1 min-w-[200px]">
                <Text className="text-neutral-500 font-mono text-[9px] uppercase font-bold mb-1">SELECT MONTH</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                  {MONTH_NAMES.map((monthName, idx) => (
                    <Pressable
                      key={monthName}
                      onPress={() => { playSound('click'); setSelectedMonth(idx); }}
                      className={`mr-1.5 px-2.5 py-1 rounded border ${selectedMonth === idx ? 'bg-amber-500/20 border-amber-500' : 'bg-neutral-800 border-neutral-700'}`}
                    >
                      <Text className={`font-mono text-xs ${selectedMonth === idx ? 'text-amber-400 font-bold' : 'text-neutral-300'}`}>{monthName.slice(0, 3)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Format & Sort Controls */}
          <View className="flex-row items-center justify-between gap-2 flex-wrap">
            {/* Format Selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              <View className="flex-row items-center gap-1.5">
                {['ALL', 'VHS', 'DVD', 'BluRay', '4K', 'Digital'].map(fmt => (
                  <Pressable
                    key={fmt}
                    onPress={() => { playSound('click'); setFormatFilter(fmt); }}
                    className={`px-2.5 py-1 rounded border ${formatFilter === fmt ? 'bg-neutral-800 border-amber-500' : 'bg-neutral-900 border-neutral-800'}`}
                  >
                    <Text className={`font-mono text-[11px] ${formatFilter === fmt ? 'text-amber-400 font-bold' : 'text-neutral-400'}`}>
                      {fmt === 'BluRay' ? 'Blu-ray' : fmt}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            {/* Sort Toggle */}
            <View className="flex-row items-center bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
              <Pressable
                onPress={() => { playSound('click'); setSortOrder('RECENT'); }}
                className={`px-2 py-1 rounded ${sortOrder === 'RECENT' ? 'bg-neutral-800' : ''}`}
              >
                <Text className={`font-mono text-[10px] ${sortOrder === 'RECENT' ? 'text-white font-bold' : 'text-neutral-500'}`}>NEWEST</Text>
              </Pressable>
              <Pressable
                onPress={() => { playSound('click'); setSortOrder('OLDEST'); }}
                className={`px-2 py-1 rounded ${sortOrder === 'OLDEST' ? 'bg-neutral-800' : ''}`}
              >
                <Text className={`font-mono text-[10px] ${sortOrder === 'OLDEST' ? 'text-white font-bold' : 'text-neutral-500'}`}>OLDEST</Text>
              </Pressable>
              <Pressable
                onPress={() => { playSound('click'); setSortOrder('MOST_VIEWED'); }}
                className={`px-2 py-1 rounded ${sortOrder === 'MOST_VIEWED' ? 'bg-neutral-800' : ''}`}
              >
                <Text className={`font-mono text-[10px] ${sortOrder === 'MOST_VIEWED' ? 'text-white font-bold' : 'text-neutral-500'}`}>MOST VIEWS</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Watch Log Items List */}
        {filteredLog.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons name="film-outline" size={48} color="#404040" style={{ marginBottom: 16 }} />
            <Text className="text-white font-mono font-bold text-base text-center mb-2">No Watch Events Found</Text>
            <Text className="text-neutral-500 font-mono text-xs text-center">
              Try adjusting your filter settings or logging views on titles in your collection.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredLog}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
            renderItem={({ item }) => {
              const media = item.movies || item.shows;
              const title = item.media_type === 'movie' ? item.movies?.title : item.shows?.name;
              const tmdbBackdrop = getBackdropUrl(media?.backdrop_path, 'w300');
              const tmdbPoster = getPosterUrl(media?.poster_path, 'w185');
              const artworkUrl = item.custom_backdrop_url || tmdbBackdrop || item.custom_poster_url || tmdbPoster;
              const lastWatchedDate = item.last_watched_at ? new Date(item.last_watched_at) : null;
              const formattedDate = lastWatchedDate 
                ? lastWatchedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : 'Date unknown';
              const formattedTime = lastWatchedDate
                ? lastWatchedDate.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <Pressable
                  onPress={() => {
                    playSound('click');
                    onClose();
                    navigateToDetail(item);
                  }}
                  className="mb-3 bg-neutral-900 border border-neutral-800/90 rounded-xl overflow-hidden flex-row items-center active:border-emerald-500/50 shadow-md shadow-black"
                >
                  {/* Backdrop Thumbnail */}
                  <View className="w-28 h-24 bg-neutral-950 relative justify-center items-center">
                    {artworkUrl ? (
                      <Image
                        source={{ uri: artworkUrl }}
                        style={{ width: '100%', height: '100%', opacity: 0.85 }}
                        contentFit="cover"
                        contentPosition="top center"
                      />
                    ) : (
                      <Ionicons name="film-outline" size={24} color="#525252" />
                    )}
                    {/* Play Badge Overlay */}
                    <View className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded border border-white/10 flex-row items-center">
                      <Ionicons name="play" size={8} color="#10b981" />
                      <Text className="text-[8px] font-mono font-bold text-emerald-400 ml-0.5">
                        {item.watch_count || 1}x
                      </Text>
                    </View>
                  </View>

                  {/* Main Details */}
                  <View className="flex-1 p-3 justify-between h-24">
                    <View>
                      <View className="flex-row items-center justify-between gap-1 mb-1">
                        <Text className="text-white font-bold font-mono text-sm flex-1 leading-4" numberOfLines={1}>
                          {title || 'Untitled'}
                        </Text>
                        {/* Format Badge */}
                        <View className={`px-2 py-0.5 rounded border ${getFormatBadgeStyle(item.format)}`}>
                          <Text className="font-mono text-[9px] font-bold">
                            {item.format === 'BluRay' ? 'Blu-ray' : item.format}
                          </Text>
                        </View>
                      </View>

                      {/* Rating Stars if rated */}
                      {item.rating && (
                        <View className="flex-row items-center gap-0.5 mb-1">
                          {[1, 2, 3, 4, 5].map(star => (
                            <Ionicons
                              key={star}
                              name="star"
                              size={11}
                              color={star <= item.rating ? '#f59e0b' : '#333'}
                            />
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Date & Quick Action */}
                    <View className="flex-row items-center justify-between border-t border-neutral-850 pt-1.5">
                      <View className="flex-row items-center gap-1">
                        <Ionicons name="calendar-outline" size={11} color="#737373" />
                        <Text className="text-neutral-400 font-mono text-[10px]">
                          {formattedDate} {formattedTime ? `• ${formattedTime}` : ''}
                        </Text>
                      </View>

                      {/* Log View Button */}
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleQuickLogView(item);
                        }}
                        className="bg-emerald-950/80 border border-emerald-800/40 px-2 py-1 rounded flex-row items-center gap-1 active:bg-emerald-900"
                      >
                        <Ionicons name="add-circle" size={10} color="#10b981" />
                        <Text className="text-emerald-400 font-mono text-[9px] font-bold">LOG AGAIN</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}
