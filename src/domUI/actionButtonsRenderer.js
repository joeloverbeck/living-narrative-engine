/**
 * @file Renders available actions as buttons from an array of `ActionComposite` objects.
 * Handles action selection and dispatches the chosen action.
 * @see src/domUI/actionButtonsRenderer.js
 */

import { SelectableListDisplayComponent } from './selectableListDisplayComponent.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../constants/eventIds.js';
import { DATASET_ACTION_INDEX } from '../constants/datasetKeys.js';

/**
 * Dataset key storing the index for rendered action buttons.
 *
 * @constant {string}
 */

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactoryType
 * @typedef {import('./boundDomRendererBase.js').ElementConfigEntry} ElementConfigEntry
 * @typedef {import('./boundDomRendererBase.js').ElementsConfig} ElementsConfig
 * @typedef {import('../interfaces/CommonTypes.js').NamespacedId} NamespacedId
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
 * @augments {SelectableListDisplayComponent<ActionComposite>}
 */
export class ActionButtonsRenderer extends SelectableListDisplayComponent {
  _EVENT_TYPE_SUBSCRIBED = 'core:update_available_actions';

  static FADE_IN_CLASS = 'actions-fade-in';
  static FADE_OUT_CLASS = 'actions-fade-out';
  static DISABLED_CLASS = 'actions-disabled';

  /** @type {ActionComposite | null} */
  selectedAction = null;
  /** @type {ActionComposite[]} */
  availableActions = [];
  #currentActorId = null;
  #isDisposed = false;

  /** @type {object} Configuration for grouping behavior */
  #groupingConfig = {
    enabled: true,
    showCounts: false,
    minActionsForGrouping: 6,
    minNamespacesForGrouping: 2,
    namespaceOrder: ['core', 'intimacy', 'sex', 'anatomy', 'clothing'],
  };

  /** @type {Map<string, ActionComposite[]>} Grouped actions by namespace */
  #groupedActions = new Map();

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
      datasetKey: DATASET_ACTION_INDEX,
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
    button.setAttribute('role', 'radio');
    button.setAttribute(
      `data-${DATASET_ACTION_INDEX.replace(/([A-Z])/g, '-$1').toLowerCase()}`,
      String(actionIndex)
    );

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

      this._onItemSelected(button, clickedAction);
    });

    return button;
  }

  /**
   * Handles selection updates when a list item is clicked.
   *
   * @protected
   * @param {HTMLElement|null} selectedElement - The clicked button element.
   * @param {ActionComposite|null} actionData - The action data associated with the element.
   * @returns {void}
   */
  _onItemSelected(selectedElement, actionData) {
    super._selectItem(selectedElement, actionData);
    this.selectedAction = actionData;
    if (this.elements.sendButtonElement) {
      this.elements.sendButtonElement.disabled = !actionData;
    }
    if (actionData) {
      this.logger.debug(
        `${this._logPrefix} Action selected: '${actionData.commandString}' (Index: ${actionData.index}, ID: ${actionData.actionId})`
      );
    } else {
      this.logger.debug(`${this._logPrefix} Action deselected.`);
    }
  }

  /**
   * @protected
   * @override
   */
  _getEmptyListMessage() {
    return 'No actions available.';
  }

  /**
   * Override renderList to implement grouping functionality
   *
   * @override
   * @async
   * @returns {Promise<void>}
   */
  async renderList() {
    this.logger.debug(
      `${this._logPrefix} renderList() called with grouping support.`
    );

    if (!this.elements.listContainerElement) {
      this.logger.error(
        `${this._logPrefix} Cannot render list: 'listContainerElement' is not available.`
      );
      return;
    }

    let itemsData = null;
    try {
      // Get the items data
      itemsData = await this._getListItemsData();
    } catch (error) {
      this.logger.error(`${this._logPrefix} Error fetching list data:`, error);
      const container = this.elements.listContainerElement;
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      const errorEl = this.documentContext.create('div');
      errorEl.className = 'error-message';
      errorEl.textContent = 'Error loading action data.';
      container.appendChild(errorEl);
      return;
    }

    // Clear the container
    const container = this.elements.listContainerElement;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Handle empty or invalid data
    if (!itemsData || !Array.isArray(itemsData) || itemsData.length === 0) {
      const emptyMsg = this._getEmptyListMessage();
      if (typeof emptyMsg === 'string') {
        const msgEl = this.documentContext.create('div');
        msgEl.className = 'empty-list-message';
        msgEl.textContent = emptyMsg;
        container.appendChild(msgEl);
      } else if (emptyMsg instanceof HTMLElement) {
        container.appendChild(emptyMsg);
      }
      this._onListRendered(null, container);
      return;
    }

    // Check if we should use grouping
    if (!this.#shouldUseGrouping(itemsData)) {
      // Use standard rendering without grouping
      itemsData.forEach((item) => {
        const element = this._renderListItem(item);
        if (element) {
          container.appendChild(element);
        }
      });
    } else {
      // Use grouped rendering
      this.#groupedActions = this.#groupActionsByNamespace(itemsData);
      const fragment = this.#renderGroupedActions();
      container.appendChild(fragment);
    }

    // Call the post-render hook
    this._onListRendered(itemsData, container);
  }

  /**
   * Determines if grouping should be applied based on action count and diversity
   *
   * @private
   * @param {ActionComposite[]} actions
   * @returns {boolean}
   */
  #shouldUseGrouping(actions) {
    const namespaces = new Set(
      actions
        .filter((action) => action && action.actionId)
        .map((action) => this.#extractNamespace(action.actionId))
    );
    return (
      actions.length >= this.#groupingConfig.minActionsForGrouping &&
      namespaces.size >= this.#groupingConfig.minNamespacesForGrouping &&
      this.#groupingConfig.enabled
    );
  }

  /**
   * Extracts namespace from action ID (e.g., "core:wait" → "core")
   *
   * @private
   * @param {string} actionId
   * @returns {string}
   */
  #extractNamespace(actionId) {
    if (!actionId || typeof actionId !== 'string') {
      return 'unknown';
    }
    const colonIndex = actionId.indexOf(':');
    return colonIndex !== -1 ? actionId.substring(0, colonIndex) : 'unknown';
  }

  /**
   * Groups actions by namespace with ordering priority
   *
   * @private
   * @param {ActionComposite[]} actions
   * @returns {Map<string, ActionComposite[]>}
   */
  #groupActionsByNamespace(actions) {
    const grouped = new Map();

    // Group actions
    for (const action of actions) {
      // Include all actions, even null ones, so _renderListItem can handle validation
      const namespace = this.#extractNamespace(action?.actionId);
      if (!grouped.has(namespace)) {
        grouped.set(namespace, []);
      }
      grouped.get(namespace).push(action);
    }

    // Sort namespaces by priority order
    const sortedGroups = new Map();
    const orderedNamespaces = this.#getSortedNamespaces(
      Array.from(grouped.keys())
    );

    for (const namespace of orderedNamespaces) {
      sortedGroups.set(namespace, grouped.get(namespace));
    }

    return sortedGroups;
  }

  /**
   * Sorts namespaces according to priority configuration
   *
   * @private
   * @param {string[]} namespaces
   * @returns {string[]}
   */
  #getSortedNamespaces(namespaces) {
    const { namespaceOrder } = this.#groupingConfig;

    return namespaces.sort((a, b) => {
      const aIndex = namespaceOrder.indexOf(a);
      const bIndex = namespaceOrder.indexOf(b);

      // If both are in priority list, sort by priority order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If only one is in priority list, prioritize it
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // If neither is in priority list, sort alphabetically
      return a.localeCompare(b);
    });
  }

  /**
   * Renders actions with section headers
   *
   * @private
   * @returns {DocumentFragment}
   */
  #renderGroupedActions() {
    const fragment = this.documentContext.document.createDocumentFragment();

    for (const [namespace, actions] of this.#groupedActions) {
      // Create section header
      const sectionHeader = this.#createSectionHeader(
        namespace,
        actions.length
      );
      fragment.appendChild(sectionHeader);

      // Create action group container
      const groupContainer = this.#createGroupContainer(namespace);

      // Render actions in this group
      for (const action of actions) {
        const button = this._renderListItem(action);
        if (button) {
          groupContainer.appendChild(button);
        }
      }

      fragment.appendChild(groupContainer);
    }

    return fragment;
  }

  /**
   * Creates a section header element
   *
   * @private
   * @param {string} namespace
   * @param {number} actionCount
   * @returns {HTMLElement}
   */
  #createSectionHeader(namespace, actionCount) {
    const header = this.documentContext.create('div');
    header.className = 'action-section-header';
    header.setAttribute('role', 'heading');
    header.setAttribute('aria-level', '3');

    const displayName = this.#formatNamespaceDisplayName(namespace);
    header.textContent = this.#groupingConfig.showCounts
      ? `${displayName} (${actionCount})`
      : displayName;

    return header;
  }

  /**
   * Creates a container for grouped actions
   *
   * @private
   * @param {string} namespace
   * @returns {HTMLElement}
   */
  #createGroupContainer(namespace) {
    const container = this.documentContext.create('div');
    container.className = 'action-group';
    container.setAttribute('data-namespace', namespace);
    container.setAttribute('role', 'group');
    container.setAttribute(
      'aria-label',
      `${this.#formatNamespaceDisplayName(namespace)} actions`
    );

    return container;
  }

  /**
   * Formats namespace for display (e.g., "core" → "CORE")
   *
   * @private
   * @param {string} namespace
   * @returns {string}
   */
  #formatNamespaceDisplayName(namespace) {
    // Handle special cases
    const specialCases = {
      unknown: 'OTHER',
    };

    if (specialCases[namespace]) {
      return specialCases[namespace];
    }

    return namespace.toUpperCase();
  }

  /**
   * Updates grouping configuration
   *
   * @public
   * @param {object} config
   */
  updateGroupingConfig(config) {
    this.#groupingConfig = { ...this.#groupingConfig, ...config };

    // Re-render if we have current actions
    if (this.availableActions.length > 0) {
      this.refreshList();
    }
  }

  /**
   * Gets current grouping configuration
   *
   * @public
   * @returns {object}
   */
  getGroupingConfig() {
    return { ...this.#groupingConfig };
  }

  /**
   * @protected
   * @override
   */
  _onListRendered(actionsData, container) {
    if (this.#isDisposed) return;

    super._onListRendered(actionsData, container);

    if (container) {
      container.classList.remove(ActionButtonsRenderer.DISABLED_CLASS);
      container.classList.remove(ActionButtonsRenderer.FADE_OUT_CLASS);
      container.classList.add(ActionButtonsRenderer.FADE_IN_CLASS);
      container.addEventListener(
        'animationend',
        () => {
          container.classList.remove(ActionButtonsRenderer.FADE_IN_CLASS);
        },
        { once: true }
      );

      const buttons = container.querySelectorAll('button.action-button');
      buttons.forEach((btn, idx) => {
        if (btn?.style?.setProperty) {
          btn.style.setProperty('--i', idx.toString());
        }
      });
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

    if (this.selectedAction) {
      const attrName = DATASET_ACTION_INDEX.replace(
        /([A-Z])/g,
        '-$1'
      ).toLowerCase();
      const selectedButton = container.querySelector(
        `button.action-button[data-${attrName}="${this.selectedAction.index}"]`
      );
      this._selectItem(selectedButton, this.selectedAction);
    } else {
      this._selectItem(null, null);
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

          // Play fade-out animation then clear actions and disable
          container.classList.remove(ActionButtonsRenderer.FADE_IN_CLASS);
          container.classList.add(ActionButtonsRenderer.FADE_OUT_CLASS);
          container.addEventListener(
            'animationend',
            () => {
              container.classList.remove(ActionButtonsRenderer.FADE_OUT_CLASS);
              if (this.availableActions.length === 0) {
                while (container.firstChild) {
                  container.removeChild(container.firstChild);
                }
                container.classList.add(ActionButtonsRenderer.DISABLED_CLASS);
              }
            },
            { once: true }
          );
        }

        this.availableActions = [];

        // 3. Clear internal state
        this._onItemSelected(null, null);
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
