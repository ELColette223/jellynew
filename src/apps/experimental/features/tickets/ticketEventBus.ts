import { getTicketEventsUrl } from './api';

export interface TicketUpdatePayload {
    id: number;
    title: string;
    status: string;
}

type Listener = (data: TicketUpdatePayload) => void;

let es: EventSource | null = null;
const listeners = new Set<Listener>();

function openIfNeeded(): void {
    if (es) return;
    const url = getTicketEventsUrl();
    if (!url) return;

    es = new EventSource(url);

    es.addEventListener('ticket_updated', (e: MessageEvent<string>) => {
        try {
            const data = JSON.parse(e.data) as TicketUpdatePayload;
            for (const fn of listeners) fn(data);
        } catch {
            // malformed payload — ignore
        }
    });

    // EventSource auto-reconnects on error; no extra handling needed.
    es.onerror = () => { /* noop */ };
}

function closeIfEmpty(): void {
    if (listeners.size === 0 && es) {
        es.close();
        es = null;
    }
}

/**
 * Subscribe to real-time ticket status-change events.
 * Opens a single shared SSE connection for the first subscriber and closes it
 * when the last subscriber unsubscribes.
 *
 * Returns an unsubscribe function suitable for use in a useEffect cleanup.
 */
export function subscribeToTicketUpdates(fn: Listener): () => void {
    listeners.add(fn);
    openIfNeeded();
    return () => {
        listeners.delete(fn);
        closeIfEmpty();
    };
}
