// src/domUI/locationRenderer.js
// --- FILE START ---
import {RendererBase} from './rendererBase.js';
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
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').UnsubscribeFn} UnsubscribeFn
 * @typedef {import('./domElementFactory').default} DomElementFactory
 * @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../core/interfaces/IDataRegistry').IDataRegistry} IDataRegistry // Keep for potential future use if needed, but not for direct location data here
 */

/**
 * @typedef {object} CoreTurnStartedPayload
 * @property {import('../core/interfaces/CommonTypes').NamespacedId} entityId
 * @property {'player'|'ai'} entityType
 */

/**
 * @typedef {object} CoreTurnStartedEvent
 * @property {string} type - The event type name (e.g., 'core:turn_started').
 * @property {CoreTurnStartedPayload} payload - The payload of the event.
 */

/**
 * Represents a character to be displayed.
 * @typedef {object} CharacterDisplayData
 * @property {string} id - The ID of the character.
 * @property {string} name - The name of the character.
 * @property {string} [description] - Optional description of the character.
 */

/**
 * Represents the data structure for displaying a location.
 * @typedef {object} LocationDisplayPayload
 * @property {string} name - The name of the location.
 * @property {string} description - The textual description of the location.
 * @property {Array<{description: string, id?: string}>} exits - List of exits from the location.
 * @property {Array<CharacterDisplayData>} [characters] - Optional list of characters present in the location.
 */

export class LocationRenderer extends RendererBase {
    /** @private @type {HTMLElement} */
    #baseContainerElement;
    /** @private @type {DomElementFactory} */
    #domElementFactory;
    /** @private @type {IEntityManager} */
    #entityManager;
    /** @private @type {IDataRegistry} */ // No longer directly used for fetching primary location data
    #dataRegistry;
    /** @private @type {Array<UnsubscribeFn|undefined>} */
    #subscriptions = [];
    /** @private @readonly */
    _EVENT_TYPE_SUBSCRIBED = 'core:turn_started';

    static #NAME_DISPLAY_ID = 'location-name-display';
    static #DESCRIPTION_DISPLAY_ID = 'location-description-display';
    static #EXITS_DISPLAY_ID = 'location-exits-display';
    static #CHARACTERS_DISPLAY_ID = 'location-characters-display';

    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    entityManager,
                    dataRegistry, // Keep for constructor signature consistency if other parts use it
                    containerElement
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        if (!entityManager ||
            typeof entityManager.getEntityInstance !== 'function' ||
            typeof entityManager.getEntitiesInLocation !== 'function'
        ) {
            const errMsg = `${this._logPrefix} 'entityManager' dependency is missing or invalid (must have getEntityInstance and getEntitiesInLocation).`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#entityManager = entityManager;

        // dataRegistry is no longer the primary source for location display data, but keep if other methods use it
        if (!dataRegistry) { // Simplified check as its direct critical use here is removed
            this.logger.warn(`${this._logPrefix} 'dataRegistry' dependency is missing. Certain fallback or definitional lookups might fail if ever needed.`);
        }
        this.#dataRegistry = dataRegistry;


        if (!containerElement || containerElement.nodeType !== 1) {
            const errMsg = `${this._logPrefix} 'containerElement' (expected '#location-info-container') dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#baseContainerElement = containerElement;
        this.logger.debug(`${this._logPrefix} Attached to base container element:`, this.#baseContainerElement);

        this.#subscribeToEvents();
    }

    /** @private */
    #subscribeToEvents() {
        if (!this.validatedEventDispatcher || typeof this.validatedEventDispatcher.subscribe !== 'function') {
            this.logger.error(`${this._logPrefix} ValidatedEventDispatcher not available or 'subscribe' method is missing.`);
            return;
        }
        const unsubscribeFn = this.validatedEventDispatcher.subscribe(
            this._EVENT_TYPE_SUBSCRIBED,
            this.#handleTurnStarted.bind(this)
        );

        if (typeof unsubscribeFn === 'function') {
            this.#subscriptions.push(unsubscribeFn);
            this.logger.debug(`${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}'.`);
        } else {
            this.logger.error(`${this._logPrefix} Failed to subscribe to VED event '${this._EVENT_TYPE_SUBSCRIBED}'. Expected an unsubscribe function.`);
        }
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
            const actingEntity = this.#entityManager.getEntityInstance(currentActorEntityId);
            if (!actingEntity) {
                this.logger.warn(`${this._logPrefix} Entity '${currentActorEntityId}' (whose turn started) not found. Cannot determine location.`);
                this.#clearAllDisplaysOnErrorWithMessage(`Entity ${currentActorEntityId} not found.`);
                return;
            }

            const positionComponent = actingEntity.getComponentData(POSITION_COMPONENT_ID);
            if (!positionComponent || typeof positionComponent.locationId !== 'string' || !positionComponent.locationId) {
                this.logger.warn(`${this._logPrefix} Entity '${currentActorEntityId}' has no valid position or locationId. Position:`, positionComponent);
                this.#clearAllDisplaysOnErrorWithMessage(`Location for ${currentActorEntityId} is unknown.`);
                return;
            }

            const currentLocationInstanceId = positionComponent.locationId; // This is an INSTANCE ID

            // Fetch the location ENTITY INSTANCE from EntityManager
            const locationEntityInstance = this.#entityManager.getEntityInstance(currentLocationInstanceId);

            if (!locationEntityInstance) {
                // This is the error you were seeing, but now checking against EntityManager
                this.logger.error(`${this._logPrefix} Location entity INSTANCE for ID '${currentLocationInstanceId}' not found in EntityManager.`);
                this.#clearAllDisplaysOnErrorWithMessage(`Location data for '${currentLocationInstanceId}' missing (instance not found).`);
                return;
            }

            // Get component data directly from the location's INSTANCE
            const nameComponentData = locationEntityInstance.getComponentData(NAME_COMPONENT_ID);
            const descriptionComponentData = locationEntityInstance.getComponentData(DESCRIPTION_COMPONENT_ID);
            const exitsComponentRawData = locationEntityInstance.getComponentData(EXITS_COMPONENT_ID);

            const locationName = nameComponentData?.text || 'Unnamed Location';
            const locationDescription = descriptionComponentData?.text || 'No description available.';

            let exits = [];
            if (exitsComponentRawData && Array.isArray(exitsComponentRawData)) {
                exits = exitsComponentRawData.map(exit => ({
                    description: exit.direction || 'Unmarked Exit',
                    // exit.target should ideally be an instanceId of the target location
                    // after the linking pass. If it's still a definitionId, that's a separate issue
                    // in how exits are defined/resolved. For rendering, we just display it.
                    id: exit.target
                })).filter(exit => exit.description && exit.description !== 'Unmarked Exit');
            } else if (exitsComponentRawData) {
                this.logger.warn(`${this._logPrefix} Exits data for location '${currentLocationInstanceId}' is present but not an array:`, exitsComponentRawData);
            }

            const charactersInLocation = [];
            // GetEntitiesInLocation correctly uses the location's INSTANCE ID
            const entityIdsInLocation = this.#entityManager.getEntitiesInLocation(currentLocationInstanceId);

            for (const entityIdInLoc of entityIdsInLocation) {
                if (entityIdInLoc === currentActorEntityId) { // Don't list the current actor
                    continue;
                }

                const entity = this.#entityManager.getEntityInstance(entityIdInLoc);
                if (!entity) {
                    this.logger.warn(`${this._logPrefix} Entity with ID '${entityIdInLoc}' from location index not found during character search.`);
                    continue;
                }

                if (entity.hasComponent(ACTOR_COMPONENT_ID)) {
                    const entityNameData = entity.getComponentData(NAME_COMPONENT_ID);
                    const entityDescriptionData = entity.getComponentData(DESCRIPTION_COMPONENT_ID);
                    charactersInLocation.push({
                        id: entity.id,
                        name: entityNameData?.text || 'Unnamed Character',
                        description: entityDescriptionData?.text
                    });
                }
            }
            this.logger.debug(`${this._logPrefix} Found ${charactersInLocation.length} other characters in location '${currentLocationInstanceId}'.`);

            const displayPayload = {
                name: locationName,
                description: locationDescription,
                exits: exits,
                characters: charactersInLocation
            };

            this.render(displayPayload);

        } catch (error) {
            this.logger.error(`${this._logPrefix} Error processing '${event.type}' for entity '${currentActorEntityId}':`, error);
            this.#clearAllDisplaysOnErrorWithMessage('Error retrieving location details.');
        }
    }

    /** @private */
    #clearAllDisplaysOnErrorWithMessage(message) {
        const idsAndDefaults = {
            [LocationRenderer.#NAME_DISPLAY_ID]: '(Location Unknown)',
            [LocationRenderer.#DESCRIPTION_DISPLAY_ID]: message,
            [LocationRenderer.#EXITS_DISPLAY_ID]: '(Exits Unavailable)',
            [LocationRenderer.#CHARACTERS_DISPLAY_ID]: '(Characters Unavailable)'
        };
        let errorLogged = false;
        for (const [id, defaultText] of Object.entries(idsAndDefaults)) {
            try {
                const element = this.documentContext.query(`#${id}`);
                if (element) {
                    this._clearElementContent(element);
                    const text = (id === LocationRenderer.#DESCRIPTION_DISPLAY_ID) ? message : defaultText;
                    const pError = this.#domElementFactory.p('error-message', text);
                    if (pError) {
                        element.appendChild(pError);
                    } else {
                        element.textContent = text;
                    }
                } else if (!errorLogged) {
                    this.logger.warn(`${this._logPrefix} Could not find element #${id} to clear/update on error.`);
                    errorLogged = true; // Log only once per clear operation
                }
            } catch (e) {
                this.logger.error(`${this._logPrefix} Error while clearing/updating element #${id} on error:`, e);
            }
        }
    }

    /** @private */
    _clearElementContent(element) {
        if (element) {
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        }
    }

    /**
     * Renders a list of items into a target DOM element.
     * If the title is 'Characters', it will also look for an 'description' property on items
     * and append it as a paragraph with class 'character-description'.
     * @private
     * @param {Array<object>} dataArray - Array of data objects to render.
     * @param {HTMLElement} targetElement - The DOM element to render into.
     * @param {string} title - The title for this list section (e.g., "Exits", "Characters").
     * @param {string} itemTextProperty - The property name on each data object to use for the main text.
     * @param {string} emptyText - Text to display if dataArray is empty.
     * @param {string} [itemClassName='list-item'] - CSS class for each list item.
     */
    _renderList(dataArray, targetElement, title, itemTextProperty, emptyText, itemClassName = 'list-item') {
        this._clearElementContent(targetElement);
        const titleEl = this.#domElementFactory.create('h4');
        if (titleEl) {
            titleEl.textContent = `${title}:`;
            targetElement.appendChild(titleEl);
        } else {
            this.logger.warn(`${this._logPrefix} Failed to create title element for ${title}.`);
            targetElement.appendChild(this.documentContext.document.createTextNode(`${title}: `));
        }

        if (!dataArray || dataArray.length === 0) {
            const pEmpty = this.#domElementFactory.p('empty-list-message', emptyText);
            if (pEmpty) {
                targetElement.appendChild(pEmpty);
            } else {
                targetElement.appendChild(this.documentContext.document.createTextNode(emptyText));
            }
        } else {
            const ul = this.#domElementFactory.ul(undefined, 'location-detail-list');
            if (!ul) {
                this.logger.error(`${this._logPrefix} Failed to create UL element for ${title}. Rendering as paragraphs.`);
                dataArray.forEach(item => {
                    const primaryText = item && typeof item === 'object' && itemTextProperty in item ? String(item[itemTextProperty]) : `(Invalid item data for ${title})`;
                    const pItem = this.#domElementFactory.p(itemClassName, primaryText);
                    if (pItem) targetElement.appendChild(pItem); else targetElement.appendChild(this.documentContext.document.createTextNode(primaryText));
                });
                return;
            }

            dataArray.forEach(item => {
                const primaryTextValue = item && typeof item === 'object' && itemTextProperty in item ? item[itemTextProperty] : null;
                const primaryText = primaryTextValue !== null ? String(primaryTextValue) : `(Invalid ${itemTextProperty} for item in ${title})`;

                const li = this.#domElementFactory.li(itemClassName);
                if (!li) {
                    this.logger.warn(`${this._logPrefix} Failed to create LI element for item in ${title}.`);
                    ul.appendChild(this.documentContext.document.createTextNode(primaryText));
                    return;
                }

                const nameSpan = this.#domElementFactory.create('span');
                if (nameSpan) {
                    nameSpan.textContent = primaryText;
                    li.appendChild(nameSpan);
                } else {
                    li.appendChild(this.documentContext.document.createTextNode(primaryText));
                }

                if (title === 'Characters' && item && typeof item === 'object' && typeof item.description === 'string' && item.description.trim() !== '') {
                    const descP = this.#domElementFactory.p('character-description', item.description);
                    if (descP) {
                        li.appendChild(descP);
                    } else {
                        const descTextNode = this.documentContext.document.createTextNode(` - ${item.description}`);
                        li.appendChild(descTextNode);
                    }
                }
                ul.appendChild(li);
            });
            targetElement.appendChild(ul);
        }
    }

    render(locationDto) {
        if (!this.#baseContainerElement) {
            this.logger.error(`${this._logPrefix} Cannot render location, baseContainerElement is not set.`);
            return;
        }
        if (!this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render location, domElementFactory is not available.`);
            return;
        }
        if (!locationDto) {
            this.logger.warn(`${this._logPrefix} Received null location DTO. Clearing display.`);
            this.#clearAllDisplaysOnErrorWithMessage('(No location data to display)');
            return;
        }

        this.logger.debug(`${this._logPrefix} Rendering location: "${locationDto.name}" into sub-elements.`);
        const nameDisplay = this.documentContext.query(`#${LocationRenderer.#NAME_DISPLAY_ID}`);
        const descriptionDisplay = this.documentContext.query(`#${LocationRenderer.#DESCRIPTION_DISPLAY_ID}`);
        const exitsDisplay = this.documentContext.query(`#${LocationRenderer.#EXITS_DISPLAY_ID}`);
        const charactersDisplay = this.documentContext.query(`#${LocationRenderer.#CHARACTERS_DISPLAY_ID}`);

        if (nameDisplay) {
            this._clearElementContent(nameDisplay);
            const h3Name = this.#domElementFactory.h3(undefined, locationDto.name || 'Unnamed Location');
            if (h3Name) nameDisplay.appendChild(h3Name); else nameDisplay.textContent = locationDto.name || 'Unnamed Location';
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#NAME_DISPLAY_ID} not found.`);
        }

        if (descriptionDisplay) {
            this._clearElementContent(descriptionDisplay);
            const pDesc = this.#domElementFactory.p(undefined, locationDto.description || 'You see nothing remarkable.');
            if (pDesc) descriptionDisplay.appendChild(pDesc); else descriptionDisplay.textContent = locationDto.description || 'You see nothing remarkable.';
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#DESCRIPTION_DISPLAY_ID} not found.`);
        }

        if (exitsDisplay) {
            this._renderList(locationDto.exits, exitsDisplay, 'Exits', 'description', '(None visible)');
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#EXITS_DISPLAY_ID} not found.`);
        }

        if (charactersDisplay) {
            this._renderList(locationDto.characters, charactersDisplay, 'Characters', 'name', '(None else here)');
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#CHARACTERS_DISPLAY_ID} not found.`);
        }

        this.logger.info(`${this._logPrefix} Location "${locationDto.name}" display updated.`);
    }

    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(unsubscribeFn => {
            if (typeof unsubscribeFn === 'function') {
                unsubscribeFn();
            }
        });
        this.#subscriptions = [];
        super.dispose();
        this.logger.info(`${this._logPrefix} LocationRenderer disposed.`);
    }
}

// --- FILE END ---