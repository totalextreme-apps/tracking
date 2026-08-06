import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Reaction } from '@/hooks/useReactions';
import Ionicons from '@expo/vector-icons/Ionicons';

interface ReactionSummaryProps {
  reactions: Reaction[];
  currentUserId?: string;
  onReact: (emoji: string) => void;
  onShowPicker: () => void;
}

export function ReactionSummary({ reactions, currentUserId, onReact, onShowPicker }: ReactionSummaryProps) {
  // Group reactions and check if user has reacted to each group
  const grouped = useMemo(() => {
    const map: Record<string, { count: number; userHasReacted: boolean }> = {};
    
    reactions.forEach(r => {
      const type = r.reaction_type;
      const isUser = r.user_id === currentUserId;
      
      if (!map[type]) {
        map[type] = { count: 0, userHasReacted: false };
      }
      map[type].count += 1;
      if (isUser) {
        map[type].userHasReacted = true;
      }
    });
    
    return Object.entries(map).map(([emoji, data]) => ({
      emoji,
      ...data
    })).sort((a, b) => b.count - a.count);
  }, [reactions, currentUserId]);

  const userCurrentReaction = useMemo(() => {
    return reactions.find(r => r.user_id === currentUserId)?.reaction_type;
  }, [reactions, currentUserId]);

  if (reactions.length === 0) {
    // Show a simple "+" add reaction button if empty
    return (
      <Pressable 
        onPress={onShowPicker}
        style={styles.addButtonEmpty}
      >
        <Ionicons name="happy-outline" size={14} color="#737373" />
        <Text style={styles.addTextEmpty}>React</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {grouped.map(({ emoji, count, userHasReacted }) => (
        <Pressable
          key={emoji}
          onPress={() => onReact(emoji)}
          style={[
            styles.badge,
            userHasReacted && styles.userReactedBadge
          ]}
        >
          <Text style={styles.emojiText}>{emoji}</Text>
          <Text style={[styles.countText, userHasReacted && styles.userReactedCountText]}>
            {count}
          </Text>
        </Pressable>
      ))}

      {/* Mini plus button to add another type */}
      <Pressable 
        onPress={onShowPicker}
        style={styles.addButton}
      >
        <Ionicons name="add" size={12} color="#a3a3a3" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e', // bg-neutral-900/80
    borderWidth: 1,
    borderColor: '#2c2c2e', // border-neutral-800
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  userReactedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)', // Amber tint
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  emojiText: {
    fontSize: 12,
  },
  countText: {
    color: '#a3a3a3', // text-neutral-400
    fontFamily: 'SpaceMono',
    fontSize: 10,
    fontWeight: 'bold',
  },
  userReactedCountText: {
    color: '#f59e0b', // text-amber-500
  },
  addButtonEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  addTextEmpty: {
    color: '#737373',
    fontFamily: 'SpaceMono',
    fontSize: 10,
    fontWeight: 'bold',
  },
  addButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: '#2c2c2e',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
