import type {
    AdminListResponse,
    AdminTicket,
    CreateTicketPayload,
    JellyfinSearchResult,
    TicketSettings,
    Ticket
} from './types';

const BASE_URL = (window as Window & { __TICKET_SERVER_URL__?: string }).__TICKET_SERVER_URL__
    || (import.meta as { env?: { VITE_TICKET_SERVER_URL?: string } }).env?.VITE_TICKET_SERVER_URL
    || 'http://localhost:3001';

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

/**
 * Returns the URL for the ticket SSE event stream, or an empty string if the
 * user is not authenticated.  The token is passed as a query param because the
 * browser EventSource API does not support custom request headers.
 */
export function getTicketEventsUrl(): string {
    const token = getRawToken();
    if (!token) return '';
    return `${BASE_URL}/api/tickets/events?token=${encodeURIComponent(token)}`;
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
    let res: Response;
    try {
        res = await fetch(`${BASE_URL}${path}`, {
            ...init,
            headers: {
                'Content-Type': 'application/json',
                Authorization: getAuthHeader(),
                ...(init.headers || {})
            }
        });
    } catch (err) {
        // Convert low-level network errors into a friendlier, localized message
        // so the UI doesn't show browser-specific text like
        // "NetworkError when attempting to fetch resource.".
        // Keep a console.error for diagnostics.
        // Portuguese message: "Sistema de pedidos offline"
        // Add a brief explanatory sentence to help users.
        // eslint-disable-next-line no-console
        console.error('[tickets/api] Network request failed for', path, err);
        throw new Error('Sistema de pedidos offline — não foi possível conectar ao servidor de pedidos.');
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
    }

    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
}

// ── User API ────────────────────────────────────────────────────────────────

export function fetchMyTickets(): Promise<Ticket[]> {
    return request<Ticket[]>('/api/tickets');
}

export function fetchTicket(id: number): Promise<Ticket> {
    return request<Ticket>(`/api/tickets/${id}`);
}

export function searchJellyfinContent(
    query: string,
    year?: number
): Promise<{ results: JellyfinSearchResult[] }> {
    return request<{ results: JellyfinSearchResult[] }>('/api/tickets/search', {
        method: 'POST',
        body: JSON.stringify({ query, year })
    });
}

export function createTicket(payload: CreateTicketPayload): Promise<{ id: number; status: string }> {
    return request<{ id: number; status: string }>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
}

// ── Admin API ────────────────────────────────────────────────────────────────

export function fetchAdminTickets(
    status?: string,
    page = 1,
    limit = 50
): Promise<AdminListResponse> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (status) params.set('status', status);
    return request<AdminListResponse>(`/api/admin/tickets?${params}`);
}

export function fetchAdminTicket(id: number): Promise<AdminTicket> {
    return request<AdminTicket>(`/api/admin/tickets/${id}`);
}

export function updateTicketStatus(
    id: number,
    status: string,
    admin_notes?: string
): Promise<{ id: number; status: string; admin_notes?: string }> {
    return request(`/api/admin/tickets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, admin_notes })
    });
}

export function deleteTicket(id: number): Promise<void> {
    return request<void>(`/api/admin/tickets/${id}`, { method: 'DELETE' });
}

// ── Ticket system settings ───────────────────────────────────────────────────

export function getTicketSettings(): Promise<TicketSettings> {
    return request<TicketSettings>('/api/admin/settings');
}

export function updateTicketSettings(
    settings: Partial<Pick<TicketSettings, 'admin_email' | 'notify_client'>>
): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings)
    });
}

export function testAdminEmail(): Promise<{ ok: boolean }> {
    return request<{ ok: boolean }>('/api/admin/settings/test-email', {
        method: 'POST'
    });
}
