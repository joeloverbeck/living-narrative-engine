/**
 * @file This module handles displaying the success or failure of actions.
 * @see src/domUI/actionResultRenderer.js
 */

/**
 * @file Defines the {@link ActionResultRenderer} class – a renderer that outputs the
 * results of player and NPC actions to the main `#message-list` container.
 *
 * This implementation fulfils ticket 2.1.3 by:
 * • Injecting a {@link DomElementFactory} for safe, testable element creation.
 * • Rendering success / failure bubbles on the corresponding core events.
 * • Auto-scrolling the output list so the newest bubble is always visible.
 * @module ActionResultRenderer
 */

// ────────────────────────────────────────────────────────────────────────────────
// Type imports – removed at build time
// ────────────────────────────────────────────────────────────────────────────────
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
import DomElementFactory from './domElementFactory.js';

// ────────────────────────────────────────────────────────────────────────────────
// Runtime imports
// ────────────────────────────────────────────────────────────────────────────────
import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { DISPLAY_ERROR_ID } from '../constants/eventIds.js';

/**
 * @typedef {object} ActionResultPayload
 * @property {string} message - The narrative message to display for the action result.
 */

/**
 * Renders the outcome of game actions (narrative descriptions, combat summaries, etc.)
 * into the chat log.
 *
 * @class
 * @augments {BoundDomRendererBase}
 * @since 0.3.0
 * @fires core:display_successful_action_result
 * @fires core:display_failed_action_result
 * @example
 * const renderer = new ActionResultRenderer({
 * logger,
 * documentContext,
 * safeEventDispatcher,
 * domElementFactory: new DomElementFactory(documentContext),
 * });
 */
export class ActionResultRenderer extends BoundDomRendererBase {
  /**
   * @private
   * @type {DomElementFactory}
   */
  #domElementFactory;

  /**
   * Creates an {@link ActionResultRenderer} instance.
   *
   * @param {object} deps – Constructor dependencies.
   * @param {ILogger}               deps.logger
   * @param {IDocumentContext}      deps.documentContext
   * @param {ISafeEventDispatcher}  deps.safeEventDispatcher
   * @param {DomElementFactory}     deps.domElementFactory
   */
  constructor({
    logger,
    documentContext,
    safeEventDispatcher,
    domElementFactory,
  }) {
    if (!domElementFactory) {
      throw new Error(
        '[ActionResultRenderer] domElementFactory dependency must be provided.'
      );
    }

    const elementsConfig = {
      scrollContainer: { selector: '#outputDiv', required: true },
      listContainerElement: { selector: '#message-list', required: true },
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher: safeEventDispatcher,
      elementsConfig,
      scrollContainerKey: 'scrollContainer',
      contentContainerKey: 'listContainerElement',
    });

    /** @private */ this.#domElementFactory = domElementFactory;

    this.logger.debug(
      `${this._logPrefix} Instantiated. listContainerElement =`,
      this.elements.listContainerElement
    );

    this.#subscribeToEvents();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VED subscriptions
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Subscribes to the necessary core events for displaying action results.
   *
   * @private
   */
  #subscribeToEvents() {
    this._addSubscription(
      this.validatedEventDispatcher.subscribe(
        'core:display_successful_action_result',
        this.#handleSuccess.bind(this)
      )
    );

    this._addSubscription(
      this.validatedEventDispatcher.subscribe(
        'core:display_failed_action_result',
        this.#handleFailure.bind(this)
      )
    );

    this.logger.debug(
      `${this._logPrefix} Subscribed to action-result events (success & failure).`
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Handles the 'core:display_successful_action_result' event.
   *
   * @private
   * @param {object} event - The full event object from the EventBus.
   * @param {ActionResultPayload} event.payload - The payload of the event.
   */
  #handleSuccess({ payload: { message } }) {
    this.logger.debug(
      `${this._logPrefix} Rendering SUCCESS bubble. Message: "${message}"`
    );
    this.#renderBubble(message, 'action-success-bubble');
  }

  /**
   * Handles the 'core:display_failed_action_result' event.
   *
   * @private
   * @param {object} event - The full event object from the EventBus.
   * @param {ActionResultPayload} event.payload - The payload of the event.
   */
  #handleFailure({ payload: { message } }) {
    this.logger.debug(
      `${this._logPrefix} Rendering FAILURE bubble. Message: "${message}"`
    );
    this.#renderBubble(message, 'action-failure-bubble');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Rendering helpers
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Creates and appends a result bubble to the message list, then scrolls to bottom.
   *
   * @private
   * @param {string} message – Bubble contents.
   * @param {string} cssClass – Either 'action-success-bubble' or 'action-failure-bubble'.
   */
  #renderBubble(message, cssClass) {
    if (typeof message !== 'string' || !message.trim()) {
      this.logger.warn(
        `${this._logPrefix} Received invalid or empty message. Aborting bubble render.`,
        { message }
      );
      return;
    }
    const listEl = this.elements.listContainerElement;

    if (!listEl) {
      this.validatedEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: `${this._logPrefix} listContainerElement not found – cannot render bubble.`,
        details: { message, cssClass },
      });
      return;
    }

    const li = this.#domElementFactory.li(cssClass);
    if (!li) {
      this.validatedEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
        message: `${this._logPrefix} DomElementFactory.li() returned null – cannot render bubble.`,
        details: { message, cssClass },
      });
      return;
    }

    li.textContent = message;
    listEl.appendChild(li);
    this.scrollToBottom();
  }
}
