// src/domUI/ProcessingIndicatorController.js

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import {
  AI_TURN_PROCESSING_STARTED,
  AI_TURN_PROCESSING_ENDED,
  PLAYER_TURN_SUBMITTED_ID,
  // TEXT_UI_DISPLAY_SPEECH_ID // Not directly used for hiding in this version
  DISPLAY_ERROR_ID,
} from '../constants/eventIds.js'; // Assuming these constants are correctly named and exported

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('./domElementFactory.js').default} DomElementFactory
 */

/**
 * @typedef {'ai' | 'player_input'} IndicatorType
 * Represents the type of processing the indicator is for.
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
  #domElementFactory = null;

  /**
   * @type {ISafeEventDispatcher | null}
   */
  safeEventDispatcher = null;

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
    });

    this.safeEventDispatcher = safeEventDispatcher;

    if (!domElementFactory || typeof domElementFactory.create !== 'function') {
      const errMsg = `${this._logPrefix} DomElementFactory dependency is missing or invalid.`;
      this.safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, { message: errMsg });
      // Not throwing, but #indicatorElement creation will fail if it's not in DOM.
    } else {
      this.#domElementFactory = domElementFactory;
    }

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
      if (this.#domElementFactory && this.elements.outputDiv) {
        this.logger.debug(
          `${this._logPrefix} #processing-indicator not found in DOM. Creating dynamically.`
        );
        this.#indicatorElement = this.#domElementFactory.create('div', {
          id: 'processing-indicator',
          cls: 'processing-indicator', // CSS will handle initial display: none via lack of .visible
          attrs: { 'aria-live': 'polite', 'aria-label': 'Processing turn' },
        });

        if (this.#indicatorElement) {
          for (let i = 0; i < 3; i++) {
            const dot = this.#domElementFactory.span('dot');
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
          this.safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
            message: errMsg,
          });
        }
      } else {
        const errMsg = `${this._logPrefix} Cannot create #processing-indicator: DomElementFactory or #outputDiv element missing.`;
        this.safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
          message: errMsg,
        });
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
    // AI Processing Indicator
    this._subscribe(AI_TURN_PROCESSING_STARTED, () =>
      this.#showIndicator('ai')
    );
    this.logger.debug(
      `${this._logPrefix} Subscribed to ${AI_TURN_PROCESSING_STARTED}.`
    );

    this._subscribe(AI_TURN_PROCESSING_ENDED, () => this.#hideIndicator('ai'));
    this.logger.debug(
      `${this._logPrefix} Subscribed to ${AI_TURN_PROCESSING_ENDED}.`
    );

    // Player Composing Indicator (Optional Extension)
    if (this.#speechInputElement) {
      this._addDomListener(this.#speechInputElement, 'input', (event) => {
        const target = /** @type {HTMLInputElement} */ (event.target);
        if (target.value.trim() !== '') {
          this.#showIndicator('player_input');
        } else {
          this.#hideIndicator('player_input');
        }
      });
      this.logger.debug(
        `${this._logPrefix} Added 'input' listener to speech input element for player indicator.`
      );
    }

    this._subscribe(
      PLAYER_TURN_SUBMITTED_ID,
      () => this.#hideIndicator('player_input') // Hide player input indicator on submit
    );
    this.logger.debug(
      `${this._logPrefix} Subscribed to ${PLAYER_TURN_SUBMITTED_ID} for hiding player indicator.`
    );
  }

  /**
   * Shows the processing indicator.
   *
   * @param {IndicatorType} _type - The type of processing causing the indicator to show.
   * @private
   */
  #showIndicator(_type) {
    if (this.#indicatorElement) {
      // TODO: Potentially update aria-label based on type if needed for player indicator
      // if (type === 'player_input') {
      // this.#indicatorElement.setAttribute('aria-label', 'Player is typing...');
      // } else {
      // this.#indicatorElement.setAttribute('aria-label', 'Processing turn');
      // }
      // this.logger.debug(`${this._logPrefix} Showing processing indicator for type: ${type}.`);
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
    this.#domElementFactory = null; // Clear reference

    this.logger.debug(
      `${this._logPrefix} ProcessingIndicatorController disposed.`
    );
  }
}
