/**
 * @file Renders damage events to the chat message list.
 * @module DamageEventMessageRenderer
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

/**
 * Damage severity thresholds for CSS class assignment.
 * @type {Readonly<{MINOR: number, MODERATE: number, SEVERE: number}>}
 */
const SEVERITY_THRESHOLDS = Object.freeze({
  MINOR: 10,
  MODERATE: 25,
  SEVERE: 50,
});

/**
 * Renders damage event messages to the main chat log.
 *
 * This renderer subscribes to composed `core:perceptible_event` events with
 * `perceptionType: 'damage_received'` for unified damage narratives that include
 * primary damage, effects, and propagation in a single message.
 *
 * Also handles entity state events (dying/death) which are dispatched separately.
 *
 * @class
 * @augments {BoundDomRendererBase}
 * @since 0.4.0
 */
export class DamageEventMessageRenderer extends BoundDomRendererBase {
  /**
   * Creates a {@link DamageEventMessageRenderer} instance.
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
   * Subscribes to damage-related anatomy events.
   *
   * Subscribes to the composed `core:perceptible_event` with `perceptionType: 'damage_received'`
   * for unified damage narratives (primary damage + effects + propagation in one message),
   * plus entity state events (dying/death) which are dispatched separately.
   *
   * @private
   */
  #subscribeToEvents() {
    // Subscribe to composed damage events dispatched from ApplyDamageHandler
    this._subscribe(
      'core:perceptible_event',
      this.#handlePerceptibleEvent.bind(this)
    );

    this._subscribe('anatomy:entity_dying', this.#handleEntityDying.bind(this));

    this._subscribe('anatomy:entity_died', this.#handleEntityDied.bind(this));

    this.logger.debug(
      `${this._logPrefix} Subscribed to core:perceptible_event (damage_received) and 2 entity state events.`
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Handles the 'core:perceptible_event' event.
   * Filters for damage_received perception type and renders the composed narrative.
   *
   * @private
   * @param {object} event - The event object.
   * @param {object} event.payload - The perceptible event payload.
   * @param {string} event.payload.perceptionType - Type of perception (e.g., 'damage_received').
   * @param {string} event.payload.descriptionText - The composed narrative text.
   * @param {number} [event.payload.totalDamage] - Total damage for severity styling.
   */
  #handlePerceptibleEvent({ payload }) {
    // Only handle damage-related perceptible events
    if (payload?.perceptionType !== 'damage_received') {
      return;
    }

    this.logger.debug(
      `${this._logPrefix} Received perceptible_event (damage_received).`
    );

    const message = payload.descriptionText;
    if (!message || !message.trim()) {
      this.logger.warn(
        `${this._logPrefix} Empty descriptionText in damage_received event. Skipping.`
      );
      return;
    }

    // Use totalDamage for severity styling if available
    const cssClass = this.#getSeverityCssClass(payload.totalDamage || 0);
    this.#renderBubble(message, cssClass);
  }

  /**
   * Handles the 'anatomy:entity_dying' event.
   * Renders directly since this is a standalone event.
   *
   * @private
   * @param {object} event - The event object.
   * @param {object} event.payload - The event payload.
   * @param {string} event.payload.entityId - The ID of the dying entity.
   * @param {string} event.payload.entityName - The name of the dying entity.
   */
  #handleEntityDying({ payload }) {
    this.logger.debug(`${this._logPrefix} Received entity_dying event.`);
    const message = `${payload?.entityName || 'An entity'} is dying!`;
    this.#renderBubble(message, 'damage-message damage-message--dying');
  }

  /**
   * Handles the 'anatomy:entity_died' event.
   * Renders directly since this is a standalone event.
   *
   * @private
   * @param {object} event - The event object.
   * @param {object} event.payload - The event payload.
   * @param {string} event.payload.entityId - The ID of the dead entity.
   * @param {string} event.payload.entityName - The name of the dead entity.
   * @param {string} [event.payload.finalMessage] - Optional custom death message.
   */
  #handleEntityDied({ payload }) {
    this.logger.debug(`${this._logPrefix} Received entity_died event.`);
    const message =
      payload?.finalMessage ||
      `${payload?.entityName || 'An entity'} falls dead from their injuries.`;
    this.#renderBubble(message, 'damage-message damage-message--death');
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Determines the CSS class based on damage severity.
   *
   * @private
   * @param {number} [damageAmount=0] - The amount of damage.
   * @returns {string} The CSS class string.
   */
  #getSeverityCssClass(damageAmount = 0) {
    const baseClass = 'damage-message';
    let severityModifier;

    if (damageAmount > SEVERITY_THRESHOLDS.SEVERE) {
      severityModifier = 'critical';
    } else if (damageAmount > SEVERITY_THRESHOLDS.MODERATE) {
      severityModifier = 'severe';
    } else if (damageAmount >= SEVERITY_THRESHOLDS.MINOR) {
      severityModifier = 'moderate';
    } else {
      severityModifier = 'minor';
    }

    return `${baseClass} ${baseClass}--${severityModifier}`;
  }

  /**
   * Creates and appends a message element to the message list.
   *
   * @private
   * @param {string} message - The message text.
   * @param {string} cssClass - The CSS class(es) to apply.
   */
  #renderBubble(message, cssClass) {
    const listEl = this.elements.listContainerElement;

    if (!listEl) {
      this.validatedEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `${this._logPrefix} listContainerElement not found – cannot render damage message.`,
        details: { message, cssClass },
      });
      return;
    }

    const li = this.domElementFactory?.li();
    if (!li) {
      this.validatedEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: `${this._logPrefix} DomElementFactory.li() returned null – cannot render damage message.`,
        details: { message, cssClass },
      });
      return;
    }

    // Apply CSS classes
    const classes = cssClass.split(' ').filter(Boolean);
    for (const cls of classes) {
      li.classList.add(cls);
    }

    li.textContent = message;
    listEl.appendChild(li);
    this.scrollToBottom();
  }
}
