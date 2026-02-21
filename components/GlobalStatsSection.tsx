import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

export function GlobalStatsSection() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['global-stats'],
        queryFn: async () => {
            const { data, error } = await supabase.rpc('get_global_stats');
            if (error) throw error;
            return data as {
                total_members: number;
                titles_in_circulation: number;
                special_requests: number;
                most_wanted: number;
            };
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    const cursorOpacity = useSharedValue(1);

    useEffect(() => {
        cursorOpacity.value = withRepeat(
            withSequence(
                withTiming(0, { duration: 500 }),
                withTiming(1, { duration: 500 })
            ),
            -1,
            true
        );
    }, []);

    const cursorStyle = useAnimatedStyle(() => ({
        opacity: cursorOpacity.value,
    }));

    if (isLoading || !stats) {
        return (
            <View style={styles.monitorContainer}>
                <View style={styles.screen}>
                    <Text style={styles.label}>LOADING CORE DATA...</Text>
                    <Animated.View style={[styles.cursor, cursorStyle]} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.monitorContainer}>
            <View style={styles.screen}>
                <View className="flex-row justify-between mb-2">
                    <Text style={styles.header}>VIDEO STORE SYSTEM v1.0.1</Text>
                    <Text style={styles.header}>ONLINE</Text>
                </View>
                <View className="h-[1px] bg-green-500/30 mb-4" />

                <View className="gap-2">
                    <StatRow label="STORE MEMBERS" value={stats.total_members} />
                    <StatRow label="TITLES IN CIRCULATION" value={stats.titles_in_circulation} />
                    <StatRow label="SPECIAL REQUESTS" value={stats.special_requests} />
                    <StatRow label="MOST WANTED" value={stats.most_wanted} />
                </View>

                <View className="mt-4 flex-row items-center">
                    <Text style={styles.prompt}>C:\TRACKING\&gt;</Text>
                    <Animated.View style={[styles.cursor, cursorStyle]} />
                </View>
            </View>
        </View>
    );
}

function StatRow({ label, value }: { label: string, value: number }) {
    // Pad the label to 24 characters
    const paddedLabel = label.padEnd(24, '.');
    // Format number with leading zeros for that digital counter look
    const formattedValue = value.toString().padStart(6, '0');

    return (
        <View className="flex-row justify-between items-center">
            <Text style={styles.rowLabel}>{paddedLabel}</Text>
            <Text style={styles.rowValue}>{formattedValue}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    monitorContainer: {
        padding: 4,
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        borderWidth: 8,
        borderColor: '#333',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
    },
    screen: {
        backgroundColor: '#050505',
        borderRadius: 4,
        padding: 16,
        borderWidth: 1,
        borderColor: '#004400',
    },
    header: {
        color: '#00ff00',
        fontFamily: 'SpaceMono',
        fontSize: 8,
        opacity: 0.7,
    },
    label: {
        color: '#00ff00',
        fontFamily: 'SpaceMono',
        fontSize: 12,
        fontWeight: 'bold',
    },
    rowLabel: {
        color: '#008800',
        fontFamily: 'SpaceMono',
        fontSize: 11,
        letterSpacing: 1,
    },
    rowValue: {
        color: '#00ff00',
        fontFamily: 'SpaceMono',
        fontSize: 13,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 255, 0, 0.4)',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
    },
    prompt: {
        color: '#00ff00',
        fontFamily: 'SpaceMono',
        fontSize: 10,
        opacity: 0.8,
    },
    cursor: {
        width: 8,
        height: 12,
        backgroundColor: '#00ff00',
        marginLeft: 4,
    }
});
