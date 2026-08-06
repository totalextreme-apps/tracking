import React, { useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Pressable, 
  Image, 
  TextInput, 
  ActivityIndicator, 
  StyleSheet, 
  RefreshControl 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';

interface SwapItem {
  id: string;
  user_id: string;
  movie_id: number | null;
  show_id: number | null;
  format: string;
  status: string;
  rating: number | null;
  edition: string | null;
  condition: string | null;
  custom_poster_url: string | null;
  for_sale: boolean;
  for_trade: boolean;
  price: number | null;
  created_at: string;
  movies?: {
    id: number;
    title: string;
    poster_path: string | null;
    genres: { id: number; name: string }[] | null;
  } | null;
  shows?: {
    id: number;
    name: string;
    poster_path: string | null;
    genres: { id: number; name: string }[] | null;
  } | null;
  profiles?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

const FORMAT_COLORS: Record<string, string> = {
  '4K': '#eab308',       // Yellow
  'BluRay': '#3b82f6',   // Blue
  'DVD': '#a855f7',      // Purple
  'VHS': '#ef4444',      // Red
  'Digital': '#10b981',  // Green
};

export function SwapMeetView() {
  const router = useRouter();
  const { userId: currentUserId } = useAuth();
  const { playSound } = useSound();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'trade'>('all');
  const [formatFilter, setFormatFilter] = useState<string>('ALL');

  // Query: Fetch all swap meet items
  const { data: swapItems = [], isLoading, isRefetching, refetch } = useQuery<SwapItem[]>({
    queryKey: ['swap-meet-items'],
    queryFn: async () => {
      // 1. Fetch items marked for sale or trade
      const { data: items, error: itemsError } = await supabase
        .from('collection_items')
        .select(`
          *,
          movies (id, tmdb_id, title, poster_path, genres),
          shows (id, tmdb_id, name, poster_path, genres)
        `)
        .or('for_sale.eq.true,for_trade.eq.true')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return [];

      // 2. Extract unique owner IDs
      const ownerIds = Array.from(new Set(items.map(i => i.user_id)));

      // 3. Fetch profiles for owners
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', ownerIds);

      if (profilesError) throw profilesError;

      // 4. Map profiles to items
      return items.map(item => ({
        ...item,
        profiles: profiles?.find(p => p.id === item.user_id) || null
      }));
    }
  });

  // Filtered swap items
  const filteredItems = useMemo(() => {
    return swapItems.filter(item => {
      const media = item.movies || item.shows;
      if (!media) return false;

      const title = (item.movies?.title || item.shows?.name || '').toLowerCase();
      const edition = (item.edition || '').toLowerCase();
      const matchesSearch = title.includes(searchQuery.toLowerCase()) || edition.includes(searchQuery.toLowerCase());

      const matchesType = 
        typeFilter === 'all' || 
        (typeFilter === 'sale' && item.for_sale) || 
        (typeFilter === 'trade' && item.for_trade);

      const matchesFormat = 
        formatFilter === 'ALL' || 
        item.format.toLowerCase() === formatFilter.toLowerCase();

      return matchesSearch && matchesType && matchesFormat;
    });
  }, [swapItems, searchQuery, typeFilter, formatFilter]);

  const handleMessageUser = (item: SwapItem) => {
    playSound('click');
    const title = item.movies?.title || item.shows?.name || 'this item';
    const prefillMessage = `Hey @${item.profiles?.username || 'member'}, I saw your copy of "${title}" (${item.format}) listed in The Swap Meet for ${item.for_sale ? `$${item.price?.toFixed(2)}` : 'trade'}. Is it still available?`;
    
    router.push({
      pathname: `/(tabs)/profile/chat/${item.user_id}` as any,
      params: { prefill: prefillMessage }
    });
  };

  const renderSwapCard = ({ item }: { item: SwapItem }) => {
    const media = item.movies || item.shows;
    const title = media ? (item.movies?.title || item.shows?.name) : 'Unknown Title';
    const isOwner = item.user_id === currentUserId;
    
    const posterUrl = item.custom_poster_url || (media?.poster_path ? `https://image.tmdb.org/t/p/w300${media.poster_path}` : null);
    
    const formatColor = FORMAT_COLORS[item.format] || '#737373';

    return (
      <View style={styles.cardContainer}>
        {/* Poster Wrapper */}
        <Pressable 
          onPress={() => {
            playSound('click');
            const targetType = item.movies ? 'movie' : 'show';
            const targetId = item.movie_id || item.show_id;
            router.push(`/(tabs)/${targetType}/${targetId}?ownerId=${item.user_id}`);
          }}
          style={styles.posterContainer}
        >
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} />
          ) : (
            <View style={styles.placeholderPoster}>
              <Ionicons name="film-outline" size={20} color="#525252" />
            </View>
          )}

          {/* Format Badge */}
          <View style={[styles.formatBadge, { backgroundColor: formatColor }]}>
            <Text style={styles.formatText}>{item.format.toUpperCase()}</Text>
          </View>
        </Pressable>

        {/* Details Wrapper */}
        <View style={styles.detailsContainer}>
          <View>
            <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
            {item.edition && <Text style={styles.cardSubtitle} numberOfLines={1}>{item.edition}</Text>}
            {item.condition && (
              <View style={styles.conditionRow}>
                <Text style={styles.conditionLabel}>Condition: </Text>
                <Text style={styles.conditionVal}>{item.condition}</Text>
              </View>
            )}
            
            {/* Listing Badges */}
            <View style={styles.badgeRow}>
              {item.for_sale && (
                <View style={styles.saleBadge}>
                  <Text style={styles.saleBadgeText}>
                    FOR SALE {item.price !== null ? `$${item.price.toFixed(2)}` : ''}
                  </Text>
                </View>
              )}
              {item.for_trade && (
                <View style={styles.tradeBadge}>
                  <Text style={styles.tradeBadgeText}>TRADE</Text>
                </View>
              )}
            </View>
          </View>

          {/* Owner & Message/Edit Action */}
          <View style={styles.footerRow}>
            <Pressable 
              onPress={() => router.push(`/profile/${item.user_id}`)}
              style={styles.ownerInfo}
            >
              <View style={styles.avatar}>
                {item.profiles?.avatar_url ? (
                  <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person-circle" size={14} color="#737373" />
                )}
              </View>
              <Text style={styles.ownerName} numberOfLines={1}>
                @{item.profiles?.username || 'member'}
              </Text>
            </Pressable>

            {isOwner ? (
              <Pressable
                onPress={() => {
                  playSound('click');
                  const targetType = item.movies ? 'movie' : 'show';
                  const targetId = item.movie_id || item.show_id;
                  router.push(`/(tabs)/${targetType}/${targetId}`);
                }}
                style={styles.editButton}
              >
                <Text style={styles.editButtonText}>EDIT</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => handleMessageUser(item)}
                style={styles.messageButton}
              >
                <Ionicons name="chatbubble-ellipses" size={10} color="#000" />
                <Text style={styles.messageButtonText}>CONTACT</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search and Filters */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={14} color="#737373" style={{ marginRight: 6 }} />
          <TextInput
            placeholder="Search titles, editions..."
            placeholderTextColor="#525252"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={14} color="#737373" />
            </Pressable>
          )}
        </View>

        <View style={styles.quickFilterRow}>
          {/* Listing Types */}
          <View style={styles.btnGroup}>
            {(['all', 'sale', 'trade'] as const).map(t => (
              <Pressable
                key={t}
                onPress={() => {
                  playSound('click');
                  setTypeFilter(t);
                }}
                style={[
                  styles.filterBtn,
                  typeFilter === t && styles.activeFilterBtn
                ]}
              >
                <Text style={[styles.filterBtnText, typeFilter === t && styles.activeFilterBtnText]}>
                  {t.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Formats Selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.formatScroll}>
            {['ALL', '4K', 'BluRay', 'DVD', 'VHS', 'Digital'].map(fmt => (
              <Pressable
                key={fmt}
                onPress={() => {
                  playSound('click');
                  setFormatFilter(fmt);
                }}
                style={[
                  styles.chip,
                  formatFilter === fmt && styles.activeChip
                ]}
              >
                <Text style={[styles.chipText, formatFilter === fmt && styles.activeChipText]}>
                  {fmt === 'BluRay' ? 'BLU-RAY' : fmt}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* List content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#f59e0b" />
          <Text style={styles.loadingText}>Opening swap bins...</Text>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="gift-outline" size={48} color="#262626" />
          <Text style={styles.emptyText}>Nothing listed in this section yet.</Text>
          <Text style={styles.emptySubtext}>Mark titles in your collection "For Sale" or "For Trade" to list them here!</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={item => item.id}
          renderItem={renderSwapCard}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#f59e0b"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  filterSection: {
    padding: 12,
    backgroundColor: '#050505',
    borderBottomWidth: 1,
    borderColor: '#171717',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#262626',
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontFamily: 'SpaceMono',
    fontSize: 11,
    padding: 0,
  },
  quickFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnGroup: {
    flexDirection: 'row',
    backgroundColor: '#171717',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262626',
    overflow: 'hidden',
  },
  filterBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeFilterBtn: {
    backgroundColor: '#f59e0b',
  },
  filterBtnText: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#a3a3a3',
  },
  activeFilterBtnText: {
    color: '#000000',
  },
  formatScroll: {
    flexDirection: 'row',
    marginLeft: 4,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#262626',
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeChip: {
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  chipText: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#737373',
  },
  activeChipText: {
    color: '#f59e0b',
  },
  listContent: {
    padding: 12,
    paddingBottom: 160, // Make sure there is enough scrolling room
  },
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#171717',
    padding: 10,
    marginBottom: 12,
  },
  posterContainer: {
    width: 60,
    height: 90,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#171717',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderPoster: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
  },
  formatText: {
    color: '#000000',
    fontFamily: 'SpaceMono',
    fontSize: 6,
    fontWeight: 'bold',
  },
  detailsContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  cardSubtitle: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    color: '#737373',
    marginTop: 1,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  conditionLabel: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    color: '#525252',
  },
  conditionVal: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    color: '#f59e0b',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  saleBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  saleBadgeText: {
    color: '#ef4444',
    fontFamily: 'SpaceMono',
    fontSize: 7,
    fontWeight: 'bold',
  },
  tradeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  tradeBadgeText: {
    color: '#10b981',
    fontFamily: 'SpaceMono',
    fontSize: 7,
    fontWeight: 'bold',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: '#171717',
    paddingTop: 6,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#262626',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  ownerName: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    color: '#737373',
    fontWeight: 'bold',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  messageButtonText: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#000000',
  },
  editButton: {
    backgroundColor: '#262626',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#404040',
  },
  editButtonText: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#a3a3a3',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'SpaceMono',
    fontSize: 11,
    color: '#737373',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyText: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#a3a3a3',
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    color: '#525252',
    textAlign: 'center',
    lineHeight: 14,
  },
});
