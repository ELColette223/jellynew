import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import AdminTicketTable from 'apps/experimental/features/tickets/components/AdminTicketTable';
import Page from 'components/Page';

export const Component = () => {
    return (
        <Page
            id='adminTicketsPage'
            title='Pedidos de Conteúdo'
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary'>
                <Typography variant='h2' sx={{ mb: 3 }}>
                    Pedidos de Conteúdo
                </Typography>
                <AdminTicketTable />
            </Box>
        </Page>
    );
};

Component.displayName = 'AdminTicketsPage';
