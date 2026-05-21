import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';

import { createReport } from '../api';

interface Props {
    open: boolean;
    onClose: () => void;
    itemId: string;
    itemTitle: string;
    itemType?: string;
    itemYear?: number;
    onCreated?: () => void;
}

const ReportContentDialog: React.FC<Props> = ({
    open,
    onClose,
    itemId,
    itemTitle,
    itemType,
    itemYear,
    onCreated
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [description, setDescription] = useState('');

    const reset = useCallback(() => {
        setLoading(false);
        setError(null);
        setSuccess(false);
        setDescription('');
    }, []);

    useEffect(() => {
        if (open) {
            reset();
        }
    }, [open, reset]);

    const handleSubmit = useCallback(async () => {
        const descTrim = description.trim();
        if (descTrim.length < 4) {
            setError('A descrição do problema deve ter pelo menos 4 caracteres.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            await createReport({
                item_id: itemId,
                item_title: itemTitle,
                item_type: itemType,
                item_year: itemYear,
                description: descTrim
            });
            setSuccess(true);
            if (onCreated) {
                onCreated();
            }
            // Auto close after 2 seconds
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, [itemId, itemTitle, itemType, itemYear, description, onClose, onCreated]);

    return (
        <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth='sm' fullWidth>
            <DialogTitle>Reportar Problema de Conteúdo</DialogTitle>

            <DialogContent dividers>
                {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
                {success && (
                    <Alert severity='success' sx={{ mb: 2 }}>
                        Problema reportado com sucesso! O administrador foi notificado.
                    </Alert>
                )}

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                        <Typography variant='caption' color='textSecondary' display='block'>
                            Conteúdo selecionado
                        </Typography>
                        <Typography variant='body1' fontWeight='bold'>
                            {itemTitle}
                            {itemYear ? ` (${itemYear})` : ''}
                            {itemType ? ` — ${itemType}` : ''}
                        </Typography>
                    </Box>

                    {!success && (
                        <TextField
                            label='Descrição do Problema'
                            placeholder='Descreva detalhadamente o problema (ex: sem legenda, áudio dessincronizado, travamento aos 15 minutos, etc.)'
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            disabled={loading}
                            required
                            multiline
                            rows={4}
                            fullWidth
                            helperText='Mínimo de 4 caracteres.'
                            error={description.trim().length > 0 && description.trim().length < 4}
                        />
                    )}
                </Box>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={loading}>
                    {success ? 'Fechar' : 'Cancelar'}
                </Button>
                {!success && (
                    <Button
                        variant='contained'
                        onClick={handleSubmit}
                        disabled={loading || description.trim().length < 4}
                    >
                        {loading ? <CircularProgress size={20} color='inherit' /> : 'Enviar Relatório'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ReportContentDialog;
