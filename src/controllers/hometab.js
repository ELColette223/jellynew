import * as userSettings from '../scripts/settings/userSettings';
import focusManager from '../components/focusManager';
import homeSections from '../components/homesections/homesections';
import { loadHero, pauseHero, destroyHero } from '../components/homesections/hero/recommendationHero';
import { ServerConnections } from 'lib/jellyfin-apiclient';

import '../elements/emby-itemscontainer/emby-itemscontainer';

class HomeTab {
    constructor(view, params) {
        this.view = view;
        this.params = params;
        this.apiClient = ServerConnections.currentApiClient();
        this.sectionsContainer = view.querySelector('.sections');
        view.querySelector('.sections').addEventListener('settingschange', onHomeScreenSettingsChanged.bind(this));
    }
    onResume(options) {
        if (this.sectionsRendered) {
            const sectionsContainer = this.sectionsContainer;

            if (sectionsContainer) {
                return homeSections.resume(sectionsContainer, options);
            }

            return Promise.resolve();
        }

        const view = this.view;
        const apiClient = this.apiClient;
        this.destroyHomeSections();
        this.sectionsRendered = true;

        const sectionsElem = view.querySelector('.sections');

        // Load the hero recommendation section above the normal sections
        if (apiClient) {
            loadHero(sectionsElem, apiClient).catch(err => {
                console.error('[HomeTab] Hero load failed', err);
            });
        }

        return apiClient.getCurrentUser()
            .then(user => homeSections.loadSections(sectionsElem, apiClient, user, userSettings))
            .then(() => {
                if (options.autoFocus) {
                    focusManager.autoFocus(view);
                }
            }).catch(err => {
                console.error(err);
            });
    }
    onPause() {
        const sectionsContainer = this.sectionsContainer;

        if (sectionsContainer) {
            homeSections.pause(sectionsContainer);
        }

        pauseHero();
    }
    destroy() {
        this.view = null;
        this.params = null;
        this.apiClient = null;
        destroyHero();
        this.destroyHomeSections();
        this.sectionsContainer = null;
    }
    destroyHomeSections() {
        const sectionsContainer = this.sectionsContainer;

        if (sectionsContainer) {
            homeSections.destroySections(sectionsContainer);
        }
    }
}

function onHomeScreenSettingsChanged() {
    this.sectionsRendered = false;

    if (!this.paused) {
        this.onResume({
            refresh: true
        });
    }
}

export default HomeTab;
