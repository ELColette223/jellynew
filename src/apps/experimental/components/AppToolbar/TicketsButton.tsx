import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import Alert from '@mui/material/Alert';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Tooltip from '@mui/material/Tooltip';
import React, { type FC } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useTicketNotifications } from 'apps/experimental/features/tickets/hooks/useTicketNotifications';

const TicketsButton: FC = () => {
    const location = useLocation();
    const isActive = location.pathname.startsWith('/tickets');
    const { unreadCount, latestUpdate, dismissLatest } = useTicketNotifications();

    return (
        <>
            <Tooltip title='Meus Pedidos'>
                <IconButton
                    component={Link}
                    to='/tickets'
                    color='inherit'
                    size='large'
                >
                    <Badge
                        badgeContent={unreadCount}
                        color='error'
                        max={99}
                        invisible={unreadCount === 0}
                    >
                        <ConfirmationNumberIcon />
                    </Badge>
                </IconButton>
            </Tooltip>

            {latestUpdate && !isActive && (
                <Snackbar
                    open
                    autoHideDuration={5000}
                    onClose={dismissLatest}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                >
                    <Alert
                        severity='info'
                        onClose={dismissLatest}
                        sx={{ width: '100%' }}
                    >
                        Pedido &quot;{latestUpdate.title}&quot; atualizado: <strong>{latestUpdate.statusLabel}</strong>
                    </Alert>
                </Snackbar>
            )}
        </>
    );
};

export default TicketsButton;
