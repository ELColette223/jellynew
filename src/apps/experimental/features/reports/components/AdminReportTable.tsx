import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
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
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import LaunchIcon from '@mui/icons-material/Launch';
import React, { useCallback, useEffect, useState } from 'react';

import { deleteReport, fetchAdminReports, resolveReport } from '../api';
import type { ContentReport } from '../types';

const AdminReportTable: React.FC = () => {
    const [ reports, setReports ] = useState<ContentReport[]>([]);
    const [ total, setTotal ] = useState(0);
    const [ page, setPage ] = useState(0);
    const [ rowsPerPage, setRowsPerPage ] = useState(25);
    const [ resolvedFilter, setResolvedFilter ] = useState<string>(''); // '' | 'true' | 'false'
    const [ loading, setLoading ] = useState(true);
    const [ error, setError ] = useState<string | null>(null);

    const loadReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const resolvedParam = resolvedFilter === '' ? undefined : resolvedFilter === 'true';
            const res = await fetchAdminReports(resolvedParam, page + 1, rowsPerPage);
            setReports(res.rows);
            setTotal(res.total);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [ resolvedFilter, page, rowsPerPage ]);

    useEffect(() => { void loadReports(); }, [ loadReports ]);

    const handleToggleResolve = useCallback(async (id: number, currentResolved: number) => {
        const targetResolved = currentResolved === 1 ? false : true;
        try {
            await resolveReport(id, targetResolved);
            await loadReports();
        } catch (err) {
            setError((err as Error).message);
        }
    }, [ loadReports ]);

    const handleDelete = useCallback(async (id: number) => {
        if (!confirm('Remover este reporte permanentemente?')) return;
        try {
            await deleteReport(id);
            await loadReports();
        } catch (err) {
            setError((err as Error).message);
        }
    }, [ loadReports ]);

    return (
        <Box>
            {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <FormControl size='small' sx={{ minWidth: 160 }}>
                    <InputLabel>Status</InputLabel>
                    <Select
                        value={resolvedFilter}
                        label='Status'
                        onChange={e => { setPage(0); setResolvedFilter(e.target.value); }}
                    >
                        <MenuItem value=''>Todos</MenuItem>
                        <MenuItem value='false'>Pendentes</MenuItem>
                        <MenuItem value='true'>Resolvidos</MenuItem>
                    </Select>
                </FormControl>
                <Button variant='outlined' size='small' onClick={() => void loadReports()}>
                    Atualizar
                </Button>
            </Box>

            <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Conteúdo</TableCell>
                            <TableCell>Usuário</TableCell>
                            <TableCell>Problema</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Criado em</TableCell>
                            <TableCell align='right'>Ações</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} align='center'>
                                    <CircularProgress size={24} sx={{ my: 2 }} />
                                </TableCell>
                            </TableRow>
                        ) : reports.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align='center'>
                                    Nenhum reporte encontrado.
                                </TableCell>
                            </TableRow>
                        ) : reports.map(report => (
                            <TableRow key={report.id} hover>
                                <TableCell>{report.id}</TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box>
                                            <Typography variant='body2' fontWeight={600}>{report.item_title}</Typography>
                                            <Typography variant='caption' color='text.secondary'>
                                                {report.item_type || 'Tipo desconhecido'}
                                                {report.item_year ? ` • ${report.item_year}` : ''}
                                            </Typography>
                                        </Box>
                                        <IconButton
                                            size='small'
                                            href={`#/details?id=${report.item_id}`}
                                            title='Ver Detalhes do Conteúdo'
                                        >
                                            <LaunchIcon fontSize='inherit' />
                                        </IconButton>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Typography variant='body2'>{report.user_name}</Typography>
                                    {report.user_email ? (
                                        <Typography variant='caption' color='text.secondary' display='block'>
                                            {report.user_email}
                                        </Typography>
                                    ) : (
                                        <Typography variant='caption' color='text.secondary' display='block'>
                                            ID: {report.user_id}
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell sx={{ maxWidth: 300, wordBreak: 'break-word' }}>
                                    <Typography variant='body2'>{report.description}</Typography>
                                </TableCell>
                                <TableCell>
                                    {report.resolved === 1 ? (
                                        <Chip label='Resolvido' size='small' color='success' />
                                    ) : (
                                        <Chip label='Pendente' size='small' color='warning' />
                                    )}
                                </TableCell>
                                <TableCell>
                                    {new Date(report.created_at).toLocaleString('pt-BR')}
                                </TableCell>
                                <TableCell align='right'>
                                    <IconButton
                                        size='small'
                                        color={report.resolved === 1 ? 'default' : 'success'}
                                        onClick={() => void handleToggleResolve(report.id, report.resolved)}
                                        title={report.resolved === 1 ? 'Reabrir Reporte' : 'Marcar como Resolvido'}
                                    >
                                        {report.resolved === 1 ? (
                                            <CheckCircleIcon fontSize='small' color='success' />
                                        ) : (
                                            <RadioButtonUncheckedIcon fontSize='small' />
                                        )}
                                    </IconButton>
                                    <IconButton
                                        size='small'
                                        color='error'
                                        onClick={() => void handleDelete(report.id)}
                                        title='Excluir Reporte'
                                    >
                                        <DeleteIcon fontSize='small' />
                                    </IconButton>
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
        </Box>
    );
};

export default AdminReportTable;
