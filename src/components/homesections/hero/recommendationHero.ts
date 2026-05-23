/**
 * Home Hero — recommendation carousel controller.
 *
 * Renders a full-width 70 vh hero section above the normal home sections.
 * Shows 7 personalised recommendations fetched once per session.
 * Each slide shows:
 *   - backdrop image (always)
 *   - inline muted video trailer (if a local trailer exists) after a short delay
 *   - title, overview snippet, "Watch Now" and "More Info" CTAs
 *   - dot indicators for position
 *
 * The section advances automatically:
 *   - with trailer: when the video ends (or after VIDEO_ADVANCE_MS as a safety cap)
 *   - without trailer: after IMAGE_DWELL_MS
 */

import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client/models/base-item-dto';
import type { ApiClient } from 'jellyfin-apiclient';

import globalize from 'lib/globalize';
import { ServerConnections } from 'lib/jellyfin-apiclient';
import { appRouter } from 'components/router/appRouter';
import { getItemBackdropImageUrl } from 'utils/jellyfin-apiclient/backdropImage';
import { buildHeroPool, clearShownHistory, HERO_POOL_SIZE } from './recommendationEngine';
import {
    addToWatchLater,
    fetchWatchLaterStatus,
    removeFromWatchLater
} from 'apps/experimental/features/watchlater/api';

import './recommendationHero.scss';

/** Milliseconds to dwell on a slide when there is no trailer. */
const IMAGE_DWELL_MS = 9000;
/** Maximum milliseconds before advancing even if the video has not ended. */
const VIDEO_ADVANCE_MS = 90_000;
/** Delay before the trailer starts playing after the backdrop appears. */
const TRAILER_START_DELAY_MS = 2500;

interface HeroState {
    items: BaseItemDto[];
    /** Session-stable start index (random, chosen once). */
    startIndex: number;
    /** Currently displayed index (0-based into items). */
    currentIndex: number;
    container: HTMLElement | null;
    advanceTimer: ReturnType<typeof setTimeout> | null;
    trailerTimer: ReturnType<typeof setTimeout> | null;
    video: HTMLVideoElement | null;
    destroyed: boolean;
}

const state: HeroState = {
    items: [],
    startIndex: 0,
    currentIndex: 0,
    container: null,
    advanceTimer: null,
    trailerTimer: null,
    video: null,
    destroyed: false
};

function clearTimers() {
    if (state.advanceTimer !== null) {
        clearTimeout(state.advanceTimer);
        state.advanceTimer = null;
    }
    if (state.trailerTimer !== null) {
        clearTimeout(state.trailerTimer);
        state.trailerTimer = null;
    }
}

function stopVideo() {
    if (state.video) {
        state.video.pause();
        state.video.src = '';
        state.video.load();
        state.video = null;
    }
}

/** Returns the absolute slide index for a given step from startIndex. */
function slideIndex(step: number): number {
    return (state.startIndex + step) % state.items.length;
}

/** Returns the URL for a local trailer video stream, or null. */
function getLocalTrailerUrl(apiClient: ApiClient, trailer: BaseItemDto): string | null {
    if (!trailer.Id) return null;
    // Jellyfin serves local trailers through the same stream endpoint as any
    // other video item.  The simplest direct-stream URL is:
    //   /Videos/{id}/stream?static=true&api_key=...
    // ApiClient.getUrl() prepends the server address and appends the token.
    return apiClient.getUrl(`Videos/${trailer.Id}/stream`, {
        static: true,
        api_key: apiClient.accessToken()
    });
}

/** Fetches the first local trailer for an item. Returns null if none. */
async function fetchTrailerUrl(
    apiClient: ApiClient,
    item: BaseItemDto
): Promise<string | null> {
    if (!item.Id || !(item.LocalTrailerCount ?? 0)) return null;
    try {
        const trailers = await apiClient.getLocalTrailers(
            apiClient.getCurrentUserId(),
            item.Id
        );
        if (trailers?.length) {
            return getLocalTrailerUrl(apiClient, trailers[0]);
        }
    } catch {
        // Swallow — fall back to image-only mode
    }
    return null;
}

/** Attaches horizontal swipe detection to the hero container. */
function attachSwipeHandler(container: HTMLElement) {
    let startX = 0;
    let startY = 0;

    container.addEventListener('touchstart', (e: TouchEvent) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchmove', (e: TouchEvent) => {
        const dx = Math.abs(e.touches[0].clientX - startX);
        const dy = Math.abs(e.touches[0].clientY - startY);
        // Só bloqueia o scroll da página se o gesto é predominantemente horizontal
        if (dx > dy && dx > 10) {
            e.preventDefault();
        }
    }, { passive: false });

    container.addEventListener('touchend', (e: TouchEvent) => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;

        if (!state.items.length) return;
        const relativeStep = (state.currentIndex - state.startIndex + state.items.length) % state.items.length;
        if (dx < 0) {
            // Swipe para esquerda → próximo slide
            goToStep((relativeStep + 1) % state.items.length);
        } else {
            // Swipe para direita → slide anterior
            goToStep((relativeStep - 1 + state.items.length) % state.items.length);
        }
    }, { passive: true });
}

/** Builds the hero DOM inside `container`. */
function renderHeroShell(container: HTMLElement) {
    container.innerHTML = `
        <div class="heroRecommendation">
            <div class="heroBackdrop"></div>
            <video class="heroVideo" muted playsinline preload="none"></video>
            <div class="heroGradient"></div>
            <div class="heroContent">
                <p class="heroSectionLabel">${globalize.translate('BasedOnWhatYouWatch')}</p>
                <h1 class="heroTitle"></h1>
                <p class="heroOverview"></p>
                <div class="heroCtas">
                    <button is="emby-button" class="raised button-submit heroWatchNow">
                        <span class="material-icons play_arrow" aria-hidden="true"></span>
                        <span>${globalize.translate('WatchNow')}</span>
                    </button>
                    <button is="emby-button" class="raised heroMoreInfo">
                        <span class="material-icons info" aria-hidden="true"></span>
                        <span>${globalize.translate('MoreInfo')}</span>
                    </button>
                    <button class="heroWatchLaterIcon" data-in-watch-later="false" aria-label="Assistir Mais Tarde" title="Assistir Mais Tarde">
                        <span class="material-icons">watch_later</span>
                    </button>
                </div>
            </div>
            <div class="heroDots"></div>
        </div>
    `;
}

/** Builds the dot indicators. */
function renderDots(container: HTMLElement, count: number, activeStep: number) {
    const dotsEl = container.querySelector<HTMLElement>('.heroDots');
    if (!dotsEl) return;
    let html = '';
    for (let i = 0; i < count; i++) {
        html += `<button class="heroDot${i === activeStep ? ' heroDot--active' : ''}" data-step="${i}" aria-label="${i + 1}"></button>`;
    }
    dotsEl.innerHTML = html;

    dotsEl.querySelectorAll<HTMLButtonElement>('.heroDot').forEach(btn => {
        btn.addEventListener('click', () => {
            const step = parseInt(btn.dataset.step ?? '0', 10);
            goToStep(step);
        });
    });
}

/** Navigates to a specific step (0-based position from startIndex). */
function goToStep(step: number) {
    clearTimers();
    stopVideo();
    const absoluteIndex = slideIndex(step);
    state.currentIndex = absoluteIndex;
    const relativeStep = step % state.items.length;
    showSlide(relativeStep);
}

function updateWatchLaterBtn(btn: HTMLButtonElement, inWatchLater: boolean) {
    btn.dataset.inWatchLater = String(inWatchLater);
    const iconEl = btn.querySelector<HTMLElement>('.material-icons');
    if (iconEl) iconEl.textContent = inWatchLater ? 'check_circle' : 'watch_later';
    btn.classList.toggle('heroWatchLaterIcon--active', inWatchLater);
    btn.title = inWatchLater ? 'Remover da lista' : 'Assistir Mais Tarde';
    btn.setAttribute('aria-label', inWatchLater ? 'Remover da lista' : 'Assistir Mais Tarde');
}

/** Shows the slide at the given step relative to startIndex. */
async function showSlide(step: number) {
    if (state.destroyed || !state.container) return;

    const absoluteIndex = slideIndex(step);
    state.currentIndex = absoluteIndex;
    const item = state.items[absoluteIndex];
    if (!item) return;

    const apiClient = ServerConnections.currentApiClient();
    if (!apiClient) return;

    // -- Backdrop --
    const backdropEl = state.container.querySelector<HTMLElement>('.heroBackdrop');
    if (backdropEl) {
        const backdropUrl = getItemBackdropImageUrl(apiClient, item, {
            maxWidth: 1920,
            quality: 85
        });
        backdropEl.style.backgroundImage = backdropUrl ? `url("${backdropUrl}")` : 'none';
    }

    // -- Text --
    const titleEl = state.container.querySelector<HTMLElement>('.heroTitle');
    const overviewEl = state.container.querySelector<HTMLElement>('.heroOverview');
    if (titleEl) titleEl.textContent = item.Name ?? '';
    if (overviewEl) {
        const overview = item.Overview ?? '';
        overviewEl.textContent = overview.length > 200
            ? overview.substring(0, 197) + '...'
            : overview;
    }

    // -- CTAs --
    const watchNowBtn = state.container.querySelector<HTMLButtonElement>('.heroWatchNow');
    const moreInfoBtn = state.container.querySelector<HTMLButtonElement>('.heroMoreInfo');

    if (watchNowBtn) {
        watchNowBtn.onclick = () => {
            appRouter.showItem(item, { context: 'home' });
        };
    }
    if (moreInfoBtn) {
        moreInfoBtn.onclick = () => {
            appRouter.showItem(item, { context: 'home' });
        };
    }

    // -- Watch Later --
    const watchLaterBtn = state.container.querySelector<HTMLButtonElement>('.heroWatchLaterIcon');
    if (watchLaterBtn && item.Id) {
        const itemId = item.Id;

        // Fetch current status asynchronously and reflect on the button
        fetchWatchLaterStatus(itemId).then(({ inWatchLater }) => {
            if (state.currentIndex !== absoluteIndex || !watchLaterBtn) return;
            updateWatchLaterBtn(watchLaterBtn, inWatchLater);
        }).catch(() => { /* keep default state */ });

        watchLaterBtn.onclick = async () => {
            const isIn = watchLaterBtn.dataset.inWatchLater === 'true';
            try {
                if (isIn) {
                    await removeFromWatchLater(itemId);
                    updateWatchLaterBtn(watchLaterBtn, false);
                } else {
                    await addToWatchLater({
                        item_id: itemId,
                        item_title: item.Name ?? '',
                        item_type: item.Type ?? undefined,
                        item_year: item.ProductionYear ?? undefined
                    });
                    updateWatchLaterBtn(watchLaterBtn, true);
                }
            } catch {
                // Silently ignore — user feedback not required for a secondary action
            }
        };
    }

    // -- Dots --
    renderDots(state.container, state.items.length, step);

    // -- Fade in the backdrop --
    const hero = state.container.querySelector<HTMLElement>('.heroRecommendation');
    if (hero) {
        hero.classList.remove('heroRecommendation--ready');
        // Trigger reflow so the class removal is noticed before re-adding
        void hero.offsetWidth;
        hero.classList.add('heroRecommendation--ready');
    }

    // -- Trailer (deferred) --
    const videoEl = state.container.querySelector<HTMLVideoElement>('.heroVideo');

    state.trailerTimer = setTimeout(async () => {
        if (state.destroyed) return;
        const trailerUrl = await fetchTrailerUrl(apiClient, item);
        if (state.destroyed || state.currentIndex !== absoluteIndex) return;

        if (trailerUrl && videoEl) {
            state.video = videoEl;
            videoEl.src = trailerUrl;
            videoEl.classList.add('heroVideo--visible');

            const onEnded = () => {
                videoEl.classList.remove('heroVideo--visible');
                state.video = null;
                advanceSlide(step);
            };
            videoEl.addEventListener('ended', onEnded, { once: true });

            videoEl.play().catch(() => {
                // Autoplay blocked — fall back to image dwell
                videoEl.classList.remove('heroVideo--visible');
                state.video = null;
                scheduleAdvance(step, IMAGE_DWELL_MS);
            });

            // Safety cap in case the video never ends
            state.advanceTimer = setTimeout(() => {
                videoEl.removeEventListener('ended', onEnded);
                stopVideo();
                advanceSlide(step);
            }, VIDEO_ADVANCE_MS);
        } else {
            // No trailer — use image dwell
            scheduleAdvance(step, IMAGE_DWELL_MS);
        }
    }, TRAILER_START_DELAY_MS);
}

function scheduleAdvance(currentStep: number, delayMs: number) {
    state.advanceTimer = setTimeout(() => advanceSlide(currentStep), delayMs);
}

function advanceSlide(currentStep: number) {
    clearTimers();
    stopVideo();
    const nextStep = (currentStep + 1) % state.items.length;
    showSlide(nextStep);
}

/** Public API — called from hometab.js. */
export async function loadHero(
    parentElem: HTMLElement,
    apiClient: ApiClient
): Promise<void> {
    state.destroyed = false;

    // Create and insert the hero container before the .sections div
    const heroContainer = document.createElement('div');
    heroContainer.className = 'heroRecommendationContainer';
    parentElem.insertAdjacentElement('beforebegin', heroContainer);
    state.container = heroContainer;

    renderHeroShell(heroContainer);
    attachSwipeHandler(heroContainer);

    // Show a loading state until data arrives
    heroContainer.classList.add('heroRecommendationContainer--loading');

    let items: BaseItemDto[];
    try {
        items = await buildHeroPool(apiClient);
    } catch (err) {
        console.error('[Hero] Failed to build recommendation pool', err);
        heroContainer.remove();
        state.container = null;
        return;
    }

    if (!items.length) {
        heroContainer.remove();
        state.container = null;
        return;
    }

    heroContainer.classList.remove('heroRecommendationContainer--loading');

    state.items = items;
    state.startIndex = Math.floor(Math.random() * items.length);

    // Show the first slide (step 0 = startIndex)
    showSlide(0);
}

/** Pause auto-advance (called when the tab loses focus / page pauses). */
export function pauseHero() {
    clearTimers();
    stopVideo();
}

/** Resume auto-advance (called when the tab regains focus). */
export function resumeHero() {
    if (!state.items.length || state.destroyed) return;
    const relativeStep = (state.currentIndex - state.startIndex + HERO_POOL_SIZE) % state.items.length;
    scheduleAdvance(relativeStep, IMAGE_DWELL_MS);
}

/** Destroy the hero and remove it from the DOM. */
export function destroyHero() {
    state.destroyed = true;
    clearTimers();
    stopVideo();
    if (state.container) {
        state.container.remove();
        state.container = null;
    }
    state.items = [];
    // Clear session shown-IDs so a fresh hero load (e.g. after re-login) starts clean
    clearShownHistory();
}
