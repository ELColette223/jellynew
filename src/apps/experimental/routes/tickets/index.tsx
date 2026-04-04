import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import React, { useCallback, useRef, useState } from 'react';

import Page from 'components/Page';
import CreateTicketDialog from '../../features/tickets/components/CreateTicketDialog';
import TicketList from '../../features/tickets/components/TicketList';

const TicketsPage: React.FC = () => {
    const [ dialogOpen, setDialogOpen ] = useState(false);
    const reloadRef = useRef<(() => void) | null>(null);

    const handleCreated = useCallback(() => {
        reloadRef.current?.();
    }, []);

    return (
        <Page id='ticketsPage' className='mainAnimatedPage'>
            <Container maxWidth='md' sx={{ py: 4, pt: '10vh' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant='h5' component='h1'>
                        Meus Pedidos de Conteúdo
                    </Typography>
                    <Button
                        variant='contained'
                        startIcon={<AddIcon />}
                        onClick={() => setDialogOpen(true)}
                    >
                        Novo Pedido
                    </Button>
                </Box>

                <TicketList key={String(dialogOpen)} />

                <CreateTicketDialog
                    open={dialogOpen}
                    onClose={() => setDialogOpen(false)}
                    onCreated={handleCreated}
                />
            </Container>
        </Page>
    );
};

export default TicketsPage;
