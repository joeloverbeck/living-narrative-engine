/**
 * @file Renders expression narrative messages to the chat message list.
 * @module ExpressionMessageRenderer
 */

// ────────────────────────────────────────────────────────────────────────────────
// Type imports – removed at build time
// ────────────────────────────────────────────────────────────────────────────────
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('./domElementFactory.js').default} DomElementFactory */

// ────────────────────────────────────────────────────────────────────────────────
// Runtime imports
// ────────────────────────────────────────────────────────────────────────────────
import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

const EXPRESSION_TAG_MODIFIERS = Object.freeze({
  // Anger family
  anger: 'expression-message--anger',
  rage: 'expression-message--anger',
  fury: 'expression-message--anger',
  // Affection family
  affection: 'expression-message--affection',
  love: 'expression-message--affection',
  warmth: 'expression-message--affection',
  // Loss family
  grief: 'expression-message--loss',
  despair: 'expression-message--loss',
  sorrow: 'expression-message--loss',
  // Threat family
  fear: 'expression-message--threat',
  panic: 'expression-message--threat',
  horror: 'expression-message--threat',
  // Agency family
  confidence: 'expression-message--agency',
  determination: 'expression-message--agency',
  // Attention family
  curious: 'expression-message--attention',
  fascinated: 'expression-message--attention',
});

/**
 * Renders expression narrative messages to the main chat log.
 *
 * This renderer subscribes to `core:perceptible_event` events and filters for
 * emotion-related perception types, rendering the narrative to the chat panel.
 *
 * @class
 * @augments {BoundDomRendererBase}
 * @since 0.4.0
 */
export class ExpressionMessageRenderer extends BoundDomRendererBase {
  /**
   * Creates a {@link ExpressionMessageRenderer} instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {IDocumentContext} deps.documentContext - Document context.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher.
   * @param {DomElementFactory} deps.domElementFactory - DOM element factory.
   */
  constructor({
    logger,
    documentContext,
    safeEventDispatcher,
    domElementFactory,
  }) {
    const elementsConfig = {
      scrollContainer: { selector: '#outputDiv', required: true },
      listContainerElement: { selector: '#message-list', required: true },
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher: safeEventDispatcher,
      elementsConfig,
      domElementFactory,
      scrollContainerKey: 'scrollContainer',
      contentContainerKey: 'listContainerElement',
    });

    this.logger.debug(
      `${this._logPrefix} Instantiated. listContainerElement =`,
      this.elements.listContainerElement
    );

    this.#subscribeToEvents();
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Event subscriptions
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Subscribes to expression-related perceptible events.
   *
   * @private
   */
  #subscribeToEvents() {
    this._subscribe(
      'core:perceptible_event',
      this.#handlePerceptibleEvent.bind(this)
    );

    this.logger.debug(
      `${this._logPrefix} Subscribed to core:perceptible_event (emotion.*).`
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Handles the 'core:perceptible_event' event.
   * Filters for emotion.* perception types and renders the narrative.
   *
   * @private
   * @param {object} event - The event object.
   * @param {object} event.payload - The perceptible event payload.
   * @param {string} event.payload.perceptionType - Type of perception.
   * @param {string} event.payload.descriptionText - The narrative text.
   */
  #handlePerceptibleEvent({ payload }) {
    const perceptionType = payload?.perceptionType;
    if (!this.#isExpressionPerceptionType(perceptionType)) {
      return;
    }

    this.logger.debug(
      `${this._logPrefix} Received perceptible_event (${perceptionType}).`
    );

    const message = payload?.descriptionText;
    if (!message || !message.trim()) {
      this.logger.warn(
        `${this._logPrefix} Empty descriptionText in emotion event. Skipping.`
      );
      return;
    }

    const cssClass = this.#buildCssClasses(payload);
    this.#renderMessage(message, cssClass);
  }

  /**
   * Checks whether the perception type should be rendered as an expression message.
   *
   * @private
   * @param {string} perceptionType - The perception type string.
   * @returns {boolean} True if expression-related.
   */
  #isExpressionPerceptionType(perceptionType) {
    if (!perceptionType) return false;
    return (
      perceptionType === 'emotion.expression' ||
      perceptionType.startsWith('emotion.')
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Builds the CSS class string based on expression tags.
   *
   * @private
   * @param {object} payload - The event payload.
   * @returns {string} The CSS class string.
   */
  #buildCssClasses(payload) {
    const classes = ['expression-message'];
    const tags = payload?.contextualData?.tags || [];

    for (const tag of tags) {
      if (typeof tag !== 'string') continue;
      const modifier = EXPRESSION_TAG_MODIFIERS[tag.toLowerCase()];
      if (modifier && !classes.includes(modifier)) {
        classes.push(modifier);
      }
    }

    if (classes.length === 1) {
      classes.push('expression-message--default');
    }

    return classes.join(' ');
  }

  /**
   * Creates and appends a message element to the message list.
   *
   * @private
   * @param {string} message - The message text.
   * @param {string} cssClass - The CSS class(es) to apply.
   */
  #renderMessage(message, cssClass) {
    const listEl = this.elements.listContainerElement;

    if (!listEl) {
      this.validatedEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `${this._logPrefix} listContainerElement not found – cannot render expression message.`,
        details: { message, cssClass },
      });
      return;
    }

    const li = this.domElementFactory?.li();
    if (!li) {
      this.validatedEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `${this._logPrefix} DomElementFactory.li() returned null – cannot render expression message.`,
        details: { message, cssClass },
      });
      return;
    }

    const classes = cssClass.split(' ').filter(Boolean);
    for (const cls of classes) {
      li.classList.add(cls);
    }

    li.textContent = message;
    listEl.appendChild(li);
    this.scrollToBottom();
  }
}
