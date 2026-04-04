export type TicketStatus = 'open' | 'searching' | 'processing' | 'closed' | 'rejected';
export type TicketType = 'movie' | 'show' | 'music' | 'book' | 'other';

export interface Ticket {
    id: number;
    title: string;
    type: TicketType;
    description: string;
    year?: number;
    status: TicketStatus;
    insisted: number;
    admin_notes?: string;
    created_at: string;
    updated_at: string;
}

export interface AdminTicket extends Ticket {
    user_id: string;
    user_name: string;
    user_email?: string;
    tmdb_id?: string;
    imdb_id?: string;
    history?: TicketHistoryEntry[];
}

export interface TicketHistoryEntry {
    old_status: TicketStatus | null;
    new_status: TicketStatus;
    changed_by: string;
    note?: string;
    created_at: string;
}

export interface CreateTicketPayload {
    title: string;
    type: TicketType;
    description: string;
    year?: number;
    tmdb_id?: string;
    imdb_id?: string;
    insisted?: boolean;
}

export interface JellyfinSearchResult {
    Id: string;
    Name: string;
    Type: string;
    ProductionYear?: number;
    Overview?: string;
}

export interface AdminListResponse {
    total: number;
    page: number;
    limit: number;
    rows: AdminTicket[];
}

export interface TicketSettings {
    admin_email: string;
    notify_client: boolean;
    smtp_configured: boolean;
}
