/* eslint-disable compat/compat */
function getApiClient(serverId) {
    return Promise.resolve(window.connectionManager.getApiClient(serverId));
}

function executeAction(action, data, serverId) {
    return getApiClient(serverId).then(function (apiClient) {
        switch (action) {
            case 'cancel-install':
                return apiClient.cancelPackageInstallation(data.id);
            case 'restart':
                return apiClient.restartServer();
            default:
                clients.openWindow('/');
                return Promise.resolve();
        }
    });
}

/* eslint-disable-next-line no-restricted-globals -- self is valid in a serviceworker environment */
self.addEventListener('notificationclick', function (event) {
    const notification = event.notification;
    notification.close();

    const data = notification.data;
    const serverId = data.serverId;
    const action = event.action;

    if (!action) {
        clients.openWindow('/');
        event.waitUntil(Promise.resolve());
        return;
    }

    event.waitUntil(executeAction(action, data, serverId));
}, false);

/* eslint-disable-next-line no-restricted-globals -- self is valid in a serviceworker environment */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => !ALL_CACHE_NAMES.includes(k)).map((k) => caches.delete(k))
            );
        }).then(() => {
            /* eslint-disable-next-line no-restricted-globals -- self is valid in a serviceworker environment */
            return self.clients.claim();
        })
    );
});

const IMAGE_CACHE_NAME = 'jf-images-v1';
const ALL_CACHE_NAMES = [IMAGE_CACHE_NAME];
const IMAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_IMAGE_ENTRIES = 300;
const EVICT_COUNT = 50;

function isImageRequest(url) {
    return (url.includes('/Items/') && url.includes('/Images/'))
        || (url.includes('/Users/') && url.includes('/Images/'));
}

function shouldHandleFetch(request) {
    if (request.method !== 'GET') {
        return false;
    }
    return isImageRequest(request.url);
}

function cleanOldCacheEntries(cache) {
    cache.keys().then((keys) => {
        if (keys.length > MAX_IMAGE_ENTRIES) {
            const keysToDelete = keys.slice(0, EVICT_COUNT);
            keysToDelete.forEach((key) => {
                cache.delete(key);
            });
        }
    });
}

function cacheImageResponse(request, response) {
    if (!response || response.status !== 200) {
        return response;
    }
    const responseToCache = response.clone();
    const responseToReturn = response.clone();

    responseToCache.blob().then((blob) => {
        const headers = new Headers(responseToCache.headers);
        headers.set('x-sw-cached-at', String(Date.now()));
        const cachedResponse = new Response(blob, {
            status: responseToCache.status,
            statusText: responseToCache.statusText,
            headers: headers
        });

        caches.open(IMAGE_CACHE_NAME).then((cache) => {
            cache.put(request, cachedResponse).then(() => {
                cleanOldCacheEntries(cache);
            });
        });
    }).catch(() => {
        // Fallback: if blob conversion fails, cache the clone directly
        caches.open(IMAGE_CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
        });
    });

    return responseToReturn;
}

/* eslint-disable-next-line no-restricted-globals -- self is valid in a serviceworker environment */
self.addEventListener('fetch', (event) => {
    if (!shouldHandleFetch(event.request)) {
        return;
    }

    event.respondWith(
        caches.open(IMAGE_CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    const cachedAt = cachedResponse.headers.get('x-sw-cached-at');
                    if (cachedAt) {
                        const age = Date.now() - parseInt(cachedAt, 10);
                        if (age < IMAGE_TTL_MS) {
                            return cachedResponse;
                        }
                    } else {
                        // Fallback if cachedAt header is missing
                        return cachedResponse;
                    }
                }

                return fetch(event.request).then((networkResponse) => {
                    return cacheImageResponse(event.request, networkResponse);
                }).catch(() => {
                    // If network fails, return cached response (even if expired/stale) as fallback
                    return cachedResponse;
                });
            });
        })
    );
});

/* eslint-enable compat/compat */
