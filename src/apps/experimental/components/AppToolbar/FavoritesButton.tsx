import FavoriteIcon from '@mui/icons-material/Favorite';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React, { type FC } from 'react';
import { Link, useLocation } from 'react-router-dom';

import globalize from 'lib/globalize';

const FAVORITES_PATH = '/home?tab=1';

const FavoritesButton: FC = () => {
    const location = useLocation();
    const isFavoritesPath = location.pathname === '/home' && location.search === '?tab=1';

    return (
        <Tooltip title={globalize.translate('Favorites')}>
            <IconButton
                size='large'
                aria-label={globalize.translate('Favorites')}
                color='inherit'
                component={Link}
                disabled={isFavoritesPath}
                to={FAVORITES_PATH}
            >
                <FavoriteIcon />
            </IconButton>
        </Tooltip>
    );
};

export default FavoritesButton;
