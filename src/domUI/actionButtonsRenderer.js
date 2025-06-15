/**
 * @file Renders available actions as buttons from an array of `ActionComposite` objects.
 * Handles action selection and dispatches the chosen action.
 * @see src/domUI/actionButtonsRenderer.js
 */

import { BaseListDisplayComponent } from './baseListDisplayComponent.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../constants/eventIds.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactoryType
 * @typedef {import('./boundDomRendererBase.js').ElementConfigEntry} ElementConfigEntry
 * @typedef {import('./boundDomRendererBase.js').ElementsConfig} ElementsConfig
 */

/**
 * Represents a single available action, indexed and ready for rendering.
 * This is the DTO received from the core engine.
 *
 * @typedef {object} ActionComposite
 * @property {number} index - The 1-based index of the action in the current turn's list.
 * @property {NamespacedId} actionId - The unique ID of the action definition (e.g., 'core:wait').
 * @property {string} commandString - The formatted command string (e.g., 'wait', 'go north'). Used for button text.
 * @property {object} params - Any parameters associated with the action.
 * @property {string} description - A detailed description of the action for tooltips.
 * @see {createActionComposite}
 */

/**
 * Represents the *inner* payload for 'core:update_available_actions'.
 *
 * @typedef {object} UIUpdateActionsInnerPayload
 * @property {string} actorId - The ID of the actor these actions are for.
 * @property {ActionComposite[]} actions - An array of action composites available to the player.
 */

/**
 * Represents the *full event object* received by the subscriber for 'core:update_available_actions'.
 *
 * @typedef {object} UIUpdateActionsEventObject
 * @property {string} type - The event type name (e.g., 'core:update_available_actions').
 * @property {UIUpdateActionsInnerPayload} payload - The inner payload containing the actorId and actions.
 */

/**
 * Payload for PLAYER_TURN_SUBMITTED_ID.
 *
 * @typedef {object} CorePlayerTurnSubmittedPayload
 * @property {string} submittedByActorId - The instance ID of the actor who submitted this turn.
 * @property {number} chosenIndex - The 1-based index of the chosen action composite.
 * @property {string | null} speech - The text from the speech input field, or null if empty.
 */

/**
 * Renders available actions as buttons from an array of `ActionComposite` objects.
 * Handles action selection and dispatches the chosen action.
 *
 * @augments {BaseListDisplayComponent<ActionComposite>}
 */
export class ActionButtonsRenderer extends BaseListDisplayComponent {
  _EVENT_TYPE_SUBSCRIBED = 'core:update_available_actions';

  static FADE_IN_CLASS = 'actions-fade-in';
  static FADE_OUT_CLASS = 'actions-fade-out';

  /** @type {ActionComposite | null} */
  selectedAction = null;
  /** @type {ActionComposite[]} */
  availableActions = [];
  #currentActorId = null;
  #isDisposed = false;

  /**
   * Constructs an ActionButtonsRenderer instance.
   *
   * @param {object} params - The parameters object.
   * @param {ILogger} params.logger - The logger instance.
   * @param {IDocumentContext} params.documentContext - The document context abstraction.
   * @param {IValidatedEventDispatcher} params.validatedEventDispatcher - The validated event dispatcher.
   * @param {DomElementFactoryType} params.domElementFactory - Factory for creating DOM elements.
   * @param {string} params.actionButtonsContainerSelector - CSS selector for the action buttons container. This is mandatory.
   * @param {string} [params.sendButtonSelector] - CSS selector for the send button.
   * @param {string} [params.speechInputSelector] - CSS selector for the speech input.
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
    // domElementFactory is optional but recommended for creating button elements.

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

    this._subscribe(
      this._EVENT_TYPE_SUBSCRIBED,
      this.#handleUpdateActions.bind(this)
    );
    this.logger.debug(
      `${this._logPrefix} Subscribed to VED event '${this._EVENT_TYPE_SUBSCRIBED}' via _subscribe.`
    );
  }

  /**
   * @protected
   * @override
   */
  _getListItemsData() {
    return this.availableActions;
  }

  /**
   * Creates a button element from an ActionComposite.
   *
   * @protected
   * @override
   * @param {ActionComposite} actionComposite - The action data to render.
   * @returns {HTMLButtonElement | null} The button element or null if invalid.
   */
  _renderListItem(actionComposite) {
    if (this.#isDisposed) return null;

    // Basic validation for the composite object
    if (
      !actionComposite ||
      typeof actionComposite.index !== 'number' ||
      typeof actionComposite.actionId !== 'string' ||
      !actionComposite.actionId.trim() ||
      typeof actionComposite.commandString !== 'string' ||
      !actionComposite.commandString.trim() ||
      typeof actionComposite.description !== 'string' // description can be empty but must exist
    ) {
      this.logger.warn(
        `${this._logPrefix} Skipping invalid action composite in _renderListItem: `,
        { actionComposite }
      );
      return null;
    }

    const buttonText = actionComposite.commandString;
    const buttonTooltip = actionComposite.description;
    const actionIndex = actionComposite.index;

    const button = this.domElementFactory.button(buttonText, 'action-button');
    if (!button) {
      this.logger.error(
        `${this._logPrefix} Failed to create button element for action composite:`,
        { actionComposite }
      );
      return null;
    }

    button.title = buttonTooltip;
    button.setAttribute('data-action-index', actionIndex);

    button.addEventListener('click', () => {
      if (this.#isDisposed) return;

      const clickedAction = this.availableActions.find(
        (c) => c.index === actionIndex
      );

      if (!clickedAction) {
        this.logger.error(
          `${this._logPrefix} Critical: Clicked action button with index '${actionIndex}' but could not find corresponding composite.`,
          { clickedActionIndex: actionIndex }
        );
        return;
      }

      if (
        this.selectedAction &&
        this.selectedAction.index === clickedAction.index
      ) {
        button.classList.remove('selected');
        this.selectedAction = null;
        this.logger.debug(
          `${this._logPrefix} Action deselected: '${clickedAction.commandString}' (Index: ${clickedAction.index})`
        );
      } else {
        if (this.selectedAction && this.elements.listContainerElement) {
          const previousButton =
            this.elements.listContainerElement.querySelector(
              `button.action-button.selected[data-action-index="${this.selectedAction.index}"]`
            );
          if (previousButton) {
            previousButton.classList.remove('selected');
          }
        }
        button.classList.add('selected');
        this.selectedAction = clickedAction;
        this.logger.debug(
          `${this._logPrefix} Action selected: '${this.selectedAction.commandString}' (Index: ${this.selectedAction.index}, ID: ${this.selectedAction.actionId})`
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

    if (container) {
      container.classList.remove(ActionButtonsRenderer.FADE_OUT_CLASS);
      container.classList.add(ActionButtonsRenderer.FADE_IN_CLASS);
      container.addEventListener(
        'animationend',
        () => {
          container.classList.remove(ActionButtonsRenderer.FADE_IN_CLASS);
        },
        { once: true }
      );
    }

    const childCount = container.querySelectorAll(
      'button.action-button'
    ).length;
    this.logger.debug(
      `${this._logPrefix} Rendered ${childCount} action buttons. Selected action: ${this.selectedAction ? `'${this.selectedAction.commandString}' (Index: ${this.selectedAction.index})` : 'none'}.`
    );

    // If the previously selected action is no longer in the new list, clear the selection
    if (
      this.selectedAction &&
      !actionsData?.find((c) => c.index === this.selectedAction?.index)
    ) {
      this.selectedAction = null;
      this.logger.debug(
        `${this._logPrefix} Previously selected action is no longer available. Selection cleared.`
      );
    }

    // Ensure the selected button has the .selected class after a re-render
    if (this.selectedAction) {
      const selectedButton = container.querySelector(
        `button.action-button[data-action-index="${this.selectedAction.index}"]`
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
   * Processes the 'core:update_available_actions' event with `ActionComposite[]`.
   *
   * @param {UIUpdateActionsEventObject} eventObject - Event payload with action list.
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
      this.logger.debug(
        `${this._logPrefix} Actions received for actor ID: ${this.#currentActorId}`
      );

      const validActions = innerPayload.actions.filter((composite) => {
        const isValid =
          composite &&
          typeof composite === 'object' &&
          typeof composite.index === 'number' &&
          composite.index > 0 &&
          typeof composite.actionId === 'string' &&
          composite.actionId.trim().length > 0 &&
          typeof composite.commandString === 'string' &&
          composite.commandString.trim().length > 0 &&
          typeof composite.description === 'string' && // Can be empty, but must be string
          typeof composite.params === 'object' &&
          composite.params !== null;
        if (!isValid) {
          this.logger.warn(
            `${this._logPrefix} Invalid action composite found in payload:`,
            { composite }
          );
        }
        return isValid;
      });

      if (validActions.length !== innerPayload.actions.length) {
        this.logger.warn(
          `${this._logPrefix} Received '${eventTypeForLog}' with some invalid items. Only valid composites will be rendered.`
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
   * Sends the currently selected action to the game engine.
   *
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

    const { index, commandString } = this.selectedAction;
    this.logger.debug(
      `${this._logPrefix} Attempting to send action: '${commandString}' (Index: ${index}) for actor ${this.#currentActorId}, Speech: "${speechText}"`
    );

    const eventPayload = {
      submittedByActorId: this.#currentActorId,
      chosenIndex: index,
      speech: speechText || null,
    };

    try {
      const dispatchResult = await this.validatedEventDispatcher.dispatch(
        PLAYER_TURN_SUBMITTED_ID,
        eventPayload
      );

      if (dispatchResult) {
        this.logger.debug(
          `${this._logPrefix} Event '${PLAYER_TURN_SUBMITTED_ID}' dispatched for action index '${index}' by actor '${this.#currentActorId}'.`
        );
        if (this.elements.speechInputElement) {
          this.elements.speechInputElement.value = '';
        }

        // --- UI updates on successful dispatch ---
        if (this.elements.listContainerElement) {
          const container = this.elements.listContainerElement;

          // 1. Remove the visual selection from the clicked button
          const selectedButton = container.querySelector(
            `button.action-button.selected[data-action-index="${this.selectedAction.index}"]`
          );
          if (selectedButton) {
            selectedButton.classList.remove('selected');
          }

          // 2. Play fade-out animation
          container.classList.remove(ActionButtonsRenderer.FADE_IN_CLASS);
          container.classList.add(ActionButtonsRenderer.FADE_OUT_CLASS);
          container.addEventListener(
            'animationend',
            () => {
              container.classList.remove(ActionButtonsRenderer.FADE_OUT_CLASS);
            },
            { once: true }
          );
        }

        // 3. Clear internal state
        this.selectedAction = null;
        if (this.elements.sendButtonElement) {
          this.elements.sendButtonElement.disabled = true;
        }
      } else {
        this.logger.error(
          `${this._logPrefix} Failed to dispatch '${PLAYER_TURN_SUBMITTED_ID}' for action index '${index}'.`,
          { payload: eventPayload }
        );
      }
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Exception during dispatch for '${PLAYER_TURN_SUBMITTED_ID}'.`,
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

    this.logger.debug(`${this._logPrefix} ActionButtonsRenderer disposed.`);
    this.#isDisposed = true;
  }
}
