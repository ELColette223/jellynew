import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useCallback, useEffect, useState } from 'react';

import {
    getTicketSettings,
    testAdminEmail,
    updateTicketSettings
} from 'apps/experimental/features/tickets/api';
import type { TicketSettings } from 'apps/experimental/features/tickets/types';
import Page from 'components/Page';

export const Component = () => {
    const [ settings, setSettings ] = useState<TicketSettings | null>(null);
    const [ adminEmail, setAdminEmail ] = useState('');
    const [ notifyClient, setNotifyClient ] = useState(true);
    const [ loading, setLoading ] = useState(true);
    const [ saving, setSaving ] = useState(false);
    const [ testing, setTesting ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ successMsg, setSuccessMsg ] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await getTicketSettings();
            setSettings(data);
            setAdminEmail(data.admin_email);
            setNotifyClient(data.notify_client);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [ load ]);

    const handleSave = useCallback(async () => {
        setSaving(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await updateTicketSettings({ admin_email: adminEmail.trim(), notify_client: notifyClient });
            setSuccessMsg('Configurações salvas com sucesso.');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setSaving(false);
        }
    }, [ adminEmail, notifyClient ]);

    const handleTestEmail = useCallback(async () => {
        setTesting(true);
        setError(null);
        setSuccessMsg(null);
        try {
            await testAdminEmail();
            setSuccessMsg('E-mail de teste enviado para o endereço configurado.');
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setTesting(false);
        }
    }, []);

    return (
        <Page
            id='ticketSettingsPage'
            title='Configurações de Pedidos'
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary'>
                <Typography variant='h2' sx={{ mb: 3 }}>
                    Configurações de Pedidos
                </Typography>

                {loading ? (
                    <CircularProgress />
                ) : (
                    <Stack spacing={3} maxWidth={560}>
                        {error && (
                            <Alert severity='error' onClose={() => setError(null)}>
                                {error}
                            </Alert>
                        )}
                        {successMsg && (
                            <Alert severity='success' onClose={() => setSuccessMsg(null)}>
                                {successMsg}
                            </Alert>
                        )}

                        {/* ── Admin email ── */}
                        <Box>
                            <Typography variant='h3' gutterBottom>
                                E-mail do Administrador
                            </Typography>
                            <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                                Quando um usuário enviar um novo pedido de conteúdo, uma notificação
                                será enviada para este endereço. O SMTP é configurado via arquivo{' '}
                                <code>.env</code>.
                            </Typography>

                            {settings && !settings.smtp_configured && (
                                <Alert severity='warning' sx={{ mb: 2 }}>
                                    SMTP não está configurado no <code>.env</code>. Os e-mails não
                                    serão enviados até que as variáveis{' '}
                                    <code>SMTP_HOST</code>, <code>SMTP_USER</code> e{' '}
                                    <code>SMTP_PASS</code> sejam definidas.
                                </Alert>
                            )}

                            <Stack direction='row' spacing={2} alignItems='flex-start'>
                                <TextField
                                    label='E-mail do admin'
                                    type='email'
                                    value={adminEmail}
                                    onChange={e => setAdminEmail(e.target.value)}
                                    fullWidth
                                    size='small'
                                    placeholder='admin@example.com'
                                />
                                <Button
                                    variant='outlined'
                                    size='small'
                                    onClick={() => void handleTestEmail()}
                                    disabled={testing || !adminEmail.trim() || (settings ? !settings.smtp_configured : true)}
                                    sx={{ whiteSpace: 'nowrap', mt: 0.25 }}
                                >
                                    {testing ? <CircularProgress size={18} /> : 'Testar envio'}
                                </Button>
                            </Stack>
                        </Box>

                        <Divider />

                        {/* ── Notify client ── */}
                        <Box>
                            <Typography variant='h3' gutterBottom>
                                Notificação ao Usuário
                            </Typography>
                            <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                                Quando ativado, o usuário receberá um e-mail sempre que o status
                                do pedido dele for atualizado. O endereço é obtido do perfil
                                Jellyfin do usuário.
                            </Typography>

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={notifyClient}
                                        onChange={e => setNotifyClient(e.target.checked)}
                                    />
                                }
                                label='Notificar o usuário por e-mail nas mudanças de status'
                            />
                        </Box>

                        <Divider />

                        <Box>
                            <Button
                                variant='contained'
                                onClick={() => void handleSave()}
                                disabled={saving}
                            >
                                {saving ? <CircularProgress size={20} /> : 'Salvar'}
                            </Button>
                        </Box>
                    </Stack>
                )}
            </Box>
        </Page>
    );
};

Component.displayName = 'TicketSettingsPage';
