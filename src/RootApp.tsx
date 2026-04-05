import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { ApiProvider } from 'hooks/useApi';
import { UserSettingsProvider } from 'hooks/useUserSettings';
import { WebConfigProvider } from 'hooks/useWebConfig';
import browser from 'scripts/browser';
import { queryClient } from 'utils/query/queryClient';

import RootAppRouter from 'RootAppRouter';

// Devtools are only loaded in development builds; the dynamic import is
// dead-code-eliminated by webpack when NODE_ENV === 'production'.
const ReactQueryDevtools = process.env.NODE_ENV !== 'production'
    ? React.lazy(() =>
        import('@tanstack/react-query-devtools').then(m => ({ default: m.ReactQueryDevtools }))
    )
    : null;

const useReactQueryDevtools = process.env.NODE_ENV !== 'production'
    && window.Proxy // '@tanstack/query-devtools' requires 'Proxy', which cannot be polyfilled for legacy browsers
    && !browser.tv; // Don't use devtools on the TV as the navigation is weird

const RootApp = () => (
    <QueryClientProvider client={queryClient}>
        <ApiProvider>
            <UserSettingsProvider>
                <WebConfigProvider>
                    <RootAppRouter />
                </WebConfigProvider>
            </UserSettingsProvider>
        </ApiProvider>
        {useReactQueryDevtools && ReactQueryDevtools && (
            <React.Suspense fallback={null}>
                <ReactQueryDevtools initialIsOpen={false} />
            </React.Suspense>
        )}
    </QueryClientProvider>
);

export default RootApp;
