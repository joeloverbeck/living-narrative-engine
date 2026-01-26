/**
 * @file PrototypeGateAlignmentAnalyzer - Detects structural contradictions between
 * expression mood regimes (AND-only constraints) and emotion prototype gates.
 * @see PrototypeConstraintAnalyzer.js
 * @see moodRegimeUtils.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { extractMoodConstraints } from '../utils/moodRegimeUtils.js';
import AxisInterval from '../models/AxisInterval.js';
import GateConstraint from '../models/GateConstraint.js';

/**
 * @typedef {object} GateContradiction
 * @property {string} emotionId - The emotion prototype ID (e.g., 'anger')
 * @property {string} axis - The axis name where contradiction was found
 * @property {object} regime - The regime interval bounds
 * @property {number} regime.min - Regime minimum bound
 * @property {number} regime.max - Regime maximum bound
 * @property {object} gate - The gate constraint bounds
 * @property {number} gate.min - Gate minimum bound
 * @property {number} gate.max - Gate maximum bound
 * @property {string} gateString - Original gate string for debugging
 * @property {number} distance - Distance between non-overlapping intervals
 * @property {'critical' | 'info'} severity - Severity level
 */

/**
 * @typedef {object} AlignmentAnalysisResult
 * @property {GateContradiction[]} contradictions - Detected contradictions
 * @property {Array} tightPassages - Placeholder for future use
 * @property {boolean} hasIssues - Whether any issues were detected
 */

/**
 * Analyzes structural alignment between expression mood regimes and emotion prototype gates.
 * Detects contradictions where AND-only constraints make prototype gates unsatisfiable.
 */
class PrototypeGateAlignmentAnalyzer {
  /** @type {object} Data registry for prototype lookups */
  #dataRegistry;

  /** @type {object} Logger instance */
  #logger;

  /**
   * Creates a new PrototypeGateAlignmentAnalyzer.
   *
   * @param {object} deps - Dependencies object
   * @param {object} deps.dataRegistry - IDataRegistry for prototype lookups
   * @param {object} deps.logger - ILogger instance
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
   * Analyze alignment between mood regime constraints and emotion prototype gates.
   *
   * @param {Array} prerequisites - Expression prerequisites containing mood constraints
   * @param {Array<{type: string, id: string, operator: string, threshold: number}>} emotionConditions
   *   - Emotion conditions to analyze
   * @returns {AlignmentAnalysisResult} Analysis result with contradictions and issues
   */
  analyze(prerequisites, emotionConditions) {
    // Invariant #1, #2: Return empty for missing/empty inputs
    if (
      !Array.isArray(prerequisites) ||
      prerequisites.length === 0 ||
      !Array.isArray(emotionConditions) ||
      emotionConditions.length === 0
    ) {
      return {
        contradictions: [],
        tightPassages: [],
        hasIssues: false,
      };
    }

    // Extract regime bounds from AND-only constraints
    const regimeBounds = this.#extractRegimeBounds(prerequisites);

    // Analyze each emotion condition's prototype gates
    const contradictions = this.#analyzePrototypeGates(
      emotionConditions,
      regimeBounds
    );

    return {
      contradictions,
      tightPassages: [], // Placeholder for future implementation
      hasIssues: contradictions.length > 0,
    };
  }

  /**
   * Extract regime bounds from AND-only mood constraints.
   *
   * @private
   * @param {Array} prerequisites - Expression prerequisites
   * @returns {Map<string, AxisInterval>} Map of axis name to interval
   */
  #extractRegimeBounds(prerequisites) {
    const bounds = new Map();

    const moodConstraints = extractMoodConstraints(prerequisites, {
      includeMoodAlias: true,
      andOnly: true,
    });

    for (const constraint of moodConstraints) {
      const axis = this.#getAxisFromVarPath(constraint.varPath);
      if (!axis) {
        continue;
      }

      // Get or create interval for this axis
      let interval = bounds.get(axis);
      if (!interval) {
        interval = this.#getDefaultInterval(axis);
      }

      // Normalize threshold value if necessary (values > 1 are raw [-100,100])
      const normalizedValue =
        Math.abs(constraint.threshold) <= 1
          ? constraint.threshold
          : constraint.threshold / 100;

      // Apply constraint to tighten interval
      interval = interval.applyConstraint(
        constraint.operator,
        normalizedValue
      );
      bounds.set(axis, interval);
    }

    return bounds;
  }

  /**
   * Analyze prototype gates against regime bounds.
   *
   * @private
   * @param {Array} emotionConditions - Emotion conditions to analyze
   * @param {Map<string, AxisInterval>} regimeBounds - Regime bounds by axis
   * @returns {GateContradiction[]} Array of detected contradictions
   */
  #analyzePrototypeGates(emotionConditions, regimeBounds) {
    const contradictions = [];

    for (const condition of emotionConditions) {
      if (condition.type !== 'emotion') {
        continue;
      }

      const emotionId = condition.id;
      const prototype = this.#getPrototype(emotionId);

      // Invariant #9: Tolerate missing/null prototype gracefully
      if (!prototype) {
        this.#logger.debug(
          `PrototypeGateAlignmentAnalyzer: Prototype not found: ${emotionId}`
        );
        continue;
      }

      const gates = prototype.gates || [];

      // Check each gate for contradiction
      for (const gateStr of gates) {
        const contradiction = this.#checkGateContradiction(
          emotionId,
          gateStr,
          regimeBounds
        );
        if (contradiction) {
          contradictions.push(contradiction);
        }
      }
    }

    return contradictions;
  }

  /**
   * Check if a single gate contradicts regime bounds.
   *
   * @private
   * @param {string} emotionId - Emotion prototype ID
   * @param {string} gateStr - Gate condition string
   * @param {Map<string, AxisInterval>} regimeBounds - Regime bounds by axis
   * @returns {GateContradiction | null} Contradiction object or null if no contradiction
   */
  #checkGateContradiction(emotionId, gateStr, regimeBounds) {
    let parsed;
    try {
      parsed = GateConstraint.parse(gateStr);
    } catch (err) {
      this.#logger.debug(
        `PrototypeGateAlignmentAnalyzer: Could not parse gate "${gateStr}": ${err.message}`
      );
      return null;
    }

    const axis = parsed.axis;

    // Get regime interval for this axis (or default if no constraint)
    const regimeInterval =
      regimeBounds.get(axis) || this.#getDefaultInterval(axis);

    // Convert gate to interval based on operator
    const gateInterval = this.#gateToInterval(parsed);

    // Invariant #3: Check intersection
    const intersection = regimeInterval.intersect(gateInterval);

    if (intersection !== null) {
      // Intervals overlap - no contradiction
      return null;
    }

    // Invariant #4, #5: Calculate distance between non-overlapping intervals
    const distance = this.#calculateDistance(regimeInterval, gateInterval);

    // Invariant #6: Determine severity
    const severity = distance > 0 ? 'critical' : 'info';

    return {
      emotionId,
      axis,
      regime: {
        min: regimeInterval.min,
        max: regimeInterval.max,
      },
      gate: {
        min: gateInterval.min,
        max: gateInterval.max,
      },
      gateString: gateStr,
      distance,
      severity,
    };
  }

  /**
   * Convert a gate constraint to an interval representing satisfiable values.
   *
   * @private
   * @param {GateConstraint} gate - Parsed gate constraint
   * @returns {AxisInterval} Interval of values satisfying the gate
   */
  #gateToInterval(gate) {
    const defaultInterval = this.#getDefaultInterval(gate.axis);

    // Apply gate constraint to get interval of satisfiable values
    return defaultInterval.applyConstraint(gate.operator, gate.value);
  }

  /**
   * Calculate distance between two non-overlapping intervals.
   *
   * @private
   * @param {AxisInterval} interval1 - First interval
   * @param {AxisInterval} interval2 - Second interval
   * @returns {number} Non-negative distance (Invariant #5)
   */
  #calculateDistance(interval1, interval2) {
    // If interval1 is entirely below interval2
    if (interval1.max < interval2.min) {
      return interval2.min - interval1.max;
    }

    // If interval1 is entirely above interval2
    if (interval1.min > interval2.max) {
      return interval1.min - interval2.max;
    }

    // Overlapping (shouldn't happen if called correctly)
    return 0;
  }

  /**
   * Get default interval based on axis type.
   * Invariant #7: Correct normalization for axis types.
   *
   * @private
   * @param {string} axis - Axis name
   * @returns {AxisInterval} Default interval for the axis type
   */
  #getDefaultInterval(axis) {
    const sexualAxes = new Set([
      'sex_excitation',
      'sex_inhibition',
      'baseline_libido',
      'sexual_arousal',
    ]);

    // Invariant #7: Sexual axes use [0,1], mood axes use [-1,1]
    if (sexualAxes.has(axis)) {
      return AxisInterval.forSexualAxis(); // [0, 1]
    }

    return AxisInterval.forMoodAxis(); // [-1, 1]
  }

  /**
   * Extract axis name from var path.
   *
   * @private
   * @param {string} varPath - Variable path from mood constraint
   * @returns {string | null} Axis name or null if not a valid path
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
   * Get emotion prototype from data registry.
   *
   * @private
   * @param {string} emotionId - Emotion prototype ID
   * @returns {object | null} Prototype object or null if not found
   */
  #getPrototype(emotionId) {
    const lookup = this.#dataRegistry.getLookupData('core:emotion_prototypes');
    return lookup?.entries?.[emotionId] || null;
  }
}

export default PrototypeGateAlignmentAnalyzer;
