import WatchLaterIcon from '@mui/icons-material/WatchLater';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React, { type FC } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useWatchLaterCount } from 'apps/experimental/features/watchlater/hooks/useWatchLater';

const WATCH_LATER_PATH = '/watchlater';

const WatchLaterButton: FC = () => {
    const location = useLocation();
    const isActive = location.pathname === WATCH_LATER_PATH;
    const count = useWatchLaterCount();

    return (
        <Tooltip title='Assistir Mais Tarde'>
            <IconButton
                size='large'
                aria-label='Assistir Mais Tarde'
                color='inherit'
                component={Link}
                disabled={isActive}
                to={WATCH_LATER_PATH}
            >
                <Badge
                    badgeContent={count}
                    color='primary'
                    max={99}
                    invisible={count === 0}
                >
                    <WatchLaterIcon />
                </Badge>
            </IconButton>
        </Tooltip>
    );
};

export default WatchLaterButton;
