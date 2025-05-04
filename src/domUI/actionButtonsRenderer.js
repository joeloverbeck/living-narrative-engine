// src/domUI/actionButtonsRenderer.js
import {RendererBase} from './rendererBase.js';
import DomElementFactory from './domElementFactory.js';

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 * @typedef {import('../core/interfaces/CommonTypes').NamespacedId} NamespacedId
 */

/**
 * Represents an individual action available to the player.
 * @typedef {object} AvailableAction
 * @property {NamespacedId} id - The unique ID of the action definition (e.g., 'core:wait').
 * @property {string} command - The formatted command string (e.g., 'wait', 'go north').
 */

/**
 * Represents the *inner* payload containing the actions array.
 * @typedef {object} UIUpdateActionsInnerPayload
 * @property {AvailableAction[]} actions - An array of action objects available to the player.
 */

/**
 * Represents the *full event object* received by the subscriber.
 * @typedef {object} UIUpdateActionsEventObject
 * @property {string} type - The event type name (e.g., 'textUI:update_available_actions').
 * @property {UIUpdateActionsInnerPayload} payload - The inner payload containing the actions.
 */

/**
 * Manages the rendering of action buttons in a specified container element.
 * Subscribes to 'textUI:update_available_actions' to dynamically update the buttons.
 */
export class ActionButtonsRenderer extends RendererBase {
    /** @private @type {HTMLElement} */
    #actionButtonsContainer;
    /** @private @type {DomElementFactory} */
    #domElementFactory;
    /** @private @type {Array<IEventSubscription|undefined>} */
    #subscriptions = [];
    /** @private @readonly */
    _EVENT_TYPE_SUBSCRIBED = 'textUI:update_available_actions'; // Store for subscription/logging

    /**
     * Creates an instance of ActionButtonsRenderer.
     * @param {object} deps Dependencies object.
     * @param {ILogger} deps.logger
     * @param {IDocumentContext} deps.documentContext
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher
     * @param {DomElementFactory} deps.domElementFactory
     * @param {HTMLElement | null} deps.actionButtonsContainer
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    actionButtonsContainer
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        if (!actionButtonsContainer || actionButtonsContainer.nodeType !== 1) {
            const errMsg = `${this._logPrefix} 'actionButtonsContainer' dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg, {receivedElement: actionButtonsContainer});
            throw new Error(errMsg);
        }
        this.#actionButtonsContainer = actionButtonsContainer;
        this.logger.debug(`${this._logPrefix} Attached to action buttons container element:`, actionButtonsContainer);

        this.#subscribeToEvents();
    }

    /** @private */
    #subscribeToEvents() {
        const ved = this.validatedEventDispatcher;
        this.#subscriptions.push(
            ved.subscribe(this._EVENT_TYPE_SUBSCRIBED, this.#handleUpdateActions.bind(this))
        );
        this.logger.debug(`${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}'.`);
    }

    // --- Private Event Handler ---

    /**
     * Handles the event object dispatched for 'textUI:update_available_actions'.
     * Extracts the actions array from the event object's payload property.
     * Validates the actions array and calls the public render method.
     * NOTE: Assumes the handler receives ONE argument: the event object { type: string, payload: { actions: [...] } }.
     * @private
     * @param {UIUpdateActionsEventObject | object | null | undefined} eventObject - The full event object received from VED.
     */
    #handleUpdateActions(eventObject) {
        const eventTypeForLog = eventObject?.type ?? this._EVENT_TYPE_SUBSCRIBED; // Use actual type if available
        this.logger.debug(`${this._logPrefix} Received event object for '${eventTypeForLog}'. Event Object:`, eventObject);

        // *** CORRECTED VALIDATION LOGIC ***
        // Check if the eventObject is valid, has a payload object, and that payload has an 'actions' array.
        if (eventObject &&
            typeof eventObject === 'object' &&
            eventObject.payload && // Check if inner payload exists
            typeof eventObject.payload === 'object' && // Check if inner payload is an object
            Array.isArray(eventObject.payload.actions)) // Check for actions array *inside* inner payload
        {
            // Type assertion for clarity after validation (assuming eventObject matches UIUpdateActionsEventObject structure)
            const validatedEventObject = /** @type {UIUpdateActionsEventObject} */ (eventObject);
            const innerPayload = validatedEventObject.payload; // Access the inner payload

            // Filter out any invalid action objects within the 'actions' array
            const validActions = innerPayload.actions.filter(action =>
                action && typeof action === 'object' &&
                typeof action.id === 'string' && action.id.length > 0 &&
                typeof action.command === 'string' && action.command.trim().length > 0
            );

            // Warn if some actions were filtered out
            if (validActions.length !== innerPayload.actions.length) {
                this.logger.warn(`${this._logPrefix} Received '${eventTypeForLog}' with some invalid items in the nested actions array. Only valid action objects will be rendered. Original event object:`, eventObject);
            }

            // Render using only the valid actions extracted from the inner payload
            this.render(validActions);

        } else {
            // Log a warning if the event object structure is not as expected
            this.logger.warn(`${this._logPrefix} Received invalid or incomplete event object structure for '${eventTypeForLog}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons. Received object:`, eventObject);
            // Render with an empty array to clear the buttons
            this.render([]);
        }
    }


    // --- Private Helpers ---

    /** @private */
    #clearContainer() {
        if (this.#actionButtonsContainer) {
            while (this.#actionButtonsContainer.firstChild) {
                this.#actionButtonsContainer.removeChild(this.#actionButtonsContainer.firstChild);
            }
        }
    }

    /**
     * @private
     * @param {string} commandString
     * @returns {Promise<boolean>}
     */
    async #dispatchSubmitCommand(commandString) {
        this.logger.debug(`${this._logPrefix} Attempting to dispatch 'core:submit_command' for: "${commandString}"`);
        try {
            const dispatched = await this.validatedEventDispatcher.dispatchValidated(
                'core:submit_command',
                {command: commandString}
            );

            if (dispatched) {
                this.logger.info(`${this._logPrefix} Event 'core:submit_command' for "${commandString}" dispatched successfully.`);
                return true;
            } else {
                this.logger.warn(`${this._logPrefix} Event 'core:submit_command' for "${commandString}" was NOT dispatched (validation failed or prevented by listener). See VED logs.`);
                return false;
            }
        } catch (error) {
            this.logger.error(`${this._logPrefix} Error occurred during dispatch of 'core:submit_command' for "${commandString}":`, error);
            return false;
        }
    }


    // --- Public API ---

    /**
     * Renders action buttons based on the provided actions array.
     * @param {AvailableAction[]} actions - An array of valid action objects.
     */
    render(actions) {
        // Basic validation of dependencies (should have been caught in constructor)
        if (!this.#actionButtonsContainer) {
            this.logger.error(`${this._logPrefix} Cannot render action buttons, container element is not set.`);
            return;
        }
        if (!this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render action buttons, domElementFactory is not available.`);
            return;
        }
        // Validate input 'actions' is an array
        if (!Array.isArray(actions)) {
            this.logger.error(`${this._logPrefix} Invalid actions argument received in render(). Expected array, got:`, actions);
            this.#clearContainer();
            return;
        }

        // 1. Clear existing content
        this.#clearContainer();

        // 2. Handle empty actions list
        if (actions.length === 0) {
            this.logger.debug(`${this._logPrefix} No actions provided to render, container cleared.`);
            return;
        }

        // 3. Create and append buttons for each action
        actions.forEach(actionObject => {
            // Validate each action object *again* for robustness (belt-and-suspenders)
            if (!actionObject || typeof actionObject.id !== 'string' || actionObject.id.length === 0 ||
                typeof actionObject.command !== 'string' || actionObject.command.trim() === '') {
                this.logger.warn(`${this._logPrefix} Skipping invalid action object during render: `, actionObject);
                return;
            }

            const commandText = actionObject.command.trim();
            const actionId = actionObject.id;
            const button = this.#domElementFactory.button(commandText, 'action-button');

            if (!button) {
                this.logger.error(`${this._logPrefix} Failed to create button element for action: "${commandText}" (ID: ${actionId})`);
                return;
            }

            button.setAttribute('title', `Click to ${commandText}`);
            button.setAttribute('data-action-id', actionId);

            button.addEventListener('click', async () => {
                const commandToSubmit = button.textContent?.trim();
                if (!commandToSubmit) {
                    this.logger.warn(`${this._logPrefix} Action button clicked, but its textContent is unexpectedly empty or whitespace. ID: ${button.getAttribute('data-action-id')}`);
                    return;
                }
                await this.#dispatchSubmitCommand(commandToSubmit);
            });

            this.#actionButtonsContainer.appendChild(button);
        });

        this.logger.info(`${this._logPrefix} Rendered ${this.#actionButtonsContainer.children.length} action buttons into container.`);
    }

    /**
     * Dispose method for cleanup.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => sub?.unsubscribe());
        this.#subscriptions = [];
        super.dispose();
    }
}

// --- END OF CORRECTED ActionButtonsRenderer.js ---