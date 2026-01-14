/**
 * @file PrototypeConstraintAnalyzer.js
 * @description Analyzes emotion/sexual prototype constraints against axis constraints
 * extracted from expression prerequisites. Used by Monte Carlo reports to explain
 * why certain emotion thresholds are difficult or impossible to achieve.
 * @see IntensityBoundsCalculator.js - Used for max intensity computation
 * @see GateConstraintAnalyzer.js - Provides gate constraint analysis
 */

import GateConstraint from '../models/GateConstraint.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { extractMoodConstraints } from '../utils/moodRegimeUtils.js';

/**
 * @typedef {object} PrototypeAnalysisResult
 * @property {string} prototypeId - The emotion/sexual state ID
 * @property {string} type - 'emotion' or 'sexual'
 * @property {string} operator - Comparison operator used
 * @property {number} threshold - Required threshold value
 * @property {number} maxAchievable - Max intensity achievable given constraints
 * @property {number} minAchievable - Min intensity achievable given constraints
 * @property {boolean} isReachable - Whether threshold can be reached
 * @property {number} gap - Operator-aware distance from satisfiability
 * @property {object} weights - Prototype weights by axis
 * @property {string[]} gates - Prototype gate conditions
 * @property {object} gateStatus - Status of each gate
 * @property {BindingAxisInfo[]} bindingAxes - Axes that limit achievable intensity
 * @property {BindingAxisInfo[]} axisAnalysis - Full analysis of all axes
 * @property {number} sumAbsWeights - Sum of absolute weights
 * @property {number} requiredRawSum - Required raw sum for threshold
 * @property {string} explanation - Human-readable explanation
 */

/**
 * @typedef {object} BindingAxisInfo
 * @property {string} axis - Axis name
 * @property {number} weight - Prototype weight for this axis
 * @property {number} constraintMin - Min value from expression constraint
 * @property {number} constraintMax - Max value from expression constraint
 * @property {number} defaultMin - Default axis minimum
 * @property {number} defaultMax - Default axis maximum
 * @property {number} optimalValue - Value that maximizes contribution
 * @property {number} contribution - Contribution to raw sum
 * @property {boolean} isBinding - Whether constraint limits optimal value
 * @property {string} conflictType - 'positive_weight_low_max' | 'negative_weight_high_min' | null
 * @property {number} lostRawSum - Raw lost magnitude from default bounds
 * @property {number|null} lostIntensity - Lost magnitude normalized by sumAbsWeights
 * @property {Array<{ varPath: string, operator: string, threshold: number }>} sources
 */

/**
 * @typedef {object} AxisConstraint
 * @property {number} min - Minimum allowed value
 * @property {number} max - Maximum allowed value
 * @property {Array<{ varPath: string, operator: string, threshold: number }>} sources
 */

/**
 * Analyzes prototype constraints to explain why emotion thresholds may be
 * difficult or impossible to achieve given expression axis constraints.
 */
class PrototypeConstraintAnalyzer {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.dataRegistry - IDataRegistry for prototype lookups
   * @param {object} deps.logger - ILogger
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getLookupData'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Analyze a prototype threshold condition against expression constraints
   *
   * @param {string} prototypeId - Emotion or sexual state ID (e.g., 'anger')
   * @param {string} type - 'emotion' or 'sexual'
   * @param {number} threshold - Required threshold value
   * @param {Map<string, AxisConstraint>} axisConstraints - Axis constraints from expression
   * @param {string} [operator='>='] - Comparison operator from the clause
   * @returns {PrototypeAnalysisResult}
   */
  analyzeEmotionThreshold(
    prototypeId,
    type,
    threshold,
    axisConstraints,
    operator = '>='
  ) {
    const comparisonOperator = operator ?? '>=';
    const prototype = this.#getPrototype(prototypeId, type);

    if (!prototype) {
      this.#logger.warn(
        `PrototypeConstraintAnalyzer: Prototype not found: ${prototypeId} (${type})`
      );
      return this.#createNotFoundResult(
        prototypeId,
        type,
        threshold,
        comparisonOperator
      );
    }

    const weights = prototype.weights || {};
    const gates = prototype.gates || [];

    // Calculate sum of absolute weights for normalization
    const sumAbsWeights = Object.values(weights).reduce(
      (sum, w) => sum + Math.abs(w),
      0
    );

    if (sumAbsWeights === 0) {
      return this.#createZeroWeightResult(
        prototypeId,
        type,
        threshold,
        weights,
        gates,
        comparisonOperator
      );
    }

    // Analyze each axis contribution
    const axisAnalysis = this.#analyzeAxisContributions(
      weights,
      axisConstraints,
      sumAbsWeights
    );

    // Calculate max raw sum and max intensity
    const maxRawSum = axisAnalysis.reduce((sum, a) => sum + a.contribution, 0);
    const maxAchievable = Math.min(1.0, Math.max(0, maxRawSum / sumAbsWeights));
    const minAchievable = 0;

    // Identify binding axes
    const bindingAxes = axisAnalysis.filter((a) => a.isBinding);

    // Check gate feasibility
    const gateStatus = this.#checkGateFeasibility(gates, axisConstraints);

    const isReachable = this.#calculateReachability(
      maxAchievable,
      minAchievable,
      threshold,
      comparisonOperator,
      gateStatus.allSatisfiable
    );
    const gap = this.#calculateGap(
      maxAchievable,
      minAchievable,
      threshold,
      comparisonOperator
    );

    // Generate explanation
    const explanation = this.#generateExplanation(
      prototypeId,
      threshold,
      maxAchievable,
      minAchievable,
      bindingAxes,
      gateStatus,
      comparisonOperator
    );

    return {
      prototypeId,
      type,
      operator: comparisonOperator,
      threshold,
      maxAchievable,
      minAchievable,
      isReachable,
      gap,
      weights,
      gates,
      gateStatus,
      bindingAxes,
      axisAnalysis,
      sumAbsWeights,
      requiredRawSum: threshold * sumAbsWeights,
      explanation,
    };
  }

  /**
   * Extract axis constraints from expression prerequisites
   *
   * @param {Array} prerequisites - Expression prerequisites array
   * @returns {Map<string, AxisConstraint>} Axis name -> constraint
   */
  extractAxisConstraints(prerequisites) {
    const constraints = new Map();

    if (!Array.isArray(prerequisites)) {
      return constraints;
    }

    const moodConstraints = extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });

    for (const constraint of moodConstraints) {
      const axis = this.#getAxisFromVarPath(constraint.varPath);
      if (!axis) {
        continue;
      }
      this.#applyConstraint(
        constraints,
        axis,
        constraint.operator,
        constraint.threshold,
        constraint
      );
    }

    return constraints;
  }

  /**
   * Analyze axis contributions given constraints
   *
   * @private
   * @param {object} weights - Prototype weights
   * @param {Map<string, AxisConstraint>} axisConstraints - Axis constraints
   * @returns {BindingAxisInfo[]}
   */
  #analyzeAxisContributions(weights, axisConstraints, sumAbsWeights) {
    const analysis = [];

    for (const [axis, weight] of Object.entries(weights)) {
      const constraint = axisConstraints.get(axis);
      const defaultBounds = this.#getDefaultBounds(axis);

      // Determine constraint bounds (use defaults if no constraint)
      const constraintMin = constraint?.min ?? defaultBounds.min;
      const constraintMax = constraint?.max ?? defaultBounds.max;
      const defaultMin = defaultBounds.min;
      const defaultMax = defaultBounds.max;
      const sources = Array.isArray(constraint?.sources) ? constraint.sources : [];

      let optimalValue;
      let contribution;
      let isBinding = false;
      let conflictType = null;

      if (weight > 0) {
        // Positive weight: want max axis value
        // Optimal is unbounded max (1.0 for mood axes)
        const unbound = defaultMax;
        optimalValue = constraintMax;
        contribution = weight * optimalValue;

        if (constraintMax < unbound) {
          isBinding = true;
          conflictType = 'positive_weight_low_max';
        }
      } else {
        // Negative weight: want min axis value
        // Optimal is unbounded min (-1.0 for mood axes)
        const unbound = defaultMin;
        optimalValue = constraintMin;
        // For negative weight, contribution = weight * optimalValue
        // To maximize, we want the most negative axis value
        contribution = weight * optimalValue;
        // Since weight is negative and we're using min, contribution is positive

        if (constraintMin > unbound) {
          isBinding = true;
          conflictType = 'negative_weight_high_min';
        }
      }

      const absWeight = Math.abs(weight);
      let lostRawSum = 0;
      if (weight > 0) {
        lostRawSum = absWeight * (defaultMax - constraintMax);
      } else if (weight < 0) {
        lostRawSum = absWeight * (constraintMin - defaultMin);
      }
      if (!Number.isFinite(lostRawSum) || lostRawSum < 0) {
        lostRawSum = 0;
      }
      const lostIntensity =
        sumAbsWeights > 0 ? lostRawSum / sumAbsWeights : null;

      analysis.push({
        axis,
        weight,
        constraintMin,
        constraintMax,
        defaultMin,
        defaultMax,
        optimalValue,
        contribution,
        isBinding,
        conflictType,
        lostRawSum,
        lostIntensity,
        sources,
      });
    }

    return analysis;
  }

  /**
   * Check if gate conditions can be satisfied given axis constraints
   *
   * @private
   * @param {string[]} gates - Gate condition strings
   * @param {Map<string, AxisConstraint>} axisConstraints - Axis constraints
   * @returns {object} Gate status information
   */
  #checkGateFeasibility(gates, axisConstraints) {
    const gateResults = [];
    let allSatisfiable = true;

    for (const gateStr of gates) {
      let parsed;
      try {
        parsed = GateConstraint.parse(gateStr);
      } catch (err) {
        gateResults.push({
          gate: gateStr,
          satisfiable: true,
          reason: 'Could not parse gate',
        });
        continue;
      }

      const constraint = axisConstraints.get(parsed.axis);
      const defaultBounds = this.#getDefaultBounds(parsed.axis);
      const constraintMin = constraint?.min ?? defaultBounds.min;
      const constraintMax = constraint?.max ?? defaultBounds.max;

      let satisfiable = true;
      let reason = 'Satisfiable';

      // Check if gate requirement conflicts with axis constraint
      if (parsed.operator === '>=' || parsed.operator === '>') {
        // Gate requires axis >= threshold
        if (constraintMax < parsed.value) {
          satisfiable = false;
          reason = `Constraint max (${constraintMax}) < gate requirement (${parsed.value})`;
        }
      } else if (parsed.operator === '<=' || parsed.operator === '<') {
        // Gate requires axis <= threshold
        if (constraintMin > parsed.value) {
          satisfiable = false;
          reason = `Constraint min (${constraintMin}) > gate requirement (${parsed.value})`;
        }
      } else if (parsed.operator === '==') {
        if (parsed.value < constraintMin || parsed.value > constraintMax) {
          satisfiable = false;
          reason = `Constraint range (${constraintMin}, ${constraintMax}) excludes gate requirement (${parsed.value})`;
        }
      }

      if (!satisfiable) {
        allSatisfiable = false;
      }

      gateResults.push({
        gate: gateStr,
        axis: parsed.axis,
        operator: parsed.operator,
        value: parsed.value,
        satisfiable,
        reason,
      });
    }

    return {
      gates: gateResults,
      allSatisfiable,
      blockingGates: gateResults.filter((g) => !g.satisfiable),
    };
  }

  /**
   * Generate human-readable explanation
   *
   * @param prototypeId
   * @param threshold
   * @param maxAchievable
   * @param minAchievable
   * @param bindingAxes
   * @param gateStatus
   * @param operator
   * @private
   */
  #generateExplanation(
    prototypeId,
    threshold,
    maxAchievable,
    minAchievable,
    bindingAxes,
    gateStatus,
    operator
  ) {
    const parts = [];

    if (operator === '>=' || operator === '>') {
      const meetsThreshold =
        operator === '>' ? maxAchievable > threshold : maxAchievable >= threshold;

      if (meetsThreshold) {
        if (gateStatus.allSatisfiable) {
          parts.push(
            `Threshold ${threshold} is achievable (max: ${maxAchievable.toFixed(3)})`
          );
        } else {
          parts.push(`Intensity ${threshold} is achievable but gates are blocked`);
        }
      } else {
        parts.push(
          `Threshold ${threshold} is NOT achievable (max: ${maxAchievable.toFixed(3)})`
        );
      }
    } else if (operator === '<=' || operator === '<') {
      const meetsThreshold =
        operator === '<' ? minAchievable < threshold : minAchievable <= threshold;
      const alwaysSatisfied =
        operator === '<' ? maxAchievable < threshold : maxAchievable <= threshold;

      if (!meetsThreshold) {
        parts.push(
          `Threshold ${threshold} is NOT achievable (min: ${minAchievable.toFixed(3)})`
        );
      } else if (alwaysSatisfied) {
        if (gateStatus.allSatisfiable) {
          parts.push(
            `Condition always satisfied (max: ${maxAchievable.toFixed(3)} ${operator} ${threshold.toFixed(3)})`
          );
        } else {
          parts.push(
            'Condition always satisfied by axis bounds but gates are blocked'
          );
        }
      } else if (gateStatus.allSatisfiable) {
        parts.push(
          `Threshold ${threshold} is achievable (min: ${minAchievable.toFixed(3)})`
        );
      } else {
        parts.push(`Threshold ${threshold} is achievable but gates are blocked`);
      }
    } else if (maxAchievable >= threshold) {
      parts.push(
        `Threshold ${threshold} is achievable (max: ${maxAchievable.toFixed(3)})`
      );
    } else {
      parts.push(
        `Threshold ${threshold} is NOT achievable (max: ${maxAchievable.toFixed(3)})`
      );
    }

    if (bindingAxes.length > 0) {
      const conflicts = bindingAxes.filter((a) => a.conflictType);
      if (conflicts.length > 0) {
        const conflictDescs = conflicts.map((a) => {
          if (a.conflictType === 'positive_weight_low_max') {
            return `${a.axis} has positive weight (+${a.weight.toFixed(2)}) but constraint limits it to max=${a.constraintMax.toFixed(2)}`;
          } else {
            return `${a.axis} has negative weight (${a.weight.toFixed(2)}) but constraint requires min=${a.constraintMin.toFixed(2)}`;
          }
        });
        parts.push('Binding conflicts: ' + conflictDescs.join('; '));
      }
    }

    if (!gateStatus.allSatisfiable) {
      const blocked = gateStatus.blockingGates.map((g) => g.gate).join(', ');
      parts.push(`Blocked gates: ${blocked}`);
    }

    return parts.join('. ');
  }

  /**
   * Calculate reachability based on operator semantics.
   * @private
   * @param {number} maxAchievable
   * @param {number} minAchievable
   * @param {number} threshold
   * @param {string} operator
   * @param {boolean} gatesPassable
   * @returns {boolean}
   */
  #calculateReachability(
    maxAchievable,
    minAchievable,
    threshold,
    operator,
    gatesPassable
  ) {
    switch (operator) {
      case '>=':
        return gatesPassable && maxAchievable >= threshold;
      case '>':
        return gatesPassable && maxAchievable > threshold;
      case '<=':
        return minAchievable <= threshold;
      case '<':
        return minAchievable < threshold;
      default:
        return gatesPassable && maxAchievable >= threshold;
    }
  }

  /**
   * Calculate gap with operator-appropriate semantics.
   * @private
   * @param {number} maxAchievable
   * @param {number} minAchievable
   * @param {number} threshold
   * @param {string} operator
   * @returns {number}
   */
  #calculateGap(maxAchievable, minAchievable, threshold, operator) {
    switch (operator) {
      case '>=':
      case '>':
        return threshold - maxAchievable;
      case '<=':
      case '<':
        return minAchievable - threshold;
      default:
        return threshold - maxAchievable;
    }
  }

  /**
   * Extract axis constraints from JSON Logic recursively
   *
   * @private
   * @param {object} logic - JSON Logic expression
   * @param {Map} constraints - Accumulated constraints
   */
  #getAxisFromVarPath(varPath) {
    if (typeof varPath !== 'string') {
      return null;
    }
    if (varPath.startsWith('moodAxes.')) {
      return varPath.replace('moodAxes.', '');
    }
    if (varPath.startsWith('mood.')) {
      return varPath.replace('mood.', '');
    }
    return null;
  }

  /**
   * Apply a constraint to the constraints map
   *
   * @param constraints
   * @param axis
   * @param op
   * @param value
   * @private
   */
  #applyConstraint(constraints, axis, op, value, source) {
    if (!constraints.has(axis)) {
      constraints.set(axis, {
        min: this.#getDefaultBounds(axis).min,
        max: this.#getDefaultBounds(axis).max,
        sources: [],
      });
    }

    const current = constraints.get(axis);

    // For mood axes, values are in [-100, 100] range
    // Normalize to [-1, 1] for consistency
    const normalizedValue = Math.abs(value) <= 1 ? value : value / 100;

    if (op === '>=' || op === '>') {
      current.min = Math.max(current.min, normalizedValue);
    } else if (op === '<=' || op === '<') {
      current.max = Math.min(current.max, normalizedValue);
    }

    if (
      source &&
      typeof source.varPath === 'string' &&
      typeof source.operator === 'string' &&
      typeof source.threshold === 'number'
    ) {
      current.sources.push({
        varPath: source.varPath,
        operator: source.operator,
        threshold: source.threshold,
      });
    }
  }

  /**
   * Get prototype from data registry
   *
   * @param prototypeId
   * @param type
   * @private
   */
  #getPrototype(prototypeId, type) {
    const lookupKey =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.getLookupData(lookupKey);
    return lookup?.entries?.[prototypeId] || null;
  }

  /**
   * Get default bounds for an axis
   *
   * @param axis
   * @private
   */
  #getDefaultBounds(axis) {
    // Sexual axes are [0, 1], mood axes are [-1, 1]
    const sexualAxes = [
      'sex_excitation',
      'sex_inhibition',
      'baseline_libido',
      'sexual_arousal',
    ];

    if (sexualAxes.includes(axis)) {
      return { min: 0, max: 1 };
    }

    return { min: -1, max: 1 };
  }

  /**
   * Create result for prototype not found
   *
   * @param prototypeId
   * @param type
   * @param threshold
   * @private
   */
  #createNotFoundResult(prototypeId, type, threshold, operator) {
    const comparisonOperator = operator ?? '>=';
    const minAchievable = 0;
    const maxAchievable = 0;
    const gap = this.#calculateGap(
      maxAchievable,
      minAchievable,
      threshold,
      comparisonOperator
    );
    return {
      prototypeId,
      type,
      operator: comparisonOperator,
      threshold,
      maxAchievable,
      minAchievable,
      isReachable: false,
      gap,
      weights: {},
      gates: [],
      gateStatus: { gates: [], allSatisfiable: true, blockingGates: [] },
      bindingAxes: [],
      axisAnalysis: [],
      sumAbsWeights: 0,
      requiredRawSum: 0,
      explanation: `Prototype '${prototypeId}' not found in ${type} prototypes`,
    };
  }

  /**
   * Create result for zero-weight prototype
   *
   * @param prototypeId
   * @param type
   * @param threshold
   * @param weights
   * @param gates
   * @private
   */
  #createZeroWeightResult(prototypeId, type, threshold, weights, gates, operator) {
    const comparisonOperator = operator ?? '>=';
    const minAchievable = 0;
    const maxAchievable = 0;
    const gateStatus = { gates: [], allSatisfiable: true, blockingGates: [] };
    const isReachable = this.#calculateReachability(
      maxAchievable,
      minAchievable,
      threshold,
      comparisonOperator,
      gateStatus.allSatisfiable
    );
    const gap = this.#calculateGap(
      maxAchievable,
      minAchievable,
      threshold,
      comparisonOperator
    );
    return {
      prototypeId,
      type,
      operator: comparisonOperator,
      threshold,
      maxAchievable,
      minAchievable,
      isReachable,
      gap,
      weights,
      gates,
      gateStatus,
      bindingAxes: [],
      axisAnalysis: [],
      sumAbsWeights: 0,
      requiredRawSum: 0,
      explanation: `Prototype '${prototypeId}' has no weights defined`,
    };
  }
}

export default PrototypeConstraintAnalyzer;
