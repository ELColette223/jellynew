import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';

import { createTicket, searchJellyfinContent } from '../api';
import type { JellyfinSearchResult, TicketType } from '../types';

interface Props {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}

type Step = 'form' | 'found' | 'insist';

const TICKET_TYPES: { value: TicketType; label: string }[] = [
    { value: 'movie', label: 'Filme' },
    { value: 'show', label: 'Série' },
    { value: 'music', label: 'Música' },
    { value: 'book', label: 'Livro' },
    { value: 'other', label: 'Outro' }
];

const CreateTicketDialog: React.FC<Props> = ({ open, onClose, onCreated }) => {
    const [ step, setStep ] = useState<Step>('form');
    const [ loading, setLoading ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ foundItems, setFoundItems ] = useState<JellyfinSearchResult[]>([]);

    // Form fields
    const [ title, setTitle ] = useState('');
    const [ type, setType ] = useState<TicketType>('movie');
    const [ year, setYear ] = useState('');
    const [ description, setDescription ] = useState('');
    const [ tmdbId, setTmdbId ] = useState('');
    const [ imdbId, setImdbId ] = useState('');

    const reset = useCallback(() => {
        setStep('form');
        setLoading(false);
        setError(null);
        setFoundItems([]);
        setTitle('');
        setType('movie');
        setYear('');
        setDescription('');
        setTmdbId('');
        setImdbId('');
    }, []);

    useEffect(() => {
        if (!open) reset();
    }, [ open, reset ]);

    const handleSearch = useCallback(async () => {
        if (!title.trim()) {
            setError('Por favor, informe o título.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { results } = await searchJellyfinContent(title.trim(), year ? parseInt(year, 10) : undefined);
            if (results.length > 0) {
                setFoundItems(results);
                setStep('found');
            } else {
                setStep('insist'); // No results – head straight to the detail form
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [ title, year ]);

    const handleSubmit = useCallback(async (insisted: boolean) => {
        if (!description.trim()) {
            setError('Por favor, descreva o conteúdo que deseja.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await createTicket({
                title: title.trim(),
                type,
                description: description.trim(),
                year: year ? parseInt(year, 10) : undefined,
                tmdb_id: tmdbId || undefined,
                imdb_id: imdbId || undefined,
                insisted
            });
            onCreated();
            onClose();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [ title, type, description, year, tmdbId, imdbId, onCreated, onClose ]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle>Solicitar Conteúdo</DialogTitle>

            <DialogContent dividers>
                {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}

                {/* ── Step 1: Basic info ── */}
                {(step === 'form' || step === 'found' || step === 'insist') && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label='Título'
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            disabled={step !== 'form' || loading}
                            required
                            fullWidth
                        />

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <FormControl sx={{ minWidth: 140 }}>
                                <InputLabel>Tipo</InputLabel>
                                <Select
                                    value={type}
                                    label='Tipo'
                                    onChange={e => setType(e.target.value as TicketType)}
                                    disabled={step !== 'form' || loading}
                                >
                                    {TICKET_TYPES.map(t => (
                                        <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <TextField
                                label='Ano (opcional)'
                                value={year}
                                onChange={e => setYear(e.target.value)}
                                disabled={step !== 'form' || loading}
                                type='number'
                                sx={{ width: 170 }}
                                inputProps={{ min: 1900, max: 2100 }}
                            />
                        </Box>
                    </Box>
                )}

                {/* ── Step 2: Content found warning ── */}
                {step === 'found' && (
                    <Box sx={{ mt: 2 }}>
                        <Alert severity='info' sx={{ mb: 1 }}>
                            Este conteúdo já parece estar disponível na plataforma:
                        </Alert>
                        {foundItems.slice(0, 5).map(item => (
                            <Typography key={item.Id} variant='body2' sx={{ ml: 2 }}>
                                • {item.Name}{item.ProductionYear ? ` (${item.ProductionYear})` : ''} — {item.Type}
                            </Typography>
                        ))}
                        <Typography variant='body2' sx={{ mt: 1 }}>
                            Deseja abrir um ticket mesmo assim com detalhes adicionais?
                        </Typography>
                    </Box>
                )}

                {/* ── Step 3: Full detail form ── */}
                {step === 'insist' && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                        <TextField
                            label='Descrição / Detalhes adicionais'
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            disabled={loading}
                            required
                            multiline
                            rows={4}
                            fullWidth
                            helperText='Informe o máximo de detalhes possível (ex: link TMDb/IMDb, motivo do pedido).'
                        />

                        <TextField
                            label='ID TMDb (opcional)'
                            value={tmdbId}
                            onChange={e => setTmdbId(e.target.value)}
                            disabled={loading}
                            fullWidth
                        />

                        <TextField
                            label='ID IMDb (opcional)'
                            value={imdbId}
                            onChange={e => setImdbId(e.target.value)}
                            disabled={loading}
                            fullWidth
                        />
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={loading}>Cancelar</Button>

                {step === 'form' && (
                    <Button
                        variant='contained'
                        onClick={handleSearch}
                        disabled={loading || !title.trim()}
                    >
                        {loading ? <CircularProgress size={20} /> : 'Verificar disponibilidade'}
                    </Button>
                )}

                {step === 'found' && (
                    <>
                        <Button onClick={onClose}>Não, obrigado</Button>
                        <Button
                            variant='contained'
                            onClick={() => setStep('insist')}
                        >
                            Sim, quero um ticket
                        </Button>
                    </>
                )}

                {step === 'insist' && (
                    <Button
                        variant='contained'
                        onClick={() => handleSubmit(foundItems.length > 0)}
                        disabled={loading || !description.trim()}
                    >
                        {loading ? <CircularProgress size={20} /> : 'Enviar pedido'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default CreateTicketDialog;
