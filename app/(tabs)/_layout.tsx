import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import React from 'react';
import { Image, Platform } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { useAuth } from '@/context/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { View as RNView } from 'react-native';

const logoSource = Platform.OS === 'web'
  ? { uri: '/logo_tracking.png' }
  : require('@/assets/images/logo_tracking.png');

const stacksIconSource = Platform.OS === 'web'
  ? { uri: '/tab_stacks.png' }
  : require('@/assets/images/tab_stacks.png');

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { thriftMode, setThriftMode } = useThriftMode();
  const { playSound } = useSound();
  const { userId } = useAuth();
  const { data: profile } = useProfile(userId ?? null);

  const handleToggleThrift = (value: boolean) => {
    playSound('tv_off');
    setThriftMode(value);
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f59e0b', // Amber-500
        tabBarInactiveTintColor: '#525252', // Neutral-600
        headerShown: true,
        headerStyle: {
          backgroundColor: '#0a0a0a', // Dark background for header
          borderBottomColor: '#262626', // Neutral-800
        },
        tabBarStyle: {
          backgroundColor: '#000000',
          borderTopWidth: 1,
          borderTopColor: '#262626',
          height: 80,
          paddingBottom: 10,
          paddingTop: 10,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 10,
          zIndex: 100,
        },
        tabBarHideOnKeyboard: false,
        tabBarBackground: () => (
          <RNView style={{ flex: 1, backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#262626' }} />
        ),
        tabBarLabelStyle: {
          fontFamily: 'SpaceMono',
          fontSize: 10,
          marginBottom: 5,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontFamily: 'SpaceMono',
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: 'My Stacks',
          tabBarIcon: ({ color, focused }) => (
            <Image
              source={stacksIconSource}
              style={{
                width: 28,
                height: 28,
                marginBottom: -3,
                tintColor: color,
              }}
              resizeMode="contain"
            />
          ),
        }}
        listeners={{
          tabPress: () => {
            playSound('click');
          },
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          headerShown: false,
          title: 'Curated',
          tabBarIcon: ({ color }) => <TabBarIcon name="film" color={color} />,
        }}
        listeners={{
          tabPress: () => {
            playSound('click');
          },
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          headerShown: false,
          title: 'Bulletin',
          tabBarIcon: ({ color }) => <TabBarIcon name="clipboard" color={color} />,
        }}
        listeners={{
          tabPress: () => {
            playSound('click');
          },
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          headerShown: false,
          title: profile?.username || 'Profile',
          tabBarIcon: ({ color }) => (
            profile?.avatar_url ? (
              <RNView style={{ width: 24, height: 24, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: color, marginBottom: -3 }}>
                <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} />
              </RNView>
            ) : (
              <TabBarIcon name="user" color={color} />
            )
          ),
        }}
        listeners={{
          tabPress: () => {
            playSound('click');
          },
        }}
      />
      <Tabs.Screen
        name="privacy"
        options={{
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="developer"
        options={{
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          headerShown: false,
          href: null,
        }}
      />

      <Tabs.Screen
        name="movie/[id]"
        options={{
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="show/[id]"
        options={{
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile/[id]"
        options={{
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="create-list"
        options={{
          headerShown: false,
          href: null,
        }}
      />
      <Tabs.Screen
        name="stack/[name]"
        options={{
          headerShown: false,
          href: null,
        }}
      />
    </Tabs>
  );
}
