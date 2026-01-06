// src/domUI/sexualStatePanel.js

/**
 * @file Widget displaying character's current sexual state variables.
 * Displays 3 bars: Excitation, Inhibition, Arousal (calculated)
 * Plus Baseline Libido as a numeric value and qualitative sexual states text.
 * Subscribes to TURN_STARTED_ID to refresh the current actor's sexual state.
 * Subscribes to COMPONENT_ADDED_ID to refresh when sexual_state component changes.
 * Uses EmotionCalculatorService to calculate arousal and sexual states.
 * @see tickets/MOOANDSEXAROSYS-010-sexual-state-panel.md
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../entities/entityManager.js').default} IEntityManager */
/** @typedef {import('../emotions/emotionCalculatorService.js').default} EmotionCalculatorService */

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { TURN_STARTED_ID, COMPONENT_ADDED_ID } from '../constants/eventIds.js';
import {
  SEXUAL_STATE_COMPONENT_ID,
  MOOD_COMPONENT_ID,
} from '../constants/componentIds.js';

/**
 * Widget displaying character's current sexual state as 3 bars plus baseline and qualitative text.
 *
 * Displays:
 * - Excitation bar (0-100): pink/red gradient
 * - Inhibition bar (0-100): blue gradient
 * - Arousal bar (0-1): purple gradient (calculated from excitation - inhibition + baseline)
 * - Baseline Libido: numeric display with +/- sign
 * - Qualitative sexual states text: formatted from calculateSexualStates
 *
 * @augments BoundDomRendererBase
 */
export class SexualStatePanel extends BoundDomRendererBase {
  /** @type {IEntityManager} */
  #entityManager;

  /** @type {EmotionCalculatorService} */
  #emotionCalculatorService;

  /** @type {string|null} */
  #currentActorId;

  /**
   * Creates a SexualStatePanel instance.
   *
   * @param {object} dependencies - Runtime dependencies for this widget.
   * @param {ILogger} dependencies.logger - Logging utility for diagnostics.
   * @param {IDocumentContext} dependencies.documentContext - Abstraction over the DOM.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - Dispatcher for validated events.
   * @param {IEntityManager} dependencies.entityManager - Entity manager for accessing entity data.
   * @param {EmotionCalculatorService} dependencies.emotionCalculatorService - Service for emotion/sexual state calculation.
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    entityManager,
    emotionCalculatorService,
  }) {
    const elementsConfig = {
      panelElement: {
        selector: '#sexual-state-panel',
        required: true,
      },
    };

    super({
      logger,
      documentContext,
      validatedEventDispatcher,
      elementsConfig,
    });

    // Validate entityManager dependency
    if (!entityManager) {
      this.logger.error(
        `${this._logPrefix} EntityManager dependency is missing.`
      );
      throw new Error(`${this._logPrefix} EntityManager dependency is missing.`);
    }
    if (
      !entityManager.getEntityInstance ||
      typeof entityManager.getEntityInstance !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} EntityManager must have getEntityInstance method.`
      );
      throw new Error(
        `${this._logPrefix} EntityManager must have getEntityInstance method.`
      );
    }

    // Validate emotionCalculatorService dependency
    if (!emotionCalculatorService) {
      this.logger.error(
        `${this._logPrefix} EmotionCalculatorService dependency is missing.`
      );
      throw new Error(
        `${this._logPrefix} EmotionCalculatorService dependency is missing.`
      );
    }
    if (
      !emotionCalculatorService.calculateSexualArousal ||
      typeof emotionCalculatorService.calculateSexualArousal !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} EmotionCalculatorService must have calculateSexualArousal method.`
      );
      throw new Error(
        `${this._logPrefix} EmotionCalculatorService must have calculateSexualArousal method.`
      );
    }
    if (
      !emotionCalculatorService.calculateSexualStates ||
      typeof emotionCalculatorService.calculateSexualStates !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} EmotionCalculatorService must have calculateSexualStates method.`
      );
      throw new Error(
        `${this._logPrefix} EmotionCalculatorService must have calculateSexualStates method.`
      );
    }
    if (
      !emotionCalculatorService.formatSexualStatesForPrompt ||
      typeof emotionCalculatorService.formatSexualStatesForPrompt !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} EmotionCalculatorService must have formatSexualStatesForPrompt method.`
      );
      throw new Error(
        `${this._logPrefix} EmotionCalculatorService must have formatSexualStatesForPrompt method.`
      );
    }

    this.#entityManager = entityManager;
    this.#emotionCalculatorService = emotionCalculatorService;
    this.#currentActorId = null;

    this.logger.debug(`${this._logPrefix} Initializing...`);

    // Check if panel element was bound correctly
    if (!this.elements.panelElement) {
      this.logger.error(
        `${this._logPrefix} Required DOM element not bound. Panel will not function correctly.`
      );
    }

    // Initialize to hidden state
    this.#hidePanel();

    try {
      // Subscribe to turn started events to refresh status
      this._subscribe(TURN_STARTED_ID, this.#handleTurnStarted.bind(this));
      // Subscribe to component added events for sexual_state updates
      this._subscribe(COMPONENT_ADDED_ID, this.#handleComponentAdded.bind(this));
      this.logger.debug(
        `${this._logPrefix} Initialized and subscribed to ${TURN_STARTED_ID} and ${COMPONENT_ADDED_ID}.`
      );
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Failed to subscribe to events.`,
        error
      );
    }
  }

  /**
   * Handles the TURN_STARTED event to refresh the current actor's sexual state.
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
        `${this._logPrefix} Received ${TURN_STARTED_ID} event. Expected entityId string in .payload.entityId was missing or invalid. Hiding panel.`,
        { receivedData: eventWrapper }
      );
      this.#currentActorId = null;
      this.#hidePanel();
      return;
    }

    this.#currentActorId = actualPayload.entityId;
    this.logger.debug(
      `${this._logPrefix} Handling ${TURN_STARTED_ID} for entityId: ${this.#currentActorId}`
    );

    this.#render();
  }

  /**
   * Handles the COMPONENT_ADDED event to refresh when sexual_state component changes.
   *
   * @param {object} eventWrapper - The event wrapper containing payload.
   * @param {object} eventWrapper.payload - The event payload.
   * @param {string} eventWrapper.payload.entityId - The entity that received the component.
   * @param {string} eventWrapper.payload.componentId - The component that was added.
   * @private
   */
  #handleComponentAdded(eventWrapper) {
    const actualPayload = eventWrapper.payload;

    if (!actualPayload || !actualPayload.entityId || !actualPayload.componentId) {
      return;
    }

    // Only re-render if this is the current actor's sexual_state component
    if (
      actualPayload.entityId === this.#currentActorId &&
      actualPayload.componentId === SEXUAL_STATE_COMPONENT_ID
    ) {
      this.logger.debug(
        `${this._logPrefix} Sexual state component added for current actor. Re-rendering.`
      );
      this.#render();
    }
  }

  /**
   * Checks if the panel should be shown.
   *
   * @returns {boolean} True if panel should be visible.
   * @private
   */
  #shouldShowPanel() {
    if (!this.#currentActorId) {
      return false;
    }

    const entity = this.#entityManager.getEntityInstance(this.#currentActorId);
    if (!entity) {
      return false;
    }

    return entity.hasComponent(SEXUAL_STATE_COMPONENT_ID);
  }

  /**
   * Gets the sexual state data from the current actor.
   *
   * @returns {{sex_excitation: number, sex_inhibition: number, baseline_libido: number}|null} The sexual state data or null if not available.
   * @private
   */
  #getSexualStateData() {
    if (!this.#currentActorId) {
      return null;
    }

    const entity = this.#entityManager.getEntityInstance(this.#currentActorId);
    if (!entity) {
      return null;
    }

    const sexualStateComponent = entity.getComponentData(SEXUAL_STATE_COMPONENT_ID);
    if (!sexualStateComponent) {
      return null;
    }

    return sexualStateComponent;
  }

  /**
   * Gets the mood data from the current actor for sexual state calculations.
   *
   * @returns {object|null} The mood component data or null if not available.
   * @private
   */
  #getMoodData() {
    if (!this.#currentActorId) {
      return null;
    }

    const entity = this.#entityManager.getEntityInstance(this.#currentActorId);
    if (!entity) {
      return null;
    }

    return entity.getComponentData(MOOD_COMPONENT_ID);
  }

  /**
   * Renders the panel content.
   *
   * @private
   */
  #render() {
    if (!this.#shouldShowPanel()) {
      this.#hidePanel();
      return;
    }

    const sexualStateData = this.#getSexualStateData();
    if (!sexualStateData) {
      this.#hidePanel();
      return;
    }

    this.#showPanel();
    this.#renderContent(sexualStateData);
  }

  /**
   * Shows the panel.
   *
   * @private
   */
  #showPanel() {
    if (this.elements.panelElement) {
      this.elements.panelElement.classList.remove('hidden');
    }
  }

  /**
   * Hides the panel.
   *
   * @private
   */
  #hidePanel() {
    if (this.elements.panelElement) {
      this.elements.panelElement.classList.add('hidden');
    }
  }

  /**
   * Renders the full content of the panel.
   *
   * @param {{sex_excitation: number, sex_inhibition: number, baseline_libido: number}} sexualStateData - The sexual state data to render.
   * @private
   */
  #renderContent(sexualStateData) {
    if (!this.elements.panelElement) {
      return;
    }

    // Clear existing content
    this.elements.panelElement.innerHTML = '';

    // Create title
    const title = this.documentContext.create('div');
    title.className = 'sexual-state-panel__title';
    title.textContent = 'SEXUAL STATE';
    this.elements.panelElement.appendChild(title);

    // Create bars container
    const barsContainer = this.documentContext.create('div');
    barsContainer.className = 'sexual-state-panel__bars';

    // Extract values with defaults
    const excitation = sexualStateData.sex_excitation ?? 0;
    const inhibition = sexualStateData.sex_inhibition ?? 0;
    const baseline = sexualStateData.baseline_libido ?? 0;

    // Calculate arousal using the service
    const arousal = this.#emotionCalculatorService.calculateSexualArousal(sexualStateData);

    // Render excitation bar (0-100)
    barsContainer.appendChild(this.#createBarRow('Excitation', excitation, 100, 'excitation'));

    // Render inhibition bar (0-100)
    barsContainer.appendChild(this.#createBarRow('Inhibition', inhibition, 100, 'inhibition'));

    // Render arousal bar (0-1)
    barsContainer.appendChild(this.#createBarRow('Arousal', arousal ?? 0, 1, 'arousal'));

    this.elements.panelElement.appendChild(barsContainer);

    // Render divider
    const divider = this.documentContext.create('div');
    divider.className = 'sexual-state-panel__divider';
    this.elements.panelElement.appendChild(divider);

    // Render baseline libido
    this.#renderBaselineLibido(baseline);

    // Render qualitative sexual states text
    this.#renderSexualStatesText(sexualStateData, arousal);
  }

  /**
   * Creates a bar row element.
   *
   * @param {string} label - The label for the bar.
   * @param {number} value - The current value.
   * @param {number} maxValue - The maximum value (100 for excitation/inhibition, 1 for arousal).
   * @param {string} barType - The bar type for CSS class ('excitation', 'inhibition', 'arousal').
   * @returns {HTMLElement} The bar row element.
   * @private
   */
  #createBarRow(label, value, maxValue, barType) {
    const row = this.documentContext.create('div');
    row.className = 'sexual-state-panel__row';

    // Label
    const labelElement = this.documentContext.create('span');
    labelElement.className = 'sexual-state-panel__label';
    labelElement.textContent = label;
    row.appendChild(labelElement);

    // Bar container
    const barContainer = this.documentContext.create('div');
    barContainer.className = 'sexual-state-panel__bar-container';

    // Bar fill
    const barFill = this.documentContext.create('div');
    barFill.className = `sexual-state-panel__bar-fill sexual-state-panel__bar-fill--${barType}`;

    // Calculate width percentage
    const percentage = Math.min(100, Math.max(0, (value / maxValue) * 100));
    // Account for the 2px padding on left side
    barFill.style.width = `calc(${percentage}% - 4px)`;

    barContainer.appendChild(barFill);
    row.appendChild(barContainer);

    // Value display
    const valueElement = this.documentContext.create('span');
    valueElement.className = 'sexual-state-panel__value';

    if (maxValue === 1) {
      // Arousal: display as 0.00 to 1.00
      valueElement.textContent = value.toFixed(2);
    } else {
      // Excitation/Inhibition: display as integer
      valueElement.textContent = Math.round(value).toString();
    }

    row.appendChild(valueElement);

    return row;
  }

  /**
   * Renders the baseline libido value.
   *
   * @param {number} baseline - The baseline libido value (-50 to +50).
   * @private
   */
  #renderBaselineLibido(baseline) {
    if (!this.elements.panelElement) {
      return;
    }

    const baselineContainer = this.documentContext.create('div');
    baselineContainer.className = 'sexual-state-panel__baseline';

    const baselineLabel = this.documentContext.create('span');
    baselineLabel.className = 'sexual-state-panel__baseline-label';
    baselineLabel.textContent = 'Baseline Libido:';
    baselineContainer.appendChild(baselineLabel);

    const baselineValue = this.documentContext.create('span');
    baselineValue.className = 'sexual-state-panel__baseline-value';

    // Format with sign
    const formattedValue = baseline >= 0 ? `+${baseline}` : `${baseline}`;
    baselineValue.textContent = formattedValue;

    // Add color class based on value
    if (baseline > 0) {
      baselineValue.classList.add('sexual-state-panel__baseline-value--positive');
    } else if (baseline < 0) {
      baselineValue.classList.add('sexual-state-panel__baseline-value--negative');
    }

    baselineContainer.appendChild(baselineValue);
    this.elements.panelElement.appendChild(baselineContainer);
  }

  /**
   * Renders the qualitative sexual states text below baseline.
   *
   * @param {{sex_excitation: number, sex_inhibition: number, baseline_libido: number}} sexualStateData - The sexual state component data.
   * @param {number|null} arousal - The calculated arousal value.
   * @private
   */
  #renderSexualStatesText(sexualStateData, arousal) {
    if (!this.elements.panelElement) {
      return;
    }

    // Calculate sexual states using the service
    // The calculateSexualStates method takes moodData and sexualArousal
    // Fetch mood data from the entity for proper sexual state calculation
    const moodData = this.#getMoodData();
    const sexualStates = this.#emotionCalculatorService.calculateSexualStates(moodData, arousal);
    const sexualStatesText = this.#emotionCalculatorService.formatSexualStatesForPrompt(sexualStates);

    // Create sexual states text container
    const statesContainer = this.documentContext.create('div');
    statesContainer.className = 'sexual-state-panel__states';

    if (sexualStatesText) {
      const statesLabel = this.documentContext.create('span');
      statesLabel.className = 'sexual-state-panel__states-label';
      statesLabel.textContent = 'Current: ';
      statesContainer.appendChild(statesLabel);

      const statesValue = this.documentContext.create('span');
      statesValue.className = 'sexual-state-panel__states-value';
      statesValue.textContent = sexualStatesText;
      statesContainer.appendChild(statesValue);
    } else {
      statesContainer.textContent = 'Current: neutral';
    }

    this.elements.panelElement.appendChild(statesContainer);
  }

  // dispose() is inherited from BoundDomRendererBase and handles cleanup
}

export default SexualStatePanel;
