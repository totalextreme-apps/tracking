import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useSound } from '@/context/SoundContext';
import { useNotifications } from '@/hooks/useSocial';

type CommunityHeaderNavProps = {
  activeTab?: 'profile' | 'activity' | 'directory' | 'board' | 'swap' | 'inbox' | 'alerts';
  onTabChange?: (tab: string) => void;
  userId?: string;
};

export function CommunityHeaderNav({ activeTab = 'activity', onTabChange, userId }: CommunityHeaderNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { playSound } = useSound();
  const { userId: currentUserId } = useAuth();
  const { data: notifications } = useNotifications(currentUserId ?? undefined);

  const unreadAlertsCount = notifications?.filter((n: any) => !n.is_read).length || 0;
  const targetUserId = userId || currentUserId;

  const mainTabs = [
    { key: 'profile', label: 'PROFILE' },
    { key: 'activity', label: 'ACTIVITY' },
    { key: 'directory', label: 'DIRECTORY' },
    { key: 'board', label: 'BOARD' },
    { key: 'swap', label: 'SWAP MEET' },
  ];

  const handleTabPress = (tabKey: string) => {
    playSound('click');

    if (onTabChange) {
      onTabChange(tabKey);
    }

    if (tabKey === 'profile') {
      if (!pathname.startsWith('/profile/')) {
        router.push({ pathname: `/profile/${targetUserId}`, params: { from: 'community' } } as any);
      }
    } else if (tabKey === 'activity') {
      router.push({ pathname: '/community', params: { tab: 'activity' } } as any);
    } else if (tabKey === 'directory') {
      router.push({ pathname: '/community', params: { tab: 'directory' } } as any);
    } else if (tabKey === 'board') {
      router.push({ pathname: '/community', params: { tab: 'board' } } as any);
    } else if (tabKey === 'swap') {
      router.push({ pathname: '/community', params: { tab: 'swap' } } as any);
    } else if (tabKey === 'inbox') {
      router.push({ pathname: '/community', params: { tab: 'inbox' } } as any);
    } else if (tabKey === 'alerts') {
      router.push({ pathname: '/community', params: { tab: 'alerts' } } as any);
    }
  };

  return (
    <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 10, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' }}>
      <Text style={{ color: '#f59e0b', fontFamily: 'SpaceMono', fontSize: 18, fontWeight: 'bold', letterSpacing: 4, textAlign: 'center', marginBottom: 12 }}>
        COMMUNITY
      </Text>

      {/* Main Navigation Row */}
      <View style={{ marginBottom: 10 }}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={{ backgroundColor: '#111', borderRadius: 10, padding: 3 }}
        >
          {mainTabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(tab.key)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                  backgroundColor: isActive ? '#1c1c1c' : 'transparent',
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  fontFamily: 'SpaceMono',
                  fontSize: 11,
                  fontWeight: 'bold',
                  color: isActive ? '#f59e0b' : '#525252',
                  letterSpacing: 0.5,
                }}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Secondary Communication Controls Row (Inbox & Alerts) */}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
        {/* Inbox Button */}
        <Pressable
          onPress={() => handleTabPress('inbox')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 9,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: activeTab === 'inbox' ? '#f59e0b' : '#1c1c1c',
            backgroundColor: activeTab === 'inbox' ? '#f59e0b10' : '#111',
          }}
        >
          <Ionicons 
            name={activeTab === 'inbox' ? "mail" : "mail-outline"} 
            size={14} 
            color={activeTab === 'inbox' ? "#f59e0b" : "#737373"} 
            style={{ marginRight: 6 }} 
          />
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', color: activeTab === 'inbox' ? '#f59e0b' : '#737373' }}>
            INBOX
          </Text>
        </Pressable>

        {/* Alerts Button */}
        <Pressable
          onPress={() => handleTabPress('alerts')}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 9,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: activeTab === 'alerts' ? '#f59e0b' : '#1c1c1c',
            backgroundColor: activeTab === 'alerts' ? '#f59e0b10' : '#111',
          }}
        >
          <Ionicons 
            name={activeTab === 'alerts' ? "notifications" : "notifications-outline"} 
            size={14} 
            color={activeTab === 'alerts' ? "#f59e0b" : "#737373"} 
            style={{ marginRight: 6 }} 
          />
          <Text style={{ fontFamily: 'SpaceMono', fontSize: 10, fontWeight: 'bold', color: activeTab === 'alerts' ? '#f59e0b' : '#737373' }}>
            ALERTS
          </Text>
          {unreadAlertsCount > 0 && (
            <View style={{ backgroundColor: '#f59e0b', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 6 }}>
              <Text style={{ color: '#000', fontFamily: 'SpaceMono', fontSize: 9, fontWeight: 'bold' }}>
                {unreadAlertsCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}
