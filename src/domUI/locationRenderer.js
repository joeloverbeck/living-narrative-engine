// src/domUI/locationRenderer.js
// --- FILE START ---
import {BoundDomRendererBase} from './boundDomRendererBase.js';
import {DomUtils} from './domUtils.js';
import {
    // POSITION_COMPONENT_ID, // No longer directly used for current location logic
    // NAME_COMPONENT_ID, // Handled by EntityDisplayDataProvider
    // DESCRIPTION_COMPONENT_ID, // Handled by EntityDisplayDataProvider
    // EXITS_COMPONENT_ID, // Handled by EntityDisplayDataProvider
    ACTOR_COMPONENT_ID // Still needed to filter characters
    // PORTRAIT_COMPONENT_ID might be implicitly used by EntityDisplayDataProvider
} from '../constants/componentIds.js';

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../services/EntityDisplayDataProvider.js').EntityDisplayDataProvider} EntityDisplayDataProvider
 * @typedef {import('../core/interfaces/IDataRegistry').IDataRegistry} IDataRegistry
 */

/**
 * @typedef {object} CoreTurnStartedPayload
 * @property {import('../core/interfaces/CommonTypes').NamespacedId} entityId
 * @property {'player'|'ai'} entityType
 */

/**
 * @typedef {import('../core/interfaces/IEvent.js').IEvent<CoreTurnStartedPayload>} CoreTurnStartedEvent
 */

/**
 * Represents a character to be displayed.
 * @typedef {import('../services/EntityDisplayDataProvider.js').CharacterDisplayInfo} CharacterDisplayData
 */

/**
 * Represents the data structure for displaying a location.
 * @typedef {object} LocationDisplayPayload
 * @property {string} name - The name of the location.
 * @property {string} description - The textual description of the location.
 * @property {string | null} [portraitPath] - Optional path to the location's portrait image.
 * @property {string | null} [portraitAltText] - Optional alt text for the location's portrait.
 * @property {Array<import('../services/EntityDisplayDataProvider.js').ProcessedExit>} exits - List of exits from the location.
 * @property {Array<CharacterDisplayData>} characters - List of characters present in the location.
 */

const DEFAULT_LOCATION_NAME = 'Unknown Location';
const DEFAULT_LOCATION_DESCRIPTION = 'You see nothing remarkable.';

/**
 * Renders details of the current location, including its name, description, exits, and characters.
 * It extends BoundDomRendererBase to manage its DOM sub-elements and uses EntityDisplayDataProvider
 * for fetching display data.
 * @extends {BoundDomRendererBase}
 */
export class LocationRenderer extends BoundDomRendererBase {
    /** @private @type {HTMLElement} */
    baseContainerElement;
    /** @private @type {DomElementFactory} */
    domElementFactory;
    /** @private @type {IEntityManager} */
    entityManager;
    /** @private @type {EntityDisplayDataProvider} */
    entityDisplayDataProvider;
    /** @private @type {IDataRegistry | undefined} */
    dataRegistry;

    /** @private @readonly */
    _EVENT_TYPE_SUBSCRIBED = 'core:turn_started';

    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    entityManager,
                    entityDisplayDataProvider,
                    dataRegistry,
                    containerElement
                }) {
        const elementsConfig = {
            nameDisplay: {selector: '#location-name-display', required: true},
            // NEW: Add location portrait elements
            locationPortraitVisualsElement: {selector: '#location-portrait-visuals', required: true},
            locationPortraitImageElement: {
                selector: '#location-portrait-image',
                required: true,
                expectedType: HTMLImageElement
            },
            descriptionDisplay: {selector: '#location-description-display', required: true},
            exitsDisplay: {selector: '#location-exits-display', required: true},
            charactersDisplay: {selector: '#location-characters-display', required: true}
        };

        super({logger, documentContext, validatedEventDispatcher, elementsConfig});

        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.domElementFactory = domElementFactory;

        if (!entityManager || typeof entityManager.getEntitiesInLocation !== 'function') {
            const errMsg = `${this._logPrefix} 'entityManager' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.entityManager = entityManager;

        if (!entityDisplayDataProvider ||
            typeof entityDisplayDataProvider.getLocationDetails !== 'function' ||
            typeof entityDisplayDataProvider.getEntityLocationId !== 'function' ||
            // Assume a new method will be added to EntityDisplayDataProvider
            typeof entityDisplayDataProvider.getLocationPortraitData !== 'function' // IMPORTANT ASSUMPTION
        ) {
            const errMsg = `${this._logPrefix} 'entityDisplayDataProvider' dependency is missing or invalid (must include getLocationDetails, getEntityLocationId, and a new getLocationPortraitData).`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.entityDisplayDataProvider = entityDisplayDataProvider;

        if (dataRegistry) {
            this.dataRegistry = dataRegistry;
        } else {
            this.logger.warn(`${this._logPrefix} 'dataRegistry' dependency is missing.`);
        }

        if (!containerElement || containerElement.nodeType !== 1) {
            const errMsg = `${this._logPrefix} 'containerElement' dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.baseContainerElement = containerElement;
        this.logger.debug(`${this._logPrefix} Attached to base container element:`, this.baseContainerElement);

        // Check for new portrait elements after super() and _bindElements() have run
        if (!this.elements.locationPortraitVisualsElement || !this.elements.locationPortraitImageElement) {
            this.logger.error(`${this._logPrefix} Location portrait DOM elements not bound. Portraits will not be displayed.`);
            // Depending on strictness, you might throw an error or allow graceful degradation.
        }


        this._addSubscription(
            this.validatedEventDispatcher.subscribe(
                this._EVENT_TYPE_SUBSCRIBED,
                this.#handleTurnStarted.bind(this)
            )
        );
        this.logger.debug(`${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}'.`);
    }

    #handleTurnStarted(event) {
        this.logger.debug(`${this._logPrefix} Received '${event.type}' event. Payload:`, event.payload);

        if (!event.payload || !event.payload.entityId) {
            this.logger.warn(`${this._logPrefix} '${event.type}' event is missing entityId. Cannot update location display.`);
            this.#clearAllDisplaysOnErrorWithMessage('No entity specified for turn.');
            return;
        }

        const currentActorEntityId = event.payload.entityId;

        try {
            const currentLocationInstanceId = this.entityDisplayDataProvider.getEntityLocationId(currentActorEntityId);

            if (!currentLocationInstanceId) {
                this.logger.warn(`${this._logPrefix} Entity '${currentActorEntityId}' has no valid position or locationId.`);
                this.#clearAllDisplaysOnErrorWithMessage(`Location for ${currentActorEntityId} is unknown.`);
                return;
            }

            const locationDetails = this.entityDisplayDataProvider.getLocationDetails(currentLocationInstanceId);

            if (!locationDetails) {
                this.logger.error(`${this._logPrefix} Location details for ID '${currentLocationInstanceId}' not found.`);
                this.#clearAllDisplaysOnErrorWithMessage(`Location data for '${currentLocationInstanceId}' missing.`);
                return;
            }

            // NEW: Fetch location portrait data
            const portraitData = this.entityDisplayDataProvider.getLocationPortraitData(currentLocationInstanceId);
            // portraitData is expected to be { imagePath: string, altText?: string } | null

            const charactersInLocation = [];
            const entityIdsInLocation = this.entityManager.getEntitiesInLocation(currentLocationInstanceId);

            for (const entityIdInLoc of entityIdsInLocation) {
                if (entityIdInLoc === currentActorEntityId) continue;
                const entity = this.entityManager.getEntityInstance(entityIdInLoc);
                if (entity && entity.hasComponent(ACTOR_COMPONENT_ID)) {
                    const characterInfo = this.entityDisplayDataProvider.getCharacterDisplayInfo(entityIdInLoc);
                    if (characterInfo) {
                        charactersInLocation.push(characterInfo);
                    } else {
                        this.logger.warn(`${this._logPrefix} Could not get display info for character '${entityIdInLoc}'.`);
                    }
                }
            }
            this.logger.debug(`${this._logPrefix} Found ${charactersInLocation.length} other characters.`);

            const displayPayload = {
                name: locationDetails.name,
                description: locationDetails.description,
                portraitPath: portraitData ? portraitData.imagePath : null,
                portraitAltText: portraitData ? (portraitData.altText || `Image of ${locationDetails.name}`) : null,
                exits: locationDetails.exits,
                characters: charactersInLocation
            };

            this.render(displayPayload);

        } catch (error) {
            this.logger.error(`${this._logPrefix} Error processing '${event.type}' for entity '${currentActorEntityId}':`, error);
            this.#clearAllDisplaysOnErrorWithMessage('Error retrieving location details.');
        }
    }

    #clearAllDisplaysOnErrorWithMessage(message) {
        const elementsAndDefaults = {
            nameDisplay: `(${DEFAULT_LOCATION_NAME})`,
            // No default for portrait, it will be hidden by render logic
            descriptionDisplay: message,
            exitsDisplay: '(Exits Unavailable)',
            charactersDisplay: '(Characters Unavailable)'
        };

        for (const [key, defaultText] of Object.entries(elementsAndDefaults)) {
            const element = this.elements[key];
            if (element) {
                DomUtils.clearElement(element);
                const text = (key === 'descriptionDisplay') ? message : defaultText;
                const pError = this.domElementFactory.p('error-message', text);
                if (pError) {
                    element.appendChild(pError);
                } else {
                    element.textContent = text;
                }
            } else {
                this.logger.warn(`${this._logPrefix} Could not find element this.elements.${key} to clear on error.`);
            }
        }
        // Explicitly hide portrait on error
        if (this.elements.locationPortraitVisualsElement) {
            this.elements.locationPortraitVisualsElement.style.display = 'none';
        }
        if (this.elements.locationPortraitImageElement) {
            this.elements.locationPortraitImageElement.src = '';
            this.elements.locationPortraitImageElement.alt = '';
            this.elements.locationPortraitImageElement.style.display = 'none';
        }
    }

    _renderList(dataArray, targetElement, title, itemTextProperty, emptyText, itemClassName = 'list-item') {
        // ... (implementation of _renderList remains largely the same as you provided)
        // Ensure it correctly uses this.domElementFactory.create for h4
        // and handles potential null returns from factory methods gracefully.

        DomUtils.clearElement(targetElement);

        const titleEl = this.domElementFactory.create('h4', {text: `${title}:`});
        if (titleEl) {
            targetElement.appendChild(titleEl);
        } else {
            this.logger.warn(`${this._logPrefix} Failed to create title H4 for ${title}.`);
            targetElement.appendChild(this.documentContext.document.createTextNode(`${title}: `)); // Fallback
        }

        if (!dataArray || dataArray.length === 0) {
            const pEmpty = this.domElementFactory.p('empty-list-message', emptyText);
            if (pEmpty) {
                targetElement.appendChild(pEmpty);
            } else {
                targetElement.appendChild(this.documentContext.document.createTextNode(emptyText));
            }
        } else {
            const ul = this.domElementFactory.ul(undefined, 'location-detail-list');
            if (!ul) {
                this.logger.error(`${this._logPrefix} Failed to create UL for ${title}.`);
                // Simplified fallback: render as paragraphs directly in targetElement
                dataArray.forEach(item => {
                    const text = (item && typeof item === 'object' && item[itemTextProperty]) ? String(item[itemTextProperty]) : '(Invalid item)';
                    const pItem = this.domElementFactory.p(itemClassName, text);
                    if (pItem) targetElement.appendChild(pItem);
                    else targetElement.appendChild(this.documentContext.document.createTextNode(text));
                });
                return;
            }

            dataArray.forEach(item => {
                const primaryText = (item && typeof item === 'object' && item[itemTextProperty]) ? String(item[itemTextProperty]) : `(Invalid ${itemTextProperty})`;
                const li = this.domElementFactory.li(itemClassName);
                if (!li) {
                    this.logger.warn(`${this._logPrefix} Failed to create LI for ${title}.`);
                    ul.appendChild(this.documentContext.document.createTextNode(primaryText)); // Fallback text in UL
                    return;
                }

                const nameSpan = this.domElementFactory.span(undefined, primaryText);
                if (nameSpan) {
                    li.appendChild(nameSpan);
                } else {
                    li.appendChild(this.documentContext.document.createTextNode(primaryText)); // Fallback text in LI
                }

                if (title === 'Characters' && item && typeof item === 'object' && 'description' in item && typeof item.description === 'string' && item.description.trim() !== '') {
                    const descP = this.domElementFactory.p('character-description', item.description);
                    if (descP) {
                        li.appendChild(descP);
                    } else if (nameSpan) { // Fallback: append to nameSpan's parent (li)
                        li.appendChild(this.documentContext.document.createTextNode(` (${item.description})`));
                    }
                }
                ul.appendChild(li);
            });
            targetElement.appendChild(ul);
        }
    }

    render(locationDto) {
        if (!this.baseContainerElement || !this.domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render, critical dependencies (baseContainerElement or domElementFactory) missing.`);
            return;
        }
        // Check for all required elements, including new portrait ones
        const requiredElements = ['nameDisplay', 'locationPortraitVisualsElement', 'locationPortraitImageElement', 'descriptionDisplay', 'exitsDisplay', 'charactersDisplay'];
        for (const elKey of requiredElements) {
            if (!this.elements[elKey]) {
                this.logger.error(`${this._logPrefix} Cannot render, required DOM element '${elKey}' is missing.`);
                // Potentially call #clearAllDisplaysOnErrorWithMessage or a similar specific error display
                return;
            }
        }

        if (!locationDto) {
            this.logger.warn(`${this._logPrefix} Received null location DTO. Clearing display.`);
            this.#clearAllDisplaysOnErrorWithMessage('(No location data to display)');
            return;
        }

        this.logger.debug(`${this._logPrefix} Rendering location: "${locationDto.name}".`);

        // Name
        DomUtils.clearElement(this.elements.nameDisplay);
        const h3Name = this.domElementFactory.h3(undefined, locationDto.name || DEFAULT_LOCATION_NAME);
        if (h3Name) {
            this.elements.nameDisplay.appendChild(h3Name);
        } else {
            this.elements.nameDisplay.textContent = locationDto.name || DEFAULT_LOCATION_NAME;
        }

        // NEW: Location Portrait
        if (locationDto.portraitPath && this.elements.locationPortraitImageElement && this.elements.locationPortraitVisualsElement) {
            this.logger.debug(`${this._logPrefix} Setting location portrait to ${locationDto.portraitPath}`);
            this.elements.locationPortraitImageElement.src = locationDto.portraitPath;
            this.elements.locationPortraitImageElement.alt = locationDto.portraitAltText || `Image of ${locationDto.name || 'location'}`;
            this.elements.locationPortraitImageElement.style.display = 'block';
            this.elements.locationPortraitVisualsElement.style.display = 'flex'; // Use flex as per CSS
        } else if (this.elements.locationPortraitVisualsElement && this.elements.locationPortraitImageElement) {
            this.logger.debug(`${this._logPrefix} No portrait path for location. Hiding portrait elements.`);
            this.elements.locationPortraitVisualsElement.style.display = 'none';
            this.elements.locationPortraitImageElement.style.display = 'none';
            this.elements.locationPortraitImageElement.src = '';
            this.elements.locationPortraitImageElement.alt = '';
        }

        // Description
        DomUtils.clearElement(this.elements.descriptionDisplay);
        const pDesc = this.domElementFactory.p(undefined, locationDto.description || DEFAULT_LOCATION_DESCRIPTION);
        if (pDesc) {
            this.elements.descriptionDisplay.appendChild(pDesc);
        } else {
            this.elements.descriptionDisplay.textContent = locationDto.description || DEFAULT_LOCATION_DESCRIPTION;
        }

        // Exits and Characters
        this._renderList(locationDto.exits, this.elements.exitsDisplay, 'Exits', 'description', '(None visible)');
        this._renderList(locationDto.characters, this.elements.charactersDisplay, 'Characters', 'name', '(None else here)');

        this.logger.info(`${this._logPrefix} Location "${locationDto.name}" display updated.`);
    }

    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing LocationRenderer.`);
        super.dispose();
        this.logger.info(`${this._logPrefix} LocationRenderer disposed.`);
    }
}

// --- FILE END ---