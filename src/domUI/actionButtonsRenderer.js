// src/domUI/actionButtonsRenderer.js

import {RendererBase} from './rendererBase.js';
import {PLAYER_TURN_SUBMITTED_ID} from "../constants/eventIds.js"; // Corrected path based on other files

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('./IDocumentContext').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').UnsubscribeFn} UnsubscribeFn
 * @typedef {import('../core/interfaces/CommonTypes').NamespacedId} NamespacedId
 * @typedef {import('./domElementFactory.js').default} DomElementFactoryType
 */

/**
 * Represents an individual action available to the player.
 * @typedef {object} AvailableAction
 * @property {NamespacedId} id - The unique ID of the action definition (e.g., 'core:wait').
 * @property {string} name - The human-readable name of the action (e.g., "Wait", "Go"). Used for tooltip titles.
 * @property {string} command - The formatted command string (e.g., 'wait', 'go north'). Used for button text and for dispatching.
 * @property {string} description - A detailed description of the action for tooltips.
 */

/**
 * Represents the *inner* payload for 'textUI:update_available_actions'.
 * MODIFIED: Added actorId
 * @typedef {object} UIUpdateActionsInnerPayload
 * @property {string} actorId - The ID of the actor these actions are for.
 * @property {AvailableAction[]} actions - An array of action objects available to the player.
 */

/**
 * Represents the *full event object* received by the subscriber for 'textUI:update_available_actions'.
 * @typedef {object} UIUpdateActionsEventObject
 * @property {string} type - The event type name (e.g., 'textUI:update_available_actions').
 * @property {UIUpdateActionsInnerPayload} payload - The inner payload containing the actorId and actions.
 */

/**
 * Payload for core:player_turn_submitted, assuming it now includes submittedByActorId.
 * @typedef {object} CorePlayerTurnSubmittedPayload
 * @property {string} submittedByActorId - The instance ID of the actor who submitted this turn.
 * @property {NamespacedId} actionId - The unique identifier of the selected AvailableAction.
 * @property {string | null} speech - The text from the speech input field, or null if empty.
 */


export class ActionButtonsRenderer extends RendererBase {
    /** @private @type {HTMLElement} */
    #actionButtonsContainer;
    /** @private @type {DomElementFactoryType} */
    #domElementFactory;
    /** @private @type {Array<UnsubscribeFn|undefined>} */
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

    /** @private @type {string | null} */ // MODIFIED: Added to store current actor ID
    #currentActorId = null;

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

        const speechInput = this.documentContext.query('#speech-input');
        if (speechInput && (typeof HTMLInputElement !== 'undefined' && speechInput instanceof HTMLInputElement)) {
            this.#speechInputElement = speechInput;
            this.logger.debug(`${this._logPrefix} Speech input element ('#speech-input') cached:`, this.#speechInputElement);
        } else if (speechInput && typeof speechInput.value === 'string') {
            this.logger.warn(`${this._logPrefix} Element found for '#speech-input' but it is not an HTMLInputElement. Attempting to use based on 'value' property.`, {element: speechInput});
            this.#speechInputElement = speechInput;
        } else {
            this.logger.warn(`${this._logPrefix} Speech input element ('#speech-input') not found or unusable. Speech input will be unavailable for submitted actions.`, {queriedElement: speechInput});
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

        const unsubscribeCallback = this.validatedEventDispatcher.subscribe(
            this._EVENT_TYPE_SUBSCRIBED,
            this.#handleUpdateActions.bind(this)
        );

        if (typeof unsubscribeCallback === 'function') {
            this.#subscriptions.push(unsubscribeCallback);
            this.logger.debug(`${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}'.`);
        } else {
            this.logger.error(`${this._logPrefix} Failed to subscribe to VED event '${this._EVENT_TYPE_SUBSCRIBED}'. Expected an unsubscribe function but received:`, unsubscribeCallback);
        }
    }

    /** @private */
    #handleUpdateActions(eventObject) {
        if (this.#isDisposed) return;
        const eventTypeForLog = eventObject && typeof eventObject.type === 'string' ? eventObject.type : this._EVENT_TYPE_SUBSCRIBED;
        this.logger.debug(`${this._logPrefix} Received event object for '${eventTypeForLog}'.`, {eventObject});

        // MODIFIED: Check for actorId in payload
        if (eventObject &&
            typeof eventObject === 'object' &&
            eventObject.payload &&
            typeof eventObject.payload === 'object' &&
            typeof eventObject.payload.actorId === 'string' && // Check for actorId
            eventObject.payload.actorId.trim().length > 0 &&
            Array.isArray(eventObject.payload.actions)) {

            const innerPayload = eventObject.payload;
            this.#currentActorId = innerPayload.actorId; // Store actorId
            this.logger.info(`${this._logPrefix} Actions received for actor ID: ${this.#currentActorId}`);

            const validActions = innerPayload.actions.filter(action => {
                const isValid = action && typeof action === 'object' &&
                    typeof action.id === 'string' && action.id.trim().length > 0 &&
                    typeof action.name === 'string' && action.name.trim().length > 0 &&
                    typeof action.command === 'string' && action.command.trim().length > 0 &&
                    typeof action.description === 'string' && action.description.trim().length > 0;
                if (!isValid) {
                    this.logger.warn(`${this._logPrefix} Invalid action object found in payload (missing required fields or incorrect types):`, {action});
                }
                return isValid;
            });

            if (validActions.length !== innerPayload.actions.length) {
                this.logger.warn(`${this._logPrefix} Received '${eventTypeForLog}' with some invalid items in the nested actions array. Only valid action objects will be rendered.`, {originalEvent: eventObject});
            }
            this.render(validActions);
        } else {
            this.logger.warn(`${this._logPrefix} Received invalid or incomplete event object structure for '${eventTypeForLog}'. Expected { type: '...', payload: { actorId: '...', actions: [...] } }. Clearing action buttons.`, {receivedObject: eventObject});
            this.#currentActorId = null; // Clear actorId if payload is invalid
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
        // this.#currentActorId = null; // MODIFIED: Reset actorId when clearing. Moved to render() and #handleUpdateActions for more specific control.

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

        // MODIFIED: If actions are empty, also clear the currentActorId
        if (this.availableActions.length === 0) {
            this.#currentActorId = null;
            this.logger.debug(`${this._logPrefix} No actions to render, currentActorId cleared.`);
        }


        this.logger.debug(`${this._logPrefix} render() called. Total actions received: ${this.availableActions.length}. Selected action reset. Current actor for actions: ${this.#currentActorId || 'None'}`);


        if (!this.#actionButtonsContainer) {
            this.logger.error(`${this._logPrefix} Cannot render: 'actionButtonsContainer' is not set.`);
            return;
        }
        if (!this.#domElementFactory) {
            this.logger.error(`${this._logPrefix} Cannot render: 'domElementFactory' is not available.`);
            return;
        }

        this.#clearContainer(); // This will reset selectedAction and disable send button

        if (this.availableActions.length === 0) {
            this.logger.debug(`${this._logPrefix} No actions provided to render, container remains empty. Confirm button remains disabled.`);
            if (this.sendButtonElement && typeof this.sendButtonElement.disabled === 'boolean') {
                this.sendButtonElement.disabled = true;
            }
            // #currentActorId is already set to null above if actions were empty
            return;
        }

        this.availableActions.forEach(actionObject => {
            // ... (button creation logic remains the same)
            if (!actionObject || typeof actionObject.id !== 'string' || actionObject.id.trim().length === 0) {
                this.logger.warn(`${this._logPrefix} Skipping invalid action object during render (missing or empty id): `, {actionObject});
                return;
            }
            if (typeof actionObject.command !== 'string' || actionObject.command.trim().length === 0) {
                this.logger.warn(`${this._logPrefix} Skipping invalid action object during render (missing or empty command): `, {actionObject});
                return;
            }
            if (typeof actionObject.name !== 'string' || actionObject.name.trim().length === 0) {
                this.logger.warn(`${this._logPrefix} Skipping invalid action object during render (missing or empty name for tooltip): `, {actionObject});
                return;
            }
            if (typeof actionObject.description !== 'string' || actionObject.description.trim().length === 0) {
                this.logger.warn(`${this._logPrefix} Skipping invalid action object during render (missing or empty description): `, {actionObject});
                return;
            }

            const buttonText = actionObject.command.trim();
            const actionId = actionObject.id;
            const actionNameForTooltip = actionObject.name.trim();
            const actionDescription = actionObject.description.trim();

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
                let tooltipContent = `${actionNameForTooltip}`;
                tooltipContent += `\n\nDescription:\n${actionDescription}`;
                button.setAttribute('title', tooltipContent);
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
                        this.logger.info(`${this._logPrefix} Action deselected: '${clickedActionObjectInListener.name}' (ID: ${clickedActionObjectInListener.id})`);
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
                        this.logger.info(`${this._logPrefix} Action selected: '${this.selectedAction.name}' (ID: ${this.selectedAction.id})`);
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
        this.logger.info(`${this._logPrefix} Rendered ${childCount} action buttons. Selected action: ${this.selectedAction ? `'${this.selectedAction.name}' (ID: ${this.selectedAction.id})` : 'none'}.`);

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

        // MODIFIED: Check if #currentActorId is available
        if (!this.#currentActorId) {
            this.logger.error(`${this._logPrefix} #handleSendAction: Cannot send action because currentActorId is not set. This might indicate an issue with receiving or processing the '${this._EVENT_TYPE_SUBSCRIBED}' event correctly.`);
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
        const actionName = this.selectedAction.name;
        const commandToDispatch = this.selectedAction.command; // For logging

        this.logger.info(`${this._logPrefix} Attempting to send action: '${actionName}' (ID: ${actionId}, Command: '${commandToDispatch}') for actor ${this.#currentActorId}, Speech: "${speechText}"`);

        if (!this.validatedEventDispatcher || typeof this.validatedEventDispatcher.dispatchValidated !== 'function') {
            this.logger.error(`${this._logPrefix} ValidatedEventDispatcher not available or 'dispatchValidated' method is missing. Cannot send action.`);
            return;
        }

        // MODIFIED: Construct eventPayload with submittedByActorId
        /** @type {CorePlayerTurnSubmittedPayload} */
        const eventPayload = {
            submittedByActorId: this.#currentActorId, // Use the stored actor ID
            actionId,
            speech: speechText || null
        };

        try {
            // dispatchValidated expects the payload to match the schema for PLAYER_TURN_SUBMITTED_ID
            // which now requires submittedByActorId.
            const dispatchResult = await this.validatedEventDispatcher.dispatchValidated(
                PLAYER_TURN_SUBMITTED_ID, eventPayload
            );

            if (dispatchResult) {
                this.logger.debug(`${this._logPrefix} Event '${PLAYER_TURN_SUBMITTED_ID}' dispatched successfully for action ID '${actionId}' by actor '${this.#currentActorId}'.`);
                if (this.#speechInputElement && typeof this.#speechInputElement.value === 'string') this.#speechInputElement.value = '';
                const selectedButton = this.#actionButtonsContainer.querySelector(`button.action-button.selected[data-action-id="${actionId}"]`);
                if (selectedButton && selectedButton.classList && typeof selectedButton.classList.remove === 'function') {
                    selectedButton.classList.remove('selected');
                } else {
                    this.logger.warn(`${this._logPrefix} Could not find/deselect the selected action button (ID: ${actionId}) after dispatch.`);
                }
                this.selectedAction = null;
                if (typeof this.sendButtonElement.disabled === 'boolean') this.sendButtonElement.disabled = true;
                // Do not clear #currentActorId here, it remains valid until new actions for a (potentially different) actor arrive.
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

    /**
     * FOR TEST PURPOSES ONLY.
     * Returns the current value of the private #currentActorId field.
     * @returns {string | null}
     * @ignore
     */

    /* istanbul ignore next */
    _getTestCurrentActorId() {
        return this.#currentActorId;
    }

    /**
     * FOR TEST PURPOSES ONLY.
     * Sets the value of the private #currentActorId field.
     * @param {string | null} actorId - The actor ID to set.
     * @ignore
     */

    /* istanbul ignore next */
    _setTestCurrentActorId(actorId) {
        this.#currentActorId = actorId;
    }

    dispose() {
        if (this.#isDisposed) {
            return;
        }
        this.logger.debug(`${this._logPrefix} Disposing subscriptions.`);
        this.#subscriptions.forEach(unsubscribeFunc => {
            if (typeof unsubscribeFunc === 'function') {
                unsubscribeFunc();
            }
        });
        this.#subscriptions = [];
        if (this.sendButtonElement && typeof this.sendButtonElement.removeEventListener === 'function' && this.#boundHandleSendAction) {
            this.sendButtonElement.removeEventListener('click', this.#boundHandleSendAction);
            this.logger.debug(`${this._logPrefix} Removed click listener from 'Confirm Action' button.`);
        }
        this.#boundHandleSendAction = null;
        this.#clearContainer();
        this.availableActions = [];
        this.#speechInputElement = null;
        this.#currentActorId = null; // MODIFIED: Clear actorId on dispose
        this.logger.info(`${this._logPrefix} ActionButtonsRenderer disposed.`);
        super.dispose();
        this.#isDisposed = true;
    }
}