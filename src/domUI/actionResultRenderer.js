// src/domUI/actionResultRenderer.js

/**
 * @file Defines the {@link ActionResultRenderer} class – a minimal renderer responsible for
 * outputting the results of player and NPC actions to the main `#message-list` container.
 *
 * This class intentionally contains only boiler‑plate wiring for now.  Follow‑up tickets will add
 * concrete rendering logic once the exact action‑result payload format is finalised.
 *
 * @module ActionResultRenderer
 */

// ────────────────────────────────────────────────────────────────────────────────
// Type imports
// ────────────────────────────────────────────────────────────────────────────────
/** @typedef {import('../interfaces/coreServices.js').ILogger}          ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @typedef {object} ActionResultPayload
 * @property {string} message - The narrative message to display for the action result.
 */

// Base class
import { BoundDomRendererBase } from './boundDomRendererBase.js';

// ────────────────────────────────────────────────────────────────────────────────
// Class
// ────────────────────────────────────────────────────────────────────────────────
/**
 * Renders the outcome of game actions (narrative descriptions, combat summaries, etc.) into the
 * chat log.  It **must** bind the `#message-list` element so higher‑level services can call
 * `render()` (to be implemented later) without worrying about DOM selectors.
 *
 * It listens for `core:display_successful_action_result` and `core:display_failed_action_result`
 * events to know when to render new content.
 *
 * @class
 * @extends {BoundDomRendererBase}
 *
 * @example
 * const renderer = new ActionResultRenderer({
 * logger: myLogger,
 * documentContext: new DocumentContext(),
 * safeEventDispatcher: mySafeDispatcher,
 * });
 * // The renderer will now automatically handle action result events.
 */
export class ActionResultRenderer extends BoundDomRendererBase {
  /**
   * Creates an {@link ActionResultRenderer} instance.
   *
   * @param {object} deps – Constructor dependencies.
   * @param {ILogger}               deps.logger             – Logger implementation.
   * @param {IDocumentContext}      deps.documentContext    – Wrapper around the DOM/document.
   * @param {ISafeEventDispatcher}  deps.safeEventDispatcher – Event dispatcher allowing safe,
   * non‑throwing emits & subs.
   */
  constructor({ logger, documentContext, safeEventDispatcher }) {
    const elementsConfig = {
      /**
       * Reference to the list container.  Marked as `required` so the base class will log an error
       * if the selector does not resolve – which is exactly what we want during development.
       */
      listContainerElement: { selector: '#message-list', required: true },
    };

    // Call the superclass, mapping the project’s preferred “validatedEventDispatcher” param name
    // to the provided SafeEventDispatcher.
    super({
      logger,
      documentContext,
      validatedEventDispatcher: safeEventDispatcher,
      elementsConfig,
    });

    this.logger.debug(
      `${this._logPrefix} Instantiated. listContainerElement =`,
      this.elements.listContainerElement
    );

    this.#subscribeToEvents();
  }

  /**
   * Subscribes to the necessary core events for displaying action results.
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
      `${this._logPrefix} Subscribed to 'core:display_successful_action_result' and 'core:display_failed_action_result'.`
    );
  }

  /**
   * Handles the 'core:display_successful_action_result' event.
   * @private
   * @param {ActionResultPayload} payload - The event payload.
   */
  #handleSuccess(payload) {
    const { message } = payload;
    this.logger.debug(
      `${this._logPrefix} Received 'core:display_successful_action_result'. Message: "${message}"`
    );
    // DOM rendering logic will be added in a future ticket.
  }

  /**
   * Handles the 'core:display_failed_action_result' event.
   * @private
   * @param {ActionResultPayload} payload - The event payload.
   */
  #handleFailure(payload) {
    const { message } = payload;
    this.logger.debug(
      `${this._logPrefix} Received 'core:display_failed_action_result'. Message: "${message}"`
    );
    // DOM rendering logic will be added in a future ticket.
  }
}
