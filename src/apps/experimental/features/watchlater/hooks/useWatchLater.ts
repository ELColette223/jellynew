import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApi } from 'hooks/useApi';
import {
    addToWatchLater,
    fetchWatchLater,
    fetchWatchLaterStatus,
    removeFromWatchLater
} from '../api';
import type { AddToWatchLaterPayload } from '../types';

const QUERY_KEY = ['watchlater'] as const;

export function useWatchLater() {
    const { user } = useApi();
    return useQuery({
        queryKey: QUERY_KEY,
        queryFn: fetchWatchLater,
        enabled: Boolean(user)
    });
}

export function useWatchLaterCount(): number {
    const { data } = useWatchLater();
    return data?.length ?? 0;
}

export function useWatchLaterStatus(itemId: string) {
    return useQuery({
        queryKey: [...QUERY_KEY, 'status', itemId],
        queryFn: () => fetchWatchLaterStatus(itemId),
        enabled: !!itemId
    });
}

export function useAddToWatchLater() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: AddToWatchLaterPayload) => addToWatchLater(payload),
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'status', variables.item_id] });
        }
    });
}

export function useRemoveFromWatchLater() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (itemId: string) => removeFromWatchLater(itemId),
        onSuccess: (_data, itemId) => {
            void queryClient.invalidateQueries({ queryKey: QUERY_KEY });
            void queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, 'status', itemId] });
        }
    });
}
