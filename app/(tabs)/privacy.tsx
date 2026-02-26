import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

export default function PrivacyScreen() {
    const router = useRouter();

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
                        PRIVACY POLICY
                    </Text>

                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text className="text-neutral-300 mb-4 leading-6 font-mono text-sm">
                            <Text className="font-bold text-white">1. Data Collection:</Text> We collect information you provide directly, including your email address (if you link an account), username, bio, and your cataloged movie collection data. If you use our app without creating an account, we rely on an anonymous identifier tied to your device.
                        </Text>
                        <Text className="text-neutral-300 mb-4 leading-6 font-mono text-sm">
                            <Text className="font-bold text-white">2. Data Usage & Storage:</Text> Your movie collection and profile data are securely stored in the cloud using Supabase (PostgreSQL). We use your data solely to provide and improve the Tracking application experience.
                        </Text>
                        <Text className="text-neutral-300 mb-4 leading-6 font-mono text-sm">
                            <Text className="font-bold text-white">3. Third-Party Disclosures:</Text> We do not sell your personal data. We utilize third-party services such as Supabase for secure cloud database hosting and TMDB (The Movie Database) for retrieving movie metadata and images.
                        </Text>
                        <Text className="text-neutral-300 mb-4 leading-6 font-mono text-sm">
                            <Text className="font-bold text-white">4. Data Retention:</Text> We retain your data for as long as your account is active. Non-linked anonymous accounts may lose access to data if the device caching is cleared.
                        </Text>
                        <Text className="text-neutral-300 mb-4 leading-6 font-mono text-sm">
                            <Text className="font-bold text-white">5. Security:</Text> We use Row Level Security (RLS) policies within our database to ensure that only you can access and modify your personal data. Your data is strictly associated with your unique User ID.
                        </Text>
                        <Text className="text-neutral-300 mb-4 leading-6 font-mono text-sm">
                            <Text className="font-bold text-white">6. Local Storage:</Text> The app uses your device's local storage to save specific preferences (e.g., theme and sound settings) to optimize your experience.
                        </Text>
                        <Text className="text-neutral-300 mb-4 leading-6 font-mono text-sm">
                            <Text className="font-bold text-white">7. User Rights:</Text> You have the right to access, update, export (via CSV), or delete your personal data. You may export your collection at any time via the Settings menu.
                        </Text>
                        <Text className="text-neutral-300 mb-4 leading-6 font-mono text-sm">
                            <Text className="font-bold text-white">8. Contact Information:</Text> For any privacy-related questions or data deletion requests, please contact the developer via the official repository or support channels.
                        </Text>
                    </ScrollView>
                </View>
            </ScrollView>
        </View>
    );
}
