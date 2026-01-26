/**
 * @file Decision Summary Renderer for prototype analysis results.
 * Renders the add-axis decision verdict, rationale, and variance summary.
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

/**
 * @typedef {object} AxisGapAnalysis
 * @property {object} [pcaAnalysis] - PCA analysis results
 * @property {number} [pcaAnalysis.residualVarianceRatio] - Residual variance ratio
 * @property {number[]} [pcaAnalysis.explainedVariance] - Explained variance per component
 * @property {number} [pcaAnalysis.axisCount] - Number of axes
 * @property {object} [summary] - Summary with signal breakdown
 * @property {object} [summary.signalBreakdown] - Signal counts
 */

/**
 * @typedef {object} DecisionElements
 * @property {HTMLElement|null} decisionVerdict - Verdict badge element
 * @property {HTMLElement|null} decisionRationale - Rationale text element
 * @property {HTMLElement|null} varianceTop4 - Top 4 variance element
 * @property {HTMLElement|null} varianceAxisCount - Axis count element
 * @property {HTMLElement|null} varianceTopK - Top K variance element
 */

/**
 * @typedef {'yes'|'maybe'|'no'} DecisionVerdict
 */

/**
 * @typedef {object} DecisionResult
 * @property {DecisionVerdict} verdict - The decision verdict
 * @property {string} rationale - Explanation for the decision
 */

/**
 * Renderer for decision summary in prototype analysis.
 * Handles verdict determination, rationale generation, and variance display.
 */
class DecisionSummaryRenderer {
  /** @type {object} */
  #logger;

  /** @type {number} */
  static HIGH_RESIDUAL_THRESHOLD = 0.15;

  /**
   * Create a DecisionSummaryRenderer.
   *
   * @param {object} dependencies - Injected dependencies
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    this.#logger = logger;
    this.#logger.debug('[DecisionSummaryRenderer] Initialized.');
  }

  /**
   * Render the complete decision summary.
   *
   * @param {AxisGapAnalysis|null|undefined} axisGapAnalysis - The axis gap analysis data
   * @param {DecisionElements} elements - DOM elements for rendering
   */
  render(axisGapAnalysis, elements) {
    if (!axisGapAnalysis) {
      this.#logger.debug('[DecisionSummaryRenderer] No axis gap analysis provided.');
      return;
    }

    if (!elements.decisionVerdict || !elements.decisionRationale) {
      this.#logger.debug('[DecisionSummaryRenderer] Missing required decision elements.');
      return;
    }

    const pcaAnalysis = axisGapAnalysis.pcaAnalysis;
    const signalBreakdown = axisGapAnalysis.summary?.signalBreakdown;

    const decision = this.#determineDecision(pcaAnalysis, signalBreakdown);
    this.#renderVerdict(decision, elements);
    this.#renderVarianceSummary(pcaAnalysis, elements);
  }

  /**
   * Determine the decision verdict based on analysis signals.
   *
   * @param {object|undefined} pcaAnalysis - PCA analysis results
   * @param {object|undefined} signalBreakdown - Signal breakdown data
   * @returns {DecisionResult} The decision verdict and rationale
   * @private
   */
  #determineDecision(pcaAnalysis, signalBreakdown) {
    const residualVariance = pcaAnalysis?.residualVarianceRatio ?? 0;

    const pcaSignals = signalBreakdown?.pcaSignals ?? 0;
    const hubSignals = signalBreakdown?.hubSignals ?? 0;
    const coverageGapSignals = signalBreakdown?.coverageGapSignals ?? 0;
    const multiAxisConflictSignals = signalBreakdown?.multiAxisConflictSignals ?? 0;

    const highResidual = residualVariance >= DecisionSummaryRenderer.HIGH_RESIDUAL_THRESHOLD;
    const hasCoverageGaps = coverageGapSignals > 0;
    const hasHubs = hubSignals > 0;
    const hasMultiAxisConflicts = multiAxisConflictSignals > 0;
    const hasAnySignals =
      pcaSignals > 0 || hubSignals > 0 || coverageGapSignals > 0 || multiAxisConflictSignals > 0;

    if ((highResidual && hasCoverageGaps) || (hasHubs && hasMultiAxisConflicts)) {
      return this.#buildYesDecision(
        residualVariance,
        coverageGapSignals,
        hubSignals,
        multiAxisConflictSignals,
        highResidual,
        hasCoverageGaps
      );
    }

    if (highResidual) {
      return this.#buildMaybeHighResidualDecision(residualVariance);
    }

    if (hasAnySignals) {
      return this.#buildMaybeSignalsDecision(
        residualVariance,
        pcaSignals,
        hubSignals,
        coverageGapSignals,
        multiAxisConflictSignals
      );
    }

    return this.#buildNoDecision(residualVariance);
  }

  /**
   * Build a YES decision result.
   *
   * @param {number} residualVariance - Residual variance ratio
   * @param {number} coverageGapSignals - Coverage gap count
   * @param {number} hubSignals - Hub signals count
   * @param {number} multiAxisConflictSignals - Multi-axis conflict count
   * @param {boolean} highResidual - Whether residual is high
   * @param {boolean} hasCoverageGaps - Whether coverage gaps exist
   * @returns {DecisionResult} YES decision with rationale
   * @private
   */
  #buildYesDecision(
    residualVariance,
    coverageGapSignals,
    hubSignals,
    multiAxisConflictSignals,
    highResidual,
    hasCoverageGaps
  ) {
    let rationale;

    if (highResidual && hasCoverageGaps) {
      rationale =
        `High residual variance (${this.#formatPercentage(residualVariance)}) combined ` +
        `with ${coverageGapSignals} coverage gap${coverageGapSignals > 1 ? 's' : ''} ` +
        'strongly indicates missing dimensions in the axis space.';
    } else {
      rationale =
        `${hubSignals} hub prototype${hubSignals > 1 ? 's' : ''} connecting clusters, ` +
        `plus ${multiAxisConflictSignals} multi-axis conflict${multiAxisConflictSignals > 1 ? 's' : ''}, ` +
        'suggests the current axes cannot cleanly separate prototypes.';
    }

    return { verdict: 'yes', rationale };
  }

  /**
   * Build a MAYBE decision for high residual variance case.
   *
   * @param {number} residualVariance - Residual variance ratio
   * @returns {DecisionResult} MAYBE decision with rationale
   * @private
   */
  #buildMaybeHighResidualDecision(residualVariance) {
    const rationale =
      `Residual variance (${this.#formatPercentage(residualVariance)}) exceeds 15% threshold, ` +
      'indicating unexplained dimensions. However, no strong secondary signals ' +
      '(coverage gaps, hub prototypes) were detected. Consider reviewing poorly fitting prototypes.';

    return { verdict: 'maybe', rationale };
  }

  /**
   * Build a MAYBE decision for signals present case.
   *
   * @param {number} residualVariance - Residual variance ratio
   * @param {number} pcaSignals - PCA signals count
   * @param {number} hubSignals - Hub signals count
   * @param {number} coverageGapSignals - Coverage gap count
   * @param {number} multiAxisConflictSignals - Multi-axis conflict count
   * @returns {DecisionResult} MAYBE decision with rationale
   * @private
   */
  #buildMaybeSignalsDecision(
    residualVariance,
    pcaSignals,
    hubSignals,
    coverageGapSignals,
    multiAxisConflictSignals
  ) {
    const signals = [];
    if (pcaSignals > 0) signals.push('PCA signals');
    if (hubSignals > 0) signals.push(`${hubSignals} hub prototype(s)`);
    if (coverageGapSignals > 0) signals.push(`${coverageGapSignals} coverage gap(s)`);
    if (multiAxisConflictSignals > 0)
      signals.push(`${multiAxisConflictSignals} multi-axis conflict(s)`);

    const rationale =
      `Residual variance is acceptable (${this.#formatPercentage(residualVariance)}), ` +
      `but some signals detected: ${signals.join(', ')}. Review flagged prototypes ` +
      'to determine if they represent edge cases or indicate structural issues.';

    return { verdict: 'maybe', rationale };
  }

  /**
   * Build a NO decision result.
   *
   * @param {number} residualVariance - Residual variance ratio
   * @returns {DecisionResult} NO decision with rationale
   * @private
   */
  #buildNoDecision(residualVariance) {
    const rationale =
      `Residual variance (${this.#formatPercentage(residualVariance)}) is within acceptable range ` +
      'and no detection methods flagged issues. Current axis space adequately captures prototype variance.';

    return { verdict: 'no', rationale };
  }

  /**
   * Render the verdict to DOM elements.
   *
   * @param {DecisionResult} decision - The decision result
   * @param {DecisionElements} elements - DOM elements
   * @private
   */
  #renderVerdict(decision, elements) {
    const { verdict, rationale } = decision;

    elements.decisionVerdict.textContent = verdict.toUpperCase();
    elements.decisionVerdict.classList.remove('verdict-yes', 'verdict-maybe', 'verdict-no');
    elements.decisionVerdict.classList.add(`verdict-${verdict}`);
    elements.decisionRationale.textContent = rationale;
  }

  /**
   * Render the variance summary to DOM elements.
   *
   * @param {object|undefined} pcaAnalysis - PCA analysis results
   * @param {DecisionElements} elements - DOM elements
   * @private
   */
  #renderVarianceSummary(pcaAnalysis, elements) {
    const explainedVariance = pcaAnalysis?.explainedVariance ?? [];
    const axisCount = pcaAnalysis?.axisCount ?? 0;

    if (elements.varianceTop4) {
      const top4Variance = explainedVariance.slice(0, 4).reduce((sum, v) => sum + v, 0);
      elements.varianceTop4.textContent =
        explainedVariance.length > 0 ? this.#formatPercentage(top4Variance) : '--';
    }

    if (elements.varianceAxisCount) {
      elements.varianceAxisCount.textContent = axisCount > 0 ? String(axisCount) : '--';
    }

    if (elements.varianceTopK) {
      const topKVariance = explainedVariance.slice(0, axisCount).reduce((sum, v) => sum + v, 0);
      elements.varianceTopK.textContent =
        explainedVariance.length > 0 && axisCount > 0 ? this.#formatPercentage(topKVariance) : '--';
    }
  }

  /**
   * Format a ratio as a percentage string.
   *
   * @param {number} ratio - The ratio to format (0-1 range)
   * @returns {string} Formatted percentage
   * @private
   */
  #formatPercentage(ratio) {
    return `${(ratio * 100).toFixed(1)}%`;
  }
}

export default DecisionSummaryRenderer;
