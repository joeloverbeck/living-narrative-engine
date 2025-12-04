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
/** @typedef {import('../anatomy/services/injuryNarrativeFormatterService.js').default} InjuryNarrativeFormatterService */

// ────────────────────────────────────────────────────────────────────────────────
// Runtime imports
// ────────────────────────────────────────────────────────────────────────────────
import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/eventIds.js';

/**
 * @typedef {object} DamageEventPayload
 * @property {string} entityName - Name of the entity receiving damage.
 * @property {string} entityPronoun - Pronoun for the entity.
 * @property {string} partType - Type of body part damaged.
 * @property {string} [orientation] - Orientation (left/right) if applicable.
 * @property {string} damageType - Type of damage (blunt, slashing, etc.).
 * @property {number} damageAmount - Amount of damage dealt.
 * @property {string} previousState - Previous state of the body part.
 * @property {string} newState - New state after damage.
 * @property {string[]} [effectsTriggered] - Effects triggered by damage.
 * @property {object[]} [propagatedDamage] - Damage propagated to child parts.
 */

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
 * Renders damage event messages to the main chat log with batching support.
 *
 * This renderer subscribes to anatomy damage events and displays formatted
 * messages using severity-based CSS styling. Multiple rapid events are
 * batched together using queueMicrotask for efficient rendering.
 *
 * @class
 * @augments {BoundDomRendererBase}
 * @since 0.4.0
 */
export class DamageEventMessageRenderer extends BoundDomRendererBase {
  /** @type {DamageEventPayload[]} */
  #pendingEvents = [];

  /** @type {boolean} */
  #batchScheduled = false;

  /** @type {InjuryNarrativeFormatterService} */
  #narrativeFormatter;

  /**
   * Creates a {@link DamageEventMessageRenderer} instance.
   *
   * @param {object} deps - Constructor dependencies.
   * @param {ILogger} deps.logger - Logger instance.
   * @param {IDocumentContext} deps.documentContext - Document context.
   * @param {ISafeEventDispatcher} deps.safeEventDispatcher - Event dispatcher.
   * @param {DomElementFactory} deps.domElementFactory - DOM element factory.
   * @param {InjuryNarrativeFormatterService} deps.narrativeFormatter - Formatter for damage narratives.
   */
  constructor({
    logger,
    documentContext,
    safeEventDispatcher,
    domElementFactory,
    narrativeFormatter,
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

    if (!narrativeFormatter || typeof narrativeFormatter.formatDamageEvent !== 'function') {
      throw new Error(
        'DamageEventMessageRenderer: narrativeFormatter dependency must have formatDamageEvent method.'
      );
    }
    this.#narrativeFormatter = narrativeFormatter;

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
   * @private
   */
  #subscribeToEvents() {
    this._subscribe(
      'anatomy:damage_applied',
      this.#handleDamageApplied.bind(this)
    );

    this._subscribe(
      'anatomy:internal_damage_propagated',
      this.#handleInternalDamagePropagated.bind(this)
    );

    this._subscribe(
      'anatomy:entity_dying',
      this.#handleEntityDying.bind(this)
    );

    this._subscribe(
      'anatomy:entity_died',
      this.#handleEntityDied.bind(this)
    );

    this._subscribe(
      'anatomy:dismembered',
      this.#handleDismembered.bind(this)
    );

    this.logger.debug(
      `${this._logPrefix} Subscribed to 5 anatomy damage events.`
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Event handlers
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Handles the 'anatomy:damage_applied' event.
   *
   * @private
   * @param {object} event - The event object.
   * @param {DamageEventPayload} event.payload - The damage event payload.
   */
  #handleDamageApplied({ payload }) {
    this.logger.debug(`${this._logPrefix} Received damage_applied event.`);
    this.#queueDamageEvent(payload, 'damage');
  }

  /**
   * Handles the 'anatomy:internal_damage_propagated' event.
   *
   * @private
   * @param {object} event - The event object.
   * @param {DamageEventPayload} event.payload - The damage event payload.
   */
  #handleInternalDamagePropagated({ payload }) {
    // NOTE: Do NOT queue this as a user-facing message.
    // The recursive ApplyDamageHandler.execute() call dispatches
    // anatomy:damage_applied for each child part with complete data.
    // This event is for internal tracking/telemetry only.
    this.logger.debug(
      `${this._logPrefix} Internal damage propagation: ${payload?.sourcePartId} -> ${payload?.targetPartId}`
    );
  }

  /**
   * Handles the 'anatomy:entity_dying' event.
   *
   * @private
   * @param {object} event - The event object.
   * @param {object} event.payload - The event payload.
   * @param {string} event.payload.entityId - The ID of the dying entity.
   * @param {string} event.payload.entityName - The name of the dying entity.
   */
  #handleEntityDying({ payload }) {
    this.logger.debug(`${this._logPrefix} Received entity_dying event.`);
    this.#queueDamageEvent(
      { ...payload, _eventType: 'dying' },
      'dying'
    );
  }

  /**
   * Handles the 'anatomy:dismembered' event.
   *
   * @private
   * @param {object} event - The event object.
   * @param {object} event.payload - The event payload.
   */
  #handleDismembered({ payload }) {
    this.logger.debug(`${this._logPrefix} Received dismembered event.`);
    // The dismembered event payload includes entityName, entityPronoun, partType, orientation
    // (passed from ApplyDamageHandler via DamageTypeEffectsService)
    this.#queueDamageEvent({
        ...payload,
        damageType: payload.damageTypeId, // Map to format expected by renderer
        effectsTriggered: ['dismembered'],
    }, 'damage');
  }

  /**
   * Handles the 'anatomy:entity_died' event.
   *
   * @private
   * @param {object} event - The event object.
   * @param {object} event.payload - The event payload.
   * @param {string} event.payload.entityId - The ID of the dead entity.
   * @param {string} event.payload.entityName - The name of the dead entity.
   */
  #handleEntityDied({ payload }) {
    this.logger.debug(`${this._logPrefix} Received entity_died event.`);
    this.#queueDamageEvent(
      { ...payload, _eventType: 'death' },
      'death'
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Batching logic
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Queues a damage event for batched rendering.
   *
   * @private
   * @param {object} eventData - The event payload data.
   * @param {string} eventType - The type of event ('damage', 'dying', 'death').
   */
  #queueDamageEvent(eventData, eventType) {
    if (!eventData) {
      this.logger.warn(
        `${this._logPrefix} Received null/undefined event data. Ignoring.`
      );
      return;
    }

    this.#pendingEvents.push({ ...eventData, _eventType: eventType });

    if (!this.#batchScheduled) {
      this.#batchScheduled = true;
      queueMicrotask(() => {
        this.logger.debug(`${this._logPrefix} Microtask callback executing flushBatch.`);
        this.#flushBatch();
      });
    }
  }

  /**
   * Flushes the pending event batch and renders messages.
   *
   * @private
   */
  #flushBatch() {
    const events = this.#pendingEvents;
    this.#pendingEvents = [];
    this.#batchScheduled = false;

    if (events.length === 0) {
      return;
    }

        this.logger.debug(
          `${this._logPrefix} Flushing batch of ${events.length} damage event(s). Raw events:`, events
        );
    
        // Merging logic: Combine secondary events (like dismemberment) into primary damage events
        const mergedEvents = [];
        for (const event of events) {
          // Only attempt merge for 'damage' type events
          if (event._eventType === 'damage') {
            // Find existing event for same entity/part/damageType that is also a damage event
            // We assume primary event (with amount) comes first
            const existing = mergedEvents.find(e =>
              e.entityId === event.entityId &&
              e.partId === event.partId &&
              // If damageType matches (e.g. slashing), we can merge effects
              e.damageType === event.damageType &&
              e._eventType === 'damage'
            );
    
            if (existing) {
              this.logger.debug(`${this._logPrefix} Merging event into existing:`, event);
              // Merge effectsTriggered
              if (event.effectsTriggered && event.effectsTriggered.length > 0) {
                existing.effectsTriggered = [
                  ...(existing.effectsTriggered || []),
                  ...event.effectsTriggered
                ];
              }
              continue;
            }
          }
          this.logger.debug(`${this._logPrefix} Pushing new event to merged:`, event);
          mergedEvents.push(event);
        }
        this.logger.debug(`${this._logPrefix} Final merged events:`, mergedEvents);

    // Render each merged event
    for (const event of mergedEvents) {
      this.#renderDamageMessage(event);
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Rendering
  // ────────────────────────────────────────────────────────────────────────────
  /**
   * Renders a single damage event message.
   *
   * @private
   * @param {object} eventData - The event data with _eventType attached.
   */
  #renderDamageMessage(eventData) {
    const eventType = eventData._eventType || 'damage';
    let message;
    let cssClass;

    if (eventType === 'dying') {
      message = `${eventData.entityName || 'An entity'} is dying!`;
      cssClass = 'damage-message damage-message--dying';
    } else if (eventType === 'death') {
      message = `${eventData.entityName || 'An entity'} has died.`;
      cssClass = 'damage-message damage-message--death';
    } else {
      // Format using the narrative formatter
      message = this.#narrativeFormatter.formatDamageEvent(eventData);
      cssClass = this.#getSeverityCssClass(eventData.damageAmount);
    }

    if (!message || !message.trim()) {
      this.logger.warn(
        `${this._logPrefix} Empty message generated for damage event. Skipping render.`,
        { eventData }
      );
      return;
    }

    this.#renderBubble(message, cssClass);
  }

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
