import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';

export default function AboutScreen() {
    const router = useRouter();
    const logoSource = Platform.OS === 'web'
        ? { uri: '/logo_tracking.png' }
        : require('@/assets/images/logo_tracking.png');

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: "About Tracking",
                    headerStyle: { backgroundColor: '#171717' },
                    headerTintColor: '#f59e0b',
                    headerTitleStyle: { fontFamily: 'Courier', fontWeight: 'bold' },
                    headerLeft: () => (
                        <Pressable onPress={() => router.back()} className="mr-4">
                            <FontAwesome name="chevron-left" size={16} color="#f59e0b" />
                        </Pressable>
                    )
                }}
            />
            <ScrollView className="flex-1 bg-neutral-950 px-6 py-8">

                {/* App Intro */}
                <View className="items-center mb-10">
                    <Image
                        source={logoSource}
                        style={{ width: 200, height: 60, opacity: 0.9 }}
                        contentFit="contain"
                    />
                    <Text className="text-neutral-500 font-mono text-center mt-4 leading-6">
                        Tracking is your personal retro video store. Catalog your physical and digital collection, hunt for grails, and organize your stacks with the tactile feel of the VHS era.
                    </Text>
                </View>

                {/* Attribution Section */}
                <View className="mb-8">
                    <Text className="text-amber-500 font-mono font-bold text-sm mb-4 border-b border-neutral-800 pb-2">
                        DATA & METADATA
                    </Text>

                    <View className="bg-neutral-900 p-4 rounded-lg border border-neutral-800 items-center">
                        <Image
                            source={require('@/assets/images/tmdb.svg')}
                            style={{ width: 80, height: 32, opacity: 0.7 }}
                            contentFit="contain"
                        />
                        <Text className="text-neutral-500 font-mono text-[10px] mt-3 text-center leading-4">
                            Tracking uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB.
                        </Text>
                        <View className="mt-4 pt-4 border-t border-neutral-800 w-full">
                            <AttributionItem
                                title="Barcode Detection Polyfill"
                                author="georapbox / WICG"
                                license="MIT"
                            />
                            <AttributionItem
                                title="Barcode Scanner PWA"
                                author="georapbox (Inspiration)"
                                license="MIT"
                            />
                        </View>
                    </View>
                </View>

                <View className="mb-8">
                    <Text className="text-amber-500 font-mono font-bold text-sm mb-4 border-b border-neutral-800 pb-2">
                        SOUND & ASSETS
                    </Text>

                    <View className="bg-neutral-900 p-4 rounded-lg border border-neutral-800">
                        <Text className="text-neutral-400 font-bold mb-2 text-xs uppercase tracking-wider">Sound Effects</Text>
                        <Text className="text-neutral-500 font-mono text-xs leading-5 mb-4">
                            This application uses sound effects licensed under Creative Commons.
                            Special thanks to the following contributors:
                        </Text>

                        <View className="gap-2">
                            <AttributionItem
                                title="Broadcast VCR tape load"
                                author="LukaCafuka"
                                license="CC0"
                            />
                            <AttributionItem
                                title="static"
                                author="mrs4turn"
                                license="CC0"
                            />
                            <AttributionItem
                                title="Small Remote Controller (Clicking)"
                                author="moodyfingers"
                                license="CC0"
                            />
                            <AttributionItem
                                title="dot matrix printer"
                                author="azumarill"
                                license="Attribution 3.0"
                            />
                            <AttributionItem
                                title="VHS Rewind/Forward and Eject"
                                author="lucaslima"
                                license="CC0"
                            />
                            <AttributionItem
                                title="VCR Eject"
                                author="designerschoice"
                                license="CC0"
                            />
                            <AttributionItem
                                title="CRT TV turn on and off"
                                author="Sanderboah"
                                license="CC0"
                            />
                            <AttributionItem
                                title="StickyNoteTear"
                                author="AHPreston"
                                license="Attribution 4.0"
                            />
                        </View>
                    </View>
                </View>

                <View className="items-center mt-8 mb-12">
                    <Text className="text-neutral-700 font-mono text-[10px]">
                        Built with Expo & React Native
                    </Text>
                    <Text className="text-neutral-700 font-mono text-[10px]">
                        v1.0.0
                    </Text>
                </View>

            </ScrollView >
        </>
    );
}

function AttributionItem({ title, author, license }: { title: string, author: string, license?: string }) {
    return (
        <View className="flex-row justify-between items-center border-b border-neutral-800/50 pb-2">
            <View>
                <Text className="text-neutral-300 font-mono text-xs">{title}</Text>
                <Text className="text-neutral-600 font-mono text-[10px] mt-0.5">by {author}</Text>
            </View>
            {license && <Text className="text-amber-500/50 font-mono text-[8px]">{license}</Text>}
        </View>
    );
}
