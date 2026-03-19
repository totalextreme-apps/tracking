import { useSound } from '@/context/SoundContext';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

const devPhotoSource = Platform.OS === 'web'
    ? { uri: '/photo_josh.png' }
    : require('../../assets/images/photo_josh.png');

export default function DeveloperScreen() {
    const { playSound } = useSound();
    const router = useRouter();

    const handleKofiPress = () => {
        playSound('click');
        Linking.openURL('https://ko-fi.com/N4N31UKK6D');
    };

    const handleEmailPress = () => {
        playSound('click');
        Linking.openURL('mailto:totalextremeapps@gmail.com');
    };

    return (
        <View className="flex-1 bg-neutral-950">
            <ScrollView
                className="flex-1 bg-neutral-950"
                contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 16, paddingBottom: 100 }}
            >
                <View style={{ maxWidth: 800, alignSelf: 'center', width: '100%' }}>
                    <Pressable
                        onPress={() => router.push('/two')}
                        className="mb-8 bg-[#0000FF] px-4 py-1.5 rounded-md self-start shadow-sm"
                    >
                        <Text
                            className="text-white text-[10px] font-bold uppercase tracking-widest"
                            style={{ fontFamily: 'VCR_OSD_MONO' }}
                        >
                            BACK
                        </Text>
                    </Pressable>

                    <Text className="text-amber-500 font-mono font-bold text-sm mb-6 border-b border-neutral-800 pb-2">
                        ABOUT THE DEVELOPER
                    </Text>

                    {/* Bio Header */}
                    <View className="flex-row items-center mb-8">
                        <View className="w-20 h-20 rounded-full bg-neutral-900 overflow-hidden border-2 border-amber-500">
                            <ExpoImage
                                source={devPhotoSource}
                                style={{ width: '100%', height: '100%' }}
                                contentFit="cover"
                                transition={200}
                            />
                        </View>
                        <View className="ml-5">
                            <Text className="text-white font-mono text-2xl font-bold">JOSH</Text>
                            <Text className="text-neutral-500 font-mono text-sm tracking-widest uppercase">totalextreme-apps</Text>
                        </View>
                    </View>

                    {/* Bio Text */}
                    <View className="mb-8">
                        <Text className="text-neutral-300 font-mono text-sm leading-6 mb-4">
                            Designing digital grails and building editors for 20 year old wrestling sims is my jam.
                            I have a Graphic Design background and a dangerous obsession with 90s/00s nerd culture,
                            pro wrestling, and the grainy warmth of horror VHS.
                        </Text>

                        <Text className="text-neutral-300 font-mono text-sm leading-6 mb-4">
                            When I’m not on the hunt to build my collection or perfecting a CRT glow,
                            I’m using AI to help build the tools I wish existed. Whether it’s giving your library a worn
                            slipcover with the Tracking app or fine-tuning .dat files in the EWR Editing Suite,
                            I’m always up to something to stay busy.
                        </Text>

                        <Text className="text-neutral-300 font-mono text-sm leading-6 mb-4">
                            If my projects helped you organize your stacks, waste away hours in TEW or finally fix that EWR mod,
                            consider tossing a coffee my way. Every bit goes straight into the "Rare Horror Tape & Energy Drink" fund.
                        </Text>
                    </View>

                    {/* Contact */}
                    <View className="mb-8 p-4 bg-neutral-900 rounded-xl border border-neutral-800">
                        <Text className="text-neutral-500 font-mono text-xs mb-2 uppercase tracking-widest">CONTACT</Text>
                        <Pressable onPress={handleEmailPress}>
                            <Text className="text-amber-500 font-mono text-sm underline">totalextremeapps@gmail.com</Text>
                        </Pressable>
                    </View>

                    {/* Ko-fi Button */}
                    <Pressable
                        onPress={handleKofiPress}
                        className="bg-[#ff6200] flex-row items-center justify-center py-4 rounded-xl shadow-lg border border-[#e65a00] active:opacity-90"
                    >
                        <ExpoImage
                            source={{ uri: 'https://storage.ko-fi.com/cdn/cup-border.png' }}
                            style={{ width: 24, height: 16, marginRight: 10 }}
                            contentFit="contain"
                        />
                        <Text className="text-white font-mono text-base font-bold uppercase tracking-widest">Support me on Ko-fi</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}
