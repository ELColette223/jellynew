import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchMyTickets } from '../api';
import { subscribeToTicketUpdates } from '../ticketEventBus';
import type { Ticket } from '../types';
import TicketStatusChip from './TicketStatusChip';

/** How often (ms) to silently re-fetch when SSE is unavailable or the tab regains focus. */
const POLL_INTERVAL_MS = 30_000;

/** Max number of tickets to show in the home widget. */
const MAX_VISIBLE = 5;

const TicketStatusSection: React.FC = () => {
    const [ tickets, setTickets ] = useState<Ticket[]>([]);
    const [ loading, setLoading ] = useState(true);
    const [ lastChecked, setLastChecked ] = useState<Date | null>(null);
    const mountedRef = useRef(true);

    const load = useCallback(async () => {
        try {
            const data = await fetchMyTickets();
            if (!mountedRef.current) return;
            setTickets(data);
            setLastChecked(new Date());
        } catch {
            // Silent failure — home page widget should never crash
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        mountedRef.current = true;
        void load();
        return () => { mountedRef.current = false; };
    }, [ load ]);

    // Polling fallback every 30 s — paused while the tab is hidden
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') void load();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [ load ]);

    // SSE real-time push — triggers an immediate re-fetch on any update
    useEffect(() => subscribeToTicketUpdates(() => void load()), [ load ]);

    // Re-fetch when the tab becomes visible after being hidden
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible') void load();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [ load ]);

    // Don't render the widget if the user has no tickets at all
    if (!loading && tickets.length === 0) return null;

    const visible = tickets.slice(0, MAX_VISIBLE);
    const hiddenCount = tickets.length - MAX_VISIBLE;

    return (
        <Box sx={{ mx: 2, my: 2 }}>
            <Divider sx={{ mb: 2 }} />

            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.5 }}>
                <Typography variant='h6' component='h2'>
                    Meus Pedidos de Conteúdo
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {lastChecked && (
                        <Tooltip title={`Última verificação: ${lastChecked.toLocaleTimeString('pt-BR')}`}>
                            <Typography variant='caption' color='text.secondary' sx={{ cursor: 'default' }}>
                                Atualizado às {lastChecked.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </Typography>
                        </Tooltip>
                    )}
                    <Button component={Link} to='/tickets' size='small' variant='outlined'>
                        Ver todos
                    </Button>
                </Box>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {loading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} variant='rounded' height={44} />
                    ))
                    : visible.map(ticket => (
                        <Box
                            key={ticket.id}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                px: 1.5,
                                py: 0.75,
                                borderRadius: 1,
                                bgcolor: 'background.paper',
                                border: '1px solid',
                                borderColor: 'divider'
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant='body2' fontWeight={500} noWrap>
                                    {ticket.title}
                                    {ticket.year ? ` (${ticket.year})` : ''}
                                </Typography>
                                {ticket.admin_notes && (
                                    <Typography variant='caption' color='text.secondary' noWrap>
                                        {ticket.admin_notes}
                                    </Typography>
                                )}
                            </Box>
                            <TicketStatusChip status={ticket.status} />
                        </Box>
                    ))
                }
                {hiddenCount > 0 && (
                    <Typography
                        variant='caption'
                        color='text.secondary'
                        align='center'
                        component={Link}
                        to='/tickets'
                        sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                        + {hiddenCount} outro{hiddenCount > 1 ? 's' : ''} pedido{hiddenCount > 1 ? 's' : ''}
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default TicketStatusSection;
