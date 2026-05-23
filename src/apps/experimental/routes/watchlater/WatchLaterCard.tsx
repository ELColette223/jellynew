import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import React, { type FC } from 'react';

import CardBox from 'components/cardbuilder/Card/CardBox';
import useCard from 'components/cardbuilder/Card/useCard';
import type { CardOptions } from 'types/cardOptions';
import type { ItemDto } from 'types/base/models/item-dto';

import './watchLaterCard.scss';

interface WatchLaterCardProps {
    item: ItemDto;
    cardOptions: CardOptions;
    onRemove: () => void;
    isRemoving: boolean;
}

const WatchLaterCard: FC<WatchLaterCardProps> = ({ item, cardOptions, onRemove, isRemoving }) => {
    const { getCardWrapperProps, getCardBoxProps } = useCard({ item, cardOptions });
    const { className, dataAttributes } = getCardWrapperProps();
    const cardBoxProps = getCardBoxProps();

    return (
        <div className={`${className} watchLaterCard`} {...dataAttributes}>
            <CardBox {...cardBoxProps} />
            <Tooltip title='Remover da lista'>
                <IconButton
                    size='small'
                    aria-label='Remover da lista'
                    disabled={isRemoving}
                    onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove();
                    }}
                    className='watchLaterRemoveBtn'
                >
                    <CloseIcon sx={{ fontSize: '0.95rem' }} />
                </IconButton>
            </Tooltip>
        </div>
    );
};

export default WatchLaterCard;
