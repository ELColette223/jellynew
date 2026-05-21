export interface CreateReportPayload {
    item_id: string;
    item_title: string;
    item_type?: string;
    item_year?: number;
    description: string;
}

export interface ContentReport {
    id: number;
    user_id: string;
    user_name: string;
    user_email?: string;
    item_id: string;
    item_title: string;
    item_type?: string;
    item_year?: number;
    description: string;
    resolved: number;
    created_at: string;
}

export interface ReportListResponse {
    total: number;
    page: number;
    limit: number;
    rows: ContentReport[];
}
