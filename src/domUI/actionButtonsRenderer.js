// src/domUI/actionButtonsRenderer.js

import { BaseListDisplayComponent } from './baseListDisplayComponent.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../constants/eventIds.js';

/**
 * @typedef {import('../core/interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../core/interfaces/CommonTypes').NamespacedId} NamespacedId
 * @typedef {import('./domElementFactory.js').default} DomElementFactoryType
 * @typedef {import('./boundDomRendererBase.js').ElementConfigEntry} ElementConfigEntry
 * @typedef {import('./boundDomRendererBase.js').ElementsConfig} ElementsConfig
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
 * Payload for core:player_turn_submitted.
 * @typedef {object} CorePlayerTurnSubmittedPayload
 * @property {string} submittedByActorId - The instance ID of the actor who submitted this turn.
 * @property {NamespacedId} actionId - The unique identifier of the selected AvailableAction.
 * @property {string | null} speech - The text from the speech input field, or null if empty.
 */

/**
 * Renders available actions as buttons for player interaction.
 * Handles action selection and dispatches the chosen action.
 * Extends BaseListDisplayComponent to manage the rendering of action buttons.
 * @augments {BaseListDisplayComponent<AvailableAction>}
 */
export class ActionButtonsRenderer extends BaseListDisplayComponent {
     * @private
  _EVENT_TYPE_SUBSCRIBED = 'textUI:update_available_actions';

  /** @type {AvailableAction | null} */
  selectedAction = null;
  /** @type {AvailableAction[]} */
  availableActions = [];
     * @private
  #currentActorId = null;
     * @private
  #isDisposed = false;

  /**
   * Constructs an ActionButtonsRenderer instance.
   * @param {object} params - The parameters object.
   * @param {ILogger} params.logger - The logger instance.
   * @param {IDocumentContext} params.documentContext - The document context abstraction.
   * @param {IValidatedEventDispatcher} params.validatedEventDispatcher - The validated event dispatcher.
   * @param {DomElementFactoryType} params.domElementFactory - Factory for creating DOM elements.
   * @param {string} params.actionButtonsContainerSelector - CSS selector for the action buttons container. This is mandatory.
   * @param {string} [params.sendButtonSelector] - CSS selector for the send button.
   * @param {string} [params.speechInputSelector='#speech-input'] - CSS selector for the speech input.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory,
    actionButtonsContainerSelector,
    sendButtonSelector = '#player-confirm-turn-button',
    speechInputSelector = '#speech-input',
  }) {
    // MODIFIED: Enhanced domElementFactory validation to meet test expectations
    const factoryErrorMessage =
      "[ActionButtonsRenderer] 'domElementFactory' dependency is missing or invalid (must have create and button methods).";
    if (
      !domElementFactory ||
      typeof domElementFactory.create !== 'function' ||
      typeof domElementFactory.button !== 'function'
    ) {
      (logger || console).error(factoryErrorMessage, {
        receivedFactory: domElementFactory,
      });
      throw new Error(factoryErrorMessage);
    }

    if (
      !actionButtonsContainerSelector ||
      typeof actionButtonsContainerSelector !== 'string' ||
      actionButtonsContainerSelector.trim() === ''
    ) {
      const errMsg = `[ActionButtonsRenderer] 'actionButtonsContainerSelector' is required and must be a non-empty string.`;
      // Current tests expect only one argument for this specific error's log call.
      (logger || console).error(errMsg);
      throw new Error(errMsg);
    }

    const elementsConfig = {
      listContainerElement: {
        selector: actionButtonsContainerSelector,
        required: true,
      },
      sendButtonElement: {
        selector: sendButtonSelector,
        required: false,
        expectedType: HTMLButtonElement,
      },
      speechInputElement: {
        selector: speechInputSelector,
        required: false,
        expectedType: HTMLInputElement,
      },
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
      domElementFactory, // Pass the now-validated domElementFactory to super
    });

    this.selectedAction = null;
    this.availableActions = [];
    this.#currentActorId = null;
    this.#isDisposed = false;

    // This check should ideally not be strictly necessary if the initial validation and super constructor behavior are correct.
    // It's kept as a defensive measure. BaseListDisplayComponent assigns this.domElementFactory.
    if (!this.domElementFactory) {
      const errMsg = `${this._logPrefix} domElementFactory was not set by the super constructor, despite initial validation. This indicates an issue in the constructor chain.`;
      this.logger.error(errMsg);
      throw new Error(errMsg); // This would be an unexpected state
    }

    if (this.elements.sendButtonElement) {
      this.elements.sendButtonElement.disabled = true;
      this._addDomListener(
        this.elements.sendButtonElement,
        'click',
        this.#handleSendAction.bind(this)
      );
      this.logger.debug(
        `${this._logPrefix} 'Confirm Action' button listener added via _addDomListener.`
      );
    } else {
      this.logger.warn(
        `${this._logPrefix} 'Confirm Action' button (selector: '${sendButtonSelector}') not found or not a button. Send functionality will be unavailable.`
      );
    }

    if (this.elements.speechInputElement) {
      this.logger.debug(
        `${this._logPrefix} Speech input element (selector: '${speechInputSelector}') cached.`
      );
    } else {
      this.logger.warn(
        `${this._logPrefix} Speech input element (selector: '${speechInputSelector}') not found or not an input. Speech input will be unavailable.`
      );
    }

    this._addSubscription(
      this.validatedEventDispatcher.subscribe(
        this._EVENT_TYPE_SUBSCRIBED,
        this.#handleUpdateActions.bind(this)
      )
    );
    this.logger.debug(
      `${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}' via _addSubscription.`
    );

    this.refreshList().catch((error) => {
      this.logger.error(
        `${this._logPrefix} Error during initial list refresh:`,
        error
      );
    });
  }

  /**
   * @protected
   * @override
   */
  _getListItemsData() {
    return this.availableActions;
  }

  /**
   * @protected
   * @override
   */
  _renderListItem(actionObject, itemIndex) {
    if (this.#isDisposed) return null;
    if (
      !actionObject ||
      typeof actionObject.id !== 'string' ||
      !actionObject.id.trim()
    ) {
      this.logger.warn(
        `${this._logPrefix} Skipping invalid action object in _renderListItem (missing or empty id): `,
        { actionObject }
      );
      return null;
    }
    if (
      typeof actionObject.command !== 'string' ||
      !actionObject.command.trim()
    ) {
      this.logger.warn(
        `${this._logPrefix} Skipping invalid action object (missing command):`,
        { actionObject }
      );
      return null;
    }
    if (typeof actionObject.name !== 'string' || !actionObject.name.trim()) {
      this.logger.warn(
        `${this._logPrefix} Skipping invalid action object (missing name):`,
        { actionObject }
      );
      return null;
    }
    if (
      typeof actionObject.description !== 'string' ||
      !actionObject.description.trim()
    ) {
      this.logger.warn(
        `${this._logPrefix} Skipping invalid action object (missing description):`,
        { actionObject }
      );
      return null;
    }

    const buttonText = actionObject.command.trim();
    const actionId = actionObject.id;

    // this.domElementFactory is guaranteed to be valid due to constructor checks
    const button = this.domElementFactory.button(buttonText, 'action-button');
    if (!button) {
      this.logger.error(
        `${this._logPrefix} Failed to create button element for action: "${buttonText}" (ID: ${actionId}) using domElementFactory.`
      );
      return null;
    }

    let tooltipContent = `${actionObject.name.trim()}\n\nDescription:\n${actionObject.description.trim()}`;
    button.setAttribute('title', tooltipContent);
    button.setAttribute('data-action-id', actionId);

    button.addEventListener('click', () => {
      if (this.#isDisposed) return;
      const clickedAction = this.availableActions.find(
        (a) => a.id === actionId
      );
      if (!clickedAction) {
        this.logger.error(
          `${this._logPrefix} Critical: Clicked action button with ID '${actionId}' but could not find corresponding action.`,
          { clickedActionId: actionId }
        );
        return;
      }

      if (this.selectedAction && this.selectedAction.id === clickedAction.id) {
        button.classList.remove('selected');
        this.selectedAction = null;
        this.logger.info(
          `${this._logPrefix} Action deselected: '${clickedAction.name}' (ID: ${clickedAction.id})`
        );
      } else {
        if (this.selectedAction && this.elements.listContainerElement) {
          const previousButton =
            this.elements.listContainerElement.querySelector(
              `button.action-button.selected[data-action-id="${this.selectedAction.id}"]`
            );
          if (previousButton) {
            previousButton.classList.remove('selected');
          }
        }
        button.classList.add('selected');
        this.selectedAction = clickedAction;
        this.logger.info(
          `${this._logPrefix} Action selected: '${this.selectedAction.name}' (ID: ${this.selectedAction.id})`
        );
      }
      if (this.elements.sendButtonElement) {
        this.elements.sendButtonElement.disabled = !this.selectedAction;
      }
    });
    return button;
  }

  /**
   * @protected
   * @override
   */
  _getEmptyListMessage() {
    return 'No actions available.';
  }

  /**
   * @protected
   * @override
   */
  _onListRendered(actionsData, container) {
    if (this.#isDisposed) return;

    const actualActionButtons = container.querySelectorAll(
      'button.action-button'
    );
    const childCount = actualActionButtons.length;

    this.logger.info(
      `${this._logPrefix} Rendered ${childCount} action buttons. Selected action: ${this.selectedAction ? `'${this.selectedAction.name}' (ID: ${this.selectedAction.id})` : 'none'}.`
    );

    if (
      this.selectedAction &&
      !actionsData?.find((a) => a.id === this.selectedAction?.id)
    ) {
      this.selectedAction = null;
      this.logger.debug(
        `${this._logPrefix} Previously selected action is no longer available. Selection cleared.`
      );
    }

    if (this.selectedAction) {
      const selectedButton = container.querySelector(
        `button.action-button[data-action-id="${this.selectedAction.id}"]`
      );
      if (selectedButton && !selectedButton.classList.contains('selected')) {
        selectedButton.classList.add('selected');
      }
    }

    if (this.elements.sendButtonElement) {
      this.elements.sendButtonElement.disabled = !this.selectedAction;
    }
  }

  /**
   * @param eventObject
   * @private
   */
  async #handleUpdateActions(eventObject) {
    if (this.#isDisposed) return;
    const eventTypeForLog = eventObject?.type || this._EVENT_TYPE_SUBSCRIBED;
    this.logger.debug(
      `${this._logPrefix} Received event object for '${eventTypeForLog}'.`,
      { eventObject }
    );

    if (
      eventObject?.payload &&
      typeof eventObject.payload.actorId === 'string' &&
      eventObject.payload.actorId.trim().length > 0 &&
      Array.isArray(eventObject.payload.actions)
    ) {
      const innerPayload = eventObject.payload;
      this.#currentActorId = innerPayload.actorId;
      this.logger.info(
        `${this._logPrefix} Actions received for actor ID: ${this.#currentActorId}`
      );

      const validActions = innerPayload.actions.filter((action) => {
        const isValid =
          action &&
          typeof action === 'object' &&
          typeof action.id === 'string' &&
          action.id.trim().length > 0 &&
          typeof action.name === 'string' &&
          action.name.trim().length > 0 &&
          typeof action.command === 'string' &&
          action.command.trim().length > 0 &&
          typeof action.description === 'string' &&
          action.description.trim().length > 0;
        if (!isValid) {
          this.logger.warn(
            `${this._logPrefix} Invalid action object found in payload:`,
            { action }
          );
        }
        return isValid;
      });

      if (validActions.length !== innerPayload.actions.length) {
        this.logger.warn(
          `${this._logPrefix} Received '${eventTypeForLog}' with some invalid items. Only valid actions will be rendered.`
        );
      }

      this.selectedAction = null;
      this.availableActions = validActions;
    } else {
      this.logger.warn(
        `${this._logPrefix} Received invalid or incomplete event for '${eventTypeForLog}'. Clearing actions.`,
        { receivedObject: eventObject }
      );
      this.#currentActorId = null;
      this.selectedAction = null;
      this.availableActions = [];
    }

    try {
      await this.refreshList();
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error refreshing list in #handleUpdateActions:`,
        error
      );
    }
  }

  /**
   * @private
   * @async
   */
  async #handleSendAction() {
    if (this.#isDisposed) return;
    if (!this.elements.sendButtonElement) {
      this.logger.error(
        `${this._logPrefix} #handleSendAction called, but sendButtonElement is null.`
      );
      return;
    }
    if (!this.selectedAction) {
      this.logger.warn(
        `${this._logPrefix} 'Confirm Action' clicked, but no action is selected.`
      );
      this.elements.sendButtonElement.disabled = true;
      return;
    }
    if (!this.#currentActorId) {
      this.logger.error(
        `${this._logPrefix} #handleSendAction: Cannot send action, currentActorId is not set.`
      );
      return;
    }

    let speechText = '';
    if (this.elements.speechInputElement) {
      speechText = this.elements.speechInputElement.value.trim();
    } else {
      this.logger.debug(
        `${this._logPrefix} No speech input element available.`
      );
    }

    const actionId = this.selectedAction.id;
    const actionName = this.selectedAction.name;
    this.logger.info(
      `${this._logPrefix} Attempting to send action: '${actionName}' (ID: ${actionId}) for actor ${this.#currentActorId}, Speech: "${speechText}"`
    );

    const eventPayload = {
      submittedByActorId: this.#currentActorId,
      actionId,
      speech: speechText || null,
    };

    try {
      const dispatchResult =
        await this.validatedEventDispatcher.dispatchValidated(
          PLAYER_TURN_SUBMITTED_ID,
          eventPayload
        );

      if (dispatchResult) {
        this.logger.debug(
          `${this._logPrefix} Event '${PLAYER_TURN_SUBMITTED_ID}' dispatched for action '${actionId}' by actor '${this.#currentActorId}'.`
        );
        if (this.elements.speechInputElement)
          this.elements.speechInputElement.value = '';

        this.selectedAction = null;
        if (this.elements.sendButtonElement) {
          this.elements.sendButtonElement.disabled = true;
        }
        if (this.elements.listContainerElement) {
          const selectedButton =
            this.elements.listContainerElement.querySelector(
              `button.action-button.selected[data-action-id="${actionId}"]`
            );
          if (selectedButton) {
            selectedButton.classList.remove('selected');
          }
        }
      } else {
        this.logger.error(
          `${this._logPrefix} Failed to dispatch '${PLAYER_TURN_SUBMITTED_ID}' for action '${actionId}'.`,
          { payload: eventPayload }
        );
      }
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Exception during dispatchValidated for '${PLAYER_TURN_SUBMITTED_ID}'.`,
        { error, payload: eventPayload }
      );
    }
  }

  /** @ignore */
  /* istanbul ignore next */
  _getTestCurrentActorId() {
    return this.#currentActorId;
  }

  /** @ignore */
  /* istanbul ignore next */
  _setTestCurrentActorId(actorId) {
    this.#currentActorId = actorId;
  }

  /**
   * @override
   */
  dispose() {
    if (this.#isDisposed) {
      return;
    }
    this.logger.debug(`${this._logPrefix} Disposing ActionButtonsRenderer.`);

    if (this.elements && this.elements.listContainerElement) {
      while (this.elements.listContainerElement.firstChild) {
        this.elements.listContainerElement.removeChild(
          this.elements.listContainerElement.firstChild
        );
      }
      this.logger.debug(
        `${this._logPrefix} Cleared listContainerElement content during dispose.`
      );
    }

    super.dispose();

    this.selectedAction = null;
    this.availableActions = [];
    this.#currentActorId = null;

    this.logger.info(`${this._logPrefix} ActionButtonsRenderer disposed.`);
    this.#isDisposed = true;
  }
}
