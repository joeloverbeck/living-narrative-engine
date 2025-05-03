// src/domUI/locationRenderer.js
import {RendererBase} from './rendererBase.js';
import DomElementFactory from './domElementFactory.js';

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 */

/**
 * Represents the data structure for displaying a location.
 * Based on the structure used in the old DomRenderer#renderLocation and event payload.
 * @typedef {object} LocationDisplayPayload
 * @property {string} name - The name of the location.
 * @property {string} description - The textual description of the location.
 * @property {Array<{description: string}>} exits - List of exits from the location.
 * @property {Array<{id: string, name: string}>} [items] - Optional list of items present in the location. (Assuming ID might be useful later).
 * @property {Array<{id: string, name: string}>} [entities] - Optional list of entities (NPCs, etc.) present. (Assuming ID might be useful later).
 */

/**
 * Renders the details of the current game location (name, description, exits, items, entities)
 * into a designated container element. Subscribes to 'event:display_location' via VED.
 */
export class LocationRenderer extends RendererBase {
    /**
     * The DOM element where location details are rendered.
     * @private
     * @type {HTMLElement}
     */
    #containerElement;

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

    /**
     * Creates an instance of LocationRenderer.
     *
     * @param {object} deps - Dependencies object.
     * @param {ILogger} deps.logger - The logger instance.
     * @param {IDocumentContext} deps.documentContext - The document context.
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - The event dispatcher.
     * @param {DomElementFactory} deps.domElementFactory - Factory for creating DOM elements.
     * @param {HTMLElement | null} deps.containerElement - The container element to render location details into.
     * @throws {Error} If dependencies are invalid, especially containerElement or domElementFactory.
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    containerElement
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        // --- Validate specific dependencies ---
        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        if (!containerElement || containerElement.nodeType !== 1) {
            const errMsg = `${this._logPrefix} 'containerElement' dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#containerElement = containerElement;
        this.logger.debug(`${this._logPrefix} Attached to container element:`, containerElement);

        // Subscribe to events that trigger location rendering
        this.#subscribeToEvents();
    }

    /**
     * Subscribes to VED events relevant for rendering the location.
     * @private
     */
    #subscribeToEvents() {
        const ved = this.validatedEventDispatcher;

        this.#subscriptions.push(
            // Listen for the event that carries location data
            ved.subscribe('event:display_location', this.#handleDisplayLocation.bind(this))
        );

        this.logger.debug(`${this._logPrefix} Subscribed to VED event 'event:display_location'.`);
    }

    // --- Private Event Handler ---

    /**
     * Handles the 'event:display_location' event from VED.
     * Validates the payload and calls the public render method.
     * @private
     * @param {LocationDisplayPayload | object} payload - Expected payload for 'event:display_location'.
     * @param {string} eventType - The name of the triggered event.
     */
    #handleDisplayLocation(payload, eventType) {
        this.logger.debug(`${this._logPrefix} Received '${eventType}' event. Payload:`, payload);

        // Basic payload validation (more robust validation should ideally use schemas)
        if (
            payload &&
            typeof payload.name === 'string' &&
            typeof payload.description === 'string' &&
            Array.isArray(payload.exits) &&
            (!payload.items || Array.isArray(payload.items)) && // items are optional but must be array if present
            (!payload.entities || Array.isArray(payload.entities)) // entities are optional but must be array if present
        ) {
            // Type assertion for clarity after validation
            const locationData = /** @type {LocationDisplayPayload} */ (payload);
            this.render(locationData);
        } else {
            this.logger.error(`${this._logPrefix} Received invalid or incomplete payload for '${eventType}'. Cannot render location. Payload:`, payload);
            // Optionally clear the container or display an error message
            this.#clearContainer();
            // Use factory to create error message - adhering to "no HTML strings" rule
            const errorMsg = this.#domElementFactory.p('error-message', 'Error: Could not display location details.');
            if (errorMsg) {
                this.#containerElement.appendChild(errorMsg);
            }
        }
    }

    // --- Private Helpers ---

    /**
     * Clears the content of the container element.
     * @private
     */
    #clearContainer() {
        if (this.#containerElement) {
            // More robust clearing than innerHTML = ''
            while (this.#containerElement.firstChild) {
                this.#containerElement.removeChild(this.#containerElement.firstChild);
            }
        }
    }

    /**
     * Creates and appends a paragraph element for a list of named items (Items or Entities).
     * @private
     * @param {string} label - e.g., "Items here:"
     * @param {Array<{name: string}> | undefined} items - The list of items/entities.
     * @param {string} className - CSS class for the paragraph.
     */
    #renderNamedList(label, items, className) {
        if (items && items.length > 0) {
            // Use map to safely access name, provide fallback
            const itemNames = items
                .map(item => (item && item.name) || 'unnamed item')
                .join(', ');
            const p = this.#domElementFactory.p(className, `${label} ${itemNames}`);
            if (p) {
                this.#containerElement.appendChild(p);
            } else {
                this.logger.warn(`${this._logPrefix} Failed to create paragraph for ${label}.`);
            }
        }
    }

    /**
     * Creates and appends elements for displaying exits.
     * Uses spans within a paragraph for better structure and potential styling.
     * @private
     * @param {Array<{description: string}>} exits - The list of exits.
     * @param {string} className - CSS class for the main paragraph container.
     */
    #renderExits(exits, className) {
        const p = this.#domElementFactory.p(className);
        if (!p) {
            this.logger.warn(`${this._logPrefix} Failed to create paragraph for exits.`);
            return;
        }

        const labelSpan = this.#domElementFactory.span(undefined, 'Exits:');
        if (labelSpan) {
            p.appendChild(labelSpan);
        }

        if (exits && exits.length > 0) {
            exits.forEach((exit) => {
                const br = this.#domElementFactory.create('br'); // Create <br> using factory
                // Use map to safely access description, provide fallback
                const exitDesc = (exit && exit.description) || 'an exit';
                const exitSpan = this.#domElementFactory.span('location__exit-detail', `  ${exitDesc}`);

                if (br) { // Add line break before each exit description
                    p.appendChild(br);
                }
                if (exitSpan) {
                    p.appendChild(exitSpan);
                } else {
                    this.logger.warn(`${this._logPrefix} Failed to create span for exit: ${exitDesc}`);
                }
            });
        } else {
            // Handle the "None" case explicitly
            const br = this.#domElementFactory.create('br');
            const noneSpan = this.#domElementFactory.span('location__exit-detail', '  None');
            if (br) p.appendChild(br);
            if (noneSpan) {
                p.appendChild(noneSpan);
            } else {
                this.logger.warn(`${this._logPrefix} Failed to create span for 'None' exit.`);
            }
        }
        this.#containerElement.appendChild(p);
    }


    // --- Public API ---

    /**
     * Renders the location details into the designated container element.
     * Clears previous content and builds the new view using DomElementFactory.
     * Conforms to the "No HTML strings" rule.
     *
     * @param {LocationDisplayPayload} locationDto - The location data to render.
     */
    render(locationDto) {
        if (!this.#containerElement) {
            this.logger.error(`${this._logPrefix} Cannot render location, containerElement is not set.`);
            return;
        }
        if (!this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render location, domElementFactory is not available.`);
            return;
        }
        if (!locationDto) {
            // Handle potentially null/undefined DTO more gracefully
            this.logger.warn(`${this._logPrefix} Received null or undefined location DTO. Clearing location display.`);
            this.#clearContainer();
            const emptyMsg = this.#domElementFactory.p('location__empty', 'No location information available.');
            if (emptyMsg) {
                this.#containerElement.appendChild(emptyMsg);
            }
            return; // Stop execution if DTO is invalid
        }

        this.logger.debug(`${this._logPrefix} Rendering location: "${locationDto.name}"`);

        // 1. Clear existing content
        this.#clearContainer();

        // 2. Create and append elements using DomElementFactory
        // CSS classes are derived from the old renderer's structure.
        // Ideally, these would come from a central ui-classes enum/object.
        const nameEl = this.#domElementFactory.h3('location__name', locationDto.name || 'Unnamed Location');
        const descEl = this.#domElementFactory.p('location__description', locationDto.description || 'You see nothing remarkable.');

        // Append core elements, checking if creation succeeded
        if (nameEl) this.#containerElement.appendChild(nameEl);
        else this.logger.warn(`${this._logPrefix} Failed to create location name element.`);

        if (descEl) this.#containerElement.appendChild(descEl);
        else this.logger.warn(`${this._logPrefix} Failed to create location description element.`);


        // 3. Render Items list (if any) using the helper
        this.#renderNamedList('Items here:', locationDto.items, 'location__items');

        // 4. Render Entities list (if any) using the helper
        this.#renderNamedList('Others here:', locationDto.entities, 'location__entities');

        // 5. Render Exits using the helper
        this.#renderExits(locationDto.exits, 'location__exits');

        this.logger.info(`${this._logPrefix} Location "${locationDto.name}" rendered successfully.`);
    }

    /**
     * Dispose method for cleanup. Unsubscribes from all VED events.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => {
            // Check if sub exists and has an unsubscribe method before calling
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        this.#subscriptions = []; // Clear the array after unsubscribing
        super.dispose(); // Call base class dispose for logging
    }
}