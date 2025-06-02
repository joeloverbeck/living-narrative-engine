// src/domUI/locationRenderer.js
// --- FILE START ---
import {BoundDomRendererBase} from './boundDomRendererBase.js';
import {DomUtils} from './domUtils.js';
import {
    POSITION_COMPONENT_ID,
    NAME_COMPONENT_ID,
    DESCRIPTION_COMPONENT_ID,
    EXITS_COMPONENT_ID,
    ACTOR_COMPONENT_ID
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
 * @property {Array<import('../services/EntityDisplayDataProvider.js').ProcessedExit>} exits - List of exits from the location.
 * @property {Array<CharacterDisplayData>} characters - List of characters present in the location.
 */

/**
 * Renders details of the current location, including its name, description, exits, and characters.
 * It extends BoundDomRendererBase to manage its DOM sub-elements and uses EntityDisplayDataProvider
 * for fetching display data.
 * @extends {BoundDomRendererBase}
 */
export class LocationRenderer extends BoundDomRendererBase {
    /** @private @type {HTMLElement} */
    baseContainerElement; // The main container element, e.g., #location-info-container
    /** @private @type {DomElementFactory} */
    domElementFactory;
    /** @private @type {IEntityManager} */
    entityManager; // Minimize direct use, prefer entityDisplayDataProvider
    /** @private @type {EntityDisplayDataProvider} */
    entityDisplayDataProvider;
    /** @private @type {IDataRegistry | undefined} */
    dataRegistry; // Kept for potential fallback, but primary data comes from EDDP

    /** @private @readonly */
    _EVENT_TYPE_SUBSCRIBED = 'core:turn_started';

    /**
     * Constructs a LocationRenderer instance.
     * @param {object} params - The parameters object.
     * @param {ILogger} params.logger - The logger instance.
     * @param {IDocumentContext} params.documentContext - The document context abstraction.
     * @param {IValidatedEventDispatcher} params.validatedEventDispatcher - The validated event dispatcher.
     * @param {DomElementFactory} params.domElementFactory - Factory for creating DOM elements.
     * @param {IEntityManager} params.entityManager - The entity manager for data access.
     * @param {EntityDisplayDataProvider} params.entityDisplayDataProvider - Service for fetching formatted entity data.
     * @param {IDataRegistry} [params.dataRegistry] - Optional. The data registry for fallback or definitional lookups.
     * @param {HTMLElement} params.containerElement - The main DOM element that contains all location display sub-elements.
     * @throws {Error} If critical dependencies are missing or invalid.
     */
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

        if (!entityManager ||
            typeof entityManager.getEntityInstance !== 'function' ||
            typeof entityManager.getEntitiesInLocation !== 'function'
        ) {
            const errMsg = `${this._logPrefix} 'entityManager' dependency is missing or invalid (must have getEntityInstance and getEntitiesInLocation).`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.entityManager = entityManager;

        if (!entityDisplayDataProvider || typeof entityDisplayDataProvider.getLocationDetails !== 'function') {
            const errMsg = `${this._logPrefix} 'entityDisplayDataProvider' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.entityDisplayDataProvider = entityDisplayDataProvider;

        if (dataRegistry) {
            this.dataRegistry = dataRegistry;
        } else {
            this.logger.warn(`${this._logPrefix} 'dataRegistry' dependency is missing. Certain fallback or definitional lookups might fail if ever needed.`);
        }


        if (!containerElement || containerElement.nodeType !== 1) {
            const errMsg = `${this._logPrefix} 'containerElement' (expected '#location-info-container') dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.baseContainerElement = containerElement;
        this.logger.debug(`${this._logPrefix} Attached to base container element:`, this.baseContainerElement);

        this._addSubscription(
            this.validatedEventDispatcher.subscribe(
                this._EVENT_TYPE_SUBSCRIBED,
                this.#handleTurnStarted.bind(this)
            )
        );
        this.logger.debug(`${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}'.`);
    }

    /**
     * Handles the 'core:turn_started' event.
     * Fetches the current entity's location and renders its details including other characters.
     * @private
     * @param {CoreTurnStartedEvent} event - The event object from VED.
     */
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
                this.logger.warn(`${this._logPrefix} Entity '${currentActorEntityId}' has no valid position or locationId. Position component might be missing or locationId not set.`);
                this.#clearAllDisplaysOnErrorWithMessage(`Location for ${currentActorEntityId} is unknown.`);
                return;
            }

            const locationDetails = this.entityDisplayDataProvider.getLocationDetails(currentLocationInstanceId);

            if (!locationDetails) {
                this.logger.error(`${this._logPrefix} Location details for ID '${currentLocationInstanceId}' not found via EntityDisplayDataProvider.`);
                this.#clearAllDisplaysOnErrorWithMessage(`Location data for '${currentLocationInstanceId}' missing.`);
                return;
            }

            const charactersInLocation = [];
            const entityIdsInLocation = this.entityManager.getEntitiesInLocation(currentLocationInstanceId);

            for (const entityIdInLoc of entityIdsInLocation) {
                if (entityIdInLoc === currentActorEntityId) { // Don't list the current actor
                    continue;
                }
                // Check if it's an actor entity before fetching display info
                const entity = this.entityManager.getEntityInstance(entityIdInLoc);
                if (entity && entity.hasComponent(ACTOR_COMPONENT_ID)) {
                    const characterInfo = this.entityDisplayDataProvider.getCharacterDisplayInfo(entityIdInLoc);
                    if (characterInfo) {
                        charactersInLocation.push(characterInfo);
                    } else {
                        this.logger.warn(`${this._logPrefix} Could not get display info for character '${entityIdInLoc}' in location '${currentLocationInstanceId}'.`);
                    }
                }
            }
            this.logger.debug(`${this._logPrefix} Found ${charactersInLocation.length} other characters in location '${currentLocationInstanceId}'.`);

            /** @type {LocationDisplayPayload} */
            const displayPayload = {
                name: locationDetails.name,
                description: locationDetails.description,
                exits: locationDetails.exits,
                characters: charactersInLocation
            };

            this.render(displayPayload);

        } catch (error) {
            this.logger.error(`${this._logPrefix} Error processing '${event.type}' for entity '${currentActorEntityId}':`, error);
            this.#clearAllDisplaysOnErrorWithMessage('Error retrieving location details.');
        }
    }

    /**
     * Clears all display areas and shows an error message, typically when data fetching fails.
     * @private
     * @param {string} message - The error message to display in the description area.
     */
    #clearAllDisplaysOnErrorWithMessage(message) {
        const elementsAndDefaults = {
            nameDisplay: '(Location Unknown)',
            descriptionDisplay: message,
            exitsDisplay: '(Exits Unavailable)',
            charactersDisplay: '(Characters Unavailable)'
        };
        let errorLogged = false;

        for (const [key, defaultText] of Object.entries(elementsAndDefaults)) {
            const element = this.elements[key];
            if (element) {
                DomUtils.clearElement(element);
                const text = (key === 'descriptionDisplay') ? message : defaultText;
                const pError = this.domElementFactory.p('error-message', text);
                if (pError) {
                    element.appendChild(pError);
                } else {
                    element.textContent = text; // Fallback if factory fails
                }
            } else if (!errorLogged) {
                this.logger.warn(`${this._logPrefix} Could not find element this.elements.${key} to clear/update on error.`);
                errorLogged = true; // Log only once per clear operation for missing elements
            }
        }
    }

    /**
     * Renders a list of items (exits or characters) into a target DOM element.
     * @private
     * @param {Array<object>} dataArray - Array of data objects to render.
     * @param {HTMLElement} targetElement - The DOM element to render into (e.g., this.elements.exitsDisplay).
     * @param {string} title - The title for this list section (e.g., "Exits", "Characters").
     * @param {string} itemTextProperty - The property name on each data object to use for the main text.
     * @param {string} emptyText - Text to display if dataArray is empty.
     * @param {string} [itemClassName='list-item'] - CSS class for each list item.
     */
    _renderList(dataArray, targetElement, title, itemTextProperty, emptyText, itemClassName = 'list-item') {
        DomUtils.clearElement(targetElement);
        const titleEl = this.domElementFactory.h4(undefined, `${title}:`); // Updated to use h4 from factory
        if (titleEl) {
            targetElement.appendChild(titleEl);
        } else {
            this.logger.warn(`${this._logPrefix} Failed to create title element for ${title}.`);
            targetElement.appendChild(this.documentContext.document.createTextNode(`${title}: `)); // Fallback
        }

        if (!dataArray || dataArray.length === 0) {
            const pEmpty = this.domElementFactory.p('empty-list-message', emptyText);
            if (pEmpty) {
                targetElement.appendChild(pEmpty);
            } else {
                targetElement.appendChild(this.documentContext.document.createTextNode(emptyText)); // Fallback
            }
        } else {
            const ul = this.domElementFactory.ul(undefined, 'location-detail-list');
            if (!ul) {
                this.logger.error(`${this._logPrefix} Failed to create UL element for ${title}. Rendering as paragraphs.`);
                // Fallback rendering (simplified)
                dataArray.forEach(item => {
                    const primaryText = item && typeof item === 'object' && itemTextProperty in item ? String(item[itemTextProperty]) : `(Invalid item for ${title})`;
                    const pItem = this.domElementFactory.p(itemClassName, primaryText);
                    if (pItem) targetElement.appendChild(pItem);
                });
                return;
            }

            dataArray.forEach(item => {
                const primaryTextValue = item && typeof item === 'object' && itemTextProperty in item ? item[itemTextProperty] : null;
                const primaryText = primaryTextValue !== null ? String(primaryTextValue) : `(Invalid ${itemTextProperty} for ${title})`;

                const li = this.domElementFactory.li(itemClassName);
                if (!li) {
                    this.logger.warn(`${this._logPrefix} Failed to create LI element for item in ${title}.`);
                    ul.appendChild(this.documentContext.document.createTextNode(primaryText)); // Fallback
                    return;
                }

                const nameSpan = this.domElementFactory.span(undefined, primaryText); // Updated to use span from factory
                if (nameSpan) {
                    li.appendChild(nameSpan);
                } else {
                    li.appendChild(this.documentContext.document.createTextNode(primaryText)); // Fallback
                }


                // Special handling for character descriptions
                if (title === 'Characters' && item && typeof item === 'object' && 'description' in item && typeof item.description === 'string' && item.description.trim() !== '') {
                    const descP = this.domElementFactory.p('character-description', item.description);
                    if (descP) {
                        li.appendChild(descP);
                    }
                }
                ul.appendChild(li);
            });
            targetElement.appendChild(ul);
        }
    }

    /**
     * Renders the provided location data into the designated DOM elements.
     * @param {LocationDisplayPayload | null} locationDto - The data for the location to display.
     */
    render(locationDto) {
        if (!this.baseContainerElement) {
            this.logger.error(`${this._logPrefix} Cannot render location, baseContainerElement is not set.`);
            return;
        }
        if (!this.domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render location, domElementFactory is not available.`);
            return;
        }
        if (!this.elements.nameDisplay || !this.elements.descriptionDisplay || !this.elements.exitsDisplay || !this.elements.charactersDisplay) {
            this.logger.error(`${this._logPrefix} One or more display elements (name, description, exits, characters) are missing from this.elements.`);
            return;
        }

        if (!locationDto) {
            this.logger.warn(`${this._logPrefix} Received null location DTO. Clearing display.`);
            this.#clearAllDisplaysOnErrorWithMessage('(No location data to display)');
            return;
        }

        this.logger.debug(`${this._logPrefix} Rendering location: "${locationDto.name}" into sub-elements.`);

        DomUtils.clearElement(this.elements.nameDisplay);
        const h3Name = this.domElementFactory.h3(undefined, locationDto.name || 'Unnamed Location');
        if (h3Name) this.elements.nameDisplay.appendChild(h3Name);
        else this.elements.nameDisplay.textContent = locationDto.name || 'Unnamed Location';


        DomUtils.clearElement(this.elements.descriptionDisplay);
        const pDesc = this.domElementFactory.p(undefined, locationDto.description || 'You see nothing remarkable.');
        if (pDesc) this.elements.descriptionDisplay.appendChild(pDesc);
        else this.elements.descriptionDisplay.textContent = locationDto.description || 'You see nothing remarkable.';


        this._renderList(locationDto.exits, this.elements.exitsDisplay, 'Exits', 'description', '(None visible)');
        this._renderList(locationDto.characters, this.elements.charactersDisplay, 'Characters', 'name', '(None else here)');

        this.logger.info(`${this._logPrefix} Location "${locationDto.name}" display updated.`);
    }

    /**
     * Disposes of resources used by the renderer.
     * Unsubscribes from VED events via super.dispose().
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing LocationRenderer.`);
        super.dispose(); // Handles VED unsubscriptions and clearing of bound elements
        this.logger.info(`${this._logPrefix} LocationRenderer disposed.`);
    }
}

// --- FILE END ---