import WatchLaterIcon from '@mui/icons-material/WatchLater';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import React, { useMemo } from 'react';

import Page from 'components/Page';
import { CardShape } from 'components/cardbuilder/utils/shape';
import { setCardData } from 'components/cardbuilder/cardBuilder';
import ItemsContainer from 'elements/emby-itemscontainer/ItemsContainer';
import { useApi } from 'hooks/useApi';
import type { CardOptions } from 'types/cardOptions';
import type { ItemDto } from 'types/base/models/item-dto';

import {
    useRemoveFromWatchLater,
    useWatchLater
} from '../../features/watchlater/hooks/useWatchLater';
import WatchLaterCard from './WatchLaterCard';

import 'components/cardbuilder/card.scss';

const WatchLaterPage: React.FC = () => {
    const { api, user, __legacyApiClient__ } = useApi();
    const { data: watchLaterItems, isLoading: isLoadingList } = useWatchLater();
    const removeMutation = useRemoveFromWatchLater();

    const itemIds = useMemo(
        () => watchLaterItems?.map(i => i.item_id) ?? [],
        [watchLaterItems]
    );

    const { data: jellyfinItems, isLoading: isLoadingItems } = useQuery({
        queryKey: ['watchlater-jellyfin-items', itemIds],
        queryFn: async () => {
            const response = await getItemsApi(api!).getItems({
                userId: user!.Id!,
                ids: itemIds,
                fields: [
                    ItemFields.Overview,
                    ItemFields.PrimaryImageAspectRatio
                ]
            });
            return response.data.Items ?? [];
        },
        enabled: !!api && !!user?.Id && itemIds.length > 0
    });

    const items = jellyfinItems ?? [];

    const cardOptions = useMemo<CardOptions>(() => {
        const opts: CardOptions = {
            shape: CardShape.Portrait,
            showTitle: true,
            showYear: true,
            overlayPlayButton: true,
            centerText: true,
            coverImage: true,
            cardLayout: false,
            serverId: __legacyApiClient__?.serverId()
        };
        if (items.length > 0) {
            setCardData(items as ItemDto[], opts);
        }
        return opts;
    }, [items, __legacyApiClient__]);

    const isLoading = isLoadingList || (itemIds.length > 0 && isLoadingItems);
    const isEmpty = !isLoading && itemIds.length === 0;

    return (
        <Page id='watchLaterPage' className='mainAnimatedPage'>
            <Container maxWidth={false} sx={{ py: 4, pt: '10vh', px: { xs: 2, sm: 3 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                    <Typography variant='h5' component='h1'>
                        Assistir Mais Tarde
                    </Typography>
                </Box>

                {isLoading && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
                        <CircularProgress />
                    </Box>
                )}

                {isEmpty && (
                    <Alert severity='info' sx={{ maxWidth: 520 }}>
                        Sua lista está vazia. Use o ícone{' '}
                        <WatchLaterIcon sx={{ fontSize: '1em', verticalAlign: 'middle' }} />{' '}
                        em um conteúdo para adicioná-lo aqui.
                    </Alert>
                )}

                {!isLoading && items.length > 0 && (
                    <ItemsContainer className='vertical-wrap padded-left padded-right'>
                        {items.map(item => (
                            <WatchLaterCard
                                key={item.Id}
                                item={item as ItemDto}
                                cardOptions={cardOptions}
                                onRemove={() => item.Id && removeMutation.mutate(item.Id)}
                                isRemoving={removeMutation.isPending}
                            />
                        ))}
                    </ItemsContainer>
                )}
            </Container>
        </Page>
    );
};

export default WatchLaterPage;
