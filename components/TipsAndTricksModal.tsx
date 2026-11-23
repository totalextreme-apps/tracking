import { useSound } from '@/context/SoundContext';
import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

type TipCategory = 'all' | 'basics' | 'customizing' | 'organizing' | 'pro';

interface TipSection {
  id: string;
  category: Exclude<TipCategory, 'all'>;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
  title: string;
  summary: string;
  steps: string[];
  proTip?: string;
}

const TIPS_DATA: TipSection[] = [
  {
    id: 'add-collection-thrift',
    category: 'basics',
    icon: 'add-circle-outline',
    badge: 'BASICS & THRIFT MODE',
    title: 'Adding to Collection vs. Thrift Mode Wishlist',
    summary: 'Log physical or digital titles you own, or switch to Thrift Mode while hunting at flea markets and thrift stores.',
    steps: [
      'Tap the yellow [+] button in the top header (or "ADD TITLE" on desktop) to search for any Movie or TV Show, or use the Barcode Scanner to scan a UPC.',
      'Select one or more formats (VHS, DVD, Blu-ray, 4K, Digital), choose OWNED or WISHLIST, and tap ADD TO STACKS.',
      'Flip the THRIFT switch in the top-right header anytime to toggle between your Owned Collection ("The Stacks") and your Wishlist ("Thrift Mode").',
      'When you find a wishlist item in the wild, long-press its card (or open its detail screen) and tap MARK ACQUIRED for a celebration animation!',
    ],
    proTip: 'Double-tap any owned card in your grid to pin/unpin it to your "On Display" shelf at the top of your screen. Double-tap a wishlist card to crown it as a "Grail"!',
  },
  {
    id: 'multipack-titles',
    category: 'organizing',
    icon: 'albums-outline',
    badge: 'MULTI-PACKS & BOX SETS',
    title: 'Grouping Multi-Pack & Compilation Releases',
    summary: 'Own a 2-pack, 4-Movie Midnight Marathon DVD, or multi-tape VHS set? Stack the titles together into a single Multi-pack card.',
    steps: [
      'Open the Movie or TV Show detail screen (or fill out the fields while adding a new title) and scroll to "Release Details & Format Notes".',
      'Check the box labeled "PART OF A COMPILATION / MULTI-PACK".',
      'Type the name of the compilation (e.g., "4 Movie Midnight Marathon Pack: Aliens" or "Dollman vs. Evil Toys Collection"), or tap one of your existing Multi-pack quick-pills.',
      'Tap SAVE. All movies or tapes tagged with that same Multi-pack name will automatically stack physically on top of one another on your shelf!',
    ],
    proTip: 'Tap a Multi-pack stack on your shelf to open the Multi-pack drawer, where you can see every included movie, jump to any title, or tap the cycle icon on the card to flip which cover sits on top.',
  },
  {
    id: 'custom-titles-vhs-volumes',
    category: 'customizing',
    icon: 'text-outline',
    badge: 'CUSTOM TITLES & VHS VOLUMES',
    title: 'Custom Movie/TV Titles & Standalone VHS Volumes',
    summary: 'Override TMDB titles for alternate releases (like "Dead Alive" vs. "Braindead") or log standalone TV episode VHS tapes (like "South Park: Vol. 1").',
    steps: [
      'For Movies: Open the movie info screen, scroll to "Release Details & Format Notes", enter your preferred title in "Custom Display Title", and tap SAVE.',
      'For TV Show VHS Volumes / Specials: Open the TV show info screen (or add the show), select "SPECIAL / VHS VOLUME", and enter a "Custom Release Title" (e.g., "Midnight Madness: She Demons" or "South Park: Vol. 1").',
      'You can add as many separate VHS Volumes or Specials under the same TV show as you own — each copy can have its own custom release title, edition notes, and custom cover art!',
    ],
    proTip: 'If each copy of a TV show has a distinct Custom Release Title (and is not in a Multi-pack), it stands as its own individual card on your shelf with its own cover art.',
  },
  {
    id: 'custom-cover-art',
    category: 'customizing',
    icon: 'image-outline',
    badge: 'CUSTOM ARTWORK',
    title: 'Uploading Custom Cover Art & Backdrops',
    summary: 'Replace default TMDB posters with photos or scans of your actual VHS slipcovers, limited-edition steelbooks, or bootleg sleeves.',
    steps: [
      'Open any Movie or TV Show info screen and select the format copy you want to customize.',
      'Tap UPLOAD COVER (or CHANGE COVER) next to the poster at the top — or tap CUSTOM COVER directly on a specific copy in the Release Details section.',
      'Take a photo with your camera or choose an image from your library, crop it to fit the format ratio (VHS, DVD, or Blu-ray/4K), and save.',
      'You can also upload a custom 16:9 backdrop banner and tap FOCAL (Top / Center / Bottom) to adjust how the banner aligns.',
    ],
  },
  {
    id: 'custom-genre-stickers',
    category: 'customizing',
    icon: 'pricetag-outline',
    badge: 'GENRES & STICKERS',
    title: 'Setting a Custom Genre & Retro Genre Stickers',
    summary: 'Control the round video-store genre sticker on your covers and how titles are categorized when filtering by genre.',
    steps: [
      'Open any Movie or TV Show info screen and scroll down to the "Franchise & Sorting Tags" section.',
      'Type any genre into the "Custom Primary Genre" field (e.g., "Horror", "Sci-Fi", "Documentary", "Cult"), or tap one of the genre pills below the input.',
      'Tap SAVE TITLE SETTINGS. The round genre sticker on the top-left of the cover will immediately update to match your custom genre!',
    ],
    proTip: 'Prefer clean covers without genre stickers? You can toggle Genre Stickers on or off anytime in Profile / Settings -> Genre Stickers.',
  },
  {
    id: 'franchise-sorting',
    category: 'organizing',
    icon: 'layers-outline',
    badge: 'FRANCHISE GROUPING',
    title: 'Keeping Sequels Together with Franchise Order',
    summary: 'Stop sequels with different names (like "First Blood" and "Rambo", or "Evil Dead" and "Army of Darkness") from splitting up alphabetically.',
    steps: [
      'Open a movie or show info screen and scroll to "Franchise & Sorting Tags".',
      'Enter a shared Franchise name (e.g., "Evil Dead" or "Friday the 13th") and an Order # (1, 2, 3...) for each entry in the series, then tap SAVE TITLE SETTINGS.',
      'On your main shelf, when sorting by NAME (or searching), keep the "FRANCHISE" toggle active to group the entire series together in chronological order!',
    ],
  },
  {
    id: 'cast-search-filters',
    category: 'pro',
    icon: 'people-outline',
    badge: 'CAST & POWER FILTERS',
    title: 'Actor/Director Tap-to-Filter & Edition Filters',
    summary: 'Explore your collection by the actors and directors starring in your movies, or filter by special editions and bootlegs.',
    steps: [
      'On any Movie or TV Show info screen, scroll to the "STARRING" cast row and tap any Actor or Director\'s photo/name to immediately view every title you own featuring them.',
      'You can also switch the search bar on your main shelf between TITLE, ACTOR, and DIRECTOR modes.',
      'Use the filter pills below the search bar (or inside the Sort box) to filter by format, MULTI-PACK, HAS EDITION (items with text in the edition field), BOOTLEG, FOR SALE, or FOR TRADE.',
    ],
  },
  {
    id: 'watch-tracker-roulette-value',
    category: 'pro',
    icon: 'sparkles-outline',
    badge: 'POWER TOOLS',
    title: 'Watch Tracker, Auto-Valuation, Roulette & Receipts',
    summary: 'Track what you watch, estimate market value from eBay sold listings, spin the Roulette wheel, or print a retro receipt.',
    steps: [
      'Watch Tracker: Tap the green eye icon (or LOG VIEW) on any owned title to increment your tape counter and log when you watched it.',
      'Auto Market Value: Inside "Release Details & Format Notes", tap AUTO VALUE to look up recent eBay sold prices for your specific format and edition.',
      'Movie Roulette: Tap the dice icon next to "THE STACKS" header on your home screen when you can\'t decide what to watch tonight.',
      'Retro Inventory Receipt: Head to Profile / Settings -> "Print Inventory Receipt (PDF)" to generate a dot-matrix video store receipt of your collection!',
    ],
  },
];

const CATEGORY_TABS: { id: TipCategory; label: string }[] = [
  { id: 'all', label: 'ALL TIPS' },
  { id: 'basics', label: 'BASICS' },
  { id: 'customizing', label: 'CUSTOMIZE' },
  { id: 'organizing', label: 'ORGANIZE' },
  { id: 'pro', label: 'PRO TOOLS' },
];

type TipsAndTricksModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function TipsAndTricksModal({ visible, onClose }: TipsAndTricksModalProps) {
  const { playSound } = useSound();
  const [selectedCategory, setSelectedCategory] = useState<TipCategory>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({
    'add-collection-thrift': true,
    'multipack-titles': true,
    'custom-titles-vhs-volumes': true,
    'custom-genre-stickers': true,
  });

  const filteredTips =
    selectedCategory === 'all'
      ? TIPS_DATA
      : TIPS_DATA.filter((t) => t.category === selectedCategory);

  const toggleExpand = (id: string) => {
    playSound('click');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/90 justify-center items-center p-3 sm:p-6">
        <View
          className="bg-neutral-950 border-2 border-amber-500/50 rounded-2xl w-full overflow-hidden shadow-2xl"
          style={{ maxWidth: 640, maxHeight: '90%' }}
        >
          {/* Retro VHS Manual Header */}
          <View className="p-4 sm:p-5 bg-neutral-900 border-b border-neutral-800">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2.5 flex-1 pr-2">
                <View className="bg-amber-500/15 border border-amber-500/40 p-2 rounded-xl">
                  <Ionicons name="bulb-outline" size={20} color="#f59e0b" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-amber-500 font-mono text-[9px] font-bold uppercase tracking-widest">
                      COLLECTOR&apos;S FIELD MANUAL
                    </Text>
                  </View>
                  <Text
                    className="text-white font-bold text-lg sm:text-xl uppercase tracking-wider mt-0.5"
                    style={{ fontFamily: 'VCR_OSD_MONO' }}
                  >
                    TIPS, TRICKS &amp; TUTORIALS
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  playSound('click');
                  onClose();
                }}
                className="p-2 bg-neutral-800 rounded-full border border-neutral-700"
              >
                <Ionicons name="close" size={18} color="#d4d4d4" />
              </Pressable>
            </View>

            {/* Category Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mt-3.5"
              contentContainerStyle={{ gap: 6 }}
            >
              {CATEGORY_TABS.map((tab) => {
                const isActive = selectedCategory === tab.id;
                return (
                  <Pressable
                    key={tab.id}
                    onPress={() => {
                      playSound('click');
                      setSelectedCategory(tab.id);
                    }}
                    className={`px-3 py-1.5 rounded-full border ${
                      isActive
                        ? 'bg-amber-500 border-amber-400'
                        : 'bg-neutral-950 border-neutral-800'
                    }`}
                  >
                    <Text
                      className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                        isActive ? 'text-black' : 'text-neutral-400'
                      }`}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Tutorials List */}
          <ScrollView className="p-3.5 sm:p-5" contentContainerStyle={{ paddingBottom: 24 }}>
            <Text className="text-neutral-400 font-mono text-xs leading-5 mb-4">
              Tap any guide below to expand step-by-step instructions for getting the most out of your shelves.
            </Text>

            {filteredTips.map((tip) => {
              const isExpanded = !!expandedIds[tip.id];
              return (
                <View
                  key={tip.id}
                  className={`mb-3 rounded-xl border overflow-hidden ${
                    isExpanded
                      ? 'bg-neutral-900/90 border-amber-500/40'
                      : 'bg-neutral-900/50 border-neutral-800'
                  }`}
                >
                  <Pressable
                    onPress={() => toggleExpand(tip.id)}
                    className="p-3.5 flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center gap-3 flex-1 pr-2">
                      <View
                        className={`w-9 h-9 rounded-lg items-center justify-center border ${
                          isExpanded
                            ? 'bg-amber-500/20 border-amber-500/50'
                            : 'bg-neutral-950 border-neutral-800'
                        }`}
                      >
                        <Ionicons
                          name={tip.icon}
                          size={18}
                          color={isExpanded ? '#f59e0b' : '#a3a3a3'}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-amber-500/90 font-mono text-[8px] font-bold uppercase tracking-widest">
                          {tip.badge}
                        </Text>
                        <Text className="text-white font-bold text-sm leading-tight mt-0.5">
                          {tip.title}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={isExpanded ? '#f59e0b' : '#737373'}
                    />
                  </Pressable>

                  {isExpanded && (
                    <View className="px-3.5 pb-3.5 pt-1 border-t border-neutral-800/80">
                      <Text className="text-neutral-300 font-mono text-xs leading-5 mb-3 mt-1">
                        {tip.summary}
                      </Text>

                      <View className="gap-2">
                        {tip.steps.map((step, idx) => (
                          <View key={idx} className="flex-row items-start bg-neutral-950/70 p-2.5 rounded-lg border border-neutral-800/60">
                            <View className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 items-center justify-center mr-2.5 mt-0.5">
                              <Text className="text-amber-400 font-mono text-[10px] font-bold">
                                {idx + 1}
                              </Text>
                            </View>
                            <Text className="text-neutral-300 font-mono text-[11px] leading-4 flex-1">
                              {step}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {tip.proTip && (
                        <View className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 flex-row items-start gap-2">
                          <FontAwesome name="star" size={11} color="#f59e0b" style={{ marginTop: 2 }} />
                          <Text className="text-amber-300 font-mono text-[10px] leading-4 flex-1">
                            <Text className="font-bold">PRO TIP: </Text>
                            {tip.proTip}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View className="p-3.5 bg-neutral-900 border-t border-neutral-800 flex-row items-center justify-between">
            <Text className="text-neutral-500 font-mono text-[9px] flex-1 pr-2">
              You can reopen this guide anytime from the top banner or Settings.
            </Text>
            <Pressable
              onPress={() => {
                playSound('click');
                onClose();
              }}
              className="bg-amber-500 px-4 py-2 rounded-lg"
            >
              <Text className="text-black font-mono text-xs font-bold uppercase">GOT IT</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
