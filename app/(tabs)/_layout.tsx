import FontAwesome from '@expo/vector-icons/FontAwesome';
import { router, Tabs } from 'expo-router';
import React from 'react';
import { Image, Platform, Pressable, Switch, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import { useSound } from '@/context/SoundContext';
import { useThriftMode } from '@/context/ThriftModeContext';
import { LinearGradient } from 'expo-linear-gradient';

const logoSource = Platform.OS === 'web'
  ? { uri: '/logo_tracking.png' }
  : require('@/assets/images/logo_tracking.png');

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
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          height: 80, // Reduced from 100
          paddingBottom: 10,
          paddingTop: 10,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          elevation: 0,
          shadowColor: '#00ff88', // CRT Phosphor Green Glow
          shadowOffset: {
            width: 0,
            height: -4, // Cast upwards
          },
          shadowOpacity: 0.15, // Subtle glow
          shadowRadius: 10,
        },
        tabBarBackground: () => (
          <LinearGradient
            colors={['#1f1f1f', '#000000']} // Dark Gray to Black
            style={{ flex: 1, borderTopWidth: 1, borderTopColor: '#262626' }}
          />
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
          title: 'My Stacks', // Renamed from 'Tracking'
          headerTitleAlign: 'left',
          headerTitle: () => (
            <Image
              source={logoSource}
              style={{ width: 140, height: 40, resizeMode: 'contain' }}
            />
          ),
          tabBarIcon: ({ color }) => <TabBarIcon name="film" color={color} />,
          headerRight: () => (
            <View className="flex-row items-center mr-2 gap-3">
              <Pressable
                onPress={() => router.push('/add')}
                style={{ padding: 8, marginRight: 4 }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <FontAwesome name="plus" size={22} color="#f59e0b" />
              </Pressable>
              <Text className="text-neutral-400 font-mono text-xs" style={{ marginLeft: 4 }}>
                THRIFT
              </Text>
              <Switch
                value={thriftMode}
                onValueChange={handleToggleThrift}
                trackColor={{ false: '#374151', true: '#059669' }}
                thumbColor="#fff"
              />
            </View>
          ),
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
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
        listeners={{
          tabPress: () => {
            playSound('click');
          },
        }}
      />
    </Tabs>
  );
}
