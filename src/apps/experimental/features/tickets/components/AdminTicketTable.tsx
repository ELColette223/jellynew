import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import React, { useCallback, useEffect, useState } from 'react';

import { deleteTicket, fetchAdminTickets, updateTicketStatus } from '../api';
import type { AdminTicket, TicketStatus } from '../types';
import TicketStatusChip from './TicketStatusChip';

const STATUSES: TicketStatus[] = [ 'open', 'searching', 'processing', 'closed', 'rejected' ];
const STATUS_LABELS: Record<TicketStatus, string> = {
    open: 'Aberto',
    searching: 'Procurando',
    processing: 'Processando',
    closed: 'Concluído',
    rejected: 'Recusado'
};

const AdminTicketTable: React.FC = () => {
    const [ tickets, setTickets ] = useState<AdminTicket[]>([]);
    const [ total, setTotal ] = useState(0);
    const [ page, setPage ] = useState(0);
    const [ rowsPerPage, setRowsPerPage ] = useState(25);
    const [ statusFilter, setStatusFilter ] = useState<string>('');
    const [ loading, setLoading ] = useState(true);
    const [ error, setError ] = useState<string | null>(null);

    // Edit dialog
    const [ editTarget, setEditTarget ] = useState<AdminTicket | null>(null);
    const [ editStatus, setEditStatus ] = useState<TicketStatus>('open');
    const [ editNotes, setEditNotes ] = useState('');
    const [ editLoading, setEditLoading ] = useState(false);

    const loadTickets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetchAdminTickets(statusFilter || undefined, page + 1, rowsPerPage);
            setTickets(res.rows);
            setTotal(res.total);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [ statusFilter, page, rowsPerPage ]);

    useEffect(() => { void loadTickets(); }, [ loadTickets ]);

    const openEdit = useCallback((ticket: AdminTicket) => {
        setEditTarget(ticket);
        setEditStatus(ticket.status);
        setEditNotes(ticket.admin_notes || '');
    }, []);

    const handleSave = useCallback(async () => {
        if (!editTarget) return;
        setEditLoading(true);
        try {
            await updateTicketStatus(editTarget.id, editStatus, editNotes);
            setEditTarget(null);
            await loadTickets();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setEditLoading(false);
        }
    }, [ editTarget, editStatus, editNotes, loadTickets ]);

    const handleDelete = useCallback(async (id: number) => {
        if (!confirm('Remover este ticket permanentemente?')) return;
        try {
            await deleteTicket(id);
            await loadTickets();
        } catch (err) {
            setError((err as Error).message);
        }
    }, [ loadTickets ]);

    return (
        <Box>
            {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl size='small' sx={{ minWidth: 160 }}>
                    <InputLabel>Filtrar por status</InputLabel>
                    <Select
                        value={statusFilter}
                        label='Filtrar por status'
                        onChange={e => { setPage(0); setStatusFilter(e.target.value); }}
                    >
                        <MenuItem value=''>Todos</MenuItem>
                        {STATUSES.map(s => (
                            <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Button variant='outlined' size='small' onClick={() => void loadTickets()}>
                    Atualizar
                </Button>
            </Box>

            <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Título</TableCell>
                            <TableCell>Tipo</TableCell>
                            <TableCell>Usuário</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Insistiu?</TableCell>
                            <TableCell>Criado em</TableCell>
                            <TableCell align='right'>Ações</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} align='center'>
                                    <CircularProgress size={24} />
                                </TableCell>
                            </TableRow>
                        ) : tickets.map(ticket => (
                            <TableRow key={ticket.id} hover>
                                <TableCell>{ticket.id}</TableCell>
                                <TableCell>
                                    <Typography variant='body2' fontWeight={600}>{ticket.title}</Typography>
                                    {ticket.year && (
                                        <Typography variant='caption' color='text.secondary'>{ticket.year}</Typography>
                                    )}
                                </TableCell>
                                <TableCell>{ticket.type}</TableCell>
                                <TableCell>
                                    <Typography variant='body2'>{ticket.user_name}</Typography>
                                    {ticket.user_email && (
                                        <Typography variant='caption' color='text.secondary'>{ticket.user_email}</Typography>
                                    )}
                                </TableCell>
                                <TableCell><TicketStatusChip status={ticket.status} /></TableCell>
                                <TableCell>
                                    {ticket.insisted
                                        ? <Chip label='Sim' size='small' color='warning' />
                                        : <Chip label='Não' size='small' />}
                                </TableCell>
                                <TableCell>
                                    {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
                                </TableCell>
                                <TableCell align='right'>
                                    <IconButton size='small' onClick={() => openEdit(ticket)}><EditIcon fontSize='small' /></IconButton>
                                    <IconButton size='small' color='error' onClick={() => void handleDelete(ticket.id)}><DeleteIcon fontSize='small' /></IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                component='div'
                count={total}
                page={page}
                rowsPerPage={rowsPerPage}
                onPageChange={(_, p) => setPage(p)}
                onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                rowsPerPageOptions={[ 10, 25, 50 ]}
                labelRowsPerPage='Por página:'
            />

            {/* ── Edit dialog ── */}
            <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} maxWidth='sm' fullWidth>
                <DialogTitle>Atualizar Ticket #{editTarget?.id} — {editTarget?.title}</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant='body2' color='text.secondary'>
                            Usuário: <strong>{editTarget?.user_name}</strong>
                            {editTarget?.user_email && ` (${editTarget.user_email})`}
                        </Typography>
                        <Typography variant='body2'>{editTarget?.description}</Typography>

                        <FormControl fullWidth>
                            <InputLabel>Novo Status</InputLabel>
                            <Select
                                value={editStatus}
                                label='Novo Status'
                                onChange={e => setEditStatus(e.target.value as TicketStatus)}
                            >
                                {STATUSES.map(s => (
                                    <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            label='Nota para o usuário (opcional)'
                            value={editNotes}
                            onChange={e => setEditNotes(e.target.value)}
                            multiline
                            rows={3}
                            fullWidth
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditTarget(null)} disabled={editLoading}>Cancelar</Button>
                    <Button variant='contained' onClick={() => void handleSave()} disabled={editLoading}>
                        {editLoading ? <CircularProgress size={20} /> : 'Salvar'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AdminTicketTable;
