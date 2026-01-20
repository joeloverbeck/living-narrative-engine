/**
 * @file AxisConflictAnalyzer - Analyzes axis sign conflicts and builds recommendation components.
 * @description Extracted from RecommendationEngine to handle the complex logic for
 * detecting axis sign conflicts between prototype weights and regime constraints,
 * and building actionable recommendations with binary choice framing.
 *
 * Analysis logic:
 *   - Normalizes raw axis conflicts (filters valid entries)
 *   - Builds evidence arrays with conflict details
 *   - Generates binary choice actions (Option A: adjust regime, Option B: change emotion)
 *   - Calculates severity based on lost intensity relative to threshold
 *
 * @see RecommendationEngine.js (orchestrator that delegates to this analyzer)
 */

import {
  getSeverity,
  buildPopulation,
} from '../utils/recommendationUtils.js';

/**
 * Analyzer class for axis sign conflict recommendations.
 *
 * Responsible for:
 * - Normalizing axis conflict data
 * - Building evidence and action suggestions
 * - Providing binary choice framing for recommendations
 * - Calculating conflict severity
 *
 * Optionally depends on EmotionSimilarityService for alternative emotion suggestions.
 */
class AxisConflictAnalyzer {
  #emotionSimilarityService;

  /**
   * @param {object} [options]
   * @param {object} [options.emotionSimilarityService] - Optional service for finding alternative emotions.
   */
  constructor({ emotionSimilarityService = null } = {}) {
    this.#emotionSimilarityService = emotionSimilarityService;
  }

  /**
   * Normalize raw axis conflicts array (filter valid entries).
   * @param {Array} axisConflicts - Raw conflicts from prototype
   * @returns {Array} Filtered conflicts with valid conflictType
   */
  normalize(axisConflicts) {
    if (!Array.isArray(axisConflicts)) {
      return [];
    }
    return axisConflicts.filter((conflict) => conflict?.conflictType);
  }

  /**
   * Analyze axis conflicts and build recommendation components.
   * Returns analysis results only (not full recommendation object).
   * @param {Object} params
   * @param {Array} params.axisConflicts - Normalized conflicts
   * @param {string} params.prototypeId - The emotion prototype ID
   * @param {number} params.moodSampleCount - Sample count for evidence
   * @returns {{actions: string[], structuredActions: object, evidence: Array}}
   */
  analyze({ axisConflicts, prototypeId, moodSampleCount }) {
    const evidence = this.#buildAxisConflictEvidence(
      axisConflicts ?? [],
      moodSampleCount ?? 0
    );
    const { actions, structuredActions } = this.#buildAxisSignConflictActions(
      axisConflicts ?? [],
      prototypeId ?? ''
    );

    return {
      actions,
      structuredActions,
      evidence,
    };
  }

  /**
   * Get severity level for axis conflict recommendation.
   * @param {Object} params
   * @param {Array} params.axisConflicts - The conflicts
   * @param {Object} params.clause - Clause with thresholdValue
   * @param {number} params.impact - Impact score
   * @returns {'high'|'medium'|'low'}
   */
  getSeverity({ axisConflicts, clause, impact }) {
    const threshold = clause?.thresholdValue;
    const lostIntensity = this.#getMaxLostIntensity(axisConflicts);
    if (
      typeof threshold !== 'number' ||
      threshold <= 0 ||
      typeof lostIntensity !== 'number'
    ) {
      return getSeverity(impact);
    }

    const score = lostIntensity / threshold;
    if (score < 0.15) {
      return 'low';
    }
    if (score < 0.3) {
      return 'medium';
    }
    return 'high';
  }

  // === PRIVATE METHODS ===

  /**
   * Build evidence array for axis conflicts.
   * @param {Array} axisConflicts - The axis conflicts
   * @param {number} moodSampleCount - Sample count for population
   * @returns {Array} Evidence array
   */
  #buildAxisConflictEvidence(axisConflicts, moodSampleCount) {
    return (axisConflicts ?? []).slice(0, 3).map((conflict) => {
      const weightValue =
        typeof conflict.weight === 'number' ? conflict.weight : null;
      const weightLabel =
        typeof weightValue === 'number'
          ? `${weightValue >= 0 ? '+' : ''}${weightValue.toFixed(2)}`
          : 'n/a';
      const range =
        typeof conflict.constraintMin === 'number' &&
        typeof conflict.constraintMax === 'number'
          ? `[${conflict.constraintMin.toFixed(2)}, ${conflict.constraintMax.toFixed(2)}]`
          : 'n/a';
      const lostRawSum = Number.isFinite(conflict.lostRawSum)
        ? conflict.lostRawSum
        : null;
      const lostIntensity = Number.isFinite(conflict.lostIntensity)
        ? conflict.lostIntensity
        : null;
      const lostRawLabel =
        typeof lostRawSum === 'number' ? lostRawSum.toFixed(2) : 'n/a';
      const lostIntensityLabel =
        typeof lostIntensity === 'number' ? lostIntensity.toFixed(2) : 'n/a';
      return {
        label:
          `Axis conflict (${conflict.conflictType}): ` +
          `${conflict.axis} weight ${weightLabel}, ` +
          `regime ${range}, ` +
          `lostRawSum ${lostRawLabel}, ` +
          `lostIntensity ${lostIntensityLabel}`,
        numerator: lostRawSum,
        denominator: 1,
        value: lostIntensity,
        axis: conflict.axis,
        weight: weightValue,
        constraintMin: conflict.constraintMin,
        constraintMax: conflict.constraintMax,
        lostRawSum,
        lostIntensity,
        sources: Array.isArray(conflict.sources) ? conflict.sources : [],
        population: buildPopulation('mood-regime', moodSampleCount),
      };
    });
  }

  /**
   * Build axis sign conflict actions with binary choice framing.
   * @param {Array} axisConflicts - The axis conflicts detected
   * @param {string} prototypeId - The prototype ID (emotion name)
   * @returns {{ actions: string[], structuredActions: object }}
   */
  #buildAxisSignConflictActions(axisConflicts, prototypeId) {
    const actions = [];
    const structuredActions = {
      conflictSummary: '',
      options: [],
    };

    // Build conflict summary
    const conflictSummary = this.#buildConflictSummary(
      axisConflicts,
      prototypeId
    );
    structuredActions.conflictSummary = conflictSummary;

    if (conflictSummary) {
      actions.push(`CONFLICT: ${conflictSummary}`);
      actions.push('');
    }

    // Option A: Keep emotion, adjust regime
    const optionA = this.#buildRegimeRelaxationOption(axisConflicts);
    structuredActions.options.push(optionA);
    actions.push('== OPTION A: Keep emotion, adjust regime ==');
    for (const action of optionA.actions) {
      actions.push(`  - ${action}`);
    }
    actions.push(`  - Trade-off: ${optionA.tradeoff}`);
    actions.push('');

    // Option B: Keep regime, change emotion
    const optionB = this.#buildEmotionAlternativeOption(
      axisConflicts,
      prototypeId
    );
    structuredActions.options.push(optionB);
    actions.push('== OPTION B: Keep regime, change emotion ==');
    for (const action of optionB.actions) {
      actions.push(`  - ${action}`);
    }
    actions.push(`  - Trade-off: ${optionB.tradeoff}`);

    return { actions, structuredActions };
  }

  /**
   * Build a plain-English conflict summary.
   * @param {Array} axisConflicts - The axis conflicts
   * @param {string} prototypeId - The prototype ID
   * @returns {string} Human-readable conflict summary
   */
  #buildConflictSummary(axisConflicts, prototypeId) {
    if (!Array.isArray(axisConflicts) || axisConflicts.length === 0) {
      return '';
    }

    const parts = [];
    for (const conflict of axisConflicts.slice(0, 2)) {
      // axisLabel available for future use in more detailed summaries
      const _axisLabel = this.#formatAxisName(conflict.axis);
      const weight = conflict.weight;
      const weightText =
        typeof weight === 'number' ? weight.toFixed(2) : 'unknown';
      const requirementText = this.#buildRequirementText(conflict);

      if (requirementText) {
        const emotionLabel = prototypeId || 'the emotion';
        const suppressorText =
          typeof weight === 'number' && weight < 0
            ? 'treats it as a suppressor'
            : 'weight opposes the constraint';
        parts.push(
          `Expression ${requirementText}, but ${emotionLabel} ${suppressorText} (weight: ${weightText}).`
        );
      }
    }

    return parts.join(' ');
  }

  /**
   * Build requirement text from conflict sources.
   * @param {object} conflict - Single axis conflict
   * @returns {string} Requirement description
   */
  #buildRequirementText(conflict) {
    if (!conflict?.sources || conflict.sources.length === 0) {
      return '';
    }

    const source = conflict.sources[0];
    if (!source?.varPath || !source?.operator) {
      return '';
    }

    const threshold =
      typeof source.threshold === 'number' ? source.threshold : 'n/a';
    const operatorMap = {
      '>=': 'high',
      '>': 'high',
      '<=': 'low',
      '<': 'low',
      '==': 'exact',
    };
    const levelWord = operatorMap[source.operator] || source.operator;

    return `requires ${levelWord} ${this.#formatAxisName(conflict.axis)} (${source.operator} ${threshold})`;
  }

  /**
   * Build Option A: Keep emotion, adjust regime.
   * @param {Array} axisConflicts - The axis conflicts
   * @returns {object} Option A details
   */
  #buildRegimeRelaxationOption(axisConflicts) {
    const actions = [];
    const sourceTexts = [];

    for (const conflict of axisConflicts ?? []) {
      for (const source of conflict?.sources ?? []) {
        const varPath = source?.varPath;
        const operator = source?.operator;
        const threshold =
          typeof source?.threshold === 'number'
            ? source.threshold
            : source?.threshold ?? null;
        if (!varPath || !operator) {
          continue;
        }
        const thresholdText =
          typeof threshold === 'number' ? threshold : 'n/a';
        sourceTexts.push(`${varPath} ${operator} ${thresholdText}`);
      }
    }

    if (sourceTexts.length > 0) {
      actions.push(`Remove or relax: ${sourceTexts.join(', ')}`);
    } else {
      actions.push('Relax the regime axis bounds that oppose the prototype weight');
    }

    return {
      id: 'relax_regime',
      label: 'Option A: Keep emotion, adjust regime',
      actions,
      tradeoff: 'Expression may trigger in wider range of mood states',
    };
  }

  /**
   * Build Option B: Keep regime, change emotion.
   * @param {Array} axisConflicts - The axis conflicts
   * @param {string} prototypeId - The current emotion prototype ID
   * @returns {object} Option B details
   */
  #buildEmotionAlternativeOption(axisConflicts, prototypeId) {
    const actions = [];
    const alternatives = [];

    // Try to find alternative emotions for each conflicting axis
    if (this.#emotionSimilarityService && Array.isArray(axisConflicts)) {
      for (const conflict of axisConflicts.slice(0, 2)) {
        const axisName = conflict?.axis;
        const weight = conflict?.weight;

        if (!axisName || typeof weight !== 'number') {
          continue;
        }

        // If current emotion has negative weight but regime wants high values,
        // suggest emotions with positive weight on that axis (and vice versa)
        const targetSign = weight < 0 ? 'positive' : 'negative';
        const suggestions =
          this.#emotionSimilarityService.findEmotionsWithCompatibleAxisSign(
            axisName,
            targetSign,
            0.1,
            3
          );

        // Filter out current emotion and format suggestions
        for (const suggestion of suggestions) {
          if (suggestion.emotionName === prototypeId) {
            continue;
          }
          const axisLabel = this.#formatAxisName(axisName);
          const weightSign = suggestion.axisWeight > 0 ? '+' : '';
          alternatives.push({
            emotionName: suggestion.emotionName,
            axis: axisName,
            weight: suggestion.axisWeight,
          });
          actions.push(
            `Consider: ${suggestion.emotionName} (${axisLabel}: ${weightSign}${suggestion.axisWeight.toFixed(2)})`
          );
        }
      }
    }

    // Always include the generic fallback action
    const emotionLabel = prototypeId || 'the emotion';
    const axisNames = (axisConflicts ?? [])
      .map((c) => this.#formatAxisName(c?.axis))
      .filter(Boolean)
      .slice(0, 2);
    const axisText = axisNames.length > 0 ? axisNames.join('/') : 'the axis';

    actions.push(
      `Or: Adjust ${emotionLabel}'s ${axisText} weight toward 0 or compatible sign`
    );

    return {
      id: 'change_emotion',
      label: 'Option B: Keep regime, change emotion',
      actions,
      tradeoff: 'Expression will use different emotional signature',
      alternatives,
    };
  }

  /**
   * Format axis name for display (snake_case -> Title Case).
   * @param {string} axisName - The raw axis name
   * @returns {string} Formatted axis name
   */
  #formatAxisName(axisName) {
    if (!axisName || typeof axisName !== 'string') {
      return '';
    }

    return axisName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Get maximum lost intensity from axis conflicts.
   * @param {Array} axisConflicts - The axis conflicts
   * @returns {number|null} Maximum lost intensity or null
   */
  #getMaxLostIntensity(axisConflicts) {
    let max = null;
    for (const conflict of axisConflicts ?? []) {
      if (typeof conflict?.lostIntensity !== 'number') {
        continue;
      }
      if (max === null || conflict.lostIntensity > max) {
        max = conflict.lostIntensity;
      }
    }
    return max;
  }
}

export default AxisConflictAnalyzer;
