import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';

import { fetchMyTickets } from '../api';
import type { Ticket } from '../types';
import { subscribeToTicketUpdates } from '../ticketEventBus';
import TicketStatusChip from './TicketStatusChip';

const TicketList: React.FC = () => {
    const [ tickets, setTickets ] = useState<Ticket[]>([]);
    const [ loading, setLoading ] = useState(true);
    const [ error, setError ] = useState<string | null>(null);
    const [ expanded, setExpanded ] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchMyTickets();
            setTickets(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    // Silent background refresh — updates status chips without hiding the list
    const refresh = useCallback(async () => {
        try {
            const data = await fetchMyTickets();
            setTickets(data);
        } catch {
            // ignore — don't disrupt the UI for a background poll failure
        }
    }, []);

    useEffect(() => { void load(); }, [ load ]);

    // SSE real-time push
    useEffect(() => {
        return subscribeToTicketUpdates(() => { void refresh(); });
    }, [ refresh ]);

    // Polling fallback every 30 s (silent, tab-visibility aware)
    useEffect(() => {
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') void refresh();
        }, 30_000);
        return () => clearInterval(id);
    }, [ refresh ]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity='error'>{error}</Alert>;
    }

    if (tickets.length === 0) {
        return (
            <Alert severity='info'>
                Você ainda não tem pedidos. Clique em "Novo Pedido" para solicitar um conteúdo.
            </Alert>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tickets.map(ticket => (
                <Card key={ticket.id} variant='outlined'>
                    <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                            <Box>
                                <Typography variant='subtitle1' fontWeight={600}>
                                    {ticket.title}
                                    {ticket.year ? ` (${ticket.year})` : ''}
                                </Typography>
                                <Typography variant='caption' color='text.secondary'>
                                    Tipo: {ticket.type} · Criado em {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                                </Typography>
                            {ticket.admin_notes && (
                                <Alert severity='info' sx={{ mt: 1 }}>
                                    <strong>Nota do administrador:</strong> {ticket.admin_notes}
                                </Alert>
                            )}
                            </Box>
                            <Box sx={{ alignSelf: 'flex-start' }}>
                                <TicketStatusChip status={ticket.status} />
                            </Box>
                        </Box>

                        <Button
                            size='small'
                            onClick={() => setExpanded(expanded === ticket.id ? null : ticket.id)}
                            sx={{ mt: 2, px: 0, width: 100 }}
                        >
                            {expanded === ticket.id ? 'Menos detalhes' : 'Ver detalhes'}
                        </Button>

                        <Collapse in={expanded === ticket.id}>
                            <Divider sx={{ my: 1 }} />
                            <Typography variant='body2'>{ticket.description}</Typography>
                        </Collapse>
                    </CardContent>
                </Card>
            ))}
        </Box>
    );
};

export default TicketList;
