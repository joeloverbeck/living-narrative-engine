// src/domUI/injuryStatusPanel.js

/**
 * @file Widget displaying character's current physical condition.
 *
 * Subscribes to TURN_STARTED_ID to refresh the current actor's injury status.
 * Uses InjuryAggregationService to collect injury data and
 * InjuryNarrativeFormatterService to format it as first-person narrative.
 *
 * @see specs/injury-reporting-and-user-interface.md section 7.1
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../anatomy/services/injuryAggregationService.js').default} InjuryAggregationService */
/** @typedef {import('../anatomy/services/injuryNarrativeFormatterService.js').default} InjuryNarrativeFormatterService */
/** @typedef {import('../anatomy/dtos/InjurySummaryDTO.js').InjurySummaryDTO} InjurySummaryDTO */

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { TURN_STARTED_ID } from '../constants/eventIds.js';

/**
 * Widget displaying character's current physical condition.
 *
 * Displays:
 * - First-person narrative of current injuries
 * - Handles healthy, injured, dying, and dead states
 *
 * @extends BoundDomRendererBase
 */
export class InjuryStatusPanel extends BoundDomRendererBase {
  /** @type {InjuryAggregationService} */
  #injuryAggregationService;

  /** @type {InjuryNarrativeFormatterService} */
  #injuryNarrativeFormatterService;

  /**
   * Creates an InjuryStatusPanel instance.
   *
   * @param {object} dependencies - Runtime dependencies for this widget.
   * @param {ILogger} dependencies.logger - Logging utility for diagnostics.
   * @param {IDocumentContext} dependencies.documentContext - Abstraction over the DOM.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - Dispatcher for validated events.
   * @param {InjuryAggregationService} dependencies.injuryAggregationService - Service for collecting injury data.
   * @param {InjuryNarrativeFormatterService} dependencies.injuryNarrativeFormatterService - Service for formatting injury narratives.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    injuryAggregationService,
    injuryNarrativeFormatterService,
  }) {
    const elementsConfig = {
      narrativeElement: {
        selector: '#injury-narrative',
        required: true,
      },
      contentElement: {
        selector: '#injury-status-content',
        required: true,
      },
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    });

    // Validate dependencies
    if (!injuryAggregationService) {
      this.logger.error(
        `${this._logPrefix} InjuryAggregationService dependency is missing.`
      );
      throw new Error(
        `${this._logPrefix} InjuryAggregationService dependency is missing.`
      );
    }
    if (
      !injuryAggregationService.aggregateInjuries ||
      typeof injuryAggregationService.aggregateInjuries !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} InjuryAggregationService must have aggregateInjuries method.`
      );
      throw new Error(
        `${this._logPrefix} InjuryAggregationService must have aggregateInjuries method.`
      );
    }

    if (!injuryNarrativeFormatterService) {
      this.logger.error(
        `${this._logPrefix} InjuryNarrativeFormatterService dependency is missing.`
      );
      throw new Error(
        `${this._logPrefix} InjuryNarrativeFormatterService dependency is missing.`
      );
    }
    if (
      !injuryNarrativeFormatterService.formatFirstPerson ||
      typeof injuryNarrativeFormatterService.formatFirstPerson !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} InjuryNarrativeFormatterService must have formatFirstPerson method.`
      );
      throw new Error(
        `${this._logPrefix} InjuryNarrativeFormatterService must have formatFirstPerson method.`
      );
    }

    this.#injuryAggregationService = injuryAggregationService;
    this.#injuryNarrativeFormatterService = injuryNarrativeFormatterService;

    this.logger.debug(`${this._logPrefix} Initializing...`);

    // Check if elements were bound correctly
    if (!this.elements.narrativeElement || !this.elements.contentElement) {
      this.logger.error(
        `${this._logPrefix} One or more required DOM elements not bound. Panel will not function correctly.`
      );
    }

    // Initialize to default state
    this.#renderHealthyState();

    try {
      // Subscribe to turn started events to refresh status
      this._subscribe(TURN_STARTED_ID, this.#handleTurnStarted.bind(this));
      this.logger.debug(
        `${this._logPrefix} Initialized and subscribed to ${TURN_STARTED_ID}.`
      );
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Failed to subscribe to ${TURN_STARTED_ID}.`,
        error
      );
    }
  }

  /**
   * Handles the TURN_STARTED event to refresh the current actor's injury status.
   *
   * @param {object} eventWrapper - The event wrapper containing payload.
   * @param {object} eventWrapper.payload - The event payload.
   * @param {string} eventWrapper.payload.entityId - The entity whose turn started.
   * @private
   */
  #handleTurnStarted(eventWrapper) {
    const actualPayload = eventWrapper.payload;

    if (
      !actualPayload ||
      typeof actualPayload.entityId !== 'string' ||
      !actualPayload.entityId
    ) {
      this.logger.warn(
        `${this._logPrefix} Received ${TURN_STARTED_ID} event. Expected entityId string in .payload.entityId was missing or invalid. Rendering healthy state.`,
        { receivedData: eventWrapper }
      );
      this.#renderHealthyState();
      return;
    }

    const entityId = actualPayload.entityId;
    this.logger.debug(
      `${this._logPrefix} Handling ${TURN_STARTED_ID} for entityId: ${entityId}`
    );

    this.updateForActor(entityId);
  }

  /**
   * Updates the panel to display the injury status for the given actor.
   *
   * @param {string} entityId - The entity ID to display status for.
   */
  updateForActor(entityId) {
    if (!entityId || typeof entityId !== 'string') {
      this.logger.warn(
        `${this._logPrefix} updateForActor called with invalid entityId.`,
        { entityId }
      );
      this.#renderHealthyState();
      return;
    }

    try {
      // Aggregate injuries for the entity
      const summary = this.#injuryAggregationService.aggregateInjuries(entityId);

      // Render based on the summary
      this.#renderSummary(summary);
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Error aggregating injuries for entity ${entityId}:`,
        error
      );
      this.#renderHealthyState();
    }
  }

  /**
   * Renders the injury summary to the panel.
   *
   * @param {InjurySummaryDTO} summary - The injury summary to render.
   * @private
   */
  #renderSummary(summary) {
    if (!this.elements.narrativeElement) {
      this.logger.warn(
        `${this._logPrefix} Cannot render: narrative element not available.`
      );
      return;
    }

    // Check for dead state first
    if (summary.isDead) {
      this.#renderDeadState(summary);
      return;
    }

    // Check for dying state
    if (summary.isDying) {
      this.#renderDyingState(summary);
      return;
    }

    // Check if entity is healthy (no injuries)
    const hasInjuries =
      summary.injuredParts.length > 0 ||
      summary.bleedingParts.length > 0 ||
      summary.burningParts.length > 0 ||
      summary.poisonedParts.length > 0 ||
      summary.fracturedParts.length > 0;

    if (!hasInjuries) {
      this.#renderHealthyState();
      return;
    }

    // Format and render the injury narrative
    const narrative =
      this.#injuryNarrativeFormatterService.formatFirstPerson(summary);
    this.#renderNarrative(narrative, this.#getSeverityClass(summary));
  }

  /**
   * Renders a narrative with the given severity class.
   *
   * @param {string} narrative - The narrative text to display.
   * @param {string} severityClass - The CSS class for severity styling.
   * @private
   */
  #renderNarrative(narrative, severityClass) {
    if (!this.elements.narrativeElement) {
      return;
    }

    // Clear existing classes
    this.elements.narrativeElement.className = '';

    // Add severity class if provided
    if (severityClass) {
      this.elements.narrativeElement.classList.add(severityClass);
    }

    this.elements.narrativeElement.textContent = narrative;
  }

  /**
   * Renders the healthy state (no injuries).
   *
   * @private
   */
  #renderHealthyState() {
    if (!this.elements.narrativeElement) {
      return;
    }

    this.elements.narrativeElement.className = 'injury-healthy-message';
    this.elements.narrativeElement.textContent = 'I feel fine.';
  }

  /**
   * Renders the dying state with countdown.
   *
   * @param {InjurySummaryDTO} summary - The injury summary.
   * @private
   */
  #renderDyingState(summary) {
    if (!this.elements.narrativeElement) {
      return;
    }

    // First, render the injury narrative
    const narrative =
      this.#injuryNarrativeFormatterService.formatFirstPerson(summary);

    // Build the dying message
    const turnsText =
      summary.dyingTurnsRemaining === 1
        ? '1 turn'
        : `${summary.dyingTurnsRemaining} turns`;
    const dyingMessage = `I'm dying! ${turnsText} remaining.`;

    // Combine narrative with dying message
    const fullText = narrative
      ? `${narrative} ${dyingMessage}`
      : dyingMessage;

    this.elements.narrativeElement.className = 'injury-dying';
    this.elements.narrativeElement.innerHTML = `
      <span class="dying-countdown">${fullText}</span>
    `;
  }

  /**
   * Renders the dead state.
   *
   * @param {InjurySummaryDTO} summary - The injury summary.
   * @private
   */
  #renderDeadState(summary) {
    if (!this.elements.narrativeElement) {
      return;
    }

    const causeText = summary.causeOfDeath
      ? ` (${summary.causeOfDeath})`
      : '';

    this.elements.narrativeElement.className = 'injury-dead';
    this.elements.narrativeElement.innerHTML = `
      <span class="dead-message">I am dead${causeText}.</span>
    `;
  }

  /**
   * Determines the CSS severity class based on the injury summary.
   *
   * @param {InjurySummaryDTO} summary - The injury summary.
   * @returns {string} The CSS class name for the severity.
   * @private
   */
  #getSeverityClass(summary) {
    const health = summary.overallHealthPercentage;

    // Check for destroyed parts first
    if (summary.destroyedParts.length > 0) {
      return 'severity-destroyed';
    }

    // Map health percentage to severity
    if (health >= 90) {
      return 'severity-healthy';
    } else if (health >= 75) {
      return 'severity-scratched';
    } else if (health >= 50) {
      return 'severity-wounded';
    } else if (health >= 25) {
      return 'severity-injured';
    } else {
      return 'severity-critical';
    }
  }

  // dispose() is inherited from BoundDomRendererBase and handles cleanup
}

export default InjuryStatusPanel;
