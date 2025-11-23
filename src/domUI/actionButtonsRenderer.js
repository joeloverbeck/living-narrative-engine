/**
 * @file Renders available actions as buttons from an array of `ActionComposite` objects.
 * Handles action selection and dispatches the chosen action.
 * @see src/domUI/actionButtonsRenderer.js
 */

import { SelectableListDisplayComponent } from './selectableListDisplayComponent.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../constants/eventIds.js';
import { DATASET_ACTION_INDEX } from '../constants/datasetKeys.js';
import { validateDependency } from '../utils/dependencyUtils.js';

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
  #actionCategorizationService = null;

  /** @type {Map<string, ActionComposite[]>} Grouped actions by namespace */
  #groupedActions = new Map();

  /** @type {string | null} Current active theme */
  #currentTheme = null;

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
   * @param {object} params.actionCategorizationService - Service for action categorization logic.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory,
    actionButtonsContainerSelector,
    sendButtonSelector = '#player-confirm-turn-button',
    speechInputSelector = '#speech-input',
    actionCategorizationService,
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

    // Validate the action categorization service
    validateDependency(
      actionCategorizationService,
      'IActionCategorizationService',
      null,
      {
        requiredMethods: [
          'extractNamespace',
          'shouldUseGrouping',
          'groupActionsByNamespace',
          'getSortedNamespaces',
          'formatNamespaceDisplayName',
          'shouldShowCounts',
        ],
      }
    );

    this.#actionCategorizationService = actionCategorizationService;
    this.selectedAction = null;
    this.availableActions = [];
    this.#currentActorId = null;
    this.#isDisposed = false;

    // Store references for visual styling and hover handling
    this.buttonVisualMap = new Map();

    // Performance optimization: cache parsed colors to avoid repeated DOM operations
    this.colorParseCache = new Map();

    // Hover state management with event delegation
    this.hoverTimeouts = new Map(); // For debouncing rapid hover changes
    this.boundHoverHandlers = {
      enter: this._handleHoverEnter.bind(this),
      leave: this._handleHoverLeave.bind(this),
    };

    // Set up event delegation for hover management
    this._setupHoverEventDelegation();

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

    // Subscribe to theme change events
    this._subscribe('THEME_CHANGED', this.#handleThemeChange.bind(this));
    this.logger.debug(
      `${this._logPrefix} Subscribed to VED event 'THEME_CHANGED' via _subscribe.`
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

    // Apply visual styles if present
    try {
      if (actionComposite.visual) {
        this._applyVisualStylesWithValidation(
          button,
          actionComposite.visual,
          actionComposite.actionId
        );

        this.logger.debug(
          `${this._logPrefix} Applied visual styles to button for action: ${actionComposite.actionId}`
        );
      }
    } catch (error) {
      this.logger.warn(
        `${this._logPrefix} Failed to apply visual styles for action ${actionComposite.actionId}:`,
        error
      );
      // Continue without visual customization
    }

    // Add hover listeners (ACTBUTVIS-008)
    this._addHoverListeners(button);

    // Apply current theme if one is active
    if (this.#currentTheme) {
      button.classList.add(`theme-${this.#currentTheme}-adapted`);
      button.style.setProperty('--current-theme', this.#currentTheme);
    }

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
   * Apply visual styles with contrast validation
   *
   * @private
   * @param {HTMLButtonElement} button - Button element
   * @param {object} visual - Visual properties
   * @param {string} actionId - Action identifier
   */
  _applyVisualStylesWithValidation(button, visual, actionId) {
    // Apply the visual styles (existing method)
    this._applyVisualStyles(button, visual, actionId);

    // Validate contrast for accessibility
    if (visual.backgroundColor && visual.textColor) {
      const hasGoodContrast = this._validateContrast(
        visual.backgroundColor,
        visual.textColor
      );

      if (!hasGoodContrast) {
        this.logger.warn(
          `Action button ${actionId} may have insufficient contrast. ` +
            `Background: ${visual.backgroundColor}, Text: ${visual.textColor}`
        );

        // Add warning class for developer awareness
        button.classList.add('contrast-warning');
      }
    }

    // Set CSS custom properties for future theme support
    this._setThemeReadyProperties(button, visual);

    // Prepare for future theme support
    this._prepareForThemeSupport(button);
  }

  /**
   * Apply visual styles to a button
   *
   * @private
   * @param {HTMLButtonElement} button - Button element
   * @param {object} visual - Visual properties object
   * @param {string} actionId - Action ID for tracking
   */
  _applyVisualStyles(button, visual, actionId) {
    if (!visual || !button) {
      return;
    }

    try {
      // Apply base colors via inline styles
      if (visual.backgroundColor) {
        button.style.backgroundColor = visual.backgroundColor;
        // Store original for theme switching
        button.dataset.customBg = visual.backgroundColor;
      }

      if (visual.textColor) {
        button.style.color = visual.textColor;
        // Store original for theme switching
        button.dataset.customText = visual.textColor;
      }

      // Store hover colors in dataset for hover handling (ACTBUTVIS-008)
      if (visual.hoverBackgroundColor || visual.hoverTextColor) {
        // Store original colors for restoration
        button.dataset.originalBg = visual.backgroundColor || '';
        button.dataset.originalText = visual.textColor || '';

        // Store hover colors
        button.dataset.hoverBg = visual.hoverBackgroundColor || '';
        button.dataset.hoverText = visual.hoverTextColor || '';

        // Flag button as having custom hover
        button.dataset.hasCustomHover = 'true';
      }

      // Store visual mapping for efficient updates
      this.buttonVisualMap.set(actionId, {
        button: button,
        visual: visual,
      });

      // Add custom visual class for CSS hooks
      button.classList.add('action-button-custom-visual');

      this.logger.debug(
        `Applied visual styles to button for action: ${actionId}`
      );
    } catch (error) {
      this.logger.warn(
        `Failed to apply visual styles for action ${actionId}:`,
        error
      );
      // Continue without visual customization
    }
  }

  /**
   * Set CSS custom properties for theme readiness with batched assignments
   *
   * @private
   * @param {HTMLButtonElement} button - Button element
   * @param {object} visual - Visual properties
   */
  _setThemeReadyProperties(button, visual) {
    try {
      // Batch CSS custom properties for better performance
      const properties = [];

      if (visual.backgroundColor) {
        properties.push(['--custom-bg-color', visual.backgroundColor]);
      }
      if (visual.textColor) {
        properties.push(['--custom-text-color', visual.textColor]);
      }
      if (visual.borderColor) {
        properties.push(['--custom-border-color', visual.borderColor]);
      }

      // Add default theme-aware properties for selection and focus
      properties.push(
        ['--selection-color', 'var(--theme-selection-color, #0066cc)'],
        ['--focus-color', 'var(--theme-focus-color, #0066cc)']
      );

      // Apply all properties in a batch to minimize reflows
      for (const [property, value] of properties) {
        button.style.setProperty(property, value);
      }
    } catch (error) {
      // Log warning but continue - CSS custom properties are enhancement only
      this.logger.warn(
        `Failed to set theme-ready properties: ${error.message}`,
        error
      );
    }
  }

  /**
   * Validate contrast ratio between background and text colors
   *
   * @private
   * @param {string} bgColor - Background color
   * @param {string} textColor - Text color
   * @returns {boolean} True if contrast meets WCAG AA standards
   */
  _validateContrast(bgColor, textColor) {
    const bg = this._parseColor(bgColor);
    const text = this._parseColor(textColor);

    if (!bg || !text) return true; // Assume valid if can't parse

    // Calculate relative luminance (WCAG formula)
    const getLuminance = (rgb) => {
      const sRGB = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
      const linear = sRGB.map((val) => {
        if (val <= 0.03928) return val / 12.92;
        return Math.pow((val + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    };

    const bgLuminance = getLuminance(bg);
    const textLuminance = getLuminance(text);

    // Calculate contrast ratio
    const lighter = Math.max(bgLuminance, textLuminance);
    const darker = Math.min(bgLuminance, textLuminance);
    const contrastRatio = (lighter + 0.05) / (darker + 0.05);

    // WCAG AA requires 4.5:1 for normal text
    return contrastRatio >= 4.5;
  }

  /**
   * Parse CSS color to RGB values with caching for performance
   *
   * @private
   * @param {string} color - CSS color string
   * @returns {object | null} RGB object or null if parsing fails
   */
  _parseColor(color) {
    // Check cache first for performance
    if (this.colorParseCache.has(color)) {
      return this.colorParseCache.get(color);
    }

    let result = null;
    try {
      // Use a temporary element to parse the color
      const div = this.documentContext.create('div');
      div.style.color = color;

      // Get the document body, fallback to documentElement if body doesn't exist
      const container =
        this.documentContext.body ||
        this.documentContext.document.documentElement;
      container.appendChild(div);

      const computed = this.documentContext.window.getComputedStyle(div).color;
      container.removeChild(div);

      // Parse rgb(r, g, b) or rgba(r, g, b, a) format
      const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        result = {
          r: parseInt(match[1], 10),
          g: parseInt(match[2], 10),
          b: parseInt(match[3], 10),
        };
      }
    } catch (error) {
      // result remains null if parsing fails for any reason
    }

    // Cache the result (including null results to avoid repeated failed attempts)
    this.colorParseCache.set(color, result);
    return result;
  }

  /**
   * Prepare for future theme support
   *
   * @private
   * @param {HTMLButtonElement} button - Button element
   */
  _prepareForThemeSupport(button) {
    // Add data attribute for future theme system
    button.dataset.themeReady = 'true';

    // Add class for theme-aware styling
    button.classList.add('theme-aware-button');
  }

  /**
   * Set up event delegation for hover management on the container
   *
   * @private
   */
  _setupHoverEventDelegation() {
    if (!this.elements.listContainerElement) {
      return;
    }

    const container = this.elements.listContainerElement;

    // Use event delegation for better performance
    this._addDomListener(
      container,
      'mouseenter',
      this._handleDelegatedHoverEnter.bind(this)
    );
    this._addDomListener(
      container,
      'mouseleave',
      this._handleDelegatedHoverLeave.bind(this)
    );
    this._addDomListener(
      container,
      'focusin',
      this._handleDelegatedHoverEnter.bind(this)
    );
    this._addDomListener(
      container,
      'focusout',
      this._handleDelegatedHoverLeave.bind(this)
    );
  }

  /**
   * Handle delegated hover enter events
   *
   * @private
   * @param {Event} event - Mouse/focus event
   */
  _handleDelegatedHoverEnter(event) {
    const button = event.target.closest('.action-button');
    if (!button) return;

    this._handleHoverEnter({ target: button });
  }

  /**
   * Handle delegated hover leave events
   *
   * @private
   * @param {Event} event - Mouse/focus event
   */
  _handleDelegatedHoverLeave(event) {
    const button = event.target.closest('.action-button');
    if (!button) return;

    this._handleHoverLeave({ target: button });
  }

  /**
   * Add hover event listeners to a button (hybrid approach for testing compatibility)
   *
   * @private
   * @param {HTMLButtonElement} button - Button element
   */
  _addHoverListeners(button) {
    // Event delegation handles the performance in production
    // But we maintain individual listeners for test compatibility
    const isTestEnvironment = typeof globalThis !== 'undefined' &&
      globalThis.process?.env?.NODE_ENV === 'test';

    if (isTestEnvironment) {
      // Use bound handlers to avoid memory leaks
      button.addEventListener('mouseenter', this.boundHoverHandlers.enter);
      button.addEventListener('mouseleave', this.boundHoverHandlers.leave);

      // Handle focus states for accessibility
      button.addEventListener('focus', this.boundHoverHandlers.enter);
      button.addEventListener('blur', this.boundHoverHandlers.leave);
    }

    // Mark as having listeners for cleanup compatibility
    button.dataset.hasHoverListeners = 'true';
  }

  /**
   * Remove hover event listeners from a button (hybrid approach for testing compatibility)
   *
   * @private
   * @param {HTMLButtonElement} button - Button element
   */
  _removeHoverListeners(button) {
    if (button.dataset.hasHoverListeners === 'true') {
      const isTestEnvironment = typeof globalThis !== 'undefined' &&
        globalThis.process?.env?.NODE_ENV === 'test';

      if (isTestEnvironment) {
        button.removeEventListener('mouseenter', this.boundHoverHandlers.enter);
        button.removeEventListener('mouseleave', this.boundHoverHandlers.leave);
        button.removeEventListener('focus', this.boundHoverHandlers.enter);
        button.removeEventListener('blur', this.boundHoverHandlers.leave);
      }

      delete button.dataset.hasHoverListeners;
    }
  }

  /**
   * Handle mouse enter / focus events
   *
   * @private
   * @param {Event} event - Mouse/focus event
   */
  _handleHoverEnter(event) {
    const button = event.target;

    // Ignore if button is disabled
    if (button.disabled) {
      return;
    }

    // Clear any pending hover leave timeout
    const timeoutId = this.hoverTimeouts.get(button);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.hoverTimeouts.delete(button);
    }

    try {
      this._applyHoverState(button, true);
    } catch (error) {
      this.logger.warn('Error applying hover state:', error);
    }
  }

  /**
   * Handle mouse leave / blur events
   *
   * @private
   * @param {Event} event - Mouse/blur event
   */
  _handleHoverLeave(event) {
    const button = event.target;

    // Debounce rapid hover changes to prevent flicker
    const timeoutId = setTimeout(() => {
      try {
        this._applyHoverState(button, false);
      } catch (error) {
        this.logger.warn('Error removing hover state:', error);
      }

      this.hoverTimeouts.delete(button);
    }, 50); // 50ms debounce

    this.hoverTimeouts.set(button, timeoutId);
  }

  /**
   * Apply or remove hover state styling
   *
   * @private
   * @param {HTMLButtonElement} button - Button element
   * @param {boolean} isHovering - Whether to apply hover state
   */
  _applyHoverState(button, isHovering) {
    if (isHovering) {
      // Apply hover colors
      if (button.dataset.hoverBg) {
        button.style.backgroundColor = button.dataset.hoverBg;
      }

      if (button.dataset.hoverText) {
        button.style.color = button.dataset.hoverText;
      }

      // Add hover class for CSS hooks
      button.classList.add('action-button-hovering');
    } else {
      // Restore original colors
      if (button.dataset.originalBg !== undefined) {
        button.style.backgroundColor = button.dataset.originalBg;
      }

      if (button.dataset.originalText !== undefined) {
        button.style.color = button.dataset.originalText;
      }

      // Remove hover class
      button.classList.remove('action-button-hovering');

      // Reapply custom colors if button is still selected
      if (button.classList.contains('selected') && button.dataset.customBg) {
        // Keep the custom background for selected buttons
        button.style.backgroundColor = button.dataset.customBg;
      }
    }
  }

  /**
   * Update visual styles for a specific button
   *
   * @param {string} actionId - Action ID
   * @param {object} newVisual - New visual properties
   */
  updateButtonVisual(actionId, newVisual) {
    const mapping = this.buttonVisualMap.get(actionId);

    if (!mapping) {
      this.logger.warn(`No button found for action: ${actionId}`);
      return;
    }

    const { button } = mapping;

    try {
      // Remove existing hover listeners before updating (ACTBUTVIS-008)
      this._removeHoverListeners(button);

      // Clear existing inline styles
      button.style.backgroundColor = '';
      button.style.color = '';

      // Apply new visual styles
      if (newVisual) {
        this._applyVisualStylesWithValidation(button, newVisual, actionId);
        // Re-add hover listeners after applying new visual
        this._addHoverListeners(button);
      } else {
        // Remove custom visual class
        button.classList.remove('action-button-custom-visual');
        // Remove theme-aware class
        button.classList.remove('theme-aware-button');

        // Clear CSS custom properties
        button.style.removeProperty('--custom-bg-color');
        button.style.removeProperty('--custom-text-color');
        button.style.removeProperty('--custom-border-color');
        button.style.removeProperty('--selection-color');
        button.style.removeProperty('--focus-color');

        // Clear dataset
        delete button.dataset.customBg;
        delete button.dataset.customText;
        delete button.dataset.hasCustomHover;
        delete button.dataset.originalBg;
        delete button.dataset.originalText;
        delete button.dataset.hoverBg;
        delete button.dataset.hoverText;
        delete button.dataset.themeReady;

        // Remove contrast warning class
        button.classList.remove('contrast-warning');

        // Remove from map
        this.buttonVisualMap.delete(actionId);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to update visual styles for action ${actionId}:`,
        error
      );
      // Continue without visual update
    }
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
    if (!this.#actionCategorizationService.shouldUseGrouping(itemsData)) {
      // Use standard rendering without grouping
      itemsData.forEach((item) => {
        const element = this._renderListItem(item);
        if (element) {
          container.appendChild(element);
        }
      });
    } else {
      // Use grouped rendering
      this.#groupedActions =
        this.#actionCategorizationService.groupActionsByNamespace(itemsData);
      const fragment = this.#renderGroupedActions();
      container.appendChild(fragment);
    }

    // Call the post-render hook
    this._onListRendered(itemsData, container);
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

    const displayName =
      this.#actionCategorizationService.formatNamespaceDisplayName(namespace);

    // Check configuration to determine if counts should be shown
    if (this.#actionCategorizationService.shouldShowCounts()) {
      header.textContent = `${displayName} (${actionCount})`;
    } else {
      header.textContent = displayName;
    }

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
      `${this.#actionCategorizationService.formatNamespaceDisplayName(namespace)} actions`
    );

    return container;
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

    // Debug logging for visual properties
    if (
      eventObject?.payload?.actions &&
      Array.isArray(eventObject.payload.actions)
    ) {
      const actionsWithVisual = eventObject.payload.actions.filter(
        (a) => a && a.visual !== null && typeof a.visual === 'object'
      );
      const actionsWithNullVisual = eventObject.payload.actions.filter(
        (a) => a && a.visual === null
      );
      const actionsMissingVisual = eventObject.payload.actions.filter(
        (a) => a && typeof a.visual === 'undefined'
      );

      if (actionsWithVisual.length > 0) {
        this.logger.debug(
          '[ActionButtonsRenderer] Actions with visual properties:',
          {
            total: eventObject.payload.actions.length,
            withVisualProps: actionsWithVisual.length,
            withNullVisual: actionsWithNullVisual.length,
            missingVisual: actionsMissingVisual.length,
            visualDetails: actionsWithVisual.map((a) => ({
              actionId: a.actionId,
              visual: a.visual,
            })),
          }
        );
      } else {
        this.logger.debug(
          '[ActionButtonsRenderer] No actions have defined visual properties in this update',
          {
            total: eventObject.payload.actions.length,
            withNullVisual: actionsWithNullVisual.length,
            missingVisual: actionsMissingVisual.length,
          }
        );
      }
    }

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
   * Handles theme change events
   *
   * @param {object} eventObject - Event object with theme change data
   * @param {string} eventObject.payload.newTheme - The new theme identifier
   * @param {string} [eventObject.payload.previousTheme] - The previous theme identifier
   * @private
   */
  #handleThemeChange(eventObject) {
    if (this.#isDisposed) return;

    const newTheme = eventObject?.payload?.newTheme;
    const previousTheme = eventObject?.payload?.previousTheme;

    if (!newTheme || typeof newTheme !== 'string') {
      this.logger.warn(
        `${this._logPrefix} Received THEME_CHANGED event with invalid newTheme`,
        { eventObject }
      );
      return;
    }

    this.logger.debug(
      `${this._logPrefix} Theme changed from '${previousTheme || 'unknown'}' to '${newTheme}'`
    );

    this.#currentTheme = newTheme;

    // Apply theme adaptations to all currently rendered buttons
    this.#applyThemeToAllButtons(newTheme, previousTheme);
  }

  /**
   * Applies theme adaptations to all currently rendered buttons
   *
   * @param {string} newTheme - The new theme identifier
   * @param {string} [previousTheme] - The previous theme identifier
   * @private
   */
  #applyThemeToAllButtons(newTheme, previousTheme) {
    if (!this.elements.listContainerElement) {
      return;
    }

    const buttons =
      this.elements.listContainerElement.querySelectorAll('.action-button');

    buttons.forEach((button) => {
      // Remove previous theme class if it exists
      if (previousTheme) {
        button.classList.remove(`theme-${previousTheme}-adapted`);
      }

      // Add new theme class
      button.classList.add(`theme-${newTheme}-adapted`);

      // Update theme-aware CSS custom properties
      // These can be used by CSS to adjust colors based on theme
      button.style.setProperty('--current-theme', newTheme);
    });

    this.logger.debug(
      `${this._logPrefix} Applied theme '${newTheme}' to ${buttons.length} buttons`
    );
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

    // Clean up hover state (ACTBUTVIS-008)
    if (this.hoverTimeouts) {
      // Clear all pending hover timeouts
      for (const [, timeoutId] of this.hoverTimeouts) {
        clearTimeout(timeoutId);
      }
      this.hoverTimeouts.clear();
    }

    if (this.elements && this.elements.listContainerElement) {
      // Remove hover listeners from all buttons before clearing DOM
      const buttons =
        this.elements.listContainerElement.querySelectorAll('.action-button');
      buttons.forEach((button) => {
        this._removeHoverListeners(button);
      });

      while (this.elements.listContainerElement.firstChild) {
        this.elements.listContainerElement.removeChild(
          this.elements.listContainerElement.firstChild
        );
      }
      this.logger.debug(
        `${this._logPrefix} Cleared listContainerElement content during dispose.`
      );
    }

    // Clear visual mappings and color parse cache
    if (this.buttonVisualMap) {
      this.buttonVisualMap.clear();
    }
    if (this.colorParseCache) {
      this.colorParseCache.clear();
    }

    super.dispose();

    this.selectedAction = null;
    this.availableActions = [];
    this.#currentActorId = null;

    this.logger.debug(`${this._logPrefix} ActionButtonsRenderer disposed.`);
    this.#isDisposed = true;
  }
}
