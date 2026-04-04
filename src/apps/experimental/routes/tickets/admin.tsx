import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import React from 'react';

import Page from 'components/Page';
import AdminTicketTable from '../../features/tickets/components/AdminTicketTable';

const AdminTicketsPage: React.FC = () => {
    return (
        <Page id='adminTicketsPage' className='mainAnimatedPage'>
            <Container maxWidth='xl' sx={{ py: 4 }}>
                <Typography variant='h5' component='h1' sx={{ mb: 3 }}>
                    Gerenciar Pedidos de Conteúdo
                </Typography>
                <AdminTicketTable />
            </Container>
        </Page>
    );
};

export default AdminTicketsPage;
