import Chip, { type ChipProps } from '@mui/material/Chip';
import React from 'react';

import type { TicketStatus } from '../types';

interface Props {
    status: TicketStatus;
    size?: ChipProps['size'];
}

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: ChipProps['color'] }> = {
    open: { label: 'Aberto', color: 'default' },
    searching: { label: 'Procurando', color: 'info' },
    processing: { label: 'Processando', color: 'warning' },
    closed: { label: 'Concluído', color: 'success' },
    rejected: { label: 'Recusado', color: 'error' }
};

const TicketStatusChip: React.FC<Props> = ({ status, size = 'small' }) => {
    const cfg = STATUS_CONFIG[status] ?? { label: status, color: 'default' as const };
    return <Chip label={cfg.label} color={cfg.color} size={size} />;
};

export default TicketStatusChip;
