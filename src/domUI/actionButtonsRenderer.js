// src/domUI/actionButtonsRenderer.js

import {RendererBase} from './rendererBase.js';
import {PLAYER_TURN_SUBMITTED_ID} from "../core/constants/eventIds.js";

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/IValidatedEventDispatcher').UnsubscribeFn} UnsubscribeFn // ADDED: For type clarity
 // Remove or comment out IEventSubscription if it's causing confusion here and UnsubscribeFn is the correct contract
 // @typedef {import('../core/interfaces/IEventSubscription').IEventSubscription} IEventSubscription
 * @typedef {import('../core/interfaces/CommonTypes').NamespacedId} NamespacedId
 * @typedef {import('./domElementFactory.js').default} DomElementFactoryType
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
    /** @private @type {DomElementFactoryType} */
    #domElementFactory;
    /** @private @type {Array<UnsubscribeFn|undefined>} */ // MODIFIED: Store UnsubscribeFn directly
    #subscriptions = [];
    /** @private @readonly */
    _EVENT_TYPE_SUBSCRIBED = 'textUI:update_available_actions';

    /** @private @type {boolean} */
    #isDisposed = false;

    /** @type {AvailableAction | null} */
    selectedAction = null;
    /** @type {AvailableAction[]} */
    availableActions = [];
    /** @type {HTMLButtonElement | { tagName?: string, disabled?: boolean, addEventListener?: Function, removeEventListener?: Function } | null} */
    sendButtonElement = null;
    /** @type {HTMLInputElement | {value?: string} | null} @private */
    #speechInputElement = null;
    /** @type {(() => void) | null} @private */
    #boundHandleSendAction = null;

    constructor({
                    logger,
                    documentContext,
                    validatedEventDispatcher,
                    domElementFactory,
                    actionButtonsContainer,
                    sendButtonElement
                }) {
        super({logger, documentContext, validatedEventDispatcher});

        if (!domElementFactory || typeof domElementFactory.create !== 'function' || typeof domElementFactory.button !== 'function') {
            const errMsg = `${this._logPrefix} 'domElementFactory' dependency is missing or invalid (must have create and button methods).`;
            this.logger.error(errMsg, {receivedFactory: domElementFactory});
            throw new Error(errMsg);
        }
        this.#domElementFactory = domElementFactory;

        if (!actionButtonsContainer || typeof actionButtonsContainer.nodeType !== 'number' || actionButtonsContainer.nodeType !== 1) {
            const errMsg = `${this._logPrefix} 'actionButtonsContainer' dependency is missing or not a valid DOM element.`;
            this.logger.error(errMsg, {receivedElement: actionButtonsContainer});
            throw new Error(errMsg);
        }
        this.#actionButtonsContainer = actionButtonsContainer;
        this.logger.debug(`${this._logPrefix} Attached to action buttons container element:`, actionButtonsContainer);

        const confirmButtonCandidate = sendButtonElement || this.documentContext.query('#player-confirm-turn-button');

        const isValidButtonInterface = !!(confirmButtonCandidate && (
            (typeof HTMLButtonElement !== 'undefined' && confirmButtonCandidate instanceof HTMLButtonElement) ||
            (typeof confirmButtonCandidate.tagName === 'string' && confirmButtonCandidate.tagName.toUpperCase() === 'BUTTON')
        ));

        if (isValidButtonInterface) {
            this.sendButtonElement = confirmButtonCandidate;
            if (typeof this.sendButtonElement.disabled === 'boolean') {
                this.sendButtonElement.disabled = true;
            }
            this.#boundHandleSendAction = this.#handleSendAction.bind(this);
            if (typeof this.sendButtonElement.addEventListener === 'function') {
                this.sendButtonElement.addEventListener('click', this.#boundHandleSendAction);
                this.logger.debug(`${this._logPrefix} 'Confirm Action' button registered and click listener added:`, this.sendButtonElement);
            } else {
                this.logger.warn(`${this._logPrefix} 'Confirm Action' button registered but 'addEventListener' is not a function. Click listener NOT added.`, {button: this.sendButtonElement});
            }
        } else {
            this.logger.warn(`${this._logPrefix} 'Confirm Action' button ('#player-confirm-turn-button' or provided sendButtonElement) was not found or is not a valid button type. Confirm button functionality will be unavailable.`, {candidate: confirmButtonCandidate});
            this.sendButtonElement = null;
        }

        const speechInput = this.documentContext.query('#command-input');
        if (speechInput && (typeof HTMLInputElement !== 'undefined' && speechInput instanceof HTMLInputElement)) {
            this.#speechInputElement = speechInput;
            this.logger.debug(`${this._logPrefix} Speech input element ('#command-input') cached:`, this.#speechInputElement);
        } else if (speechInput && typeof speechInput.value === 'string') {
            this.logger.warn(`${this._logPrefix} Element found for '#command-input' but it is not an HTMLInputElement. Attempting to use based on 'value' property.`, {element: speechInput});
            this.#speechInputElement = speechInput;
        } else {
            this.logger.warn(`${this._logPrefix} Speech input element ('#command-input') not found or unusable. Speech input will be unavailable for submitted actions.`, {queriedElement: speechInput});
            this.#speechInputElement = null;
        }

        this.#subscribeToEvents();
    }

    /** @private */
    #subscribeToEvents() {
        if (this.#isDisposed) return;
        if (!this.validatedEventDispatcher || typeof this.validatedEventDispatcher.subscribe !== 'function') {
            this.logger.error(`${this._logPrefix} ValidatedEventDispatcher not available or 'subscribe' method is missing. Cannot subscribe to events.`);
            return;
        }

        // 'unsubscribeCallback' will be the UnsubscribeFn returned by validatedEventDispatcher.subscribe
        const unsubscribeCallback = this.validatedEventDispatcher.subscribe(
            this._EVENT_TYPE_SUBSCRIBED,
            this.#handleUpdateActions.bind(this)
        );

        // MODIFIED: Check if the returned value is a function
        if (typeof unsubscribeCallback === 'function') {
            this.#subscriptions.push(unsubscribeCallback); // Store the function directly
            this.logger.debug(`${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}'.`);
        } else {
            // This path should ideally not be taken if validatedEventDispatcher.subscribe correctly returns a function
            this.logger.error(`${this._logPrefix} Failed to subscribe to VED event '${this._EVENT_TYPE_SUBSCRIBED}'. Expected an unsubscribe function but received:`, unsubscribeCallback);
        }
    }

    /** @private */
    #handleUpdateActions(eventObject) {
        if (this.#isDisposed) return;
        const eventTypeForLog = eventObject && typeof eventObject.type === 'string' ? eventObject.type : this._EVENT_TYPE_SUBSCRIBED;
        this.logger.debug(`${this._logPrefix} Received event object for '${eventTypeForLog}'.`, {eventObject});

        if (eventObject &&
            typeof eventObject === 'object' &&
            eventObject.payload &&
            typeof eventObject.payload === 'object' &&
            Array.isArray(eventObject.payload.actions)) {

            const innerPayload = eventObject.payload;

            const validActions = innerPayload.actions.filter(action =>
                action && typeof action === 'object' &&
                typeof action.id === 'string' && action.id.length > 0 &&
                typeof action.command === 'string' && action.command.trim().length > 0
            );

            if (validActions.length !== innerPayload.actions.length) {
                this.logger.warn(`${this._logPrefix} Received '${eventTypeForLog}' with some invalid items in the nested actions array. Only valid action objects will be rendered.`, {originalEvent: eventObject});
            }
            this.render(validActions);
        } else {
            this.logger.warn(`${this._logPrefix} Received invalid or incomplete event object structure for '${eventTypeForLog}'. Expected { type: '...', payload: { actions: [...] } }. Clearing action buttons.`, {receivedObject: eventObject});
            this.render([]);
        }
    }

    /** @private */
    #clearContainer() {
        if (this.#actionButtonsContainer) {
            while (this.#actionButtonsContainer.firstChild) {
                this.#actionButtonsContainer.removeChild(this.#actionButtonsContainer.firstChild);
            }
        }
        this.selectedAction = null;

        if (this.sendButtonElement && typeof this.sendButtonElement.disabled === 'boolean') {
            this.sendButtonElement.disabled = true;
        }
        if (!this.#isDisposed) {
            this.logger.debug(`${this._logPrefix} Action buttons container cleared, selected action reset, confirm button disabled.`);
        }
    }

    render(actions) {
        if (this.#isDisposed) return;
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

        if (this.availableActions.length === 0) {
            this.logger.debug(`${this._logPrefix} No actions provided to render, container remains empty. Confirm button remains disabled.`);
            if (this.sendButtonElement && typeof this.sendButtonElement.disabled === 'boolean') {
                this.sendButtonElement.disabled = true;
            }
            return;
        }

        this.availableActions.forEach(actionObject => {
            if (!actionObject || typeof actionObject.id !== 'string' || actionObject.id.length === 0 ||
                typeof actionObject.command !== 'string' || actionObject.command.trim() === '') {
                this.logger.warn(`${this._logPrefix} Skipping invalid action object during render: `, {actionObject});
                return;
            }

            const buttonText = actionObject.command.trim();
            const actionId = actionObject.id;
            if (typeof this.#domElementFactory.button !== 'function') {
                this.logger.error(`${this._logPrefix} domElementFactory.button is not a function. Cannot create action button.`);
                return;
            }
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
                    if (this.#isDisposed) return;
                    const clickedActionObjectInListener = this.availableActions.find(a => a.id === actionId);

                    if (!clickedActionObjectInListener) {
                        this.logger.error(`${this._logPrefix} Critical: Clicked action button with ID '${actionId}' but could not find corresponding action in 'this.availableActions'.`, {
                            availableActions: this.availableActions,
                            clickedActionId: actionId
                        });
                        return;
                    }

                    if (this.selectedAction && this.selectedAction.id === clickedActionObjectInListener.id) {
                        if (button.classList && typeof button.classList.remove === 'function') button.classList.remove('selected');
                        this.selectedAction = null;
                        if (this.sendButtonElement && typeof this.sendButtonElement.disabled === 'boolean') {
                            this.sendButtonElement.disabled = true;
                        }
                        this.logger.info(`${this._logPrefix} Action deselected: '${clickedActionObjectInListener.command}' (ID: ${clickedActionObjectInListener.id})`);
                    } else {
                        if (this.selectedAction) {
                            const previousButton = this.#actionButtonsContainer.querySelector(`button.action-button.selected[data-action-id="${this.selectedAction.id}"]`);
                            if (previousButton && previousButton.classList && typeof previousButton.classList.remove === 'function') {
                                previousButton.classList.remove('selected');
                            } else {
                                this.logger.warn(`${this._logPrefix} Could not find or modify the DOM element for the previously selected action (ID: ${this.selectedAction.id}) to remove .selected class.`);
                            }
                        }
                        if (button.classList && typeof button.classList.add === 'function') button.classList.add('selected');
                        this.selectedAction = clickedActionObjectInListener;
                        if (this.sendButtonElement && typeof this.sendButtonElement.disabled === 'boolean') {
                            this.sendButtonElement.disabled = false;
                        }
                        this.logger.info(`${this._logPrefix} Action selected: '${this.selectedAction.command}' (ID: ${this.selectedAction.id})`);
                    }
                });
            } else {
                this.logger.warn(`${this._logPrefix} Created button for action '${buttonText}' (ID: ${actionId}) but it does not have an addEventListener method.`, {button});
            }

            if (typeof this.#actionButtonsContainer.appendChild === 'function') {
                this.#actionButtonsContainer.appendChild(button);
            } else {
                this.logger.error(`${this._logPrefix} actionButtonsContainer does not have an appendChild method. Cannot add button for action '${buttonText}'.`, {container: this.#actionButtonsContainer});
            }
        });

        const childCount = this.#actionButtonsContainer.children ? this.#actionButtonsContainer.children.length : 0;
        this.logger.info(`${this._logPrefix} Rendered ${childCount} action buttons. Selected action: ${this.selectedAction ? `'${this.selectedAction.command}'` : 'none'}.`);

        if (this.sendButtonElement && typeof this.sendButtonElement.disabled === 'boolean') {
            this.sendButtonElement.disabled = !this.selectedAction;
        }
    }

    /** @private */
    async #handleSendAction() {
        if (this.#isDisposed) return;

        if (!this.sendButtonElement) {
            this.logger.error(`${this._logPrefix} #handleSendAction called, but sendButtonElement is null.`);
            return;
        }

        if (!this.selectedAction) {
            this.logger.warn(`${this._logPrefix} 'Confirm Action' clicked, but no action is selected.`);
            if (typeof this.sendButtonElement.disabled === 'boolean') this.sendButtonElement.disabled = true;
            return;
        }

        let speechText = '';
        if (this.#speechInputElement && typeof this.#speechInputElement.value === 'string') {
            speechText = this.#speechInputElement.value.trim();
        } else if (this.#speechInputElement) {
            this.logger.warn(`${this._logPrefix} Speech input element exists but its value is not a string. Proceeding without speech text.`, {speechInputElement: this.#speechInputElement});
        } else {
            this.logger.warn(`${this._logPrefix} No speech input element available. Proceeding without speech text.`, {speechInputElement: this.#speechInputElement});
        }

        const actionId = this.selectedAction.id;
        const command = this.selectedAction.command;
        this.logger.info(`${this._logPrefix} Attempting to send action: '${command}' (ID: ${actionId}), Speech: "${speechText}"`);

        if (!this.validatedEventDispatcher || typeof this.validatedEventDispatcher.dispatchValidated !== 'function') {
            this.logger.error(`${this._logPrefix} ValidatedEventDispatcher not available or 'dispatchValidated' method is missing. Cannot send action.`);
            return;
        }

        const eventPayload = {actionId, speech: speechText || null};

        try {
            const dispatchResult = await this.validatedEventDispatcher.dispatchValidated(
                PLAYER_TURN_SUBMITTED_ID, eventPayload
            );
            if (dispatchResult) {
                this.logger.debug(`${this._logPrefix} Event '${PLAYER_TURN_SUBMITTED_ID}' dispatched successfully for action ID '${actionId}'.`);
                if (this.#speechInputElement && typeof this.#speechInputElement.value === 'string') this.#speechInputElement.value = '';

                const selectedButton = this.#actionButtonsContainer.querySelector(`button.action-button.selected[data-action-id="${actionId}"]`);
                if (selectedButton && selectedButton.classList && typeof selectedButton.classList.remove === 'function') {
                    selectedButton.classList.remove('selected');
                } else {
                    this.logger.warn(`${this._logPrefix} Could not find/deselect the selected action button (ID: ${actionId}) after dispatch.`);
                }
                this.selectedAction = null;
                if (typeof this.sendButtonElement.disabled === 'boolean') this.sendButtonElement.disabled = true;
            } else {
                this.logger.error(`${this._logPrefix} Failed to dispatch '${PLAYER_TURN_SUBMITTED_ID}' for action ID '${actionId}'. dispatchValidated returned false.`, {payload: eventPayload});
            }
        } catch (error) {
            this.logger.error(`${this._logPrefix} Exception during dispatchValidated for '${PLAYER_TURN_SUBMITTED_ID}' (Action ID: ${actionId}).`, {
                error,
                payload: eventPayload
            });
        }
    }

    dispose() {
        if (this.#isDisposed) {
            return;
        }
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(unsubscribeFunc => {
            // MODIFIED: Call the unsubscribe function directly
            if (typeof unsubscribeFunc === 'function') {
                unsubscribeFunc();
            }
        });
        this.#subscriptions = []; // Clear the array

        if (this.sendButtonElement && typeof this.sendButtonElement.removeEventListener === 'function' && this.#boundHandleSendAction) {
            this.sendButtonElement.removeEventListener('click', this.#boundHandleSendAction);
            this.logger.debug(`${this._logPrefix} Removed click listener from 'Confirm Action' button.`);
        }
        this.#boundHandleSendAction = null;

        this.#clearContainer();
        this.availableActions = [];
        this.#speechInputElement = null;

        this.logger.info(`${this._logPrefix} ActionButtonsRenderer disposed.`);
        super.dispose();
        this.#isDisposed = true;
    }
}