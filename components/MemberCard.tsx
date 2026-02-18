import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';

type MemberCardProps = {
    userId: string | null;
    profile: any;
    onEditPress: () => void;
    onAvatarPress: () => void;
};

export function MemberCard({ userId, profile, onEditPress, onAvatarPress }: MemberCardProps) {
    // Generate discrete barcode lines
    const barcodeLines = Array.from({ length: 40 }).map((_, i) => ({
        width: Math.random() > 0.5 ? 4 : 2,
        margin: Math.random() > 0.5 ? 2 : 1,
    }));

    // Format Member Since Date
    const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString(undefined, { month: '2-digit', year: '2-digit' }) : 'MM/YY';

    // Format ID
    const displayId = userId ? userId.substring(0, 8).toUpperCase() : 'UNKNOWN';

    return (
        <View className="w-full aspect-[1.586] rounded-xl overflow-hidden relative shadow-xl" style={{ elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.6 }}>
            {/* Background Texture (Simulated with Gradient and Noise color) */}
            <View className="absolute inset-0 bg-[#262626]" />

            {/* Scuffed Texture Overlay (Optional, could use an image if we had one) */}
            {/* We'll just use some noise or gradient to make it look worn */}
            <LinearGradient
                colors={['rgba(255,255,255,0.05)', 'transparent', 'rgba(0,0,0,0.4)']}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
            />

            {/* Borders/Stripes */}
            {/* Top Orange Stripe */}
            <View className="absolute top-4 left-0 right-0 h-1 bg-amber-600/80" />
            <View className="absolute top-[18px] left-0 right-0 h-0.5 bg-black/50" />

            {/* Bottom Orange Stripe */}
            <View className="absolute bottom-4 left-0 right-0 h-1 bg-amber-600/80" />
            <View className="absolute bottom-[18px] left-0 right-0 h-0.5 bg-black/50" />

            {/* Content Container */}
            <View className="flex-1 flex-row px-5 py-4 pt-8">

                {/* LEFT COLUMN */}
                <View className="flex-1 pr-4 justify-between">
                    {/* Header Logo Area */}
                    <View className="mb-2 relative">
                        {/* Ticket Shape Background for Logo? */}
                        <View className="bg-neutral-900 border-2 border-amber-600 -rotate-2 p-1 self-start shadow-sm" style={{ transform: [{ skewX: '-10deg' }] }}>
                            <Image
                                source={require('@/assets/images/logo_tracking.png')}
                                style={{ width: 100, height: 30 }}
                                contentFit="contain"
                            />
                            {/* "VIDEO STORE" text if not in logo? Logo is just "Tracking"? 
                                The image shows "Tracking VIDEO STORE". 
                                Assuming logo_tracking.png has it. If not, add text.
                            */}
                        </View>
                    </View>

                    {/* Member Details */}
                    <View className="gap-3 mt-2">
                        <View className="border-b-2 border-amber-600 pb-1">
                            <Text className="text-white font-bold text-lg tracking-widest uppercase italic">MEMBERSHIP CARD</Text>
                        </View>

                        <View>
                            <Text className="text-amber-600 font-bold text-[10px] uppercase">ID #</Text>
                            <View className="flex-row items-baseline border-b-2 border-neutral-600 pb-0.5 border-dashed">
                                <Text className="text-amber-500 font-mono font-bold text-lg tracking-widest">{displayId}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Barcode */}
                    <View className="flex-row h-8 items-end overflow-hidden mt-auto bg-white px-2 py-1 rounded-sm w-full">
                        {barcodeLines.map((line, i) => (
                            <View key={i} style={{ width: line.width, height: '100%', backgroundColor: 'black', marginRight: line.margin }} />
                        ))}
                    </View>

                </View>

                {/* RIGHT COLUMN: Photo */}
                <View className="w-[35%] justify-center items-center">
                    <Pressable onPress={onAvatarPress} className="w-full aspect-[3/4] bg-neutral-300 p-1 rotate-1 shadow-lg" style={{ elevation: 5 }}>
                        <View className="w-full h-full bg-neutral-800 border border-neutral-400 overflow-hidden relative">
                            {profile?.avatar_url ? (
                                <Image source={{ uri: profile.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={1000} />
                            ) : (
                                <View className="flex-1 items-center justify-center bg-neutral-800">
                                    <FontAwesome name="user" size={40} color="#525252" />
                                </View>
                            )}

                            {/* Gloss Overlay */}
                            <LinearGradient
                                colors={['rgba(255,255,255,0.2)', 'transparent']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
                            />
                        </View>
                        {/* Edit Icon Badge */}
                        <View className="absolute -bottom-2 -right-2 bg-amber-600 p-1.5 rounded-full border border-white shadow-sm">
                            <FontAwesome name="camera" size={10} color="white" />
                        </View>
                    </Pressable>
                </View>
            </View>

        </View>
    );
}
