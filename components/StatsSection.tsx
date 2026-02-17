import { CollectionItemWithMovie } from '@/hooks/useCollection';
import { useMemo } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

interface StatsSectionProps {
    collection: CollectionItemWithMovie[] | undefined | null;
}

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
    backgroundGradientFrom: "#171717",
    backgroundGradientFromOpacity: 0,
    backgroundGradientTo: "#171717",
    backgroundGradientToOpacity: 0,
    color: (opacity = 1) => `rgba(245, 158, 11, ${opacity})`, // Amber
    strokeWidth: 2, // optional, default 3
    barPercentage: 0.7,
    useShadowColorFromDataset: false, // optional
    decimalPlaces: 0,
    labelColor: (opacity = 1) => `rgba(163, 163, 163, ${opacity})`, // Neutral-400
    propsForLabels: {
        fontSize: 10,
        fontFamily: 'SpaceMono',
    }
};

export function StatsSection({ collection }: StatsSectionProps) {
    if (!collection || collection.length === 0) return null;

    // --- Format Data ---
    const formatData = useMemo(() => {
        const counts: Record<string, number> = {};
        collection.forEach(item => {
            const fmt = item.format || 'Unknown';
            counts[fmt] = (counts[fmt] || 0) + 1;
        });

        const colors: Record<string, string> = {
            'VHS': '#f59e0b', // Amber
            'DVD': '#ef4444', // Red
            'BluRay': '#3b82f6', // Blue
            '4K': '#a855f7', // Purple
            'Digital': '#22c55e', // Green
        };

        return Object.keys(counts).map(key => ({
            name: key,
            population: counts[key],
            color: colors[key] || '#737373',
            legendFontColor: '#d4d4d4',
            legendFontSize: 10,
        })).sort((a, b) => b.population - a.population);
    }, [collection]);

    // --- Genre Data ---
    const genreData = useMemo(() => {
        const counts: Record<string, number> = {};
        collection.forEach(item => {
            // item.movies.genre_ids might be needed, currently assuming we might have genre text or need to fetch/map it. 
            // Wait, we don't have genres stored directly on the item usually, except maybe in `item.movies`.
            // Let's check `item.movies`. 
            // Actually `useCollection` query selects `movies (*)` but Supabase type might not layout genres easily if it's just IDs.
            // If `genre_ids` is an array of IDs, we need a map. 
            // OR if we stored `genres` (text).
            // Checking: We likely don't have comprehensive genre data stored as text on `movies` based on previous files.
            // Let's stick to Formats for now and verify Genres availability. 
            // If no genres, I'll just show formats.
            // Actually, `movies` table usually has `genre_ids` (array of ints). I don't have the ID->Name map loaded.
            // I'll skip Genres for this iteration and focus on Formats + Status (Owned vs Wishlist). 
        });
        return [];
    }, [collection]);

    // Alternative: Status Distribution (Owned vs Wishlist)
    const statusData = useMemo(() => {
        const counts: Record<string, number> = {
            'Owned': 0,
            'Wishlist': 0,
            'For Sale': 0 // Grail in Thrift Mode context? No, status is 'owned' | 'wishlist'.
        };

        collection.forEach(item => {
            if (item.status === 'owned') counts['Owned']++;
            else if (item.status === 'wishlist') counts['Wishlist']++;
        });

        return [
            { name: 'Owned', population: counts['Owned'], color: '#f59e0b', legendFontColor: '#d4d4d4', legendFontSize: 10 },
            { name: 'Wishlist', population: counts['Wishlist'], color: '#737373', legendFontColor: '#d4d4d4', legendFontSize: 10 },
        ].filter(i => i.population > 0);
    }, [collection]);

    return (
        <View className="mb-8">
            <Text className="text-amber-500/90 font-mono text-sm font-bold tracking-widest mb-4 text-center">
                COLLECTION ANALYTICS
            </Text>

            {/* Formats Pie Chart */}
            <View className="bg-neutral-900 rounded-xl p-2 border border-neutral-800 mb-6 items-center">
                <Text className="text-neutral-500 font-mono text-xs font-bold mb-2 mt-2">BY FORMAT</Text>
                <PieChart
                    data={formatData}
                    width={screenWidth - 64}
                    height={200}
                    chartConfig={chartConfig}
                    accessor={"population"}
                    backgroundColor={"transparent"}
                    paddingLeft={"15"}
                    center={[10, 0]}
                    absolute
                    hasLegend={true}
                />
            </View>

            {/* Status Bar Chart or Pie? Let's use Pie for status too for consistency, or maybe a simple breakdown */}
            <View className="bg-neutral-900 rounded-xl p-2 border border-neutral-800 items-center">
                <Text className="text-neutral-500 font-mono text-xs font-bold mb-2 mt-2">BY STATUS</Text>
                <PieChart
                    data={statusData}
                    width={screenWidth - 64}
                    height={150}
                    chartConfig={chartConfig}
                    accessor={"population"}
                    backgroundColor={"transparent"}
                    paddingLeft={"15"}
                    center={[10, 0]}
                    absolute
                />
            </View>
        </View>
    );
}
