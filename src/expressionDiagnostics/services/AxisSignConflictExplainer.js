/**
 * @file AxisSignConflictExplainer - Generates plain-English explanations for axis sign conflicts
 * @description Transforms technical axis sign conflict data into human-readable explanations
 * with distance-to-threshold decomposition showing whether recommendations are material.
 * @see specs/monte-carlo-report-clarity-improvements.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Conflict details structure for axis sign conflicts.
 *
 * @typedef {object} AxisSignConflictDetails
 * @property {string} conflictType - Type of conflict (e.g., 'positive_weight_low_max').
 * @property {string} axisName - Name of the affected axis (e.g., 'engagement', 'arousal').
 * @property {'positive' | 'negative'} prototypeSign - Sign needed by the prototype.
 * @property {number} moodRegimeMax - Maximum value achievable in current mood regime.
 * @property {number} requiredForThreshold - Value required to meet threshold.
 * @property {number} lostIntensity - Intensity lost due to the conflict.
 * @property {number} threshold - Expression threshold.
 * @property {number} p95Value - 95th percentile observed value.
 * @property {number} maxObserved - Maximum observed value.
 * @property {number} meanValue - Mean observed value.
 */

/**
 * Distance analysis result structure.
 *
 * @typedef {object} DistanceAnalysisResult
 * @property {number} threshold - Expression threshold requirement.
 * @property {number} p95 - 95th percentile observed.
 * @property {number} max - Maximum observed.
 * @property {number} gapFromP95 - Gap between threshold and P95.
 * @property {number} gapFromMax - Gap between threshold and max.
 * @property {number} recoverableIntensity - Intensity recoverable if axis caps removed.
 * @property {boolean} isRecoveryMaterial - Whether recovery would bridge the gap.
 * @property {string} conclusion - Human-readable conclusion about materiality.
 */

/**
 * Service for generating plain-English explanations of axis sign conflicts.
 * Replaces technical jargon with actionable descriptions.
 */
class AxisSignConflictExplainer {
  /** @type {object} */
  #logger;

  /**
   * Create an AxisSignConflictExplainer.
   *
   * @param {object} deps - Dependencies.
   * @param {object} deps.logger - Logger instance.
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#logger = logger;
  }

  /**
   * Generate plain-English explanation of an axis sign conflict.
   *
   * @param {AxisSignConflictDetails} conflict - The detected conflict details.
   * @returns {string} Human-readable explanation.
   */
  explain(conflict) {
    const {
      conflictType,
      axisName,
      prototypeSign,
      moodRegimeMax,
      requiredForThreshold,
      lostIntensity,
    } = conflict;

    const signDescription =
      prototypeSign === 'positive' ? 'positive' : 'negative';
    const axisDescription = this.#formatAxisName(axisName);

    const lines = [
      `**What this means**: This mood regime caps ${axisDescription} below the level this prototype needs for high intensity.`,
      ``,
      `**Specifics**:`,
      `- Prototype needs ${signDescription} ${axisDescription} contribution`,
      `- Current regime max: ${moodRegimeMax.toFixed(2)}`,
      `- Required for threshold: ${requiredForThreshold.toFixed(2)}`,
      `- Intensity lost: ${lostIntensity.toFixed(3)} (${(lostIntensity * 100).toFixed(1)}% of max)`,
    ];

    this.#logger.debug(
      `AxisSignConflictExplainer: Generated explanation for ${axisName} conflict`,
      { conflictType }
    );

    return lines.join('\n');
  }

  /**
   * Generate distance-to-threshold decomposition analysis.
   * Shows whether the recommendation is actually material.
   *
   * @param {AxisSignConflictDetails} conflict - The conflict details.
   * @returns {DistanceAnalysisResult} Distance analysis with materiality conclusion.
   */
  generateDistanceAnalysis(conflict) {
    const { threshold, p95Value, maxObserved, lostIntensity } = conflict;

    const gapFromP95 = threshold - p95Value;
    const gapFromMax = threshold - maxObserved;
    const recoverableIntensity = lostIntensity;

    // Recovery is material if it would bridge the P95 gap
    const isRecoveryMaterial = recoverableIntensity >= gapFromP95;

    let conclusion;
    if (gapFromMax <= 0) {
      conclusion = 'Threshold already achievable at max observed';
    } else if (isRecoveryMaterial) {
      conclusion = `Recovery (+${recoverableIntensity.toFixed(3)}) would bridge P95 gap (${gapFromP95.toFixed(3)})`;
    } else {
      conclusion = `Insufficient: Even full recovery (+${recoverableIntensity.toFixed(3)}) wouldn't bridge P95 gap (${gapFromP95.toFixed(3)})`;
    }

    return {
      threshold,
      p95: p95Value,
      max: maxObserved,
      gapFromP95,
      gapFromMax,
      recoverableIntensity,
      isRecoveryMaterial,
      conclusion,
    };
  }

  /**
   * Format distance analysis as a markdown table.
   *
   * @param {DistanceAnalysisResult} analysis - The distance analysis result.
   * @returns {string} Markdown-formatted table.
   */
  formatDistanceAnalysisTable(analysis) {
    const lines = [
      '### Distance to Threshold Analysis',
      '',
      '| Metric | Value | Notes |',
      '|--------|-------|-------|',
      `| threshold | ${analysis.threshold.toFixed(3)} | Expression requirement |`,
      `| P95 | ${analysis.p95.toFixed(3)} | 95th percentile observed |`,
      `| max | ${analysis.max.toFixed(3)} | Maximum observed |`,
      `| threshold - P95 | ${analysis.gapFromP95.toFixed(3)} | Gap from typical high values |`,
      `| threshold - max | ${analysis.gapFromMax.toFixed(3)} | Gap from absolute best case |`,
      `| recoverable intensity | ${analysis.recoverableIntensity.toFixed(3)} | If axis caps removed |`,
      `| **conclusion** | **${analysis.isRecoveryMaterial ? 'Potentially Material' : 'Insufficient'}** | ${analysis.conclusion} |`,
    ];

    return lines.join('\n');
  }

  /**
   * Generate a full explanation block with technical details in collapsible section.
   *
   * @param {AxisSignConflictDetails} conflict - The conflict details.
   * @param {string} technicalDetails - Pre-formatted technical details.
   * @returns {string} Complete formatted explanation block.
   */
  formatFullExplanationBlock(conflict, technicalDetails) {
    const plainEnglish = this.explain(conflict);
    const distanceAnalysis = this.generateDistanceAnalysis(conflict);
    const distanceTable = this.formatDistanceAnalysisTable(distanceAnalysis);

    const lines = [
      `#### Axis Sign Conflict: ${this.#formatAxisName(conflict.axisName)}`,
      ``,
      plainEnglish,
      ``,
      `<details>`,
      `<summary>Technical Details</summary>`,
      ``,
      technicalDetails,
      `</details>`,
      ``,
      distanceTable,
    ];

    return lines.join('\n');
  }

  /**
   * Format axis name for display (capitalize and format).
   *
   * @param {string} axisName - Raw axis name.
   * @returns {string} Formatted axis name.
   */
  #formatAxisName(axisName) {
    return axisName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Determine if a conflict represents a significant blocker.
   * A conflict is significant if the lost intensity is more than 10% of the threshold gap.
   *
   * @param {AxisSignConflictDetails} conflict - The conflict to evaluate.
   * @returns {boolean} True if the conflict is significant.
   */
  isSignificantBlocker(conflict) {
    const { threshold, maxObserved, lostIntensity } = conflict;
    const gapFromMax = threshold - maxObserved;

    if (gapFromMax <= 0) {
      // Already achievable
      return false;
    }

    // Significant if lost intensity is more than 10% of the gap
    return lostIntensity / gapFromMax > 0.1;
  }
}

export default AxisSignConflictExplainer;
