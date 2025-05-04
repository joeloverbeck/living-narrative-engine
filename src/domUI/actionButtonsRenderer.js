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
 * Represents the payload for the 'textUI:update_available_actions' event.
 * @typedef {object} UIUpdateActionsPayload
 * @property {AvailableAction[]} actions - An array of action objects available to the player.
 */

/**
 * Manages the rendering of action buttons in a specified container element.
 * Subscribes to 'textUI:update_available_actions' to dynamically update the buttons.
 */
export class ActionButtonsRenderer extends RendererBase {
    /**
     * The container element where action buttons are rendered.
     * @private
     * @type {HTMLElement}
     */
    #actionButtonsContainer;

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
     * Creates an instance of ActionButtonsRenderer.
     *
     * @param {object} deps - Dependencies object.
     * @param {ILogger} deps.logger - The logger instance.
     * @param {IDocumentContext} deps.documentContext - The document context.
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher - The event dispatcher.
     * @param {DomElementFactory} deps.domElementFactory - Factory for creating DOM elements.
     * @param {HTMLElement | null} deps.actionButtonsContainer - The specific container element for action buttons.
     * @throws {Error} If dependencies are invalid, especially actionButtonsContainer or domElementFactory.
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    actionButtonsContainer
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        // --- Validate specific dependencies ---
        if (!domElementFactory || typeof domElementFactory.create !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid.`;
            this.logger.error(errMsg);
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        // Acceptance Criteria: Throws if container missing
        if (!actionButtonsContainer || actionButtonsContainer.nodeType !== 1) {
            const errMsg = `${this._logPrefix} 'actionButtonsContainer' dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg, {receivedElement: actionButtonsContainer});
            throw new Error(errMsg); // Throw as required by acceptance criteria
        }
        this.#actionButtonsContainer = actionButtonsContainer;
        this.logger.debug(`${this._logPrefix} Attached to action buttons container element:`, actionButtonsContainer);

        // Subscribe to events that trigger button updates
        this.#subscribeToEvents();
    }

    /**
     * Subscribes to VED events relevant for updating the action buttons.
     * @private
     */
    #subscribeToEvents() {
        const ved = this.validatedEventDispatcher;

        this.#subscriptions.push(
            // Listen for the event that carries the list of available actions
            ved.subscribe('textUI:update_available_actions', this.#handleUpdateActions.bind(this))
        );

        this.logger.debug(`${this._logPrefix} Subscribed to VED event 'textUI:update_available_actions'.`);
    }

    // --- Private Event Handler ---

    /**
     * Handles the 'textUI:update_available_actions' event from VED.
     * Validates the payload and calls the public render method.
     * @private
     * @param {UIUpdateActionsPayload | object} payload - Expected payload for 'textUI:update_available_actions'.
     * @param {string} eventType - The name of the triggered event.
     */
    #handleUpdateActions(payload, eventType) {
        this.logger.debug(`${this._logPrefix} Received '${eventType}' event. Payload:`, payload);

        // Basic payload validation
        if (payload && Array.isArray(payload.actions)) {
            // Type assertion for clarity after validation
            const validatedPayload = /** @type {UIUpdateActionsPayload} */ (payload);

            // Filter out any invalid action objects
            // --- NOTE: This filter matches the stricter validation we're adding to render() ---
            const validActions = validatedPayload.actions.filter(action =>
                action && typeof action === 'object' &&
                typeof action.id === 'string' && action.id.length > 0 && // ID must be non-empty string
                typeof action.command === 'string' && action.command.trim().length > 0 // Command must be non-empty/whitespace string
            );

            if (validActions.length !== validatedPayload.actions.length) {
                this.logger.warn(`${this._logPrefix} Received '${eventType}' with some invalid items in the actions array. Only valid action objects will be rendered.`, payload);
            }
            this.render(validActions);
        } else {
            this.logger.warn(`${this._logPrefix} Received invalid or incomplete payload for '${eventType}'. Clearing action buttons. Payload:`, payload);
            this.render([]); // Clear buttons if payload is bad
        }
    }

    // --- Private Helpers ---

    /**
     * Clears the content of the action buttons container element.
     * @private
     */
    #clearContainer() {
        if (this.#actionButtonsContainer) {
            // More robust clearing than innerHTML = ''
            while (this.#actionButtonsContainer.firstChild) {
                this.#actionButtonsContainer.removeChild(this.#actionButtonsContainer.firstChild);
            }
        }
    }

    /**
     * Helper to dispatch a 'core:submit_command' event via VED.
     * @private
     * @param {string} commandString - The command text to submit.
     * @returns {Promise<boolean>} True if the event was successfully dispatched, false otherwise.
     */
    async #dispatchSubmitCommand(commandString) {
        this.logger.debug(`${this._logPrefix} Attempting to dispatch 'core:submit_command' for: "${commandString}"`);
        try {
            // Make sure to use the injected instance from the base class
            const dispatched = await this.validatedEventDispatcher.dispatchValidated(
                'core:submit_command',
                {command: commandString} // Ensure payload matches expected schema
            );

            if (dispatched) {
                this.logger.info(`${this._logPrefix} Event 'core:submit_command' for "${commandString}" dispatched successfully.`);
                return true;
            } else {
                // Validation likely failed or an interceptor prevented dispatch
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
     * Renders a list of action buttons into the container element.
     * Clears previous buttons and creates new ones based on the provided actions array.
     * Each button, when clicked, dispatches a 'core:submit_command' event.
     *
     * @param {AvailableAction[]} actions - An array of action objects, where each object contains an action ID and command string.
     */
    render(actions) {
        if (!this.#actionButtonsContainer) {
            // Should not happen if constructor threw error correctly
            this.logger.error(`${this._logPrefix} Cannot render action buttons, container element is not set or invalid.`);
            return;
        }
        if (!this.#domElementFactory) {
            // Should not happen if constructor validated correctly
            this.logger.error(`${this._logPrefix} Cannot render action buttons, domElementFactory is not available.`);
            return;
        }
        if (!Array.isArray(actions)) {
            this.logger.error(`${this._logPrefix} Invalid actions argument received. Expected array, got:`, actions);
            this.#clearContainer(); // Clear container on invalid input
            return;
        }

        // 1. Clear existing content
        this.#clearContainer();

        // 2. Handle empty actions list
        if (actions.length === 0) {
            this.logger.debug(`${this._logPrefix} No actions provided, container cleared.`);
            return; // Nothing more to do
        }

        this.logger.debug(`${this._logPrefix} Rendering ${actions.length} action buttons.`);

        // 3. Create and append buttons for each action
        actions.forEach(actionObject => {
            // --- UPDATED VALIDATION: Now also checks for valid 'id' ---
            if (!actionObject ||
                typeof actionObject.id !== 'string' || actionObject.id.length === 0 || // ID must be non-empty string
                typeof actionObject.command !== 'string' || actionObject.command.trim() === '') // Command must be non-empty/whitespace string
            {
                this.logger.warn(`${this._logPrefix} Skipping invalid or empty action object in list: `, actionObject);
                return; // Skip this action
            }
            // --- END UPDATED VALIDATION ---

            const commandText = actionObject.command.trim();
            const actionId = actionObject.id; // ID is now guaranteed valid here

            // Use DomElementFactory to create the button
            // TODO: Get class name from a central ui-classes.ts/enum if available
            const button = this.#domElementFactory.button(commandText, 'action-button');

            if (!button) {
                this.logger.error(`${this._logPrefix} Failed to create button element for action: "${commandText}" (ID: ${actionId})`);
                return; // Skip if button creation failed
            }

            // Add title attribute for accessibility/tooltip
            button.setAttribute('title', `Click to ${commandText}`);
            // Optional: Add data attribute for the action ID
            button.setAttribute('data-action-id', actionId);

            // Attach click listener to dispatch command
            button.addEventListener('click', async () => {
                const commandToSubmit = button.textContent; // Get text at time of click
                if (!commandToSubmit) {
                    this.logger.warn(`${this._logPrefix} Action button clicked, but textContent is unexpectedly empty. ID: ${button.getAttribute('data-action-id')}`);
                    return;
                }
                // Call the private helper to dispatch the event
                await this.#dispatchSubmitCommand(commandToSubmit);
                // Optional: Add visual feedback on click? (e.g., brief style change)
            });

            // Append the fully configured button to the container
            this.#actionButtonsContainer.appendChild(button);
        });

        this.logger.info(`${this._logPrefix} Rendered ${this.#actionButtonsContainer.children.length} action buttons.`);
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
        this.#subscriptions = []; // Clear the array
        super.dispose(); // Call base class dispose for logging
    }
}