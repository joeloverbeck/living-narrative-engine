/**
 * @file GateConstraintAnalyzer - Detects gate conflicts in expression prerequisites
 * @see specs/expression-diagnostics.md Layer A.1
 */

import { AxisInterval, GateConstraint } from '../models/index.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} GateConflict
 * @property {string} axis - The conflicting axis (e.g., 'threat')
 * @property {{min: number, max: number}} required - The impossible interval
 * @property {string[]} prototypes - Names of conflicting prototypes
 * @property {string[]} gates - The conflicting gate strings
 */

/**
 * @typedef {object} GateAnalysisResult
 * @property {boolean} hasConflict - True if any axis has conflicting constraints
 * @property {GateConflict[]} conflicts - List of detected conflicts
 * @property {Map<string, AxisInterval>} axisIntervals - Final intervals per axis
 */

/**
 * Detects gate conflicts in expression prerequisites.
 * Analyzes required emotion/sexual prototypes and identifies cases where
 * their gate constraints are mutually exclusive.
 */
class GateConstraintAnalyzer {
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
   * Analyze an expression for gate conflicts
   *
   * @param {object} expression - Expression with prerequisites
   * @returns {GateAnalysisResult}
   */
  analyze(expression) {
    if (!expression?.prerequisites) {
      return { hasConflict: false, conflicts: [], axisIntervals: new Map() };
    }

    // 1. Extract required prototypes from prerequisites
    const requiredPrototypes = this.#extractRequiredPrototypes(
      expression.prerequisites
    );

    if (requiredPrototypes.length === 0) {
      return { hasConflict: false, conflicts: [], axisIntervals: new Map() };
    }

    // 2. Build consolidated intervals per axis
    const axisIntervals = new Map();
    const gatesByAxis = new Map(); // Track which gates affect each axis

    for (const { prototypeId, type } of requiredPrototypes) {
      const prototype = this.#getPrototype(prototypeId, type);
      if (!prototype?.gates) continue;

      for (const gateStr of prototype.gates) {
        try {
          const gate = GateConstraint.parse(gateStr);
          const axis = gate.axis;

          // Initialize interval if needed
          if (!axisIntervals.has(axis)) {
            axisIntervals.set(axis, this.#getDefaultInterval(axis));
            gatesByAxis.set(axis, []);
          }

          // Apply constraint
          const currentInterval = axisIntervals.get(axis);
          const newInterval = gate.applyTo(currentInterval);
          axisIntervals.set(axis, newInterval);

          // Track gate source
          gatesByAxis.get(axis).push({
            gate: gateStr,
            prototype: prototypeId,
          });
        } catch (err) {
          this.#logger.warn(
            `Failed to parse gate "${gateStr}": ${err.message}`
          );
        }
      }
    }

    // 3. Check for empty intervals (conflicts)
    const conflicts = [];

    for (const [axis, interval] of axisIntervals) {
      if (interval.isEmpty()) {
        const sources = gatesByAxis.get(axis) || [];
        conflicts.push({
          axis,
          required: interval.toJSON(),
          prototypes: [...new Set(sources.map((s) => s.prototype))],
          gates: sources.map((s) => s.gate),
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
      axisIntervals,
    };
  }

  /**
   * Extract emotion/sexual state requirements from prerequisites
   *
   * Only returns prototypes that MUST be active (gates must pass).
   * Prototypes with ceiling constraints (<=, <) that can be satisfied by
   * gate failure (emotion = 0) are excluded because their gates don't need
   * to constrain the axis intervals.
   *
   * @private
   * @param {Array} prerequisites - Expression prerequisites
   * @returns {Array<{prototypeId: string, type: string}>}
   */
  #extractRequiredPrototypes(prerequisites) {
    // First pass: collect all floor and ceiling constraints
    const floorConstraints = new Map(); // prototypeKey -> {prototypeId, type}
    const ceilingConstraints = new Set(); // prototypeKey

    for (const prereq of prerequisites) {
      this.#extractConstraintsFromLogic(
        prereq.logic,
        floorConstraints,
        ceilingConstraints
      );
    }

    // Second pass: filter out prototypes that have ceiling constraints
    // Rationale: If emotion <= X (where X >= 0), then gate failure makes
    // emotion = 0, which satisfies the ceiling constraint. Therefore,
    // the emotion's gates don't need to be applied to constrain axis intervals.
    const required = [];

    for (const [key, prototype] of floorConstraints) {
      if (!ceilingConstraints.has(key)) {
        required.push(prototype);
      }
    }

    return required;
  }

  /**
   * Recursively extract prototype references from JSON Logic,
   * categorizing them as floor (>=) or ceiling (<=, <) constraints.
   *
   * @private
   * @param {object} logic - JSON Logic expression
   * @param {Map} floorConstraints - Floor constraints (>= threshold)
   * @param {Set} ceilingConstraints - Ceiling constraints (<= or < threshold)
   */
  #extractConstraintsFromLogic(logic, floorConstraints, ceilingConstraints) {
    if (!logic || typeof logic !== 'object') return;

    // Check for >= comparisons (floor constraints)
    if (logic['>=']) {
      const [left] = logic['>='];
      if (typeof left === 'object' && left.var) {
        const varPath = left.var;
        const parsed = this.#parsePrototypeVar(varPath);
        if (parsed) {
          const key = `${parsed.type}:${parsed.prototypeId}`;
          if (!floorConstraints.has(key)) {
            floorConstraints.set(key, parsed);
          }
        }
      }
    }

    // Check for <= comparisons (ceiling constraints)
    if (logic['<=']) {
      const [left, right] = logic['<='];
      if (typeof left === 'object' && left.var) {
        const varPath = left.var;
        const parsed = this.#parsePrototypeVar(varPath);
        if (parsed && typeof right === 'number' && right >= 0) {
          // Ceiling constraint with non-negative threshold
          // Gate failure (emotion = 0) satisfies this
          const key = `${parsed.type}:${parsed.prototypeId}`;
          ceilingConstraints.add(key);
        }
      }
    }

    // Check for < comparisons (strict ceiling constraints)
    if (logic['<']) {
      const [left, right] = logic['<'];
      if (typeof left === 'object' && left.var) {
        const varPath = left.var;
        const parsed = this.#parsePrototypeVar(varPath);
        if (parsed && typeof right === 'number' && right > 0) {
          // Strict ceiling constraint with positive threshold
          // Gate failure (emotion = 0) satisfies this
          const key = `${parsed.type}:${parsed.prototypeId}`;
          ceilingConstraints.add(key);
        }
      }
    }

    // Recurse into nested logic
    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        this.#extractConstraintsFromLogic(clause, floorConstraints, ceilingConstraints);
      }
    }
  }

  /**
   * Parse a var path to extract prototype info if it's an emotion or sexual state
   *
   * @private
   * @param {string} varPath - Variable path like 'emotions.jealousy'
   * @returns {{prototypeId: string, type: string}|null}
   */
  #parsePrototypeVar(varPath) {
    if (varPath.startsWith('emotions.')) {
      return {
        prototypeId: varPath.replace('emotions.', ''),
        type: 'emotion',
      };
    } else if (varPath.startsWith('sexualStates.')) {
      return {
        prototypeId: varPath.replace('sexualStates.', ''),
        type: 'sexual',
      };
    }
    return null;
  }

  /**
   * Get prototype definition from dataRegistry
   *
   * @private
   * @param {string} prototypeId - Prototype identifier
   * @param {string} type - 'emotion' or 'sexual'
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
   * @param {string} axis - Axis name
   * @returns {AxisInterval}
   */
  #getDefaultInterval(axis) {
    // Sexual axes have [0, 1] range
    const sexualAxes = [
      'sex_excitation',
      'sex_inhibition',
      'baseline_libido',
      'sexual_arousal',
    ];
    if (sexualAxes.includes(axis)) {
      return AxisInterval.forSexualAxis();
    }

    // Mood axes have [-1, 1] range (normalized)
    return AxisInterval.forMoodAxis();
  }
}

export default GateConstraintAnalyzer;
