// src/dom-ui/titleRenderer.js
import { RendererBase } from './rendererBase.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import {
  SYSTEM_ERROR_OCCURRED_ID,
  INITIALIZATION_SERVICE_FAILED_ID,
} from '../constants/eventIds.js';

/**
 * @typedef {import('../interfaces/ILogger').ILogger} ILogger
 * @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext
 * @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 */

/**
 * Manages the content of the main H1 title element by subscribing
 * to relevant application events via the ValidatedEventDispatcher.
 *
 * @augments RendererBase
 */
export class TitleRenderer extends RendererBase {
  /**
   * The H1 element whose text content will be managed.
   *
   * @private
   * @type {HTMLHeadingElement}
   */
  #titleElement;

  /**
   * Creates an instance of TitleRenderer.
   *
   * @param {object} deps - Dependencies object.
   * @param {ILogger} deps.logger - The logger instance.
   * @param {IDocumentContext} deps.documentContext - The document context.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - The event dispatcher.
   * @param {HTMLElement | null} deps.titleElement - The root H1 element to manage. Must be an H1.
   * @throws {Error} If dependencies are invalid or titleElement is not a valid H1.
   */
  constructor({ logger, documentContext, safeEventDispatcher, titleElement }) {
    // Pass base dependencies to RendererBase constructor
    super({
      logger,
      documentContext,
      validatedEventDispatcher: safeEventDispatcher,
    });

    // --- Validate specific titleElement dependency ---
    if (!titleElement || titleElement.nodeType !== 1) {
      const errMsg = `${this._logPrefix} 'titleElement' dependency is missing or not a valid DOM element.`;
      safeDispatchError(this.validatedEventDispatcher, errMsg);
      throw new Error(errMsg);
    }
    if (titleElement.tagName !== 'H1') {
      const errMsg = `${this._logPrefix} 'titleElement' must be an H1 element, but received '${titleElement.tagName}'.`;
      safeDispatchError(this.validatedEventDispatcher, errMsg, {
        element: titleElement,
      });
      throw new Error(errMsg);
    }

    this.#titleElement = /** @type {HTMLHeadingElement} */ (titleElement);
    this.logger.debug(`${this._logPrefix} Attached to H1 element.`);

    // Subscribe to events that affect the title
    this.#subscribeToEvents();
  }

  /**
   * Subscribes to VED events relevant for updating the title.
   *
   * @private
   */
  #subscribeToEvents() {
    // Direct title setting
    this._subscribe('core:set_title', this.#handleSetTitle.bind(this));

    // Initialization Events
    this._subscribe(
      'initialization:initialization_service:completed',
      this.#handleInitializationCompleted.bind(this)
    );
    this._subscribe(
      INITIALIZATION_SERVICE_FAILED_ID,
      this.#handleInitializationFailed.bind(this)
    );

    // Initialization Steps Started
    this._subscribe(
      'initialization:world_loader:started',
      this.#handleInitializationStepStarted.bind(this)
    );
    this._subscribe(
      'initialization:system_initializer:started',
      this.#handleInitializationStepStarted.bind(this)
    );
    this._subscribe(
      'initialization:game_state_initializer:started',
      this.#handleInitializationStepStarted.bind(this)
    );
    this._subscribe(
      'initialization:world_initializer:started',
      this.#handleInitializationStepStarted.bind(this)
    );
    this._subscribe(
      'initialization:input_setup_service:started',
      this.#handleInitializationStepStarted.bind(this)
    );

    // Initialization Steps Failed
    this._subscribe(
      'initialization:world_loader:failed',
      this.#handleInitializationStepFailed.bind(this)
    );
    this._subscribe(
      'initialization:system_initializer:failed',
      this.#handleInitializationStepFailed.bind(this)
    );
    this._subscribe(
      'initialization:game_state_initializer:failed',
      this.#handleInitializationStepFailed.bind(this)
    );
    this._subscribe(
      'initialization:world_initializer:failed',
      this.#handleInitializationStepFailed.bind(this)
    );
    this._subscribe(
      'initialization:input_setup_service:failed',
      this.#handleInitializationStepFailed.bind(this)
    );

    // System Fatal Error (Could also trigger title change)
    this._subscribe(
      SYSTEM_ERROR_OCCURRED_ID,
      this.#handleFatalError.bind(this)
    );

    this.logger.debug(
      `${this._logPrefix} Subscribed to VED events for title updates.`
    );
  }

  // --- Private Event Handlers (Adapted from DomRenderer) ---

  /**
   * Handles setting the main title directly via 'core:set_title'.
   *
   * @private
   * @param {object} payload - Expected payload for 'core:set_title' (e.g., { text: string }).
   * @param {string} eventType - The name of the triggered event.
   */
  #handleSetTitle(payload, eventType) {
    if (payload && typeof payload.text === 'string') {
      this.set(payload.text);
    } else {
      this.logger.warn(
        `${this._logPrefix} Received '${eventType}' with invalid payload structure or missing 'text' property:`,
        payload
      );
    }
  }

  /**
   * Handles various 'initialization:<step>:started' events.
   *
   * @private
   * @param {object} payload - Expected payload (e.g., { worldName?: string, tag?: string }).
   * @param {string} eventType - The name of the triggered event.
   */
  #handleInitializationStepStarted(payload, eventType) {
    let statusMessage = 'Initializing...';

    switch (eventType) {
      case 'initialization:world_loader:started':
        statusMessage = `Loading world data${payload?.worldName ? ` for '${payload.worldName}'` : ''}...`;
        break;
      case 'initialization:system_initializer:started':
        statusMessage = `Initializing core systems${payload?.tag ? ` (tag: ${payload.tag})` : ''}...`;
        break;
      case 'initialization:game_state_initializer:started':
        statusMessage = 'Setting up initial game state...';
        break;
      case 'initialization:world_initializer:started':
        statusMessage = 'Creating world entities...';
        break;
      case 'initialization:input_setup_service:started':
        statusMessage = 'Configuring input handler...';
        break;
      default:
        if (eventType) {
          const parts = eventType.split(':');
          if (parts.length >= 3) {
            // Generic fallback message based on event name
            statusMessage = `Initializing ${parts[1].replace(/_/g, ' ')}...`;
          }
        }
    }
    this.set(statusMessage);
  }

  /**
   * Handles 'initialization:initialization_service:completed'.
   *
   * @private
   */
  #handleInitializationCompleted() {
    this.set('Game Ready');
  }

  /**
   * Handles 'initialization:initialization_service:failed'.
   *
   * @private
   * @param {object} eventEnvelope - Event envelope with shape { type, payload }.
   * @param {string} eventType - The name of the triggered event.
   */
  #handleInitializationFailed(eventEnvelope, eventType) {
    // Expect eventEnvelope to be { type, payload }
    const payload = eventEnvelope?.payload;
    this.logger.debug(
      `${this._logPrefix} Received initialization failed event with envelope:`,
      eventEnvelope
    );
    this.logger.debug(`${this._logPrefix} Extracted payload:`, payload);
    this.logger.debug(`${this._logPrefix} Event type:`, eventType);
    this.logger.debug(`${this._logPrefix} Payload.error:`, payload?.error);

    const title = `Initialization Failed${payload?.worldName ? ` (World: ${payload.worldName})` : ''}`;
    this.set(title);
    // Dispatch error event for UI display
    const errorMessage = payload?.error || 'Unknown error occurred';
    this.logger.debug(`${this._logPrefix} Using error message:`, errorMessage);
    safeDispatchError(
      this.validatedEventDispatcher,
      `${this._logPrefix} Overall initialization failed. Error: ${errorMessage}`,
      payload
    );
  }

  /**
   * Handles various 'initialization:<step>:failed' events.
   *
   * @private
   * @param {object} payload - Expected payload (e.g., { error?: string, stack?: string }).
   * @param {string} eventType - The name of the triggered event.
   */
  #handleInitializationStepFailed(payload, eventType) {
    let stepName = 'Initialization step';
    if (eventType) {
      const parts = eventType.split(':');
      if (parts.length >= 3) {
        stepName = `${parts[1].replace(/_/g, ' ')}`;
      }
    }
    const title = `${stepName} Failed`;
    this.set(title);
    const errorMessage = payload?.error || 'Unknown error occurred';
    safeDispatchError(
      this.validatedEventDispatcher,
      `${this._logPrefix} ${title}. Error: ${errorMessage}`,
      payload
    );
  }

  /**
   * Handles SYSTEM_ERROR_OCCURRED_ID (example).
   * Sets a generic error title.
   *
   * @private
   * @param {object} _payload - Expected payload (e.g., { message: string, error?: Error }).
   */
  #handleFatalError(_payload) {
    this.set('System Error');
  }

  // --- Public API ---

  /**
   * Sets the text content of the managed H1 element.
   * This can be called directly or triggered by subscribed events.
   *
   * @param {string} text - The text to display in the title.
   */
  set(text) {
    if (typeof text !== 'string') {
      this.logger.warn(
        `${this._logPrefix} Received non-string value in set():`,
        text
      );
      text = String(text); // Coerce to string
    }

    if (this.#titleElement) {
      // Only update if text actually changes to avoid unnecessary DOM manipulation
      if (this.#titleElement.textContent !== text) {
        this.#titleElement.textContent = text;
        this.logger.debug(`${this._logPrefix} Title set to: "${text}"`);
      } else {
        this.logger.debug(
          `${this._logPrefix} Title already set to: "${text}", skipping update.`
        );
      }
    } else {
      // Should not happen if constructor validation passed
      safeDispatchError(
        this.validatedEventDispatcher,
        `${this._logPrefix} Cannot set title, internal #titleElement reference is lost.`
      );
    }
  }

  /**
   * Dispose method for cleanup. Unsubscribes from all VED events
   * by calling super.dispose().
   */
  dispose() {
    // The #subscriptions array and its manual clearing are removed.
    // All VED unsubscriptions are handled by super.dispose().
    super.dispose(); // This will call the logger.debug messages from RendererBase
  }
}
