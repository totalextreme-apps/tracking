import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Pressable, 
  Image, 
  TextInput, 
  ActivityIndicator, 
  StyleSheet, 
  RefreshControl,
  Modal,
  ScrollView,
  ImageBackground
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { getMovieById, getTvShowById } from '@/lib/tmdb';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

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
  notes: string | null;
  created_at: string;
  movies?: {
    id: number;
    tmdb_id: number;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    release_date: string | null;
    genres: { id: number; name: string }[] | null;
  } | null;
  shows?: {
    id: number;
    tmdb_id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
    first_air_date: string | null;
    genres: { id: number; name: string }[] | null;
  } | null;
  profiles?: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface GroupedSwapTitle {
  id: string; // `movie_${id}` or `show_${id}`
  mediaType: 'movie' | 'tv';
  tmdbId: number;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  releaseYear: string;
  genres: string[];
  minPrice: number | null;
  maxPrice: number | null;
  hasTrade: boolean;
  formats: string[];
  listings: SwapItem[];
}

const FORMAT_COLORS: Record<string, string> = {
  '4K': '#eab308',       // Yellow
  'BluRay': '#3b82f6',   // Blue
  'DVD': '#a855f7',      // Purple
  'VHS': '#ef4444',      // Red
  'Digital': '#10b981',  // Green
};

export function SwapMeetView({ 
  selectedSwapTitleKey, 
  setSelectedSwapTitleKey 
}: { 
  selectedSwapTitleKey?: string | null; 
  setSelectedSwapTitleKey?: (key: string | null) => void;
}) {
  const router = useRouter();
  const { userId: currentUserId } = useAuth();
  const { playSound } = useSound();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'sale' | 'trade'>('all');
  const [formatFilter, setFormatFilter] = useState<string>('ALL');
  
  const [selectedTitle, setSelectedTitle] = useState<GroupedSwapTitle | null>(null);
  const [synopsis, setSynopsis] = useState('');
  const [synopsisLoading, setSynopsisLoading] = useState(false);

  // Load TMDB Synopsis when a title is clicked
  useEffect(() => {
    if (!selectedTitle) {
      setSynopsis('');
      return;
    }

    async function fetchSynopsis() {
      setSynopsisLoading(true);
      try {
        if (selectedTitle.mediaType === 'movie') {
          const details = await getMovieById(selectedTitle.tmdbId);
          setSynopsis(details?.overview || 'No synopsis available.');
        } else {
          const details = await getTvShowById(selectedTitle.tmdbId);
          setSynopsis(details?.overview || 'No synopsis available.');
        }
      } catch (err) {
        console.error('Error fetching synopsis:', err);
        setSynopsis('Synopsis unavailable.');
      } finally {
        setSynopsisLoading(false);
      }
    }

    fetchSynopsis();
  }, [selectedTitle]);

  // Query: Fetch all listing items
  const { data: swapItems = [], isLoading, isRefetching, refetch } = useQuery<SwapItem[]>({
    queryKey: ['swap-meet-items'],
    queryFn: async () => {
      const { data: items, error: itemsError } = await supabase
        .from('collection_items')
        .select(`
          *,
          movies (id, tmdb_id, title, poster_path, backdrop_path, release_date, genres),
          shows (id, tmdb_id, name, poster_path, backdrop_path, first_air_date, genres)
        `)
        .or('for_sale.eq.true,for_trade.eq.true')
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      if (!items || items.length === 0) return [];

      const ownerIds = Array.from(new Set(items.map(i => i.user_id)));
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', ownerIds);

      if (profilesError) throw profilesError;

      return items.map(item => ({
        ...item,
        profiles: profiles?.find(p => p.id === item.user_id) || null
      }));
    }
  });

  // Aggregation/Grouping Logic (In-Memory)
  const groupedTitles = useMemo(() => {
    const map: Record<string, GroupedSwapTitle> = {};

    swapItems.forEach(item => {
      const media = item.movies || item.shows;
      if (!media) return;

      const mediaType = item.movies ? 'movie' : 'tv';
      const dbId = item.movie_id || item.show_id;
      const key = `${mediaType}_${dbId}`;

      const title = item.movies?.title || item.shows?.name || '';
      const tmdbId = media.tmdb_id;
      const posterPath = media.poster_path;
      const backdropPath = media.backdrop_path;
      
      const rawDate = item.movies?.release_date || item.shows?.first_air_date || '';
      const releaseYear = rawDate ? rawDate.substring(0, 4) : '';
      const genres = (media.genres as any[])?.map(g => g.name) || [];

      if (!map[key]) {
        map[key] = {
          id: key,
          mediaType,
          tmdbId,
          title,
          posterPath,
          backdropPath,
          releaseYear,
          genres,
          minPrice: null,
          maxPrice: null,
          hasTrade: false,
          formats: [],
          listings: [],
        };
      }

      const g = map[key];
      g.listings.push(item);

      if (item.for_sale && item.price !== null) {
        if (g.minPrice === null || item.price < g.minPrice) g.minPrice = item.price;
        if (g.maxPrice === null || item.price > g.maxPrice) g.maxPrice = item.price;
      }
      if (item.for_trade) {
        g.hasTrade = true;
      }

      if (!g.formats.includes(item.format)) {
        g.formats.push(item.format);
      }
    });

    return Object.values(map);
  }, [swapItems]);

  // Pre-select title from parent preview selection
  useEffect(() => {
    if (selectedSwapTitleKey && groupedTitles.length > 0) {
      const match = groupedTitles.find(g => g.id === selectedSwapTitleKey);
      if (match) {
        setSelectedTitle(match);
        setSelectedSwapTitleKey?.(null); // Clear
      }
    }
  }, [selectedSwapTitleKey, groupedTitles]);

  // Filter Grouped Titles
  const filteredGroupedTitles = useMemo(() => {
    return groupedTitles.filter(group => {
      const matchesSearch = group.title.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = 
        typeFilter === 'all' || 
        (typeFilter === 'sale' && group.listings.some(l => l.for_sale)) || 
        (typeFilter === 'trade' && group.listings.some(l => l.for_trade));

      const matchesFormat = 
        formatFilter === 'ALL' || 
        group.formats.some(f => f.toLowerCase() === formatFilter.toLowerCase());

      return matchesSearch && matchesType && matchesFormat;
    });
  }, [groupedTitles, searchQuery, typeFilter, formatFilter]);

  const handleContactSeller = (item: SwapItem) => {
    playSound('click');
    const title = item.movies?.title || item.shows?.name || 'this item';
    const prefillMessage = `Hey @${item.profiles?.username || 'member'}, I saw your copy of "${title}" (${item.format}) listed in The Swap Meet for ${item.for_sale ? `$${item.price?.toFixed(2)}` : 'trade'}. Is it still available?`;
    
    setSelectedTitle(null); // Close modal
    router.push({
      pathname: `/(tabs)/profile/chat/${item.user_id}` as any,
      params: { prefill: prefillMessage }
    });
  };

  const renderTitleCard = ({ item }: { item: GroupedSwapTitle }) => {
    const posterUrl = item.posterPath ? `https://image.tmdb.org/t/p/w300${item.posterPath}` : null;
    
    // Compute display pricing
    let priceLabel = '';
    if (item.minPrice !== null) {
      if (item.minPrice === item.maxPrice) {
        priceLabel = `$${item.minPrice.toFixed(2)}`;
      } else {
        priceLabel = `$${item.minPrice.toFixed(2)} - $${item.maxPrice?.toFixed(2)}`;
      }
    }
    
    return (
      <Pressable 
        onPress={() => {
          playSound('click');
          setSelectedTitle(item);
        }}
        style={styles.cardContainer}
      >
        {/* Poster */}
        <View style={styles.posterContainer}>
          {posterUrl ? (
            <Image source={{ uri: posterUrl }} style={styles.poster} />
          ) : (
            <View style={styles.placeholderPoster}>
              <Ionicons name="film-outline" size={24} color="#525252" />
            </View>
          )}
        </View>

        {/* Details */}
        <View style={styles.detailsContainer}>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.yearText}>({item.releaseYear})</Text>
            </View>
            <Text style={styles.genreList} numberOfLines={1}>{item.genres.join(' • ')}</Text>

            {/* Copies Count & Available Formats */}
            <View style={styles.formatRow}>
              {item.formats.map(fmt => (
                <View key={fmt} style={[styles.formatChip, { backgroundColor: FORMAT_COLORS[fmt] || '#737373' }]}>
                  <Text style={styles.formatChipText}>{fmt.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Footer stats */}
          <View style={styles.cardFooter}>
            <View style={styles.listingsCountRow}>
              <Ionicons name="copy-outline" size={10} color="#737373" />
              <Text style={styles.listingsCountText}>{item.listings.length} copies</Text>
            </View>

            <View style={styles.priceContainer}>
              {priceLabel !== '' && (
                <Text style={styles.minPriceText}>{priceLabel}</Text>
              )}
              {item.hasTrade && (
                <View style={styles.tradeBadgeSmall}>
                  <Text style={styles.tradeBadgeTextSmall}>TRADE</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search and Filters */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={14} color="#737373" style={{ marginRight: 6 }} />
          <TextInput
            placeholder="Search Swap Meet titles..."
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
      ) : filteredGroupedTitles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="gift-outline" size={48} color="#262626" />
          <Text style={styles.emptyText}>Nothing listed in this section yet.</Text>
          <Text style={styles.emptySubtext}>Mark titles in your collection "For Sale" or "For Trade" to list them here!</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroupedTitles}
          keyExtractor={item => item.id}
          renderItem={renderTitleCard}
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

      {/* ─── DEDICATED TITLE LANDING MODAL ─── */}
      <Modal
        visible={!!selectedTitle}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedTitle(null)}
      >
        {selectedTitle && (
          <View style={styles.modalRoot}>
            {/* Glassmorphic overlay background */}
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
            
            <View style={styles.modalContent}>
              {/* Backdrop Header */}
              <ImageBackground 
                source={{ uri: selectedTitle.backdropPath ? `https://image.tmdb.org/t/p/w780${selectedTitle.backdropPath}` : 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?q=80&w=600' }}
                style={styles.modalBackdrop}
              >
                <LinearGradient 
                  colors={['rgba(0,0,0,0.1)', 'rgba(10,10,10,1)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.backdropHeader}>
                  <Pressable 
                    onPress={() => { playSound('click'); setSelectedTitle(null); }}
                    style={styles.closeModalBtn}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </Pressable>
                </View>

                {/* Title Info Header */}
                <View style={styles.backdropFooter}>
                  <Text style={styles.backdropTitle}>{selectedTitle.title}</Text>
                  <Text style={styles.backdropYear}>{selectedTitle.releaseYear} • {selectedTitle.genres.join(' / ')}</Text>
                </View>
              </ImageBackground>

              {/* Scrollable details */}
              <ScrollView contentContainerStyle={styles.modalScroll}>
                {/* Synopsis */}
                <View style={styles.synopsisSection}>
                  <Text style={styles.sectionHeader}>SYNOPSIS</Text>
                  {synopsisLoading ? (
                    <ActivityIndicator size="small" color="#f59e0b" style={{ padding: 12 }} />
                  ) : (
                    <Text style={styles.synopsisText}>{synopsis}</Text>
                  )}
                </View>

                {/* Copies list */}
                <View style={styles.copiesSection}>
                  <Text style={styles.sectionHeader}>COMMUNITY COPIES AVAILABLE ({selectedTitle.listings.length})</Text>
                  
                  {selectedTitle.listings.map((item) => {
                    const isOwner = item.user_id === currentUserId;
                    const formatBg = FORMAT_COLORS[item.format] || '#737373';
                    
                    return (
                      <View key={item.id} style={styles.copyRow}>
                        <View style={styles.copyHeader}>
                          {/* Format & Edition info */}
                          <View style={styles.copyMeta}>
                            <View style={[styles.formatLabelBadge, { backgroundColor: formatBg }]}>
                              <Text style={styles.formatLabelText}>{item.format.toUpperCase()}</Text>
                            </View>
                            <Text style={styles.editionText} numberOfLines={1}>
                              {item.edition || 'Standard Edition'}
                            </Text>
                          </View>

                          {/* Price / Trade Label */}
                          <View style={styles.copyPriceRow}>
                            {item.for_sale && item.price !== null && (
                              <Text style={styles.copyPriceVal}>${item.price.toFixed(2)}</Text>
                            )}
                            {item.for_trade && (
                              <View style={styles.tradeBadgeMini}>
                                <Text style={styles.tradeBadgeMiniText}>TRADE</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Copy specific details / Condition */}
                        {item.condition && (
                          <View style={styles.copyDetailsRow}>
                            <Text style={styles.copyDetailsLabel}>Condition: </Text>
                            <Text style={styles.copyDetailsVal}>{item.condition}</Text>
                          </View>
                        )}

                        {/* User custom description/notes */}
                        {item.notes && (
                          <View style={styles.copyDescBox}>
                            <Text style={styles.copyDescText}>{item.notes}</Text>
                          </View>
                        )}

                        {/* Seller profile & message action */}
                        <View style={styles.copyFooter}>
                          <Pressable 
                            onPress={() => {
                              setSelectedTitle(null);
                              router.push(`/profile/${item.user_id}`);
                            }}
                            style={styles.sellerRow}
                          >
                            <View style={styles.sellerAvatar}>
                              {item.profiles?.avatar_url ? (
                                <Image source={{ uri: item.profiles.avatar_url }} style={styles.sellerAvatarImg} />
                              ) : (
                                <Ionicons name="person-circle" size={14} color="#737373" />
                              )}
                            </View>
                            <Text style={styles.sellerNameText}>@{item.profiles?.username || 'member'}</Text>
                          </Pressable>

                          {isOwner ? (
                            <Pressable
                              onPress={() => {
                                playSound('click');
                                setSelectedTitle(null);
                                const targetType = item.movies ? 'movie' : 'show';
                                const targetId = item.movie_id || item.show_id;
                                router.push(`/(tabs)/${targetType}/${targetId}`);
                              }}
                              style={styles.copyEditBtn}
                            >
                              <Text style={styles.copyEditBtnText}>EDIT LISTING</Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              onPress={() => handleContactSeller(item)}
                              style={styles.copyMessageBtn}
                            >
                              <Ionicons name="chatbubble-ellipses" size={10} color="#000" />
                              <Text style={styles.copyMessageBtnText}>CONTACT SELLER</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
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
    paddingBottom: 160,
  },
  cardContainer: {
    flexDirection: 'row',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
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
  detailsContainer: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontFamily: 'SpaceMono',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    flexShrink: 1,
  },
  yearText: {
    fontFamily: 'SpaceMono',
    fontSize: 10,
    color: '#525252',
  },
  genreList: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    color: '#737373',
    marginTop: 1,
  },
  formatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  formatChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 2,
  },
  formatChipText: {
    color: '#000000',
    fontFamily: 'SpaceMono',
    fontSize: 6,
    fontWeight: 'bold',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: '#171717',
    paddingTop: 6,
    marginTop: 8,
  },
  listingsCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listingsCountText: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    color: '#737373',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  minPriceText: {
    color: '#ef4444',
    fontFamily: 'SpaceMono',
    fontSize: 9,
    fontWeight: 'bold',
  },
  tradeBadgeSmall: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tradeBadgeTextSmall: {
    color: '#10b981',
    fontFamily: 'SpaceMono',
    fontSize: 6,
    fontWeight: 'bold',
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#262626',
  },
  modalBackdrop: {
    width: '100%',
    height: 160,
    justifyContent: 'space-between',
    padding: 16,
  },
  backdropHeader: {
    alignItems: 'flex-end',
  },
  closeModalBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropFooter: {
    marginTop: 'auto',
  },
  backdropTitle: {
    fontFamily: 'SpaceMono',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  backdropYear: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    color: '#a3a3a3',
    marginTop: 2,
  },
  modalScroll: {
    padding: 16,
    paddingBottom: 80,
  },
  synopsisSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    fontWeight: 'bold',
    color: '#f59e0b',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  synopsisText: {
    fontFamily: 'SpaceMono',
    fontSize: 10,
    color: '#a3a3a3',
    lineHeight: 14,
  },
  copiesSection: {
    marginBottom: 20,
  },
  copyRow: {
    backgroundColor: '#111',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    padding: 12,
    marginBottom: 12,
  },
  copyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  copyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  formatLabelBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  formatLabelText: {
    color: '#000000',
    fontFamily: 'SpaceMono',
    fontSize: 7,
    fontWeight: 'bold',
  },
  editionText: {
    fontFamily: 'SpaceMono',
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
    flexShrink: 1,
  },
  copyPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyPriceVal: {
    color: '#ef4444',
    fontFamily: 'SpaceMono',
    fontSize: 11,
    fontWeight: 'bold',
  },
  tradeBadgeMini: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tradeBadgeMiniText: {
    color: '#10b981',
    fontFamily: 'SpaceMono',
    fontSize: 7,
    fontWeight: 'bold',
  },
  copyDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  copyDetailsLabel: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    color: '#525252',
  },
  copyDetailsVal: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    color: '#f59e0b',
  },
  copyDescBox: {
    backgroundColor: '#0a0a0a',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    padding: 8,
    marginTop: 8,
  },
  copyDescText: {
    fontFamily: 'SpaceMono',
    fontSize: 9,
    color: '#737373',
    lineHeight: 12,
  },
  copyFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    borderTopWidth: 1,
    borderColor: '#1a1a1a',
    paddingTop: 8,
  },
  sellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  sellerAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#262626',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  sellerAvatarImg: {
    width: '100%',
    height: '100%',
  },
  sellerNameText: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    color: '#a3a3a3',
    fontWeight: 'bold',
  },
  copyMessageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copyMessageBtnText: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    fontWeight: 'bold',
    color: '#000000',
  },
  copyEditBtn: {
    backgroundColor: '#262626',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#404040',
  },
  copyEditBtnText: {
    fontFamily: 'SpaceMono',
    fontSize: 8,
    color: '#a3a3a3',
    fontWeight: 'bold',
  },
});
