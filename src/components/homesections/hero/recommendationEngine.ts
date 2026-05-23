/**
 * Hero Recommendation Engine
 *
 * Builds a pool of 7 personalised recommendations for the home hero section.
 * Strategy:
 *   1. Fetch recently played items (DatePlayed desc) to understand taste.
 *   2. Flatten Episodes → their Series so the hero shows shows, not episodes.
 *   3. Fetch movie recommendations via MoviesApi.getMovieRecommendations.
 *   4. Fetch similar series via LibraryApi.getSimilarItems for recently played series.
 *   5. Prefer items that have a backdrop image.
 *   6. Prefer items that have at least one local trailer (LocalTrailerCount > 0).
 *   7. De-duplicate by Id / SeriesId, and de-duplicate against previously shown items
 *      (tracked in sessionStorage) to avoid repeating recommendations.
 *   8. Fill 5 slots with the highest-scoring personalised picks.
 *   9. Fill the remaining 2 slots with completely random library items not already chosen.
 *  10. Return the final 7-item array in shuffled order.
 */

import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { ApiClient } from 'jellyfin-apiclient';
import { ItemFields } from '@jellyfin/sdk/lib/generated-client/models/item-fields';
import { ItemSortBy } from '@jellyfin/sdk/lib/generated-client/models/item-sort-by';
import { SortOrder } from '@jellyfin/sdk/lib/generated-client/models/sort-order';
import { getItemsApi } from '@jellyfin/sdk/lib/utils/api/items-api';
import { getMoviesApi } from '@jellyfin/sdk/lib/utils/api/movies-api';
import { getLibraryApi } from '@jellyfin/sdk/lib/utils/api/library-api';
import { toApi } from 'utils/jellyfin-apiclient/compat';

export const HERO_POOL_SIZE = 7;
/** Number of the 7 slots filled with scored/personalised picks. */
const PERSONALISED_SLOTS = 5;
/** Number of the 7 slots filled with random library items. */
const RANDOM_SLOTS = HERO_POOL_SIZE - PERSONALISED_SLOTS;

/** sessionStorage key that tracks item IDs already shown this session. */
const SESSION_SHOWN_KEY = 'heroShownIds';

interface HeroPoolCache {
    items: BaseItemDto[];
    builtAt: number;
    userId: string;
}
let poolCache: HeroPoolCache | null = null;
const POOL_CACHE_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Session-level deduplication helpers
// ---------------------------------------------------------------------------

/** Reads the set of IDs already shown this browser session. */
function getShownIds(): Set<string> {
    try {
        const raw = sessionStorage.getItem(SESSION_SHOWN_KEY);
        if (raw) {
            return new Set<string>(JSON.parse(raw) as string[]);
        }
    } catch {
        // Ignore parse or access errors
    }
    return new Set<string>();
}

/** Persists a new batch of shown IDs into sessionStorage. */
export function markItemsAsShown(ids: string[]): void {
    try {
        const current = getShownIds();
        for (const id of ids) current.add(id);
        sessionStorage.setItem(SESSION_SHOWN_KEY, JSON.stringify([...current]));
    } catch {
        // Ignore storage quota / access errors
    }
}

/** Clears the session shown-IDs record (call on hero destroy / user logout). */
export function clearShownHistory(): void {
    try {
        sessionStorage.removeItem(SESSION_SHOWN_KEY);
    } catch {
        // Ignore
    }
    poolCache = null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Shallow fisher-yates shuffle (mutates and returns the array). */
function shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/** Score an item — higher is better for the hero slot. */
function score(item: BaseItemDto): number {
    let s = 0;
    if (item.BackdropImageTags?.length) s += 2;
    if ((item.LocalTrailerCount ?? 0) > 0) s += 3;
    if (item.CommunityRating && item.CommunityRating >= 7) s += 1;
    return s;
}

/** De-duplicate a list by Id and SeriesId. */
function dedup(items: BaseItemDto[]): BaseItemDto[] {
    const seen = new Set<string>();
    const result: BaseItemDto[] = [];
    for (const item of items) {
        const key = item.SeriesId ?? item.Id ?? '';
        if (!key || seen.has(key)) continue;
        seen.add(key);
        result.push(item);
    }
    return result;
}

/** Remove items whose Id (or SeriesId) is present in the `exclude` set. */
function excludeShown(items: BaseItemDto[], exclude: Set<string>): BaseItemDto[] {
    return items.filter(item => {
        const key = item.SeriesId ?? item.Id ?? '';
        return key && !exclude.has(key);
    });
}

// ---------------------------------------------------------------------------
// Data-fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetches recently played items and resolves Episodes to their parent Series.
 * Returns up to `limit` unique Series/Movie items.
 */
async function fetchRecentHistory(
    apiClient: ApiClient,
    userId: string,
    limit: number
): Promise<BaseItemDto[]> {
    const api = toApi(apiClient);
    const response = await getItemsApi(api).getItems({
        userId,
        sortBy: [ItemSortBy.DatePlayed],
        sortOrder: [SortOrder.Descending],
        recursive: true,
        includeItemTypes: ['Movie', 'Episode'],
        fields: [
            ItemFields.PrimaryImageAspectRatio,
            ItemFields.Overview,
            ItemFields.Genres
        ],
        imageTypeLimit: 1,
        enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
        enableTotalRecordCount: false,
        limit: limit * 3 // fetch more to account for dedup
    });

    const items = response.data.Items ?? [];

    // Resolve episodes to series stubs (only id + seriesId fields available here)
    const seriesIdSet = new Set<string>();
    const resolved: BaseItemDto[] = [];

    for (const item of items) {
        if (item.Type === 'Episode' && item.SeriesId) {
            if (!seriesIdSet.has(item.SeriesId)) {
                seriesIdSet.add(item.SeriesId);
                resolved.push({
                    Id: item.SeriesId,
                    Name: item.SeriesName ?? item.Name,
                    Type: 'Series',
                    BackdropImageTags: item.ParentBackdropImageTags,
                    ParentBackdropImageTags: item.ParentBackdropImageTags,
                    ParentBackdropItemId: item.ParentBackdropItemId,
                    ImageTags: item.SeriesThumbImageTag
                        ? { Thumb: item.SeriesThumbImageTag }
                        : undefined,
                    Overview: item.Overview,
                    Genres: item.Genres,
                    ServerId: item.ServerId
                } as BaseItemDto);
            }
        } else if (item.Type === 'Movie') {
            resolved.push(item);
        }
    }

    return resolved.slice(0, limit);
}

/**
 * Fetches movie recommendations via MoviesApi and returns items from all
 * recommendation categories flattened into a single list.
 */
async function fetchMovieRecommendations(
    apiClient: ApiClient,
    userId: string
): Promise<BaseItemDto[]> {
    const api = toApi(apiClient);
    const response = await getMoviesApi(api).getMovieRecommendations({
        userId,
        fields: [
            ItemFields.PrimaryImageAspectRatio,
            ItemFields.Overview,
            ItemFields.Genres
        ],
        categoryLimit: 5,
        itemLimit: 8
    });

    const categories = response.data ?? [];
    const items: BaseItemDto[] = [];
    for (const category of categories) {
        if (category.Items) {
            items.push(...category.Items);
        }
    }
    return items;
}

/**
 * Fetches similar items for a recently watched series/movie.
 * Returns up to `perItem` results.
 */
async function fetchSimilarItems(
    apiClient: ApiClient,
    userId: string,
    itemId: string,
    perItem: number
): Promise<BaseItemDto[]> {
    const api = toApi(apiClient);
    try {
        const response = await getLibraryApi(api).getSimilarItems({
            itemId,
            userId,
            limit: perItem,
            fields: [
                ItemFields.PrimaryImageAspectRatio,
                ItemFields.Overview,
                ItemFields.Genres
            ]
        });
        return response.data.Items ?? [];
    } catch {
        return [];
    }
}

/**
 * Fetches a random sample of library items (Movies and Series) that have a
 * backdrop image.  Used to fill the RANDOM_SLOTS positions in the hero pool.
 *
 * We request a larger set and then randomly select from it so that successive
 * calls yield different results even within the same session.
 */
async function fetchRandomLibraryItems(
    apiClient: ApiClient,
    userId: string,
    count: number,
    exclude: Set<string>
): Promise<BaseItemDto[]> {
    const api = toApi(apiClient);
    try {
        // Request a generous candidate window; Jellyfin's random sort returns a
        // different subset each time, giving us natural variety.
        const response = await getItemsApi(api).getItems({
            userId,
            sortBy: [ItemSortBy.Random],
            recursive: true,
            includeItemTypes: ['Movie', 'Series'],
            fields: [
                ItemFields.PrimaryImageAspectRatio,
                ItemFields.Overview,
                ItemFields.Genres
            ],
            imageTypeLimit: 1,
            enableImageTypes: ['Primary', 'Backdrop', 'Thumb'],
            enableTotalRecordCount: false,
            // Fetch a wider window so filtering by image / dedup still leaves enough
            limit: Math.max(count * 4, 12)
        });

        const candidates = response.data.Items ?? [];

        // Keep only items with a usable image and not already in our pool
        const filtered = candidates.filter(item => {
            const key = item.SeriesId ?? item.Id ?? '';
            if (!key || exclude.has(key)) return false;
            return (
                (item.BackdropImageTags?.length ?? 0) > 0
                || (item.ParentBackdropImageTags?.length ?? 0) > 0
                || item.ImageTags?.Primary
            );
        });

        // Shuffle again for extra randomness and return the desired count
        return shuffle(filtered).slice(0, count);
    } catch {
        return [];
    }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Returns a shuffled array of exactly HERO_POOL_SIZE (7) items:
 *   - PERSONALISED_SLOTS (5) highest-scoring personalised picks
 *   - RANDOM_SLOTS (2) completely random library items
 *
 * Items that have already been shown this browser session (tracked via
 * sessionStorage) are excluded so the same content is never repeated.
 */
export async function buildHeroPool(
    apiClient: ApiClient
): Promise<BaseItemDto[]> {
    const userId = apiClient.getCurrentUserId();
    if (poolCache && poolCache.userId === userId && Date.now() - poolCache.builtAt < POOL_CACHE_TTL_MS) {
        return poolCache.items;
    }
    const shownIds = getShownIds();

    // --- Personalised candidates ---
    const [history, movieRecs] = await Promise.all([
        fetchRecentHistory(apiClient, userId, 10),
        fetchMovieRecommendations(apiClient, userId)
    ]);

    const similarPromises = history
        .slice(0, 3)
        .filter(item => item.Id)
        .map(item => fetchSimilarItems(apiClient, userId, item.Id!, 5));

    const similarResults = await Promise.all(similarPromises);
    const similar = similarResults.flat();

    // Combine, dedup by id/seriesId, then remove already-shown items
    const personalisedRaw = excludeShown(
        dedup([...history, ...movieRecs, ...similar]),
        shownIds
    );

    // Filter to items with at least one image
    const personalisedWithImage = personalisedRaw.filter(item =>
        (item.BackdropImageTags?.length ?? 0) > 0
        || (item.ParentBackdropImageTags?.length ?? 0) > 0
        || item.ImageTags?.Primary
    );

    // Sort by score and take the best PERSONALISED_SLOTS items
    personalisedWithImage.sort((a, b) => score(b) - score(a));
    const personalisedPicks = personalisedWithImage.slice(0, PERSONALISED_SLOTS);

    // Build exclusion set for the random fetch (already-shown + just-picked)
    const pickedIds = new Set<string>(shownIds);
    for (const item of personalisedPicks) {
        const key = item.SeriesId ?? item.Id ?? '';
        if (key) pickedIds.add(key);
    }

    // --- Random candidates ---
    const randomPicks = await fetchRandomLibraryItems(
        apiClient,
        userId,
        RANDOM_SLOTS,
        pickedIds
    );

    // --- Merge and shuffle the final pool ---
    const finalPool = shuffle([...personalisedPicks, ...randomPicks]);

    // Mark all chosen IDs as shown for the rest of this session
    const chosenIds = finalPool
        .map(item => item.SeriesId ?? item.Id ?? '')
        .filter(Boolean);
    markItemsAsShown(chosenIds);

    poolCache = { items: finalPool, builtAt: Date.now(), userId };

    return finalPool;
}
