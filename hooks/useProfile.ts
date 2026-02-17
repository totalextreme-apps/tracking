import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

export function useProfile(userId: string | null) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['profile', userId],
        queryFn: async () => {
            if (!userId) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }
            return data as Profile | null;
        },
        enabled: !!userId,
    });

    const updateMutation = useMutation({
        mutationFn: async (updates: Partial<Profile>) => {
            if (!userId) throw new Error('No user');
            const { data, error } = await supabase
                .from('profiles')
                .upsert({ id: userId, ...updates, updated_at: new Date().toISOString() })
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        },
    });

    const uploadAvatarMutation = useMutation({
        mutationFn: async ({ uri, base64 }: { uri: string; base64?: string | null }) => {
            if (!userId) throw new Error('No user');

            let fileData: ArrayBuffer;
            const filePath = `${userId}/${new Date().getTime()}.png`;
            const contentType = 'image/png';

            if (base64) {
                fileData = decode(base64);
            } else {
                // Native platform file read
                const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                fileData = decode(b64);
            }

            const { data, error } = await supabase.storage
                .from('avatars')
                .upload(filePath, fileData, { contentType, upsert: true });

            if (error) throw error;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

            // Update profile with new avatar URL
            await updateMutation.mutateAsync({ avatar_url: publicUrl });

            return publicUrl;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        },
    });

    return {
        ...query,
        updateProfile: updateMutation.mutateAsync,
        uploadAvatar: (uri: string, base64?: string | null) => uploadAvatarMutation.mutateAsync({ uri, base64 }),
        isUpdating: updateMutation.isPending || uploadAvatarMutation.isPending,
    };
}
