import type { AddToWatchLaterPayload, WatchLaterItem } from './types';

function getAuthHeader(): string {
    try {
        const raw = localStorage.getItem('jellyfin_credentials');
        if (raw) {
            const parsed = JSON.parse(raw) as { AccessToken?: string };
            if (parsed.AccessToken) return `MediaBrowser Token="${parsed.AccessToken}"`;
        }
    } catch {
        // ignore
    }
    const anyWindow = window as Window & { ApiClient?: { accessToken?: () => string } };
    const token = anyWindow.ApiClient?.accessToken?.();
    return token ? `MediaBrowser Token="${token}"` : '';
}

function getJellyfinServerUrl(): string | null {
    try {
        const raw = localStorage.getItem('jellyfin_credentials');
        if (raw) {
            const parsed = JSON.parse(raw) as { ServerAddress?: string };
            if (parsed.ServerAddress) return parsed.ServerAddress;
        }
    } catch {
        // ignore
    }
    const anyWindow = window as Window & { ApiClient?: { serverAddress?: () => string } };
    return anyWindow.ApiClient?.serverAddress?.() ?? null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const jellyfinUrl = getJellyfinServerUrl();
    const res = await fetch(path, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: getAuthHeader(),
            ...(jellyfinUrl ? { 'X-Jellyfin-Server': jellyfinUrl } : {}),
            ...(init.headers ?? {})
        }
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
    }

    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
}

export function fetchWatchLater(): Promise<WatchLaterItem[]> {
    return request<WatchLaterItem[]>('/api/watchlater');
}

export function addToWatchLater(payload: AddToWatchLaterPayload): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/api/watchlater', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

export function removeFromWatchLater(itemId: string): Promise<void> {
    return request<void>(`/api/watchlater/${encodeURIComponent(itemId)}`, {
        method: 'DELETE'
    });
}

export function fetchWatchLaterStatus(itemId: string): Promise<{ inWatchLater: boolean }> {
    return request<{ inWatchLater: boolean }>(`/api/watchlater/${encodeURIComponent(itemId)}/status`);
}
