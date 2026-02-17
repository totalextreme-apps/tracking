
import { MemberCard } from '@/components/MemberCard';
import { StatsSection } from '@/components/StatsSection';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useCollection } from '@/hooks/useCollection';
import { useProfile } from '@/hooks/useProfile';
import { exportCollection } from '@/lib/export-utils';
import { printInventoryReceipt } from '@/lib/receipt-utils';
import { supabase } from '@/lib/supabase';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

const logoSource = Platform.OS === 'web'
  ? { uri: '/logo_tracking.png' }
  : require('@/assets/images/logo_tracking.png');

export default function SettingsScreen() {
  const { userId, session } = useAuth();
  const { data: collection, isLoading: isCollectionLoading } = useCollection(userId);
  const { data: profile, isLoading: isProfileLoading, updateProfile, uploadAvatar, isUpdating } = useProfile(userId ?? null);

  const [isExporting, setIsExporting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');

  // Account Upgrade State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [customArtCount, setCustomArtCount] = useState(0);
  const [customArtSize, setCustomArtSize] = useState(0);
  const [isExportingArt, setIsExportingArt] = useState(false);
  const [isImportingArt, setIsImportingArt] = useState(false);

  const { soundEnabled, setSoundEnabled, staticEnabled, setStaticEnabled, resetOnboarding } = useSettings();

  const router = useRouter();

  // Stats Logic
  const totalMovies = collection?.length || 0;
  const totalGrails = collection?.filter(i => i.is_grail).length || 0;
  // Unique formats count?
  const uniqueFormats = new Set(collection?.map(i => i.format)).size || 0;

  const handleExport = async () => {
    // ... export logic (keep existing)
    let itemsToExport = collection || [];
    if (itemsToExport.length === 0) {
      Alert.alert('No items', 'Add items to your collection before exporting.');
      return;
    }
    setIsExporting(true);
    try {
      await exportCollection(itemsToExport);
    } catch (e) {
      Alert.alert('Export Failed', (e as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLinkAccount = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setIsLinking(true);
    try {
      const { error } = await supabase.auth.updateUser({ email, password });
      if (error) throw error;
      Alert.alert('Success', 'Please check your email to confirm the link.');
      setEmail('');
      setPassword('');
    } catch (e) {
      Alert.alert('Link Failed', (e as Error).message);
    } finally {
      setIsLinking(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out?', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        }
      }
    ]);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true, // Required for web upload to Supabase if URI is blob
      });

      if (!result.canceled) {
        // On web, we might need base64 or the blob uri. 
        // useProfile.ts needs to handle it.
        // For now, pass the URI, but ensures clean usage.
        await uploadAvatar(result.assets[0].uri, result.assets[0].base64);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Alert.alert('Upload Failed', (e as Error).message);
    }
  };

  const startEditing = () => {
    setEditUsername(profile?.username || '');
    setEditBio(profile?.bio || '');
    setIsEditing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const saveProfile = async () => {
    try {
      await updateProfile({ username: editUsername, bio: editBio });
      setIsEditing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Update Failed', (e as Error).message);
    }
  };

  if (isProfileLoading || isCollectionLoading) {
    return (
      <View className="flex-1 bg-neutral-950 items-center justify-center">
        <ActivityIndicator color="#f59e0b" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-neutral-950" contentContainerStyle={{ padding: 16 }}>

      {/* HEADER */}
      <View className="mb-6 items-center">
        <Text className="text-amber-500/90 font-mono text-sm font-bold tracking-widest mb-1">
          MEMBER ID
        </Text>
      </View>

      {/* MEMBER CARD */}
      <View className="mb-8">
        <MemberCard
          userId={userId ?? null}
          profile={profile || {}}
          onEditPress={startEditing}
          onAvatarPress={pickImage}
        />

        {/* Profile Info Below Card */}
        {!isEditing && (
          <View className="mt-6 px-2">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white font-bold text-3xl tracking-tight italic" style={{ fontFamily: 'sans-serif-condensed' }}>
                {profile?.username || 'NEW MEMBER'}
              </Text>
              <Pressable
                onPress={startEditing}
                className="bg-neutral-800 p-2 rounded-full border border-neutral-700"
              >
                <FontAwesome name="pencil" size={14} color="#f59e0b" />
              </Pressable>
            </View>

            {profile?.bio && (
              <Text className="text-neutral-400 font-mono text-sm leading-4">
                {profile.bio}
              </Text>
            )}
          </View>
        )}

        {/* Helper text if needed */}
        {isEditing && (
          <View className="mt-4 bg-neutral-900 p-4 rounded-lg border border-neutral-800">
            <Text className="text-amber-500 font-bold mb-2">Edit Profile</Text>
            <View className="gap-3">
              <View>
                <TextInput
                  value={editUsername}
                  onChangeText={setEditUsername}
                  className="bg-neutral-800 text-white p-3 rounded text-base font-mono border border-neutral-700"
                  placeholder="Username"
                  placeholderTextColor="#525252"
                />
              </View>
              <View>
                <TextInput
                  value={editBio}
                  onChangeText={setEditBio}
                  className="bg-neutral-800 text-white p-3 rounded text-sm font-mono border border-neutral-700"
                  placeholder="Bio"
                  placeholderTextColor="#525252"
                  multiline
                  maxLength={80}
                />
              </View>
              <View className="flex-row gap-3 mt-2">
                <Pressable onPress={() => setIsEditing(false)} className="flex-1 bg-neutral-800 p-3 rounded-lg items-center border border-neutral-700">
                  <Text className="text-neutral-400 font-mono font-bold">Cancel</Text>
                </Pressable>
                <Pressable onPress={saveProfile} className="flex-1 bg-amber-600 p-3 rounded-lg items-center shadow-lg">
                  {isUpdating ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-mono font-bold">Save Changes</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Stats Row (Below Card) */}
        {!isEditing && (
          <View className="flex-row gap-3 mt-6">
            <View className="flex-1 bg-neutral-900 p-3 rounded-lg border border-neutral-800 items-center">
              <Text className="text-2xl font-bold text-white font-mono">{totalMovies}</Text>
              <Text className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase">Movies</Text>
            </View>
            <View className="flex-1 bg-neutral-900 p-3 rounded-lg border border-neutral-800 items-center">
              <Text className="text-2xl font-bold text-amber-500 font-mono">{totalGrails}</Text>
              <Text className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase">Grails</Text>
            </View>
            <View className="flex-1 bg-neutral-900 p-3 rounded-lg border border-neutral-800 items-center">
              <Text className="text-2xl font-bold text-white font-mono">{uniqueFormats}</Text>
              <Text className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase">Formats</Text>
            </View>
          </View>
        )}

        {/* ACCOUNT UPGRADE (If Anonymous) */}
        {session?.user?.is_anonymous && (
          <View className="mt-8 bg-neutral-900 p-4 rounded-lg border border-amber-500/30">
            <Text className="text-amber-500 font-bold mb-2 font-mono">SECURE YOUR ACCOUNT</Text>
            <Text className="text-neutral-400 text-xs mb-4">
              You are using a temporary account. Link an email to prevent data loss if you switch devices.
            </Text>
            <View className="gap-3">
              <TextInput
                value={email}
                onChangeText={setEmail}
                className="bg-neutral-800 text-white p-3 rounded text-sm font-mono border border-neutral-700"
                placeholder="Email"
                placeholderTextColor="#525252"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                className="bg-neutral-800 text-white p-3 rounded text-sm font-mono border border-neutral-700"
                placeholder="Password"
                placeholderTextColor="#525252"
                secureTextEntry
              />
              <Pressable
                onPress={handleLinkAccount}
                disabled={isLinking}
                className="bg-amber-600 p-3 rounded-lg items-center mt-2 active:bg-amber-700"
              >
                {isLinking ? <ActivityIndicator color="white" /> : <Text className="text-white font-mono font-bold">LINK EMAIL</Text>}
              </Pressable>

              <Pressable onPress={() => { handleSignOut(); router.replace('/auth'); }} className="items-center mt-3">
                <Text className="text-amber-500 font-mono text-sm underline">Already have an account? Log In</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* DETAILED STATS */}
      {!isEditing && <StatsSection collection={collection} />}

      {/* SETTINGS LIST */}
      <View className="mb-8">
        <Text className="text-amber-500/90 font-mono text-sm font-bold tracking-widest mb-3">
          SETTINGS
        </Text>

        {/* A/V Settings - TV GUIDE STYLE */}
        <View className="bg-[#2B4A8C] rounded-lg overflow-hidden mb-6 border-2 border-white">
          <View className="p-4 flex-row items-center justify-between border-b-2 border-white">
            <View className="flex-row items-center">
              <View className="w-8 items-center"><FontAwesome name="volume-up" size={14} color="#FFE92F" /></View>
              <Text className="font-mono text-sm font-bold" style={{ color: '#FFE92F' }}>Sound Effects</Text>
            </View>
            <Switch
              value={soundEnabled}
              onValueChange={setSoundEnabled}
              trackColor={{ false: '#1a3366', true: '#FFE92F' }}
              thumbColor={soundEnabled ? '#ffffff' : '#f4f3f4'}
            />
          </View>
          <View className="p-4 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 items-center"><FontAwesome name="tv" size={14} color="#FFE92F" /></View>
              <Text className="font-mono text-sm font-bold" style={{ color: '#FFE92F' }}>Static Transitions</Text>
            </View>
            <Switch
              value={staticEnabled}
              onValueChange={setStaticEnabled}
              trackColor={{ false: '#1a3366', true: '#FFE92F' }}
              thumbColor={staticEnabled ? '#ffffff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View className="bg-[#2B4A8C] rounded-lg overflow-hidden border-2 border-white mb-6">

          <Pressable
            onPress={handleExport}
            disabled={isExporting || isCollectionLoading}
            className="p-4 flex-row items-center justify-between border-b-2 border-white active:bg-[#1a3366]"
          >
            <View className="flex-row items-center">
              <View className="w-8 items-center"><FontAwesome name="download" size={14} color="#FFE92F" /></View>
              <Text className="font-mono text-sm font-bold" style={{ color: '#FFE92F' }}>Export Collection (CSV)</Text>
            </View>
            {isExporting ? <ActivityIndicator size="small" color="#FFE92F" /> : <FontAwesome name="chevron-right" size={10} color="white" />}
          </Pressable>

          {/* PRINT RECEIPT */}
          <Pressable
            onPress={async () => {
              try {
                // Filter for "The Stacks" only (Owned items)
                const inventoryItems = collection?.filter(i => i.status === 'owned') || [];

                if (inventoryItems.length === 0) {
                  Alert.alert('No Items', 'No owned items in The Stacks to print.');
                  return;
                }

                // Play mechanical sound
                const { sound } = await Audio.Sound.createAsync(require('@/assets/sounds/dotmatrix_noise.mp3'));
                await sound.playAsync();

                await printInventoryReceipt(inventoryItems);
              } catch (e) {
                Alert.alert('Error', (e as Error).message);
              }
            }}
            disabled={isCollectionLoading}
            className="p-4 flex-row items-center justify-between border-b-2 border-white active:bg-[#1a3366]"
          >
            <View className="flex-row items-center">
              <View className="w-8 items-center"><FontAwesome name="print" size={14} color="#FFE92F" /></View>
              <Text className="font-mono text-sm font-bold" style={{ color: '#FFE92F' }}>Print Inventory Receipt (PDF)</Text>
            </View>
            <FontAwesome name="chevron-right" size={10} color="white" />
          </Pressable>

          <Pressable
            onPress={handleSignOut}
            className="p-4 flex-row items-center justify-between active:bg-neutral-800"
          >
            <View className="flex-row items-center">
              <View className="w-8 items-center"><FontAwesome name="sign-out" size={14} color="#f87171" /></View>
              <Text className="text-red-400 font-mono text-sm">Sign Out</Text>
            </View>
          </Pressable>
        </View>

        {/* Custom Covers Section (Web Only) */}
        {/* Custom Covers Section - TEMPORARILY DISABLED */}
        {/* <CustomCoversSection /> */}

        {/* INFO / ABOUT */}
        <View className="bg-neutral-900 rounded-lg overflow-hidden mt-6">
          <Pressable
            onPress={() => router.push('/about')}
            className="p-4 flex-row items-center justify-between active:bg-neutral-800"
          >
            <View className="flex-row items-center">
              <View className="w-8 items-center"><FontAwesome name="info-circle" size={14} color="#d1d5db" /></View>
              <Text className="text-neutral-200 font-mono text-sm">About Tracking</Text>
            </View>
            <FontAwesome name="chevron-right" size={10} color="#525252" />
          </Pressable>
          <Pressable
            onPress={async () => {
              await resetOnboarding();
              Alert.alert('Reset', 'Tutorial will show immediately.');
            }}
            className="p-4 flex-row items-center justify-between active:bg-neutral-800 border-t border-neutral-800"
          >
            <View className="flex-row items-center">
              <View className="w-8 items-center"><FontAwesome name="question-circle" size={14} color="#525252" /></View>
              <Text className="text-neutral-500 font-mono text-xs">Reset Tutorial</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => setShowPrivacy(true)}
            className="p-4 flex-row items-center justify-between active:bg-neutral-800 border-t border-neutral-800"
          >
            <View className="flex-row items-center">
              <View className="w-8 items-center"><FontAwesome name="shield" size={14} color="#d1d5db" /></View>
              <Text className="text-neutral-200 font-mono text-sm">Privacy Policy</Text>
            </View>
            <FontAwesome name="chevron-right" size={10} color="#525252" />
          </Pressable>
        </View>
      </View>

      {/* App Version */}
      <View className="mt-8 mb-32 items-center">
        <View className="bg-neutral-900/50 p-4 rounded-xl border border-neutral-800 items-center">
          <Image
            source={logoSource}
            style={{ width: 120, height: 40, opacity: 0.8 }}
            contentFit="contain"
          />
          <Text className="text-neutral-600 font-mono text-[10px] mt-2">Tracking v1.0.0</Text>

          {/* TMDB Attribution */}
          <View className="mt-6 items-center w-full px-4 pt-4 border-t border-neutral-800/50">
            <Image
              source={require('@/assets/images/tmdb.svg')}
              style={{ width: 60, height: 24, opacity: 0.6 }}
              contentFit="contain"
            />
            <Text className="text-neutral-700 font-mono text-[8px] mt-2 text-center leading-3">
              Tracking uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
            </Text>
          </View>
        </View>
      </View>



      {/* Privacy Modal */}
      <Modal
        visible={showPrivacy}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPrivacy(false)}
      >
        <View className="flex-1 bg-neutral-900 p-6">
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-white font-bold text-xl font-mono">PRIVACY POLICY</Text>
            <Pressable onPress={() => setShowPrivacy(false)}>
              <Text className="text-amber-500 font-bold font-mono">CLOSE</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-neutral-300 mb-4 leading-6">
              <Text className="font-bold text-white">Data Storage:</Text> Your movie collection and profile data are securely stored in the cloud using Supabase (PostgreSQL).
            </Text>
            <Text className="text-neutral-300 mb-4 leading-6">
              <Text className="font-bold text-white">Security:</Text> We use Row Level Security (RLS) to ensure that only you can access and modify your data. Your data is associated with your unique User ID.
            </Text>
            <Text className="text-neutral-300 mb-4 leading-6">
              <Text className="font-bold text-white">Local Storage:</Text> The app uses your device's local storage to save preferences (like theme and sound settings) and to cache data for faster performance.
            </Text>
            <Text className="text-neutral-300 mb-4 leading-6">
              <Text className="font-bold text-white">Account Recovery:</Text> If you are using an anonymous account, your data is tied to this specific device installation. To prevent data loss, we recommend linking an email address in the Settings.
            </Text>
            <View className="h-12" />
          </ScrollView>
        </View>
      </Modal>
    </ScrollView >
  );
}
