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

/**
 * @typedef {object} PrototypeAnalysisResult
 * @property {string} prototypeId - The emotion/sexual state ID
 * @property {string} type - 'emotion' or 'sexual'
 * @property {number} threshold - Required threshold value
 * @property {number} maxAchievable - Max intensity achievable given constraints
 * @property {boolean} isReachable - Whether threshold can be reached
 * @property {number} gap - threshold - maxAchievable (positive = unreachable)
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
 * @property {number} optimalValue - Value that maximizes contribution
 * @property {number} contribution - Contribution to raw sum
 * @property {boolean} isBinding - Whether constraint limits optimal value
 * @property {string} conflictType - 'positive_weight_low_max' | 'negative_weight_high_min' | null
 */

/**
 * @typedef {object} AxisConstraint
 * @property {number} min - Minimum allowed value
 * @property {number} max - Maximum allowed value
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
   * @returns {PrototypeAnalysisResult}
   */
  analyzeEmotionThreshold(prototypeId, type, threshold, axisConstraints) {
    const prototype = this.#getPrototype(prototypeId, type);

    if (!prototype) {
      this.#logger.warn(
        `PrototypeConstraintAnalyzer: Prototype not found: ${prototypeId} (${type})`
      );
      return this.#createNotFoundResult(prototypeId, type, threshold);
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
        gates
      );
    }

    // Analyze each axis contribution
    const axisAnalysis = this.#analyzeAxisContributions(
      weights,
      axisConstraints
    );

    // Calculate max raw sum and max intensity
    const maxRawSum = axisAnalysis.reduce((sum, a) => sum + a.contribution, 0);
    const maxAchievable = Math.min(1.0, Math.max(0, maxRawSum / sumAbsWeights));

    // Identify binding axes
    const bindingAxes = axisAnalysis.filter((a) => a.isBinding);

    // Check gate feasibility
    const gateStatus = this.#checkGateFeasibility(gates, axisConstraints);

    // Generate explanation
    const explanation = this.#generateExplanation(
      prototypeId,
      threshold,
      maxAchievable,
      bindingAxes,
      gateStatus
    );

    return {
      prototypeId,
      type,
      threshold,
      maxAchievable,
      isReachable: maxAchievable >= threshold && gateStatus.allSatisfiable,
      gap: threshold - maxAchievable,
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

    for (const prereq of prerequisites) {
      this.#extractConstraintsFromLogic(prereq.logic, constraints);
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
  #analyzeAxisContributions(weights, axisConstraints) {
    const analysis = [];

    for (const [axis, weight] of Object.entries(weights)) {
      const constraint = axisConstraints.get(axis);
      const defaultBounds = this.#getDefaultBounds(axis);

      // Determine constraint bounds (use defaults if no constraint)
      const constraintMin = constraint?.min ?? defaultBounds.min;
      const constraintMax = constraint?.max ?? defaultBounds.max;

      let optimalValue;
      let contribution;
      let isBinding = false;
      let conflictType = null;

      if (weight > 0) {
        // Positive weight: want max axis value
        // Optimal is unbounded max (1.0 for mood axes)
        const unbound = defaultBounds.max;
        optimalValue = constraintMax;
        contribution = weight * optimalValue;

        if (constraintMax < unbound) {
          isBinding = true;
          if (constraintMax < 0) {
            conflictType = 'positive_weight_low_max';
          }
        }
      } else {
        // Negative weight: want min axis value
        // Optimal is unbounded min (-1.0 for mood axes)
        const unbound = defaultBounds.min;
        optimalValue = constraintMin;
        // For negative weight, contribution = weight * optimalValue
        // To maximize, we want the most negative axis value
        contribution = weight * optimalValue;
        // Since weight is negative and we're using min, contribution is positive

        if (constraintMin > unbound) {
          isBinding = true;
          if (constraintMin > 0) {
            conflictType = 'negative_weight_high_min';
          }
        }
      }

      analysis.push({
        axis,
        weight,
        constraintMin,
        constraintMax,
        optimalValue,
        contribution,
        isBinding,
        conflictType,
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
   * @param bindingAxes
   * @param gateStatus
   * @private
   */
  #generateExplanation(
    prototypeId,
    threshold,
    maxAchievable,
    bindingAxes,
    gateStatus
  ) {
    const parts = [];

    if (maxAchievable >= threshold) {
      if (gateStatus.allSatisfiable) {
        parts.push(`Threshold ${threshold} is achievable (max: ${maxAchievable.toFixed(3)})`);
      } else {
        parts.push(
          `Intensity ${threshold} is achievable but gates are blocked`
        );
      }
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
   * Extract axis constraints from JSON Logic recursively
   *
   * @private
   * @param {object} logic - JSON Logic expression
   * @param {Map} constraints - Accumulated constraints
   */
  #extractConstraintsFromLogic(logic, constraints) {
    if (!logic || typeof logic !== 'object') return;

    // Check comparison operators
    for (const op of ['>=', '>', '<=', '<']) {
      if (logic[op]) {
        const [left, right] = logic[op];

        // Check if this is a moodAxes constraint
        if (
          typeof left === 'object' &&
          left.var &&
          left.var.startsWith('moodAxes.')
        ) {
          const axis = left.var.replace('moodAxes.', '');
          const value = typeof right === 'number' ? right : null;

          if (value !== null) {
            this.#applyConstraint(constraints, axis, op, value);
          }
        }
      }
    }

    // Recurse into nested logic
    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        this.#extractConstraintsFromLogic(clause, constraints);
      }
    }
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
  #applyConstraint(constraints, axis, op, value) {
    if (!constraints.has(axis)) {
      constraints.set(axis, {
        min: this.#getDefaultBounds(axis).min,
        max: this.#getDefaultBounds(axis).max,
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
  #createNotFoundResult(prototypeId, type, threshold) {
    return {
      prototypeId,
      type,
      threshold,
      maxAchievable: 0,
      isReachable: false,
      gap: threshold,
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
  #createZeroWeightResult(prototypeId, type, threshold, weights, gates) {
    return {
      prototypeId,
      type,
      threshold,
      maxAchievable: 0,
      isReachable: threshold === 0,
      gap: threshold,
      weights,
      gates,
      gateStatus: { gates: [], allSatisfiable: true, blockingGates: [] },
      bindingAxes: [],
      axisAnalysis: [],
      sumAbsWeights: 0,
      requiredRawSum: 0,
      explanation: `Prototype '${prototypeId}' has no weights defined`,
    };
  }
}

export default PrototypeConstraintAnalyzer;
