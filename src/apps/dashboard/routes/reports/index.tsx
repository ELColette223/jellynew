import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

import AdminReportTable from 'apps/experimental/features/reports/components/AdminReportTable';
import Page from 'components/Page';

export const Component = () => {
    return (
        <Page
            id='adminReportsPage'
            title='Problemas Reportados'
            className='mainAnimatedPage type-interior'
        >
            <Box className='content-primary'>
                <Typography variant='h2' sx={{ mb: 3 }}>
                    Problemas Reportados
                </Typography>
                <AdminReportTable />
            </Box>
        </Page>
    );
};

Component.displayName = 'AdminReportsPage';
