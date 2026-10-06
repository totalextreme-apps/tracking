import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const POSTERS = [
  "/wGTpGGRMZmyFCcrY2YoxVTIBlli.jpg", // Nightmare on Elm Street
  "/wvpgvcWNkF2HLuTEMIM7K83MvZ.jpg", // Child's Play
  "/wijlZ3HaYMvlDTPqJoTCWKFkCPU.jpg", // Halloween
  "/A3s2tQGNb6mhlr1hPZeE5F8IUwp.jpg", // Night of the Creeps
  "/tzGY49kseSE9QAKk47uuDGwnSCu.jpg", // The Thing
  "/xfPOxLpHexVguBauZRPpYs8hueo.jpg", // Evil Dead II
  "/88wlJ4teYlck4hJ2bnlxBrAVh0m.jpg", // Friday the 13th
  "/3Z0oPHyLnk3Vx6ZMC1MiVwIrKhO.jpg", // Hellraiser
  "/mpgkRPH1GNkMCgdPk2OMyHzAks7.jpg", // The Texas Chain Saw Massacre
  "/7FYhY70LTumoFfQgTI8TK0UDdsF.jpg", // Re-Animator
  "/oNsV9BychAe4Sk6xFKp558Rlpyz.jpg", // The Return of the Living Dead
  "/eR0uJ0Wje1lYJ4aHEpkcjgIM8d7.jpg", // Phantasm
  "/qqqkiZSU9EBGZ1KiDmfn07S7qvv.jpg", // Videodrome
  "/uAR0AWqhQL1hQa69UDEbb2rE5Wx.jpg", // The Shining
  "/vfrQk5IPloGg1v9Rzbh2Eg3VGyM.jpg", // Alien
  "/nD4M4Bx457ryLuKYpxFwQ2IBJ5w.jpg", // Scream
  "/dqoshZPLNsXlC1qtz5n34raUyrE.jpg", // Candyman
  "/8gZWMhJHRvaXdXsNhERtqNHYpH3.jpg", // The Fly
  "/hVEqUASJmCQaolkKFEySCHZ8uKG.jpg", // An American Werewolf in London
  "/mRy7JnuvqFnQ0VFScfnMzfqM67W.jpg", // Suspiria
  "/5mVyFHSY2rSsNgD4NfEwV82HigU.jpg", // The Girl Next Door
  "/2ZkuQXvVhh45uSvkBej4S7Ix1NJ.jpg", // Mean Girls
  "/aHTUpo45qy9QYIOnVITGGqLoVcA.jpg", // White Chicks
  "/9ohlMrJHQqKhfUKh7Zr3JQqHNLZ.jpg", // Legally Blonde
  "/bnVby0qI0dS7YunbShP7mw68HY3.jpg", // Bring It On
  "/8AwVTcgpTnmeOs4TdTWqcFDXEsA.jpg", // Clueless
  "/ujERk3aKABXU3NDXOAxEQYTHe9A.jpg", // 10 Things I Hate About You
  "/rtzcrwgsuESV2adSDhIuLyQoZmp.jpg", // Heathers
  "/76cCsRtQ5MJBAqoigojXsLXLJwh.jpg", // Cruel Intentions
  "/5P68by2Thn8wHAziyWGEw2O7hco.jpg"  // American Pie
].map(path => `https://image.tmdb.org/t/p/w500${path}`);

// Shuffle function for randomizing poster order per column
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const POSTER_WIDTH = 140;
const POSTER_HEIGHT = 210;
const POSTER_GAP = 16;
const ITEM_SIZE = POSTER_HEIGHT + POSTER_GAP;

function ScrollingColumn({ images, reverse = false, speedMs = 30000 }: { images: string[], reverse?: boolean, speedMs?: number }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    const totalHeight = ITEM_SIZE * images.length;
    translateY.value = reverse ? -totalHeight : 0;
    translateY.value = withRepeat(
      withTiming(reverse ? 0 : -totalHeight, {
        duration: speedMs,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, [images.length, reverse, speedMs, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Render the images twice to create a seamless loop
  const duplicatedImages = [...images, ...images];

  return (
    <View style={styles.columnContainer}>
      <Animated.View style={[styles.columnInner, animatedStyle]}>
        {duplicatedImages.map((uri, index) => (
          <Image
            key={`${uri}-${index}`}
            source={{ uri }}
            style={styles.poster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ))}
      </Animated.View>
    </View>
  );
}

export default function LandingPage() {
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  const columnsCount = Math.max(3, Math.ceil(dimensions.width / (POSTER_WIDTH + POSTER_GAP)) + 2);

  const columns = useMemo(() => {
    const cols = [];
    for (let i = 0; i < columnsCount; i++) {
      cols.push({
        id: i,
        images: shuffle(POSTERS),
        speed: 100000 + Math.random() * 40000, // Vary speed slightly and make it much slower
      });
    }
    return cols;
  }, [columnsCount]);

  const logoSource = Platform.OS === 'web'
    ? { uri: '/logo_tracking.png' }
    : require('@/assets/images/logo_tracking.png');

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Background Poster Grid */}
      <View style={styles.gridContainer}>
        {columns.map((col) => (
          <ScrollingColumn
            key={col.id}
            images={col.images}
            reverse={col.reverse}
            speedMs={col.speed}
          />
        ))}
      </View>

      {/* Overlays for fading out the top and bottom */}
      <LinearGradient
        colors={['rgba(10,10,10,0.9)', 'rgba(10,10,10,0.4)', 'rgba(10,10,10,0.1)', 'transparent']}
        style={[StyleSheet.absoluteFillObject, { height: '40%' }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(10,10,10,0.4)', 'rgba(10,10,10,0.85)', '#0a0a0a', '#0a0a0a']}
        style={[StyleSheet.absoluteFillObject, { top: '50%' }]}
        pointerEvents="none"
      />

      {/* Main Content inside ScrollView */}
      <ScrollView 
        style={StyleSheet.absoluteFillObject}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Image
            source={logoSource}
            style={{ width: 140, height: 40 }}
            contentFit="contain"
          />
          <Pressable onPress={() => router.push('/auth')} style={styles.signInButton}>
            <Text style={styles.signInText}>Sign In</Text>
          </Pressable>
        </View>

        {/* Hero Section */}
        <View style={[styles.content, { minHeight: dimensions.height - 84 }]}>
          <Text style={styles.headline}>
            Rewind your collection.
          </Text>
          <Text style={styles.subHeadline}>
            Build the video store you always wanted.
          </Text>
          <Text style={styles.subtext}>
            Tracking makes maintaining a collection feel like collecting. It's part collection manager, part hunting companion, and part digital recreation of the video store you wish still existed.
          </Text>
          <Pressable 
            style={({ pressed }) => [styles.ctaButton, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
            onPress={() => router.replace('/(tabs)')}
          >
            <Text style={styles.ctaText}>Start Tracking</Text>
          </Pressable>
        </View>

        {/* Features Carousel Section */}
        <View style={styles.featuresSection}>
          <Text style={styles.featuresHeadline}>Everything you need to track.</Text>
          
          <Animated.ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselContainer}
            snapToInterval={Platform.OS === 'web' || dimensions.width > 768 ? 424 : dimensions.width * 0.85 + 24}
            decelerationRate="fast"
          >
            {[
              {
                title: "Beautiful Cover Art",
                desc: "Browse your collection like a real video store shelf with high quality, tactile cover art and custom metadata. Set your favorites On Display with a Staff Pick sticker.",
                image: require('@/assets/images/screenshots/IMG_7813.jpg')
              },
              {
                title: "Hunt for Grails",
                desc: "Activate Thrift Mode to turn your wish list into a hit list. Keep track of what you're hunting for when you're out at the shops.",
                image: require('@/assets/images/screenshots/IMG_7817.jpg')
              },
              {
                title: "Deep Dive Details",
                desc: "Log your watch history, view trailers, check Letterboxd ratings, and set custom cover art to make your shelves exactly how you want.",
                image: require('@/assets/images/screenshots/IMG_7815.jpg')
              },
              {
                title: "Community & Friends",
                desc: "See what your friends are watching and adding. View the most circulated and most wanted titles in the Tracking community.",
                image: require('@/assets/images/screenshots/IMG_7816.jpg')
              }
            ].map((item, index) => (
              <View key={index} style={[styles.featureCard, { width: Platform.OS === 'web' || dimensions.width > 768 ? 400 : dimensions.width * 0.85 }]}>
                <Image 
                  source={item.image} 
                  style={styles.screenshotImage} 
                  contentFit="cover"
                  contentPosition="top center"
                />
                <View style={styles.featureInfo}>
                  <Text style={styles.featureTitle}>{item.title}</Text>
                  <Text style={styles.featureDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </Animated.ScrollView>
        </View>

        {/* Feature Breakdown Section */}
        <View style={styles.breakdownSection}>
          <Text style={styles.breakdownHeadline}>Built for collectors. Not accountants.</Text>
          <View style={styles.breakdownGrid}>
            
            <View style={[styles.breakdownCard, { width: Platform.OS === 'web' || dimensions.width > 768 ? '30%' : '100%' }]}>
              <Text style={styles.breakdownIcon}>📄</Text>
              <Text style={styles.breakdownTitle}>PDF & CSV Export</Text>
              <Text style={styles.breakdownDesc}>Create an external backup of your collection so your data is always safe. Export your entire library to PDF or CSV in seconds.</Text>
            </View>

            <View style={[styles.breakdownCard, { width: Platform.OS === 'web' || dimensions.width > 768 ? '30%' : '100%' }]}>
              <Text style={styles.breakdownIcon}>📸</Text>
              <Text style={styles.breakdownTitle}>Lightning Fast Scanning</Text>
              <Text style={styles.breakdownDesc}>Log titles in seconds using the blazing fast barcode scanner, dictate using voice-to-text, or type them in manually.</Text>
            </View>

            <View style={[styles.breakdownCard, { width: Platform.OS === 'web' || dimensions.width > 768 ? '30%' : '100%' }]}>
              <Text style={styles.breakdownIcon}>📈</Text>
              <Text style={styles.breakdownTitle}>Powerful Sorting & Tags</Text>
              <Text style={styles.breakdownDesc}>Organize exactly how you want. Use custom tags, advanced filters, and group sequels automatically with Franchise Mode.</Text>
            </View>

            <View style={[styles.breakdownCard, { width: Platform.OS === 'web' || dimensions.width > 768 ? '30%' : '100%' }]}>
              <Text style={styles.breakdownIcon}>📼</Text>
              <Text style={styles.breakdownTitle}>Custom Cover Art</Text>
              <Text style={styles.breakdownDesc}>Upload custom slipcovers, VHS boxes, and steelbooks to make your digital shelf reflect reality perfectly.</Text>
            </View>

            <View style={[styles.breakdownCard, { width: Platform.OS === 'web' || dimensions.width > 768 ? '30%' : '100%' }]}>
              <Text style={styles.breakdownIcon}>🎬</Text>
              <Text style={styles.breakdownTitle}>Community Hub</Text>
              <Text style={styles.breakdownDesc}>Track what you and your friends are watching and adding. Share your stacks and discover what other collectors are tracking.</Text>
            </View>

            <View style={[styles.breakdownCard, { width: Platform.OS === 'web' || dimensions.width > 768 ? '30%' : '100%' }]}>
              <Text style={styles.breakdownIcon}>🏷️</Text>
              <Text style={styles.breakdownTitle}>Thrift Mode & Grails</Text>
              <Text style={styles.breakdownDesc}>Highlight your most wanted titles as 'Grails' and flip the app into Thrift Mode when you're hunting in the wild.</Text>
            </View>

          </View>
        </View>
      </ScrollView>
    </View>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
  },
  gridContainer: {
    position: 'absolute',
    top: -200,
    bottom: -200,
    left: -100,
    right: -100,
    flexDirection: 'row',
    gap: POSTER_GAP,
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }, { scale: 1.1 }],
    opacity: 0.45,
  },
  columnContainer: {
    width: POSTER_WIDTH,
    overflow: 'hidden',
  },
  columnInner: {
    flexDirection: 'column',
    gap: POSTER_GAP,
  },
  poster: {
    width: POSTER_WIDTH,
    height: POSTER_HEIGHT,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 24 : 60,
    zIndex: 10,
  },
  signInButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  signInText: {
    color: '#ffffff',
    fontFamily: 'SpaceMono',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: Platform.OS === 'web' ? 100 : 80,
    zIndex: 10,
    maxWidth: 800,
    alignSelf: 'center',
  },
  headline: {
    color: '#ffffff',
    fontSize: Platform.OS === 'web' ? 64 : 48,
    fontFamily: 'SpaceMono',
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 72 : 54,
    letterSpacing: -2,
    marginBottom: 8,
  },
  subHeadline: {
    color: '#f59e0b',
    fontSize: Platform.OS === 'web' ? 24 : 20,
    fontFamily: 'SpaceMono',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  subtext: {
    color: '#a3a3a3',
    fontSize: Platform.OS === 'web' ? 18 : 15,
    textAlign: 'center',
    lineHeight: Platform.OS === 'web' ? 30 : 24,
    marginBottom: 48,
    maxWidth: 700,
  },
  ctaButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 30,
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaText: {
    color: '#000000',
    fontSize: 18,
    fontFamily: 'SpaceMono',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  featuresSection: {
    paddingVertical: 80,
    backgroundColor: '#0a0a0a', // Solid background so it blocks the grid when scrolling down
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  featuresHeadline: {
    color: '#ffffff',
    fontSize: Platform.OS === 'web' ? 40 : 32,
    fontFamily: 'SpaceMono',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 48,
    paddingHorizontal: 24,
  },
  carouselContainer: {
    paddingHorizontal: Platform.OS === 'web' ? 64 : 24,
    gap: 24,
  },
  featureCard: {
    backgroundColor: '#141414',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  screenshotImage: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  featureInfo: {
    padding: 24,
  },
  featureTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'SpaceMono',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  featureDesc: {
    color: '#a3a3a3',
    fontSize: 15,
    lineHeight: 22,
  },
  breakdownSection: {
    paddingVertical: 80,
    paddingHorizontal: 32,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    paddingBottom: Platform.OS === 'web' ? 120 : 100,
  },
  breakdownHeadline: {
    color: '#ffffff',
    fontSize: Platform.OS === 'web' ? 40 : 32,
    fontFamily: 'SpaceMono',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 64,
  },
  breakdownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
    maxWidth: 1200,
    width: '100%',
  },
  breakdownCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    minWidth: 300,
  },
  breakdownIcon: {
    fontSize: 32,
    marginBottom: 20,
  },
  breakdownTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontFamily: 'SpaceMono',
    fontWeight: 'bold',
    marginBottom: 12,
  },
  breakdownDesc: {
    color: '#a3a3a3',
    fontSize: 15,
    lineHeight: 24,
  },
});
