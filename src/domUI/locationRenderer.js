// src/domUI/locationRenderer.js
import {RendererBase} from './rendererBase.js';
// Assuming these component IDs are defined and exported from a constants file
import {
    POSITION_COMPONENT_ID, // e.g., 'core:position'
    NAME_COMPONENT_ID,     // e.g., 'core:name'
    DESCRIPTION_COMPONENT_ID // e.g., 'core:description'
} from '../constants/componentIds.js'; // Adjust path as necessary

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').UnsubscribeFn} UnsubscribeFn
 * @typedef {import('./domElementFactory').default} DomElementFactory
 * @typedef {import('../core/interfaces/IEntityManager').IEntityManager} IEntityManager
 * @typedef {import('../core/interfaces/IDataRegistry').IDataRegistry} IDataRegistry // Assuming this interface exists
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
 * Represents the data structure for displaying a location.
 * @typedef {object} LocationDisplayPayload
 * @property {string} name - The name of the location.
 * @property {string} description - The textual description of the location.
 * @property {Array<{description: string, id?: string}>} exits - List of exits from the location.
 * @property {Array<{id: string, name: string}>} [items] - Optional list of items present in the location.
 * @property {Array<{id: string, name: string}>} [entities] - Optional list of entities (NPCs, etc.) present.
 */

/**
 * Renders the details of the current game location (name, description, exits, items, entities)
 * into designated child elements within '#location-info-container'.
 * Subscribes to 'core:turn_started' via VED to update based on the current entity's location.
 */
export class LocationRenderer extends RendererBase {
    /** @private @type {HTMLElement} */
    #baseContainerElement;
    /** @private @type {DomElementFactory} */
    #domElementFactory;
    /** @private @type {IEntityManager} */
    #entityManager;
    /** @private @type {IDataRegistry} */
    #dataRegistry;
    /** @private @type {Array<UnsubscribeFn|undefined>} */
    #subscriptions = [];
    /** @private @readonly */
    _EVENT_TYPE_SUBSCRIBED = 'core:turn_started';

    /** @private @const @type {string} */
    static #NAME_DISPLAY_ID = 'location-name-display';
    /** @private @const @type {string} */
    static #DESCRIPTION_DISPLAY_ID = 'location-description-display';
    /** @private @const @type {string} */
    static #EXITS_DISPLAY_ID = 'location-exits-display';
    /** @private @const @type {string} */
    static #ITEMS_DISPLAY_ID = 'location-items-display';
    /** @private @const @type {string} */
    static #ENTITIES_DISPLAY_ID = 'location-entities-display';

    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    entityManager,
                    dataRegistry,
                    containerElement
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            const errMsg = `${this._logPrefix} 'entityManager' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#entityManager = entityManager;

        // Ensure dataRegistry has getEntityDefinition, as locations are entities.
        if (!dataRegistry || typeof dataRegistry.getEntityDefinition !== 'function') {
            const errMsg = `${this._logPrefix} 'dataRegistry' dependency is missing or invalid (must have getEntityDefinition).`;
            this.logger.error(errMsg, {receivedRegistry: dataRegistry});
            throw new Error(errMsg);
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
     * Fetches the current entity's location and renders its details.
     * @private
     * @param {CoreTurnStartedEvent} event - The event object from VED.
     */
    #handleTurnStarted(event) { // Removed async as getEntityDefinition is likely synchronous
        this.logger.debug(`${this._logPrefix} Received '${event.type}' event. Payload:`, event.payload);

        if (!event.payload || !event.payload.entityId) {
            this.logger.warn(`${this._logPrefix} '${event.type}' event is missing entityId. Cannot update location display.`);
            this.#clearAllDisplaysOnErrorWithMessage('No entity specified for turn.');
            return;
        }

        const entityId = event.payload.entityId;

        try {
            const actingEntity = this.#entityManager.getEntityInstance(entityId);
            if (!actingEntity) {
                this.logger.warn(`${this._logPrefix} Entity '${entityId}' (whose turn started) not found. Cannot determine location.`);
                this.#clearAllDisplaysOnErrorWithMessage(`Entity ${entityId} not found.`);
                return;
            }

            const positionComponent = actingEntity.getComponentData(POSITION_COMPONENT_ID);
            if (!positionComponent || typeof positionComponent.locationId !== 'string' || !positionComponent.locationId) {
                this.logger.warn(`${this._logPrefix} Entity '${entityId}' has no valid position or locationId. Position:`, positionComponent);
                this.#clearAllDisplaysOnErrorWithMessage(`Location for ${entityId} is unknown.`);
                return;
            }

            const locationId = positionComponent.locationId;
            const locationEntityDefinition = this.#dataRegistry.getEntityDefinition(locationId);

            if (!locationEntityDefinition) {
                this.logger.error(`${this._logPrefix} Location entity definition for ID '${locationId}' not found.`);
                this.#clearAllDisplaysOnErrorWithMessage(`Location data for '${locationId}' missing.`);
                return;
            }

            // Extract name and description from the location entity's components
            const nameComponentData = locationEntityDefinition.components?.[NAME_COMPONENT_ID];
            const descriptionComponentData = locationEntityDefinition.components?.[DESCRIPTION_COMPONENT_ID];

            const locationName = nameComponentData?.text || 'Unnamed Location';
            const locationDescription = descriptionComponentData?.text || 'No description available.';

            // Exits: For now, assume exits are not yet handled or are empty.
            // If exits were a component (e.g., 'core:exits') on the location entity:
            // const exitsData = locationEntityDefinition.components?.['core:exits']?.list || [];
            const exits = []; // Per current requirement: only name and description

            const displayPayload = {
                name: locationName,
                description: locationDescription,
                exits: exits,
                items: [], // Future scope
                entities: [] // Future scope
            };

            this.render(displayPayload);

        } catch (error) {
            this.logger.error(`${this._logPrefix} Error processing '${event.type}' for entity '${entityId}':`, error);
            this.#clearAllDisplaysOnErrorWithMessage('Error retrieving location details.');
        }
    }

    /** @private */
    #clearAllDisplaysOnErrorWithMessage(message) {
        const idsAndDefaults = {
            [LocationRenderer.#NAME_DISPLAY_ID]: '(Location Unknown)',
            [LocationRenderer.#DESCRIPTION_DISPLAY_ID]: message,
            [LocationRenderer.#EXITS_DISPLAY_ID]: '(Exits Unavailable)',
            [LocationRenderer.#ITEMS_DISPLAY_ID]: '(Items Unavailable)',
            [LocationRenderer.#ENTITIES_DISPLAY_ID]: '(Other Entities Unavailable)'
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
                    errorLogged = true;
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

    /** @private */
    _renderList(dataArray, targetElement, title, itemTextProperty, emptyText, itemClassName = 'list-item') {
        this._clearElementContent(targetElement);
        const titleEl = this.#domElementFactory.create('h4');
        if (titleEl) {
            titleEl.textContent = `${title}:`;
            targetElement.appendChild(titleEl);
        } else {
            this.logger.warn(`${this._logPrefix} Failed to create title element for ${title}.`);
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
                this.logger.error(`${this._logPrefix} Failed to create UL element for ${title}.`);
                dataArray.forEach(item => {
                    const text = item?.[itemTextProperty] || 'Unnamed';
                    const pItem = this.#domElementFactory.p(itemClassName, text);
                    if (pItem) targetElement.appendChild(pItem);
                });
                return;
            }
            dataArray.forEach(item => {
                const textValue = item && typeof item === 'object' ? item[itemTextProperty] : `(Invalid item in ${title})`;
                const text = textValue || `(Invalid ${itemTextProperty} for item)`;
                const li = this.#domElementFactory.li(itemClassName, text);
                if (li) {
                    ul.appendChild(li);
                } else {
                    this.logger.warn(`${this._logPrefix} Failed to create LI element for item in ${title}.`);
                }
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
        const itemsDisplay = this.documentContext.query(`#${LocationRenderer.#ITEMS_DISPLAY_ID}`);
        const entitiesDisplay = this.documentContext.query(`#${LocationRenderer.#ENTITIES_DISPLAY_ID}`);

        if (nameDisplay) {
            this._clearElementContent(nameDisplay);
            nameDisplay.textContent = locationDto.name || 'Unnamed Location';
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#NAME_DISPLAY_ID} not found.`);
        }

        if (descriptionDisplay) {
            this._clearElementContent(descriptionDisplay);
            descriptionDisplay.textContent = locationDto.description || 'You see nothing remarkable.';
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#DESCRIPTION_DISPLAY_ID} not found.`);
        }

        if (exitsDisplay) {
            this._renderList(locationDto.exits, exitsDisplay, 'Exits', 'description', '(None visible)');
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#EXITS_DISPLAY_ID} not found.`);
        }

        if (itemsDisplay) {
            this._renderList(locationDto.items, itemsDisplay, 'Items', 'name', '(None seen)');
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#ITEMS_DISPLAY_ID} not found.`);
        }

        if (entitiesDisplay) {
            this._renderList(locationDto.entities, entitiesDisplay, 'Entities', 'name', '(None seen)');
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#ENTITIES_DISPLAY_ID} not found.`);
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