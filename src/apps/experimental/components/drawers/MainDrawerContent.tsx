import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import Favorite from '@mui/icons-material/Favorite';
import Home from '@mui/icons-material/Home';
import WatchLaterIcon from '@mui/icons-material/WatchLater';
import Badge from '@mui/material/Badge';
import Divider from '@mui/material/Divider';
import Icon from '@mui/material/Icon';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import React from 'react';

import { useTicketNotifications } from 'apps/experimental/features/tickets/hooks/useTicketNotifications';
import { useWatchLaterCount } from 'apps/experimental/features/watchlater/hooks/useWatchLater';
import { useLocation } from 'react-router-dom';

import ListItemLink from 'components/ListItemLink';
import { appRouter } from 'components/router/appRouter';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import { useWebConfig } from 'hooks/useWebConfig';
import globalize from 'lib/globalize';

import LibraryIcon from '../LibraryIcon';
import DrawerHeaderLink from './DrawerHeaderLink';

const MainDrawerContent = () => {
    const { user } = useApi();
    const location = useLocation();
    const watchLaterCount = useWatchLaterCount();
    const { unreadCount: ticketsUnreadCount } = useTicketNotifications();
    const { data: userViewsData } = useUserViews({ userId: user?.Id });
    const userViews = userViewsData?.Items || [];
    const webConfig = useWebConfig();

    const isHomeSelected = location.pathname === '/home' && (!location.search || location.search === '?tab=0');

    return (
        <>
            {/* MAIN LINKS */}
            <List sx={{ paddingTop: 0 }}>
                <ListItem disablePadding>
                    <DrawerHeaderLink />
                </ListItem>
                <ListItem disablePadding>
                    <ListItemLink to='/home' selected={isHomeSelected}>
                        <ListItemIcon>
                            <Home />
                        </ListItemIcon>
                        <ListItemText primary={globalize.translate('Home')} />
                    </ListItemLink>
                </ListItem>
                <ListItem disablePadding>
                    <ListItemLink to='/home?tab=1'>
                        <ListItemIcon>
                            <Favorite />
                        </ListItemIcon>
                        <ListItemText primary={globalize.translate('Favorites')} />
                    </ListItemLink>
                </ListItem>
                <ListItem disablePadding>
                    <ListItemLink to='/watchlater'>
                        <ListItemIcon>
                            <Badge
                                badgeContent={watchLaterCount}
                                color='primary'
                                max={99}
                                invisible={watchLaterCount === 0}
                            >
                                <WatchLaterIcon />
                            </Badge>
                        </ListItemIcon>
                        <ListItemText primary='Assistir Mais Tarde' />
                    </ListItemLink>
                </ListItem>
                <ListItem disablePadding>
                    <ListItemLink to='/tickets'>
                        <ListItemIcon>
                            <Badge
                                badgeContent={ticketsUnreadCount}
                                color='error'
                                max={99}
                                invisible={ticketsUnreadCount === 0}
                            >
                                <ConfirmationNumberIcon />
                            </Badge>
                        </ListItemIcon>
                        <ListItemText primary='Pedidos de Conteúdo' />
                    </ListItemLink>
                </ListItem>
            </List>

            {/* CUSTOM LINKS */}
            {(!!webConfig.menuLinks && webConfig.menuLinks.length > 0) && (
                <>
                    <Divider />
                    <List>
                        {webConfig.menuLinks.map(menuLink => (
                            <ListItem
                                key={`${menuLink.name}_${menuLink.url}`}
                                disablePadding
                            >
                                <ListItemButton
                                    component='a'
                                    href={menuLink.url}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    <ListItemIcon>
                                        <Icon>{menuLink.icon ?? 'link'}</Icon>
                                    </ListItemIcon>
                                    <ListItemText primary={menuLink.name} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </>
            )}

            {/* LIBRARY LINKS */}
            {userViews.length > 0 && (
                <>
                    <Divider />
                    <List
                        aria-labelledby='libraries-subheader'
                        subheader={
                            <ListSubheader component='div' id='libraries-subheader'>
                                {globalize.translate('HeaderLibraries')}
                            </ListSubheader>
                        }
                    >
                        {userViews.map(view => (
                            <ListItem key={view.Id} disablePadding>
                                <ListItemLink
                                    to={appRouter.getRouteUrl(view, { context: view.CollectionType }).substring(1)}
                                >
                                    <ListItemIcon>
                                        <LibraryIcon item={view} />
                                    </ListItemIcon>
                                    <ListItemText primary={view.Name} />
                                </ListItemLink>
                            </ListItem>
                        ))}
                    </List>
                </>
            )}
        </>
    );
};

export default MainDrawerContent;
