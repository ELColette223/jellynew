export interface WatchLaterItem {
    id: number;
    item_id: string;
    item_title: string;
    item_type?: string;
    item_year?: number;
    added_at: string;
}

export interface AddToWatchLaterPayload {
    item_id: string;
    item_title: string;
    item_type?: string;
    item_year?: number;
}
