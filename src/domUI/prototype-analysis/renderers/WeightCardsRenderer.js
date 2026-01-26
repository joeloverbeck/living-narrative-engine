/**
 * @file Weight Cards Renderer for prototype analysis.
 * Handles rendering of prototype weight cards showing flagged prototypes
 * with their top axes and reasons for flagging.
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} PrototypeWeightSummary
 * @property {string} prototypeId - The prototype identifier
 * @property {Array<{axis: string, weight: number}>} topAxes - Top axes by weight
 * @property {string} reason - Reason code for flagging
 * @property {object} [metrics] - Optional metrics object
 */

/**
 * @typedef {object} WeightCardsElements
 * @property {HTMLElement|null} prototypeCardsContainer - Container for prototype cards
 */

/**
 * Renderer for prototype weight cards in prototype analysis.
 * Displays flagged prototypes with their top axes and explanations.
 */
class WeightCardsRenderer {
  /** @type {object} */
  #logger;

  /**
   * Reason label mappings for display.
   *
   * @type {Record<string, string>}
   */
  static REASON_LABELS = {
    high_reconstruction_error: 'High Recon. Error',
    extreme_projection: 'Extreme Projection',
    hub: 'Hub Prototype',
    multi_axis_conflict: 'Multi-Axis Conflict',
    coverage_gap: 'Coverage Gap',
  };

  /**
   * Create a WeightCardsRenderer.
   *
   * @param {object} dependencies - Injected dependencies
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('[WeightCardsRenderer] Initialized.');
  }

  /**
   * Render prototype weight cards showing flagged prototypes with their top axes.
   *
   * @param {PrototypeWeightSummary[]|null} prototypeWeightSummaries - Prototype weight summaries
   * @param {WeightCardsElements} elements - DOM elements
   */
  renderPrototypeWeightCards(prototypeWeightSummaries, elements) {
    const { prototypeCardsContainer } = elements;
    if (!prototypeCardsContainer) return;

    prototypeCardsContainer.innerHTML = '';

    if (!Array.isArray(prototypeWeightSummaries) || prototypeWeightSummaries.length === 0) {
      prototypeCardsContainer.innerHTML =
        '<p class="prototype-cards-empty">No prototypes flagged by detection methods.</p>';
      return;
    }

    prototypeWeightSummaries.forEach((summary) => {
      const card = this.#createPrototypeCard(summary);
      prototypeCardsContainer.appendChild(card);
    });
  }

  /**
   * Create a single prototype weight card element.
   *
   * @param {PrototypeWeightSummary} summary - Prototype summary
   * @returns {HTMLElement} Card element
   * @private
   */
  #createPrototypeCard(summary) {
    const card = document.createElement('div');
    card.className = `prototype-card reason-${summary.reason}`;

    // Header
    const header = document.createElement('div');
    header.className = 'prototype-card-header';

    const prototypeId = document.createElement('span');
    prototypeId.className = 'prototype-id';
    prototypeId.textContent = summary.prototypeId;

    const reasonBadge = document.createElement('span');
    reasonBadge.className = `prototype-reason-badge reason-${summary.reason}`;
    reasonBadge.textContent = this.#formatReasonLabel(summary.reason);

    header.appendChild(prototypeId);
    header.appendChild(reasonBadge);
    card.appendChild(header);

    // Weight list
    if (Array.isArray(summary.topAxes) && summary.topAxes.length > 0) {
      const weightsSection = document.createElement('div');
      weightsSection.className = 'prototype-weights';

      const heading = document.createElement('h5');
      heading.textContent = 'Top Axes by Weight';
      weightsSection.appendChild(heading);

      const weightList = document.createElement('ul');
      weightList.className = 'weight-list';

      summary.topAxes.forEach(({ axis, weight }) => {
        const li = document.createElement('li');

        const axisName = document.createElement('span');
        axisName.className = 'axis-name';
        axisName.textContent = axis;

        const weightValue = document.createElement('span');
        const sign = weight >= 0 ? '+' : '';
        weightValue.className = `weight-value ${weight >= 0 ? 'positive' : 'negative'}`;
        weightValue.textContent = `${sign}${weight.toFixed(3)}`;

        li.appendChild(axisName);
        li.appendChild(weightValue);
        weightList.appendChild(li);
      });

      weightsSection.appendChild(weightList);
      card.appendChild(weightsSection);
    }

    // Why flagged section
    const unusual = document.createElement('div');
    unusual.className = 'prototype-unusual';
    unusual.innerHTML = `<strong>Why flagged:</strong> ${this.#formatWhyFlagged(summary)}`;
    card.appendChild(unusual);

    return card;
  }

  /**
   * Format the reason label for display.
   *
   * @param {string} reason - Reason code from backend
   * @returns {string} Human-readable label
   * @private
   */
  #formatReasonLabel(reason) {
    return WeightCardsRenderer.REASON_LABELS[reason] || reason.replace(/_/g, ' ');
  }

  /**
   * Format the "why flagged" explanation based on metrics.
   *
   * @param {PrototypeWeightSummary} summary - Prototype summary
   * @returns {string} Explanation text
   * @private
   */
  #formatWhyFlagged(summary) {
    const { reason, metrics } = summary;

    if (!metrics || typeof metrics !== 'object') {
      return this.#formatReasonLabel(reason);
    }

    switch (reason) {
      case 'high_reconstruction_error':
        return `RMSE ${(metrics.reconstructionError ?? 0).toFixed(3)} (above 0.5 threshold)`;
      case 'extreme_projection':
        return `Projection score ${(metrics.projectionScore ?? 0).toFixed(3)} on unexplained component`;
      case 'hub':
        return `Hub score ${(metrics.hubScore ?? 0).toFixed(3)} - connects multiple clusters`;
      case 'multi_axis_conflict':
        return `Uses ${metrics.axisCount ?? '?'} axes with conflicting signs`;
      case 'coverage_gap':
        return `Distance ${(metrics.distance ?? 0).toFixed(3)} from nearest axis`;
      default:
        return this.#formatReasonLabel(reason);
    }
  }
}

export default WeightCardsRenderer;
