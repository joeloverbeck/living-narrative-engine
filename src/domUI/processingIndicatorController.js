// src/domUI/ProcessingIndicatorController.js

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import {
  TURN_PROCESSING_STARTED,
  TURN_PROCESSING_ENDED,
  PLAYER_TURN_SUBMITTED_ID,
  TURN_STARTED_ID,
  // TEXT_UI_DISPLAY_SPEECH_ID // Not directly used for hiding in this version
} from '../constants/eventIds.js'; // Assuming these constants are correctly named and exported
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 */

/**
 * @typedef {'ai-llm' | 'ai-goap' | 'human'} IndicatorType
 * Represents the type of player the indicator is for.
 */

export class ProcessingIndicatorController extends BoundDomRendererBase {
  /**
   * The dynamically created or found processing indicator HTML element.
   *
   * @private
   * @type {HTMLElement | null}
   */
  #indicatorElement = null;

  /**
   * The speech input element, if handling player input indication.
   *
   * @private
   * @type {HTMLInputElement | null}
   */
  #speechInputElement = null;

  /**
   * The DomElementFactory instance.
   *
   * @private
   * @type {DomElementFactory | null}
   */

  /**
   * @type {ISafeEventDispatcher | null}
   */
  safeEventDispatcher = null;

  /**
   * The current player type for styling purposes.
   *
   * @private
   * @type {IndicatorType | null}
   */
  #currentPlayerType = null;

  /**
   * Whether the current turn is for a human player.
   *
   * @private
   * @type {boolean}
   */
  #isHumanTurn = false;

  /**
   * Creates a controller for rendering processing indicators.
   *
   * @param {object} params - The parameters object.
   * @param {ILogger} params.logger - The logger instance.
   * @param {IDocumentContext} params.documentContext - The document context abstraction.
   * @param {ISafeEventDispatcher} params.safeEventDispatcher - The event dispatcher.
   * @param {DomElementFactory} params.domElementFactory - Factory for creating DOM elements.
   * @param {string} [params.speechInputSelector] - CSS selector for the speech input for player composing indicator.
   */
  constructor({
    logger,
    documentContext,
    safeEventDispatcher,
    domElementFactory,
    speechInputSelector = '#speech-input',
  }) {
    const elementsConfig = {
      outputDiv: { selector: '#outputDiv', required: true },
      // speechInputForPlayerIndicator is optional, used for player composing indicator
      speechInputForPlayerIndicator: {
        selector: speechInputSelector,
        required: false,
        expectedType: HTMLInputElement,
      },
    };
    super({
      logger,
      documentContext,
      validatedEventDispatcher: safeEventDispatcher,
      elementsConfig,
      domElementFactory,
    });

    this.safeEventDispatcher = safeEventDispatcher;

    this.#initializeIndicatorElement();

    if (this.elements.speechInputForPlayerIndicator) {
      this.#speechInputElement = this.elements.speechInputForPlayerIndicator;
      this.logger.debug(
        `${this._logPrefix} Speech input element for player indicator cached.`
      );
    } else {
      this.logger.debug(
        `${this._logPrefix} Speech input element (selector: '${speechInputSelector}') not found. Player input indicator will not be active via direct input listening.`
      );
    }

    if (this.#indicatorElement) {
      this.#hideIndicator('initialization'); // Ensure it's hidden initially
    }
    this.#subscribeToEvents();
    this.logger.debug(`${this._logPrefix} Initialized.`);
  }

  /**
   * Finds or creates the indicator element and appends it to the outputDiv.
   *
   * @private
   */
  #initializeIndicatorElement() {
    this.#indicatorElement = this.documentContext.query(
      '#processing-indicator'
    );

    if (!this.#indicatorElement) {
      if (this.domElementFactory && this.elements.outputDiv) {
        this.logger.debug(
          `${this._logPrefix} #processing-indicator not found in DOM. Creating dynamically.`
        );
        this.#indicatorElement = this.domElementFactory.create('div', {
          id: 'processing-indicator',
          cls: 'processing-indicator', // CSS will handle initial display: none via lack of .visible
          attrs: { 'aria-live': 'polite', 'aria-label': 'Processing turn' },
        });

        if (this.#indicatorElement) {
          for (let i = 0; i < 3; i++) {
            const dot = this.domElementFactory.span('dot');
            if (dot) {
              this.#indicatorElement.appendChild(dot);
            } else {
              this.logger.warn(
                `${this._logPrefix} Failed to create dot span for indicator.`
              );
            }
          }
          this.elements.outputDiv.appendChild(this.#indicatorElement);
          this.logger.debug(
            `${this._logPrefix} Processing indicator created and appended to #outputDiv.`
          );
        } else {
          const errMsg = `${this._logPrefix} Failed to create #processing-indicator element using DomElementFactory.`;
          safeDispatchError(this.safeEventDispatcher, errMsg);
        }
      } else {
        const errMsg = `${this._logPrefix} Cannot create #processing-indicator: DomElementFactory or #outputDiv element missing.`;
        safeDispatchError(this.safeEventDispatcher, errMsg);
      }
    } else {
      this.logger.debug(
        `${this._logPrefix} #processing-indicator found in DOM.`
      );
      // Ensure it's a child of outputDiv if it exists but isn't already.
      if (
        this.elements.outputDiv &&
        this.#indicatorElement.parentElement !== this.elements.outputDiv
      ) {
        this.logger.warn(
          `${this._logPrefix} #processing-indicator exists but is not a child of #outputDiv. Moving it.`
        );
        this.elements.outputDiv.appendChild(this.#indicatorElement);
      }
    }
  }

  /**
   * Subscribes to relevant VED events and DOM events.
   *
   * @private
   */
  #subscribeToEvents() {
    // Track turn started to know player type
    this._subscribe(TURN_STARTED_ID, (event) => {
      const payload = event.payload;
      this.#currentPlayerType = this.#determinePlayerType(payload);
      this.#isHumanTurn = this.#currentPlayerType === 'human';
      this.logger.debug(
        `${this._logPrefix} Turn started for ${this.#currentPlayerType} player.`
      );
    });

    // Generic Turn Processing Indicator for AI players
    this._subscribe(TURN_PROCESSING_STARTED, () => {
      if (!this.#isHumanTurn) {
        this.#showIndicator(this.#currentPlayerType || 'ai-llm');
      }
    });
    this.logger.debug(
      `${this._logPrefix} Subscribed to ${TURN_PROCESSING_STARTED}.`
    );

    this._subscribe(TURN_PROCESSING_ENDED, () => {
      if (!this.#isHumanTurn) {
        this.#hideIndicator(this.#currentPlayerType || 'ai-llm');
      }
    });
    this.logger.debug(
      `${this._logPrefix} Subscribed to ${TURN_PROCESSING_ENDED}.`
    );

    // Focus-based indicator for human players
    this._subscribe('core:speech_input_gained_focus', () => {
      if (this.#isHumanTurn) {
        this.#showIndicator('human');
      }
    });
    this.logger.debug(
      `${this._logPrefix} Subscribed to core:speech_input_gained_focus.`
    );

    this._subscribe('core:speech_input_lost_focus', () => {
      if (this.#isHumanTurn) {
        this.#hideIndicator('human');
      }
    });
    this.logger.debug(
      `${this._logPrefix} Subscribed to core:speech_input_lost_focus.`
    );

    this._subscribe(
      PLAYER_TURN_SUBMITTED_ID,
      () => {
        if (this.#isHumanTurn) {
          this.#hideIndicator('human');
        }
      }
    );
    this.logger.debug(
      `${this._logPrefix} Subscribed to ${PLAYER_TURN_SUBMITTED_ID} for hiding player indicator.`
    );
  }

  /**
   * Determines the player type from turn started event payload.
   *
   * @param {any} payload - The turn started event payload
   * @returns {IndicatorType}
   * @private
   */
  #determinePlayerType(payload) {
    // Check if the entity has player_type component
    if (payload?.entity?.components?.['core:player_type']) {
      const playerType = payload.entity.components['core:player_type'].type;
      if (playerType === 'human') return 'human';
      if (playerType === 'goap') return 'ai-goap';
      return 'ai-llm'; // Default to LLM for other AI types
    }
    
    // Fallback to old detection method for backward compatibility
    if (payload?.entityType === 'player') {
      return 'human';
    }
    
    return 'ai-llm'; // Default to AI LLM
  }

  /**
   * Shows the processing indicator.
   *
   * @param {IndicatorType} type - The type of processing causing the indicator to show.
   * @private
   */
  #showIndicator(type) {
    if (this.#indicatorElement) {
      // Remove all type classes first
      this.#indicatorElement.classList.remove('human', 'ai-llm', 'ai-goap');
      
      // Add the appropriate type class
      this.#indicatorElement.classList.add(type);
      
      // Update aria-label based on type
      const ariaLabels = {
        'human': 'Typing...',
        'ai-llm': 'AI thinking...',
        'ai-goap': 'AI planning...'
      };
      this.#indicatorElement.setAttribute('aria-label', ariaLabels[type] || 'Processing...');
      
      this.logger.debug(`${this._logPrefix} Showing processing indicator for type: ${type}.`);
      this.#indicatorElement.classList.add('visible');

      // Scroll #outputDiv to bottom so indicator is visible if content is long
      if (this.elements.outputDiv) {
        this.scrollToBottom('outputDiv', 'outputDiv');
      }
    } else {
      this.logger.warn(
        `${this._logPrefix} Attempted to show indicator, but #indicatorElement is null.`
      );
    }
  }

  /**
   * Hides the processing indicator.
   *
   * @param {IndicatorType | 'initialization'} type - The type of processing causing the indicator to hide.
   * @private
   */
  #hideIndicator(type) {
    // Current logic: If any "hide" trigger comes, hide the indicator.
    // More complex logic could be added if different types of indicators
    // should be shown/hidden independently (e.g., if AI processing starts
    // while player is typing, which indicator takes precedence or should both show?).
    // For now, one visual indicator, last call to show/hide wins for its specific type,
    // but generally, a hide call for any type will hide it.
    if (this.#indicatorElement) {
      this.logger.debug(
        `${this._logPrefix} Hiding processing indicator for type: ${type}.`
      );
      this.#indicatorElement.classList.remove('visible');
    } else {
      this.logger.warn(
        `${this._logPrefix} Attempted to hide indicator, but #indicatorElement is null.`
      );
    }
  }

  /**
   * Cleans up resources, removing the indicator element if dynamically created.
   *
   * @override
   */
  dispose() {
    this.logger.debug(
      `${this._logPrefix} Disposing ProcessingIndicatorController.`
    );
    super.dispose(); // Handles VED subscriptions and DOM listeners.

    // Remove the indicator element if it was dynamically created and parented.
    // Check if it was created by this instance by checking if it's not null
    // and if its parent exists (meaning it was added to the DOM).
    if (this.#indicatorElement && this.#indicatorElement.parentElement) {
      this.#indicatorElement.parentElement.removeChild(this.#indicatorElement);
      this.logger.debug(
        `${this._logPrefix} Removed processing indicator element from DOM.`
      );
    }
    this.#indicatorElement = null;
    this.#speechInputElement = null; // Clear reference

    this.logger.debug(
      `${this._logPrefix} ProcessingIndicatorController disposed.`
    );
  }
}
