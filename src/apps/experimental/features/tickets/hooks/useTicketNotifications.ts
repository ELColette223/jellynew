import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { subscribeToTicketUpdates, type TicketUpdatePayload } from '../ticketEventBus';

const STATUS_LABELS: Record<string, string> = {
    open: 'Aberto',
    searching: 'Procurando',
    processing: 'Processando',
    closed: 'Concluído',
    rejected: 'Recusado'
};

export interface TicketUpdate extends TicketUpdatePayload {
    statusLabel: string;
}

interface TicketNotifications {
    /** Number of ticket updates received since the user last visited /tickets. */
    unreadCount: number;
    /** The most recent update payload, used to drive a toast notification. */
    latestUpdate: TicketUpdate | null;
    /** Dismiss the toast without clearing the badge count. */
    dismissLatest: () => void;
}

/**
 * Subscribes to the shared ticket event bus and tracks real-time status-change
 * notifications for display in the toolbar badge and toast.
 *
 * - Badge count increments only when the user is NOT on /tickets.
 * - Both badge and toast are cleared automatically on navigation to /tickets.
 */
export function useTicketNotifications(): TicketNotifications {
    const [ unreadCount, setUnreadCount ] = useState(0);
    const [ latestUpdate, setLatestUpdate ] = useState<TicketUpdate | null>(null);
    const location = useLocation();

    // Keep a ref so the subscription callback always reads the current pathname
    // without needing to re-subscribe on every navigation.
    const locationRef = useRef(location);
    useEffect(() => {
        locationRef.current = location;
    }, [ location ]);

    // Clear badge and toast when the user visits the tickets page
    useEffect(() => {
        if (location.pathname.startsWith('/tickets')) {
            setUnreadCount(0);
            setLatestUpdate(null);
        }
    }, [ location.pathname ]);

    useEffect(() => {
        return subscribeToTicketUpdates((data) => {
            // Suppress badge/toast while the user is actively viewing their tickets
            if (locationRef.current.pathname.startsWith('/tickets')) return;

            const update: TicketUpdate = {
                ...data,
                statusLabel: STATUS_LABELS[data.status] ?? data.status
            };
            setUnreadCount(prev => prev + 1);
            setLatestUpdate(update);
        });
    }, []);

    const dismissLatest = useCallback(() => {
        setLatestUpdate(null);
    }, []);

    return { unreadCount, latestUpdate, dismissLatest };
}
