import Button from '@mui/material/Button/Button';
import React, { FC } from 'react';
import { Link } from 'react-router-dom';

import { useSystemInfo } from 'hooks/useSystemInfo';

const ServerButton: FC = () => {
    const {
        data: systemInfo,
        isPending
    } = useSystemInfo();

    return (
        <Button
            variant='text'
            size='large'
            color='inherit'
            component={Link}
            to='/'
            sx={{
                fontWeight: 700,
                fontSize: '1.25rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                lineHeight: 1,
                px: 1
            }}
        >
            {isPending ? '' : (systemInfo?.ServerName || 'Jellyfin')}
        </Button>
    );
};

export default ServerButton;
