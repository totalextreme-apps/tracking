import { CollectionItemWithMedia } from '@/types/database';
import { useMemo } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';

interface StatsSectionProps {
    collection: CollectionItemWithMedia[] | undefined | null;
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
            if (!item) return;
            const fmt = item.format || 'Unknown';
            counts[fmt] = (counts[fmt] || 0) + 1;
        });

        const colors: Record<string, string> = {
            'VHS': '#f59e0b', // Amber
            'DVD': '#ef4444', // Red
            'Blu-ray': '#3b82f6', // Blue
            'BluRay': '#3b82f6', // Legacy Blue
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
            if (!item) return;
            const genres = item.movies?.genres || item.shows?.genres || [];
            if (genres.length === 0) {
                counts['Uncategorized'] = (counts['Uncategorized'] || 0) + 1;
            } else {
                genres.forEach((g: any) => {
                    counts[g.name] = (counts[g.name] || 0) + 1;
                });
            }
        });

        const palette = [
            '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#22c55e',
            '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
        ];

        return Object.keys(counts).map((key, index) => ({
            name: key,
            population: counts[key],
            color: palette[index % palette.length],
            legendFontColor: '#d4d4d4',
            legendFontSize: 10,
        })).sort((a, b) => b.population - a.population).slice(0, 8); // Top 8 genres
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

            {/* Genre Distribution Pie Chart */}
            <View className="bg-neutral-900 rounded-xl p-2 border border-neutral-800 items-center">
                <Text className="text-neutral-500 font-mono text-xs font-bold mb-2 mt-2">BY GENRE</Text>
                <PieChart
                    data={genreData}
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
        </View>
    );
}
