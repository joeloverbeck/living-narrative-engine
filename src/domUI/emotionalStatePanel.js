// src/domUI/emotionalStatePanel.js

/**
 * @file Widget displaying character's current emotional state as 7 mood axes.
 *
 * Subscribes to TURN_STARTED_ID to refresh the current actor's emotional state.
 * Subscribes to COMPONENT_ADDED_ID to refresh when mood component changes.
 * Uses EmotionCalculatorService to calculate emotions and format them for display.
 * @see tickets/MOOANDSEXAROSYS-009-emotional-state-panel.md
 */

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */
/** @typedef {import('../entities/entityManager.js').default} IEntityManager */
/** @typedef {import('../emotions/emotionCalculatorService.js').default} EmotionCalculatorService */

import { BoundDomRendererBase } from './boundDomRendererBase.js';
import { TURN_STARTED_ID, COMPONENT_ADDED_ID } from '../constants/eventIds.js';
import {
  MOOD_COMPONENT_ID,
  SEXUAL_STATE_COMPONENT_ID,
} from '../constants/componentIds.js';
import { extractEntityId } from '../utils/entityUtils.js';

/**
 * Color configuration for each mood axis.
 * Negative values use the negative color, positive values use the positive color.
 *
 * @type {{[key: string]: {negative: string, positive: string}}}
 */
const AXIS_COLORS = {
  valence: { negative: '#c45850', positive: '#47a847' }, // red to green
  arousal: { negative: '#6c757d', positive: '#ffc107' }, // gray to yellow
  agency_control: { negative: '#6c757d', positive: '#0d6efd' }, // gray to blue
  threat: { negative: '#47a847', positive: '#dc3545' }, // green to red
  engagement: { negative: '#6c757d', positive: '#0dcaf0' }, // gray to cyan
  future_expectancy: { negative: '#c45850', positive: '#198754' }, // red to green
  self_evaluation: { negative: '#6f42c1', positive: '#fd7e14' }, // purple to orange
};

/**
 * Labels for each mood axis showing the meaning of negative and positive values.
 *
 * @type {{[key: string]: {negative: string, positive: string}}}
 */
const AXIS_LABELS = {
  valence: { negative: 'Unpleasant', positive: 'Pleasant' },
  arousal: { negative: 'Depleted', positive: 'Energized' },
  agency_control: { negative: 'Helpless', positive: 'In Control' },
  threat: { negative: 'Safe', positive: 'Endangered' },
  engagement: { negative: 'Indifferent', positive: 'Absorbed' },
  future_expectancy: { negative: 'Hopeless', positive: 'Hopeful' },
  self_evaluation: { negative: 'Shame', positive: 'Pride' },
};

/**
 * Ordered list of mood axes for consistent rendering.
 *
 * @type {string[]}
 */
const AXIS_ORDER = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
];

/**
 * Widget displaying character's current emotional state as 7 mood axis bars.
 *
 * Displays:
 * - 7 horizontal bars representing mood axes
 * - Each bar shows negative values extending left, positive values extending right
 * - Calculated emotions text below the bars
 *
 * @augments BoundDomRendererBase
 */
export class EmotionalStatePanel extends BoundDomRendererBase {
  /** @type {IEntityManager} */
  #entityManager;

  /** @type {EmotionCalculatorService} */
  #emotionCalculatorService;

  /** @type {string|null} */
  #currentActorId;

  /**
   * Creates an EmotionalStatePanel instance.
   *
   * @param {object} dependencies - Runtime dependencies for this widget.
   * @param {ILogger} dependencies.logger - Logging utility for diagnostics.
   * @param {IDocumentContext} dependencies.documentContext - Abstraction over the DOM.
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - Dispatcher for validated events.
   * @param {IEntityManager} dependencies.entityManager - Entity manager for accessing entity data.
   * @param {EmotionCalculatorService} dependencies.emotionCalculatorService - Service for emotion calculation.
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
        selector: '#emotional-state-panel',
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
      !emotionCalculatorService.calculateEmotions ||
      typeof emotionCalculatorService.calculateEmotions !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} EmotionCalculatorService must have calculateEmotions method.`
      );
      throw new Error(
        `${this._logPrefix} EmotionCalculatorService must have calculateEmotions method.`
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
      !emotionCalculatorService.getTopEmotions ||
      typeof emotionCalculatorService.getTopEmotions !== 'function'
    ) {
      this.logger.error(
        `${this._logPrefix} EmotionCalculatorService must have getTopEmotions method.`
      );
      throw new Error(
        `${this._logPrefix} EmotionCalculatorService must have getTopEmotions method.`
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
      // Subscribe to component added events for mood updates
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
   * Handles the TURN_STARTED event to refresh the current actor's emotional state.
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
   * Handles the COMPONENT_ADDED event to refresh when mood component changes.
   *
   * @param {object} eventWrapper - The event wrapper containing payload.
   * @param {object} eventWrapper.payload - The event payload.
   * @param {string|object} eventWrapper.payload.entity - The entity that received the component (may be entity object or string ID).
   * @param {string} eventWrapper.payload.componentTypeId - The component type that was added.
   * @private
   */
  #handleComponentAdded(eventWrapper) {
    const actualPayload = eventWrapper.payload;

    if (!actualPayload || !actualPayload.entity || !actualPayload.componentTypeId) {
      return;
    }

    // Extract entity ID (handles both entity objects and string IDs)
    const entityId = extractEntityId(actualPayload.entity);

    // Only re-render if this is the current actor's mood component
    if (
      entityId === this.#currentActorId &&
      actualPayload.componentTypeId === MOOD_COMPONENT_ID
    ) {
      this.logger.debug(
        `${this._logPrefix} Mood component added for current actor. Re-rendering.`
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

    return entity.hasComponent(MOOD_COMPONENT_ID);
  }

  /**
   * Gets the mood data from the current actor.
   *
   * @returns {{valence: number, arousal: number, agency_control: number, threat: number, engagement: number, future_expectancy: number, self_evaluation: number}|null}
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

    const moodComponent = entity.getComponentData(MOOD_COMPONENT_ID);
    if (!moodComponent) {
      return null;
    }

    return moodComponent;
  }

  /**
   * Gets the sexual state data from the current actor.
   *
   * @returns {{sex_excitation: number, sex_inhibition: number, baseline_libido: number}|null}
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

    const sexualComponent = entity.getComponentData(SEXUAL_STATE_COMPONENT_ID);
    if (!sexualComponent) {
      return null;
    }

    return sexualComponent;
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

    const moodData = this.#getMoodData();
    if (!moodData) {
      this.#hidePanel();
      return;
    }

    this.#showPanel();
    this.#renderContent(moodData);
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
   * @param {{valence: number, arousal: number, agency_control: number, threat: number, engagement: number, future_expectancy: number, self_evaluation: number}} moodData
   * @private
   */
  #renderContent(moodData) {
    if (!this.elements.panelElement) {
      return;
    }

    // Clear existing content
    this.elements.panelElement.innerHTML = '';

    // Create title
    const title = this.documentContext.create('div');
    title.className = 'emotional-state-panel__title';
    title.textContent = 'EMOTIONAL STATE';
    this.elements.panelElement.appendChild(title);

    // Create axes container
    const axesContainer = this.documentContext.create('div');
    axesContainer.className = 'emotional-state-panel__axes';

    // Render each axis
    for (const axisName of AXIS_ORDER) {
      const value = moodData[axisName] ?? 0;
      const axisElement = this.#createAxisElement(axisName, value);
      axesContainer.appendChild(axisElement);
    }

    this.elements.panelElement.appendChild(axesContainer);

    // Render calculated emotions text
    this.#renderEmotionsText(moodData);
  }

  /**
   * Creates a single axis element with bar visualization.
   *
   * @param {string} axisName - The name of the axis.
   * @param {number} value - The value of the axis (-100 to 100).
   * @returns {HTMLElement} The axis element.
   * @private
   */
  #createAxisElement(axisName, value) {
    const labels = AXIS_LABELS[axisName];
    const colors = AXIS_COLORS[axisName];

    const axisDiv = this.documentContext.create('div');
    axisDiv.className = 'emotional-state-panel__axis';
    axisDiv.setAttribute('data-axis', axisName);

    // Left label (negative)
    const leftLabel = this.documentContext.create('span');
    leftLabel.className = 'emotional-state-panel__label emotional-state-panel__label--left';
    leftLabel.textContent = labels.negative;
    axisDiv.appendChild(leftLabel);

    // Bar container with tooltip showing the value
    const barContainer = this.documentContext.create('div');
    barContainer.className = 'emotional-state-panel__bar-container';

    // Add tooltip and accessibility attributes
    const formattedValue = value >= 0 ? `+${value}` : `${value}`;
    barContainer.title = `${labels.negative} ← ${formattedValue} → ${labels.positive}`;
    barContainer.setAttribute('aria-label', `${axisName.replace(/_/g, ' ')}: ${formattedValue}`);

    // Center marker
    const centerMarker = this.documentContext.create('div');
    centerMarker.className = 'emotional-state-panel__bar-center';
    barContainer.appendChild(centerMarker);

    // Bar fill
    if (value !== 0) {
      const barFill = this.documentContext.create('div');
      barFill.className = 'emotional-state-panel__bar-fill';

      const absValue = Math.abs(value);
      const widthPercent = (absValue / 100) * 50; // 50% is half the bar (from center)

      if (value < 0) {
        barFill.classList.add('emotional-state-panel__bar-fill--negative');
        barFill.style.width = `${widthPercent}%`;
        barFill.style.backgroundColor = colors.negative;
      } else {
        barFill.classList.add('emotional-state-panel__bar-fill--positive');
        barFill.style.width = `${widthPercent}%`;
        barFill.style.backgroundColor = colors.positive;
      }

      barContainer.appendChild(barFill);
    }

    axisDiv.appendChild(barContainer);

    // Right label (positive)
    const rightLabel = this.documentContext.create('span');
    rightLabel.className = 'emotional-state-panel__label emotional-state-panel__label--right';
    rightLabel.textContent = labels.positive;
    axisDiv.appendChild(rightLabel);

    // Value display
    const valueDisplay = this.documentContext.create('span');
    valueDisplay.className = 'emotional-state-panel__value';
    valueDisplay.textContent = value >= 0 ? `+${value}` : `${value}`;
    axisDiv.appendChild(valueDisplay);

    return axisDiv;
  }

  /**
   * Renders the calculated emotions text below the bars.
   *
   * @param {{valence: number, arousal: number, agency_control: number, threat: number, engagement: number, future_expectancy: number, self_evaluation: number}} moodData
   * @private
   */
  #renderEmotionsText(moodData) {
    if (!this.elements.panelElement) {
      return;
    }

    const sexualStateData = this.#getSexualStateData();
    const sexualArousal =
      this.#emotionCalculatorService.calculateSexualArousal(sexualStateData);
    const emotions = this.#emotionCalculatorService.calculateEmotions(
      moodData,
      sexualArousal,
      sexualStateData
    );
    const emotionItems = this.#emotionCalculatorService.getTopEmotions(emotions);

    // Create emotions text container
    const emotionsContainer = this.documentContext.create('div');
    emotionsContainer.className = 'emotional-state-panel__emotions';

    if (emotionItems.length > 0) {
      const emotionsLabel = this.documentContext.create('span');
      emotionsLabel.className = 'emotional-state-panel__emotions-label';
      emotionsLabel.textContent = 'Current: ';
      emotionsContainer.appendChild(emotionsLabel);

      const emotionsList = this.documentContext.create('div');
      emotionsList.className = 'emotional-state-panel__emotions-list';
      emotionsContainer.appendChild(emotionsList);

      emotionItems.forEach((item) => {
        const emotionItem = this.documentContext.create('span');
        emotionItem.className = 'emotional-state-panel__emotion-item';

        const emotionName = this.documentContext.create('span');
        emotionName.className = 'emotional-state-panel__emotion-name';
        emotionName.textContent = `${item.displayName}: `;

        const emotionLabel = this.documentContext.create('span');
        emotionLabel.className = 'emotional-state-panel__emotion-label';
        emotionLabel.textContent = item.label;

        emotionItem.appendChild(emotionName);
        emotionItem.appendChild(emotionLabel);
        emotionsList.appendChild(emotionItem);
      });
    } else {
      emotionsContainer.textContent = 'Current: neutral';
    }

    this.elements.panelElement.appendChild(emotionsContainer);
  }

  // dispose() is inherited from BoundDomRendererBase and handles cleanup
}

export default EmotionalStatePanel;
