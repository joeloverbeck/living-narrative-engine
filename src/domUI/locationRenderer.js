// src/domUI/locationRenderer.js
import {RendererBase} from './rendererBase.js';
// DomElementFactory is not explicitly used in the new version of render directly,
// but it is used by the helper methods, so the import might be kept if helpers are complex.
// For this refactor, we'll ensure it's available and used in helpers.
// import DomElementFactory from './domElementFactory.js'; // Keep if helpers use it extensively

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 * @typedef {import('./domElementFactory').default} DomElementFactory // Correctly typed import
 */

/**
 * Represents the data structure for displaying a location.
 * @typedef {object} LocationDisplayPayload
 * @property {string} name - The name of the location.
 * @property {string} description - The textual description of the location.
 * @property {Array<{description: string, id?: string}>} exits - List of exits from the location. (id might be added for future use as per #302)
 * @property {Array<{id: string, name: string}>} [items] - Optional list of items present in the location.
 * @property {Array<{id: string, name: string}>} [entities] - Optional list of entities (NPCs, etc.) present.
 */

/**
 * Renders the details of the current game location (name, description, exits, items, entities)
 * into designated child elements within '#location-info-container'.
 * Subscribes to 'event:display_location' via VED.
 */
export class LocationRenderer extends RendererBase {
    /**
     * The main container element for location info, expected to be '#location-info-container'.
     * This is used as the root to query for sub-elements.
     * @private
     * @type {HTMLElement}
     */
    #baseContainerElement; // This will be #location-info-container

    /**
     * Factory for creating DOM elements programmatically.
     * @private
     * @type {DomElementFactory}
     */
    #domElementFactory;

    /**
     * Stores VED subscriptions for later disposal.
     * @private
     * @type {Array<IEventSubscription|undefined>}
     */
    #subscriptions = [];

    // IDs of the target sub-elements
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


    /**
     * Creates an instance of LocationRenderer.
     *
     * @param {object} deps - Dependencies object.
     * @param {ILogger} deps.logger - The logger instance.
     * @param {IDocumentContext} deps.documentContext - The document context.
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - The event dispatcher.
     * @param {DomElementFactory} deps.domElementFactory - Factory for creating DOM elements.
     * @param {HTMLElement | null} deps.containerElement - The container element ('#location-info-container') to render location details into.
     * @throws {Error} If dependencies are invalid, especially containerElement or domElementFactory.
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    containerElement // This should be #location-info-container
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        if (!containerElement || containerElement.nodeType !== 1) {
            // Renaming to #baseContainerElement to clarify its role as the parent of the specific display areas.
            const errMsg = `${this._logPrefix} 'containerElement' (expected '#location-info-container') dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#baseContainerElement = containerElement;
        this.logger.debug(`${this._logPrefix} Attached to base container element:`, this.#baseContainerElement);

        this.#subscribeToEvents();
    }

    /**
     * Subscribes to VED events relevant for rendering the location.
     * @private
     */
    #subscribeToEvents() {
        const ved = this.validatedEventDispatcher;
        this.#subscriptions.push(
            ved.subscribe('event:display_location', this.#handleDisplayLocation.bind(this))
        );
        this.logger.debug(`${this._logPrefix} Subscribed to VED event 'event:display_location'.`);
    }

    /**
     * Handles the 'event:display_location' event from VED.
     * Validates the payload and calls the public render method.
     * @private
     * @param {LocationDisplayPayload | object} payload - Expected payload for 'event:display_location'.
     * @param {string} eventType - The name of the triggered event.
     */
    #handleDisplayLocation(payload, eventType) {
        this.logger.debug(`${this._logPrefix} Received '${eventType}' event. Payload:`, payload);

        if (
            payload &&
            typeof payload.name === 'string' &&
            typeof payload.description === 'string' &&
            Array.isArray(payload.exits) &&
            (!payload.items || Array.isArray(payload.items)) &&
            (!payload.entities || Array.isArray(payload.entities))
        ) {
            const locationData = /** @type {LocationDisplayPayload} */ (payload);
            this.render(locationData);
        } else {
            this.logger.error(`${this._logPrefix} Received invalid or incomplete payload for '${eventType}'. Cannot render location. Payload:`, payload);
            this.#clearAllDisplaysOnError();
        }
    }

    /**
     * Clears all specific display areas in case of a major error or invalid payload.
     * @private
     */
    #clearAllDisplaysOnError() {
        const idsToClear = [
            LocationRenderer.#NAME_DISPLAY_ID,
            LocationRenderer.#DESCRIPTION_DISPLAY_ID,
            LocationRenderer.#EXITS_DISPLAY_ID,
            LocationRenderer.#ITEMS_DISPLAY_ID,
            LocationRenderer.#ENTITIES_DISPLAY_ID
        ];
        let errorLogged = false;
        for (const id of idsToClear) {
            try {
                const element = this.documentContext.query(`#${id}`);
                if (element) {
                    this._clearElementContent(element);
                    const pError = this.#domElementFactory.p('error-message', '(Error displaying this section)');
                    if (pError) element.appendChild(pError);
                } else if (!errorLogged) {
                    // Log only once if a general query issue is suspected
                    this.logger.warn(`${this._logPrefix} Could not find element #${id} to clear on error.`);
                    errorLogged = true; // Avoid flooding logs if many are missing
                }
            } catch (e) {
                this.logger.error(`${this._logPrefix} Error while clearing element #${id}:`, e);
            }
        }
    }


    // --- Private Helper Methods ---

    /**
     * Clears the content of a given HTML element.
     * @private
     * @param {HTMLElement} element - The element to clear.
     */
    _clearElementContent(element) {
        if (element) {
            // More robust clearing than innerHTML = ''
            while (element.firstChild) {
                element.removeChild(element.firstChild);
            }
        }
    }

    /**
     * Renders a list of items (exits, items, entities) into a target element.
     * Creates a title for the list and then either a list of items or an "empty" message.
     * @private
     * @param {Array<object> | undefined} dataArray - The array of data objects to render.
     * @param {HTMLElement} targetElement - The DOM element to render into.
     * @param {string} title - The title for this section (e.g., "Exits", "Items").
     * @param {string} itemTextProperty - The property name on each data object that contains the text to display (e.g., 'description', 'name').
     * @param {string} emptyText - Text to display if dataArray is empty (e.g., "(None)").
     * @param {string} itemClassName - Optional CSS class for each list item element.
     */
    _renderList(dataArray, targetElement, title, itemTextProperty, emptyText, itemClassName = 'list-item') {
        this._clearElementContent(targetElement);

        // Create and append title (e.g., <h4>Exits:</h4>)
        // Using H4 for semantic structure below H2 for location name.
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
                this.logger.warn(`${this._logPrefix} Failed to create empty message for ${title}.`);
                targetElement.appendChild(this.documentContext.document.createTextNode(emptyText)); // Fallback
            }
        } else {
            const ul = this.#domElementFactory.ul(undefined, 'location-detail-list'); // class for the <ul>
            if (!ul) {
                this.logger.error(`${this._logPrefix} Failed to create UL element for ${title}.`);
                // Fallback to just appending text if UL creation fails
                dataArray.forEach(item => {
                    const text = item[itemTextProperty] || 'Unnamed';
                    const pItem = this.#domElementFactory.p(itemClassName, text);
                    if (pItem) targetElement.appendChild(pItem);
                });
                return;
            }

            dataArray.forEach(item => {
                const text = item[itemTextProperty] || `(Invalid ${itemTextProperty})`;
                const li = this.#domElementFactory.li(itemClassName, text);
                if (li) {
                    // For exits, Ticket #302 will add clickability here.
                    // For now, just text.
                    ul.appendChild(li);
                } else {
                    this.logger.warn(`${this._logPrefix} Failed to create LI element for item in ${title}.`);
                }
            });
            targetElement.appendChild(ul);
        }
    }

    // --- Public API ---

    /**
     * Renders the location details into their designated sub-elements within '#location-info-container'.
     *
     * @param {LocationDisplayPayload} locationDto - The location data to render.
     */
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
            this.logger.warn(`${this._logPrefix} Received null or undefined location DTO. Clearing location display sections.`);
            this.#clearAllDisplaysOnError();
            return;
        }

        this.logger.debug(`${this._logPrefix} Rendering location: "${locationDto.name}" into specific sub-elements.`);

        // Get references to the target sub-elements
        const nameDisplay = this.documentContext.query(`#${LocationRenderer.#NAME_DISPLAY_ID}`);
        const descriptionDisplay = this.documentContext.query(`#${LocationRenderer.#DESCRIPTION_DISPLAY_ID}`);
        const exitsDisplay = this.documentContext.query(`#${LocationRenderer.#EXITS_DISPLAY_ID}`);
        const itemsDisplay = this.documentContext.query(`#${LocationRenderer.#ITEMS_DISPLAY_ID}`);
        const entitiesDisplay = this.documentContext.query(`#${LocationRenderer.#ENTITIES_DISPLAY_ID}`);

        // --- Render Location Name ---
        if (nameDisplay) {
            this._clearElementContent(nameDisplay); // Clear first
            nameDisplay.textContent = locationDto.name || 'Unnamed Location';
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#NAME_DISPLAY_ID} not found.`);
        }

        // --- Render Location Description ---
        if (descriptionDisplay) {
            this._clearElementContent(descriptionDisplay); // Clear first
            // Per ticket: "Assume textContent for safety unless specified"
            descriptionDisplay.textContent = locationDto.description || 'You see nothing remarkable.';
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#DESCRIPTION_DISPLAY_ID} not found.`);
        }

        // --- Render Exits ---
        if (exitsDisplay) {
            this._renderList(
                locationDto.exits,
                exitsDisplay,
                'Exits',
                'description',
                '(None)'
            );
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#EXITS_DISPLAY_ID} not found.`);
        }

        // --- Render Items ---
        if (itemsDisplay) {
            this._renderList(
                locationDto.items,
                itemsDisplay,
                'Items',
                'name',
                '(None seen)'
            );
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#ITEMS_DISPLAY_ID} not found.`);
        }

        // --- Render Entities ---
        if (entitiesDisplay) {
            this._renderList(
                locationDto.entities,
                entitiesDisplay,
                'Entities',
                'name',
                '(None seen)'
            );
        } else {
            this.logger.error(`${this._logPrefix} Element #${LocationRenderer.#ENTITIES_DISPLAY_ID} not found.`);
        }

        this.logger.info(`${this._logPrefix} Location "${locationDto.name}" rendered into sub-elements successfully.`);
    }

    /**
     * Dispose method for cleanup. Unsubscribes from all VED events.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        this.#subscriptions = [];
        super.dispose();
    }
}