/**
 * @file IntensityBoundsCalculator - Calculates max/min intensity for prototypes
 * @see specs/expression-diagnostics.md Layer A.2
 */

import { AxisInterval } from '../models/index.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {Object} IntensityBounds
 * @property {number} min - Minimum achievable intensity [0, 1]
 * @property {number} max - Maximum achievable intensity [0, 1]
 * @property {boolean} isUnbounded - True if no constraints applied
 */

/**
 * @typedef {Object} ThresholdReachability
 * @property {boolean} isReachable - True if threshold can be achieved
 * @property {number} threshold - Required threshold
 * @property {number} maxPossible - Maximum achievable intensity
 * @property {number} gap - How far from reachable (threshold - maxPossible)
 */

/**
 * Calculates maximum and minimum achievable intensity for emotion/sexual prototypes
 * given gate constraints. Identifies expressions requiring intensity thresholds that
 * are mathematically impossible to reach.
 */
class IntensityBoundsCalculator {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /**
   * @param {Object} deps
   * @param {object} deps.dataRegistry - IDataRegistry for prototype lookups
   * @param {object} deps.logger - ILogger
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Calculate intensity bounds for a prototype given axis constraints
   *
   * @param {string} prototypeId - Emotion or sexual state prototype ID
   * @param {string} type - 'emotion' or 'sexual'
   * @param {Map<string, AxisInterval>} [axisConstraints] - Optional pre-computed constraints
   * @returns {IntensityBounds}
   */
  calculateBounds(prototypeId, type, axisConstraints = new Map()) {
    const prototype = this.#getPrototype(prototypeId, type);

    if (!prototype) {
      this.#logger.warn(`Prototype not found: ${prototypeId} (${type})`);
      return { min: 0, max: 0, isUnbounded: false };
    }

    const weights = prototype.weights;
    if (!weights || Object.keys(weights).length === 0) {
      return { min: 0, max: 0, isUnbounded: false };
    }

    // Calculate sum of absolute weights for normalization
    const sumAbsWeights = Object.values(weights).reduce(
      (sum, w) => sum + Math.abs(w),
      0
    );

    if (sumAbsWeights === 0) {
      return { min: 0, max: 0, isUnbounded: false };
    }

    let maxRawSum = 0;
    let minRawSum = 0;

    for (const [axis, weight] of Object.entries(weights)) {
      const bounds =
        axisConstraints.get(axis) || this.#getDefaultInterval(axis);

      if (weight > 0) {
        // Positive weight: max uses bounds.max, min uses bounds.min
        maxRawSum += weight * bounds.max;
        minRawSum += weight * bounds.min;
      } else {
        // Negative weight: max uses bounds.min, min uses bounds.max
        maxRawSum += weight * bounds.min;
        minRawSum += weight * bounds.max;
      }
    }

    return {
      min: this.#clamp01(minRawSum / sumAbsWeights),
      max: this.#clamp01(maxRawSum / sumAbsWeights),
      isUnbounded: axisConstraints.size === 0,
    };
  }

  /**
   * Check if a threshold is reachable for a prototype
   *
   * @param {string} prototypeId
   * @param {string} type - 'emotion' or 'sexual'
   * @param {number} threshold - Required intensity threshold
   * @param {Map<string, AxisInterval>} [axisConstraints]
   * @returns {ThresholdReachability}
   */
  checkThresholdReachability(
    prototypeId,
    type,
    threshold,
    axisConstraints = new Map()
  ) {
    const bounds = this.calculateBounds(prototypeId, type, axisConstraints);

    return {
      isReachable: bounds.max >= threshold,
      threshold,
      maxPossible: bounds.max,
      gap: Math.max(0, threshold - bounds.max),
    };
  }

  /**
   * Analyze all intensity requirements in an expression
   *
   * @param {object} expression
   * @param {Map<string, AxisInterval>} [axisConstraints] - From GateConstraintAnalyzer
   * @returns {ThresholdReachability[]}
   */
  analyzeExpression(expression, axisConstraints = new Map()) {
    if (!expression?.prerequisites) {
      return [];
    }

    const results = [];
    const requirements = this.#extractThresholdRequirements(
      expression.prerequisites
    );

    for (const { prototypeId, type, threshold } of requirements) {
      const reachability = this.checkThresholdReachability(
        prototypeId,
        type,
        threshold,
        axisConstraints
      );

      if (!reachability.isReachable) {
        results.push({
          prototypeId,
          type,
          ...reachability,
        });
      }
    }

    return results;
  }

  /**
   * Extract threshold requirements from prerequisites
   *
   * @private
   * @param {Array} prerequisites
   * @returns {Array<{prototypeId: string, type: string, threshold: number}>}
   */
  #extractThresholdRequirements(prerequisites) {
    const requirements = [];

    for (const prereq of prerequisites) {
      this.#extractFromLogic(prereq.logic, requirements);
    }

    return requirements;
  }

  /**
   * Recursively extract threshold requirements from JSON Logic
   *
   * @private
   * @param {object} logic
   * @param {Array} results
   */
  #extractFromLogic(logic, results) {
    if (!logic || typeof logic !== 'object') return;

    // Check for >= comparisons
    if (logic['>=']) {
      const [left, right] = logic['>='];
      if (typeof left === 'object' && left.var && typeof right === 'number') {
        const varPath = left.var;
        if (varPath.startsWith('emotions.')) {
          results.push({
            prototypeId: varPath.replace('emotions.', ''),
            type: 'emotion',
            threshold: right,
          });
        } else if (varPath.startsWith('sexualStates.')) {
          results.push({
            prototypeId: varPath.replace('sexualStates.', ''),
            type: 'sexual',
            threshold: right,
          });
        }
      }
    }

    // Recurse into nested logic
    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        this.#extractFromLogic(clause, results);
      }
    }
  }

  /**
   * Get prototype definition from dataRegistry
   *
   * @private
   * @param {string} prototypeId
   * @param {string} type
   * @returns {object|null}
   */
  #getPrototype(prototypeId, type) {
    const lookupId =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';

    const lookup = this.#dataRegistry.get('lookups', lookupId);
    return lookup?.entries?.[prototypeId] || null;
  }

  /**
   * Get default interval bounds for an axis
   *
   * @private
   * @param {string} axis
   * @returns {AxisInterval}
   */
  #getDefaultInterval(axis) {
    const sexualAxes = [
      'sex_excitation',
      'sex_inhibition',
      'baseline_libido',
      'sexual_arousal',
    ];
    if (sexualAxes.includes(axis)) {
      return AxisInterval.forSexualAxis();
    }
    return AxisInterval.forMoodAxis();
  }

  /**
   * Clamp value to [0, 1] range
   *
   * @private
   * @param {number} value
   * @returns {number}
   */
  #clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }
}

export default IntensityBoundsCalculator;
