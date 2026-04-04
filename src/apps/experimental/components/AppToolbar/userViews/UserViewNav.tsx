import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import { BaseItemKind } from '@jellyfin/sdk/lib/generated-client/models/base-item-kind';
import { CollectionType } from '@jellyfin/sdk/lib/generated-client/models/collection-type';
import Button from '@mui/material/Button/Button';
import Icon from '@mui/material/Icon';
import { Theme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import React, { useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import LibraryIcon from 'apps/experimental/components/LibraryIcon';
import { useAncestors } from 'apps/experimental/features/libraries/hooks/api/useAncestors';
import { isDetailsPath, isLibraryPath } from 'apps/experimental/features/libraries/utils/path';
import { appRouter } from 'components/router/appRouter';
import { useUserViews } from 'hooks/api/useUserViews';
import { useApi } from 'hooks/useApi';
import useCurrentTab from 'hooks/useCurrentTab';
import { useWebConfig } from 'hooks/useWebConfig';

const MAX_PRIMARY_MD = 3;
const MAX_PRIMARY_LG = 5;
const MAX_PRIMARY_XL = 8;

/** Collection types that should never appear in the toolbar. */
const HIDDEN_COLLECTION_TYPES = new Set<CollectionType | undefined>([
    CollectionType.Boxsets
]);

/** Library IDs that should never appear in the toolbar. */
const HIDDEN_LIBRARY_IDS = new Set<string | undefined>([
    '6fa9075ab29759279bc3693634fbcd8f', // Animações
    'c12a47d03dabf0c86ff8f729f3383e68', // Brasil Paralelo
    '43523fdb3771e558099ea0fe01461dac', // Brasil Paralelo Séries
    'ce44083d624d539c463facd0dee2863f'  // Coleções
]);

const HOME_PATH = '/home';
const LIST_PATH = '/list';

const getCurrentUserView = (
    userViews: BaseItemDto[] | undefined,
    pathname: string,
    libraryId: string | null,
    collectionType: string | null,
    tab: number
) => {
    const isUserViewPath = isDetailsPath(pathname) || isLibraryPath(pathname) || [HOME_PATH, LIST_PATH].includes(pathname);
    if (!isUserViewPath) return undefined;

    if (collectionType === CollectionType.Livetv) {
        return userViews?.find(({ CollectionType: type }) => type === CollectionType.Livetv);
    }

    // eslint-disable-next-line sonarjs/different-types-comparison
    return userViews?.find(({ Id: id }) => id === libraryId);
};

const UserViewNav = () => {
    const location = useLocation();
    const [ searchParams ] = useSearchParams();
    const itemId = searchParams.get('id') || undefined;
    const libraryId = searchParams.get('topParentId') || searchParams.get('parentId');
    const collectionType = searchParams.get('collectionType');
    const { activeTab } = useCurrentTab();
    const { menuLinks } = useWebConfig();

    const isXl = useMediaQuery((t: Theme) => t.breakpoints.up('xl'));
    const isLg = useMediaQuery((t: Theme) => t.breakpoints.up('lg'));
    const primaryCount = useMemo(() => {
        const customLinks = (menuLinks || []).length;
        let max = MAX_PRIMARY_MD;
        if (isXl) max = MAX_PRIMARY_XL;
        else if (isLg) max = MAX_PRIMARY_LG;
        return max - customLinks;
    }, [ isXl, isLg, menuLinks ]);

    const { user } = useApi();
    const {
        data: userViews,
        isPending
    } = useUserViews({ userId: user?.Id });

    const navItems = useMemo(() => [
        ...(menuLinks || []),
        ...(userViews?.Items || [])
    ], [ menuLinks, userViews ]);

    const {
        data: ancestors
    } = useAncestors({ itemId });

    const ancestorLibraryId = useMemo(() => {
        return ancestors?.find(ancestor => ancestor.Type === BaseItemKind.CollectionFolder)?.Id || null;
    }, [ ancestors ]);

    const visibleViews = useMemo(() => (
        userViews?.Items
            ?.filter(view =>
                !HIDDEN_COLLECTION_TYPES.has(view.CollectionType as CollectionType)
                && !HIDDEN_LIBRARY_IDS.has(view.Id)
            )
            .slice(0, primaryCount) || []
    ), [ primaryCount, userViews ]);

    const currentUserView = useMemo(() => (
        getCurrentUserView(userViews?.Items, location.pathname, libraryId || ancestorLibraryId, collectionType, activeTab)
    ), [ activeTab, collectionType, libraryId, ancestorLibraryId, location.pathname, userViews ]);

    if (isPending) return null;

    return (
        <>
            {menuLinks?.map(link => (
                <Button
                    key={link.name}
                    variant='text'
                    color='inherit'
                    startIcon={<Icon>{link.icon || 'link'}</Icon>}
                    component='a'
                    href={link.url}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {link.name}
                </Button>
            ))}

            {visibleViews.map(view => (
                <Button
                    key={view.Id}
                    variant='text'
                    color='inherit'
                    sx={(view.Id === currentUserView?.Id) ? { backgroundColor: '#919191', '&:hover': { backgroundColor: '#919191' } } : undefined}
                    startIcon={<LibraryIcon item={view} />}
                    component={Link}
                    to={appRouter.getRouteUrl(view, { context: view.CollectionType }).substring(1)}
                >
                    {view.Name}
                </Button>
            ))}
        </>
    );
};

export default UserViewNav;
