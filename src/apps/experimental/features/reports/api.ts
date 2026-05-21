import type {
    CreateReportPayload,
    ReportListResponse,
    ContentReport
} from './types';

/** Returns the raw Jellyfin access token (without the MediaBrowser wrapper). */
function getRawToken(): string | null {
    try {
        const raw = localStorage.getItem('jellyfin_credentials');
        if (raw) {
            const parsed = JSON.parse(raw) as { AccessToken?: string };
            if (parsed.AccessToken) return parsed.AccessToken;
        }
    } catch {
        // ignore
    }
    const anyWindow = window as Window & { ApiClient?: { accessToken?: () => string } };
    return anyWindow.ApiClient?.accessToken?.() ?? null;
}

/** Returns the Jellyfin server URL the frontend is currently connected to. */
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

function getAuthHeader(): string {
    // Retrieve the MediaBrowser token that jellyfin-apiclient stores in localStorage
    try {
        const raw = localStorage.getItem('jellyfin_credentials');
        if (raw) {
            const parsed = JSON.parse(raw) as { AccessToken?: string; ServerAddress?: string };
            if (parsed.AccessToken) {
                return `MediaBrowser Token="${parsed.AccessToken}"`;
            }
        }
    } catch {
        // ignore
    }

    // Fallback: look for the token set by jellyfin-apiclient on window
    const anyWindow = window as Window & { ApiClient?: { accessToken?: () => string; serverAddress?: () => string } };
    const token = anyWindow.ApiClient?.accessToken?.();
    if (token) {
        return `MediaBrowser Token="${token}"`;
    }

    return '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const jellyfinUrl = getJellyfinServerUrl();
    let res: Response;
    try {
        res = await fetch(path, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                Authorization: getAuthHeader(),
                ...(jellyfinUrl ? { 'X-Jellyfin-Server': jellyfinUrl } : {}),
                ...(init.headers || {})
            }
        });
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[reports/api] Network request failed for', path, err);
        throw new Error('Sistema de reports offline — não foi possível conectar ao servidor de reports.');
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
    }

    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
}

// ── User API ────────────────────────────────────────────────────────────────

export function createReport(payload: CreateReportPayload): Promise<{ ok: boolean; id: number }> {
    return request<{ ok: boolean; id: number }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

// ── Admin API ────────────────────────────────────────────────────────────────

export function fetchAdminReports(
    resolved?: boolean,
    page = 1,
    limit = 50
): Promise<ReportListResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (resolved !== undefined) params.set('resolved', resolved ? 'true' : 'false');
    return request<ReportListResponse>(`/api/admin/reports?${params}`);
}

export function resolveReport(
    id: number,
    resolved: boolean
): Promise<{ id: number; resolved: number }> {
    return request<{ id: number; resolved: number }>(`/api/admin/reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resolved })
    });
}

export function deleteReport(id: number): Promise<void> {
    return request<void>(`/api/admin/reports/${id}`, { method: 'DELETE' });
}
