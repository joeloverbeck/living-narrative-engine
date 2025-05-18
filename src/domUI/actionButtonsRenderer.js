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
 * @property {string} command - The formatted command string (e.g., 'wait', 'go north'), also used as button text.
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
 * @typedef {object} CorePlayerTurnSubmittedPayload
 * @property {NamespacedId} actionId - The unique identifier of the selected AvailableAction.
 * @property {string | null} speech - The text from the speech input field, or null if empty.
 */


/**
 * Manages the rendering of action buttons in a specified container element.
 * Subscribes to 'textUI:update_available_actions' to dynamically update the buttons.
 * Implements single-action selection logic and handles submission of the selected action.
 */
export class ActionButtonsRenderer extends RendererBase {
    /** @private @type {HTMLElement} */
    #actionButtonsContainer;
    /** @private @type {DomElementFactory} */
    #domElementFactory;
    /** @private @type {Array<IEventSubscription|undefined>} */
    #subscriptions = [];
    /** @private @readonly */
    _EVENT_TYPE_SUBSCRIBED = 'textUI:update_available_actions';
    /** @private @readonly */
    _PLAYER_TURN_SUBMITTED_EVENT_TYPE = 'core:player_turn_submitted'; // As per user note

    /**
     * Stores the currently selected action object.
     * @type {AvailableAction | null}
     */
    selectedAction = null;

    /**
     * Stores the array of available action objects passed to the render method.
     * @type {AvailableAction[]}
     */
    availableActions = [];

    /**
     * The button element to confirm the selected action.
     * @type {HTMLButtonElement | { tagName?: string, disabled?: boolean, addEventListener?: Function } | null}
     */
    sendButtonElement = null;

    /**
     * The speech input field element.
     * @type {HTMLInputElement | null}
     * @private
     */
    #speechInputElement = null;

    /**
     * Stores the bound #handleSendAction method for easy removal of event listener.
     * @type {(() => void) | null}
     * @private
     */
    #boundHandleSendAction = null;

    /**
     * Creates an instance of ActionButtonsRenderer.
     * @param {object} deps Dependencies object.
     * @param {ILogger} deps.logger
     * @param {IDocumentContext} deps.documentContext
     * @param {IValidatedEventDispatcher} deps.validatedEventDispatcher
     * @param {DomElementFactory} deps.domElementFactory
     * @param {HTMLElement | null} deps.actionButtonsContainer
     * @param {HTMLButtonElement | { tagName?: string, disabled?: boolean, addEventListener?: Function } | null} deps.sendButtonElement - The "Confirm Action" button.
     */
    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    actionButtonsContainer,
                    sendButtonElement
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

        const confirmButtonCandidate = sendButtonElement || this.documentContext.query('#player-confirm-turn-button');

        // Check if it's a valid HTMLButtonElement OR a mock object with tagName 'BUTTON'
        const isValidButtonInterface = !!(confirmButtonCandidate && (
            (typeof HTMLButtonElement !== 'undefined' && confirmButtonCandidate instanceof HTMLButtonElement) ||
            (typeof confirmButtonCandidate.tagName === 'string' && confirmButtonCandidate.tagName.toUpperCase() === 'BUTTON')
        ));

        if (isValidButtonInterface) {
            this.sendButtonElement = confirmButtonCandidate;
            if (typeof this.sendButtonElement.disabled !== 'undefined') { // Check if disabled property exists
                this.sendButtonElement.disabled = true; // Initially disable
            }
            this.#boundHandleSendAction = this.#handleSendAction.bind(this);
            if (typeof this.sendButtonElement.addEventListener === 'function') {
                this.sendButtonElement.addEventListener('click', this.#boundHandleSendAction);
                this.logger.debug(`${this._logPrefix} 'Confirm Action' button registered and click listener added:`, this.sendButtonElement);
            } else {
                this.logger.warn(`${this._logPrefix} 'Confirm Action' button registered but 'addEventListener' is not a function. Click listener NOT added.`, this.sendButtonElement);
            }
        } else {
            this.logger.warn(`${this._logPrefix} 'Confirm Action' button ('#player-confirm-turn-button' or provided sendButtonElement) was not found or is not a valid button type. Confirm button functionality will be unavailable.`);
            this.sendButtonElement = null;
        }

        const speechInput = this.documentContext.query('#command-input');
        if (speechInput && (typeof HTMLInputElement !== 'undefined' && speechInput instanceof HTMLInputElement)) {
            this.#speechInputElement = speechInput;
            this.logger.debug(`${this._logPrefix} Speech input element ('#command-input') cached:`, this.#speechInputElement);
        } else if (speechInput) { // It's some other kind of object from query
            this.logger.warn(`${this._logPrefix} Element found for '#command-input' but it is not an HTMLInputElement. Speech input may not function as expected.`, speechInput);
            // Attempt to use it if it quacks like an input (has .value) - for POJO mocks primarily
            if (typeof speechInput.value === 'string') {
                // @ts-ignore
                this.#speechInputElement = speechInput;
                this.logger.debug(`${this._logPrefix} Non-HTMLInputElement for '#command-input' will be used based on presence of 'value' property.`);
            } else {
                this.#speechInputElement = null;
            }
        } else {
            this.logger.warn(`${this._logPrefix} Speech input element ('#command-input') not found. Speech input will be unavailable for submitted actions.`);
            this.#speechInputElement = null;
        }

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

    /**
     * Handles the event object dispatched for 'textUI:update_available_actions'.
     * @private
     * @param {UIUpdateActionsEventObject | object | null | undefined} eventObject - The full event object.
     */
    #handleUpdateActions(eventObject) {
        const eventTypeForLog = eventObject?.type ?? this._EVENT_TYPE_SUBSCRIBED;
        this.logger.debug(`${this._logPrefix} Received event object for '${eventTypeForLog}'. Event Object:`, eventObject);

        if (eventObject &&
            typeof eventObject === 'object' &&
            eventObject.payload &&
            typeof eventObject.payload === 'object' &&
            Array.isArray(eventObject.payload.actions)) {
            const validatedEventObject = /** @type {UIUpdateActionsEventObject} */ (eventObject);
            const innerPayload = validatedEventObject.payload;

            const validActions = innerPayload.actions.filter(action =>
                action && typeof action === 'object' &&
                typeof action.id === 'string' && action.id.length > 0 &&
                typeof action.command === 'string' && action.command.trim().length > 0
            );

            if (validActions.length !== innerPayload.actions.length) {
                this.logger.warn(`${this._logPrefix} Received '${eventTypeForLog}' with some invalid items in the nested actions array. Only valid action objects will be rendered. Original event object:`, eventObject);
            }
            this.render(validActions);
        } else {
            this.logger.warn(`${this._logPrefix} Received invalid or incomplete event object structure for '${eventTypeForLog}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons. Received object:`, eventObject);
            this.render([]);
        }
    }

    /**
     * Clears the action buttons container and resets selection state.
     * @private
     */
    #clearContainer() {
        if (this.#actionButtonsContainer) {
            // @ts-ignore
            while (this.#actionButtonsContainer.firstChild) {
                // @ts-ignore
                this.#actionButtonsContainer.removeChild(this.#actionButtonsContainer.firstChild);
            }
        }
        this.selectedAction = null;

        if (this.sendButtonElement && typeof this.sendButtonElement.disabled !== 'undefined') {
            this.sendButtonElement.disabled = true;
        }
        this.logger.debug(`${this._logPrefix} Action buttons container cleared, selected action reset, confirm button disabled.`);
    }

    /**
     * Renders action buttons based on the provided actions array.
     * Manages selection state of buttons.
     * @param {AvailableAction[]} actions - An array of valid action objects.
     */
    render(actions) {
        this.availableActions = Array.isArray(actions) ? actions : [];
        this.selectedAction = null;

        this.logger.debug(`${this._logPrefix} render() called. Total actions received: ${this.availableActions.length}. Selected action reset.`, {actions: this.availableActions});

        if (!this.#actionButtonsContainer) {
            this.logger.error(`${this._logPrefix} Cannot render: 'actionButtonsContainer' is not set.`);
            return;
        }
        if (!this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render: 'domElementFactory' is not available.`);
            return;
        }

        this.#clearContainer();
        this.availableActions = Array.isArray(actions) ? actions : [];


        if (this.availableActions.length === 0) {
            this.logger.debug(`${this._logPrefix} No actions provided to render, container remains empty. Confirm button remains disabled.`);
            return;
        }

        this.availableActions.forEach(actionObject => {
            if (!actionObject || typeof actionObject.id !== 'string' || actionObject.id.length === 0 ||
                typeof actionObject.command !== 'string' || actionObject.command.trim() === '') {
                this.logger.warn(`${this._logPrefix} Skipping invalid action object during render: `, actionObject);
                return;
            }

            const buttonText = actionObject.command.trim();
            const actionId = actionObject.id;
            const button = this.#domElementFactory.button(buttonText, 'action-button');

            if (!button) {
                this.logger.error(`${this._logPrefix} Failed to create button element for action: "${buttonText}" (ID: ${actionId})`);
                return;
            }

            if (typeof button.setAttribute === 'function') {
                button.setAttribute('title', `Select action: ${buttonText}`);
                button.setAttribute('data-action-id', actionId);
            }


            if (typeof button.addEventListener === 'function') {
                button.addEventListener('click', () => {
                    const clickedActionObjectInListener = this.availableActions.find(a => a.id === actionId);

                    if (!clickedActionObjectInListener) {
                        this.logger.error(`${this._logPrefix} Critical: Clicked action button with ID '${actionId}' but could not find corresponding action in 'this.availableActions'.`, {availableActions: this.availableActions});
                        return;
                    }

                    if (this.selectedAction && this.selectedAction.id === clickedActionObjectInListener.id) {
                        if (typeof button.classList?.remove === 'function') button.classList.remove('selected');
                        this.selectedAction = null;
                        if (this.sendButtonElement && typeof this.sendButtonElement.disabled !== 'undefined') {
                            this.sendButtonElement.disabled = true;
                        }
                        this.logger.info(`${this._logPrefix} Action deselected: '${clickedActionObjectInListener.command}' (ID: ${clickedActionObjectInListener.id})`);
                    } else {
                        if (this.selectedAction) {
                            // @ts-ignore
                            const previousButton = this.#actionButtonsContainer.querySelector(`button.action-button.selected[data-action-id="${this.selectedAction.id}"]`);
                            if (previousButton && typeof previousButton.classList?.remove === 'function') {
                                previousButton.classList.remove('selected');
                            } else if (previousButton) {
                                this.logger.warn(`${this._logPrefix} Found previous button for ID ${this.selectedAction.id} but it has no classList.remove method.`);
                            } else {
                                this.logger.warn(`${this._logPrefix} Could not find the DOM element for the previously selected action (ID: ${this.selectedAction.id}) to remove .selected class.`);
                            }
                        }
                        if (typeof button.classList?.add === 'function') button.classList.add('selected');
                        this.selectedAction = clickedActionObjectInListener;
                        if (this.sendButtonElement && typeof this.sendButtonElement.disabled !== 'undefined') {
                            this.sendButtonElement.disabled = false;
                        }
                        this.logger.info(`${this._logPrefix} Action selected: '${this.selectedAction.command}' (ID: ${this.selectedAction.id})`);
                    }
                });
            }

            if (typeof this.#actionButtonsContainer.appendChild === 'function') {
                this.#actionButtonsContainer.appendChild(button);
            }
        });

        this.logger.info(`${this._logPrefix} Rendered ${this.#actionButtonsContainer.children?.length || 0} action buttons. Selected action: ${this.selectedAction ? `'${this.selectedAction.command}'` : 'none'}.`);
        if (this.sendButtonElement && typeof this.sendButtonElement.disabled !== 'undefined') {
            this.sendButtonElement.disabled = !this.selectedAction;
        }
    }

    /**
     * Handles the click event of the "Confirm Action" button.
     * @private
     */
    async #handleSendAction() {
        if (!this.sendButtonElement) {
            this.logger.error(`${this._logPrefix} #handleSendAction called, but sendButtonElement is null.`);
            return;
        }

        if (!this.selectedAction) {
            this.logger.warn(`${this._logPrefix} 'Confirm Action' clicked, but no action is selected.`);
            if (typeof this.sendButtonElement.disabled !== 'undefined') this.sendButtonElement.disabled = true;
            return;
        }

        let speechText = '';
        if (this.#speechInputElement && typeof this.#speechInputElement.value === 'string') {
            speechText = this.#speechInputElement.value.trim();
        } else {
            this.logger.warn(`${this._logPrefix} Speech input element or its value is not standard. Proceeding without speech text.`);
        }

        const actionId = this.selectedAction.id;
        const command = this.selectedAction.command;
        this.logger.info(`${this._logPrefix} Attempting to send action: '${command}' (ID: ${actionId}), Speech: "${speechText}"`);

        const eventPayload = {actionId, speech: speechText || null};

        try {
            const dispatchResult = await this.validatedEventDispatcher.dispatchValidated(
                this._PLAYER_TURN_SUBMITTED_EVENT_TYPE, eventPayload
            );
            if (dispatchResult) {
                this.logger.debug(`${this._logPrefix} Event '${this._PLAYER_TURN_SUBMITTED_EVENT_TYPE}' dispatched successfully for action ID '${actionId}'.`);
                if (this.#speechInputElement && typeof this.#speechInputElement.value === 'string') this.#speechInputElement.value = '';

                // @ts-ignore
                const selectedButton = this.#actionButtonsContainer.querySelector(`button.action-button.selected[data-action-id="${actionId}"]`);
                if (selectedButton && typeof selectedButton.classList?.remove === 'function') {
                    selectedButton.classList.remove('selected');
                } else {
                    this.logger.warn(`${this._logPrefix} Could not find/deselect the selected action button (ID: ${actionId}) after dispatch.`);
                }
                this.selectedAction = null;
                if (typeof this.sendButtonElement.disabled !== 'undefined') this.sendButtonElement.disabled = true;
            } else {
                this.logger.error(`${this._logPrefix} Failed to dispatch '${this._PLAYER_TURN_SUBMITTED_EVENT_TYPE}' for action ID '${actionId}'.`);
            }
        } catch (error) {
            this.logger.error(`${this._logPrefix} Exception during dispatchValidated for '${this._PLAYER_TURN_SUBMITTED_EVENT_TYPE}' (Action ID: ${actionId}).`, {
                error,
                payload: eventPayload
            });
        }
    }

    /**
     * Dispose method for cleanup.
     */
    dispose() {
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(sub => sub?.unsubscribe());
        this.#subscriptions = [];

        if (this.sendButtonElement && typeof this.sendButtonElement.removeEventListener === 'function' && this.#boundHandleSendAction) {
            this.sendButtonElement.removeEventListener('click', this.#boundHandleSendAction);
            this.logger.debug(`${this._logPrefix} Removed click listener from 'Confirm Action' button.`);
        }
        this.#boundHandleSendAction = null; // Clear bound handler regardless

        this.#clearContainer();
        this.availableActions = [];
        this.#speechInputElement = null;

        this.logger.info(`${this._logPrefix} ActionButtonsRenderer disposed.`);
        super.dispose();
    }
}