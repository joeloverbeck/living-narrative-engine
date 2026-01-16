/**
 * @file GateEvaluator.js
 * @description Evaluates gate constraints, prototype compatibility, and gate clamp regime planning
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import GateConstraint from '../../models/GateConstraint.js';
import AxisInterval from '../../models/AxisInterval.js';
import { resolveAxisValue } from '../../utils/axisNormalizationUtils.js';
import { MOOD_AXES, AFFECT_TRAITS } from '../../../constants/moodAffectConstants.js';

const SEXUAL_AXIS_NAMES = new Set([
  'sex_excitation',
  'sex_inhibition',
  'sexual_inhibition',
  'baseline_libido',
]);

const MOOD_AXIS_NAMES = new Set(MOOD_AXES);
const AFFECT_TRAIT_NAMES = new Set(AFFECT_TRAITS);

const DERIVED_AXIS_RAW_SCALES = new Map([['sexual_arousal', 1]]);

class GateEvaluator {
  // Logger reserved for future debug output
  // eslint-disable-next-line no-unused-private-class-members
  #_logger;
  #dataRegistry;
  #contextBuilder;

  /**
   * @param {object} deps
   * @param {import('../../../interfaces/ILogger.js').ILogger} deps.logger
   * @param {import('../../../interfaces/IDataRegistry.js').IDataRegistry} deps.dataRegistry
   * @param {object} deps.contextBuilder - Context builder for normalizeGateContext
   */
  constructor({ logger, dataRegistry, contextBuilder }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(contextBuilder, 'IMonteCarloContextBuilder', logger, {
      requiredMethods: ['normalizeGateContext'],
    });

    this.#_logger = logger;
    this.#dataRegistry = dataRegistry;
    this.#contextBuilder = contextBuilder;
  }

  /**
   * Build a gate clamp regime plan from expression prerequisites.
   *
   * @param {object} expression - The expression with prerequisites
   * @param {Array|null} clauseTracking - Clause tracking data with hierarchical trees
   * @param {(logic: object, prefix: string) => object} buildTreeFn - Function to build hierarchical tree
   * @returns {{trackedGateAxes: string[], clauseGateMap: object}}
   */
  buildGateClampRegimePlan(expression, clauseTracking, buildTreeFn) {
    const clauseGateMap = {};
    const trackedGateAxes = new Set();

    if (!expression?.prerequisites || expression.prerequisites.length === 0) {
      return { trackedGateAxes: [], clauseGateMap };
    }

    const trees = clauseTracking
      ? clauseTracking
          .map((clause) => clause.hierarchicalTree)
          .filter(Boolean)
      : expression.prerequisites.map((prereq, index) =>
          buildTreeFn(prereq.logic, `${index}`)
        );

    for (const tree of trees) {
      this.#collectGatePlanLeaves(tree, clauseGateMap, trackedGateAxes);
    }

    return {
      trackedGateAxes: [...trackedGateAxes].sort((a, b) => a.localeCompare(b)),
      clauseGateMap,
    };
  }

  /**
   * Check if gates pass for given normalized axes.
   *
   * @param {Array<string>} gates - Gate constraint strings
   * @param {object} normalizedAxes - Normalized axis values
   * @returns {boolean} True if all gates pass
   */
  checkGates(gates, normalizedAxes) {
    if (!gates || !Array.isArray(gates) || gates.length === 0) return true;

    for (const gate of gates) {
      let constraint;
      try {
        constraint = GateConstraint.parse(gate);
      } catch {
        continue;
      }

      const axisValue = normalizedAxes[constraint.axis];
      if (axisValue === undefined) continue;

      if (!constraint.isSatisfiedBy(axisValue)) return false;
    }
    return true;
  }

  /**
   * Check prototype compatibility with mood regime constraints.
   *
   * @param {string} prototypeId - Prototype identifier
   * @param {'emotion'|'sexual'} type - Prototype type
   * @param {Map<string, AxisInterval>} axisIntervals - Constrained axis intervals
   * @returns {{compatible: boolean, reason: string|null}}
   */
  checkPrototypeCompatibility(prototypeId, type, axisIntervals) {
    const prototype = this.#getPrototype(prototypeId, type);
    if (!prototype) {
      return { compatible: false, reason: 'prototype not found' };
    }

    const gates = Array.isArray(prototype.gates) ? prototype.gates : [];
    if (gates.length === 0) {
      return { compatible: true, reason: null };
    }

    for (const gateStr of gates) {
      let constraint;
      try {
        constraint = GateConstraint.parse(gateStr);
      } catch {
        continue;
      }

      const interval =
        axisIntervals.get(constraint.axis) ??
        this.#getDefaultIntervalForAxis(constraint.axis);
      const constrained = constraint.applyTo(interval);
      if (constrained.isEmpty()) {
        const reason = `gate "${gateStr}" conflicts with mood regime ${constraint.axis} in [${interval.min}, ${interval.max}]`;
        return { compatible: false, reason };
      }
    }

    return { compatible: true, reason: null };
  }

  /**
   * Compute gate compatibility for all referenced prototypes against mood constraints.
   *
   * @param {object} expression - Expression to analyze
   * @param {Array} moodConstraints - Mood regime constraints
   * @param {(prerequisites: Array) => {emotions: string[], sexualStates: string[]}} extractRefsFn - Function to extract prototype references
   * @returns {{emotions: object, sexualStates: object}}
   */
  computeGateCompatibility(expression, moodConstraints, extractRefsFn) {
    const references = extractRefsFn(expression?.prerequisites);
    const axisIntervals = this.buildAxisIntervalsFromMoodConstraints(
      moodConstraints
    );

    const result = { emotions: {}, sexualStates: {} };

    for (const prototypeId of references.emotions) {
      result.emotions[prototypeId] = this.checkPrototypeCompatibility(
        prototypeId,
        'emotion',
        axisIntervals
      );
    }

    for (const prototypeId of references.sexualStates) {
      result.sexualStates[prototypeId] = this.checkPrototypeCompatibility(
        prototypeId,
        'sexual',
        axisIntervals
      );
    }

    return result;
  }

  /**
   * Evaluate gate pass against normalized axes with moodAxes, sexualAxes, traitAxes.
   *
   * @param {Array<string>} gates - Gate constraint strings
   * @param {{moodAxes: object, sexualAxes: object, traitAxes: object}} normalized - Normalized axis values
   * @returns {boolean} True if all gates pass
   */
  evaluateGatePass(gates, normalized) {
    if (!gates || !Array.isArray(gates) || gates.length === 0) {
      return true;
    }

    for (const gate of gates) {
      let constraint;
      try {
        constraint = GateConstraint.parse(gate);
      } catch {
        continue;
      }

      const axisValue = resolveAxisValue(
        constraint.axis,
        normalized.moodAxes,
        normalized.sexualAxes,
        normalized.traitAxes
      );

      if (!constraint.isSatisfiedBy(axisValue)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Resolve gate target from a variable path.
   *
   * @param {string} variablePath - Variable path like "emotions.joy" or "sexualStates.aroused"
   * @returns {{prototypeId: string, usePrevious: boolean, type: 'emotion'|'sexual'}|null}
   */
  resolveGateTarget(variablePath) {
    if (!variablePath || typeof variablePath !== 'string') {
      return null;
    }

    if (variablePath.startsWith('emotions.')) {
      return {
        prototypeId: variablePath.slice('emotions.'.length),
        usePrevious: false,
        type: 'emotion',
      };
    }

    if (variablePath.startsWith('previousEmotions.')) {
      return {
        prototypeId: variablePath.slice('previousEmotions.'.length),
        usePrevious: true,
        type: 'emotion',
      };
    }

    if (variablePath.startsWith('sexualStates.')) {
      return {
        prototypeId: variablePath.slice('sexualStates.'.length),
        usePrevious: false,
        type: 'sexual',
      };
    }

    if (variablePath.startsWith('previousSexualStates.')) {
      return {
        prototypeId: variablePath.slice('previousSexualStates.'.length),
        usePrevious: true,
        type: 'sexual',
      };
    }

    return null;
  }

  /**
   * Resolve gate context with caching support.
   *
   * @param {object|null} gateContextCache - Cache object for context
   * @param {object} context - Evaluation context
   * @param {boolean} usePrevious - Whether to use previous state
   * @returns {object|null} Normalized gate context
   */
  resolveGateContext(gateContextCache, context, usePrevious) {
    if (!context) {
      return null;
    }

    if (gateContextCache) {
      if (usePrevious) {
        if (!gateContextCache.previous) {
          gateContextCache.previous = this.#contextBuilder.normalizeGateContext(
            context,
            true
          );
        }
        return gateContextCache.previous;
      }

      if (!gateContextCache.current) {
        gateContextCache.current = this.#contextBuilder.normalizeGateContext(
          context,
          false
        );
      }
      return gateContextCache.current;
    }

    return this.#contextBuilder.normalizeGateContext(context, usePrevious);
  }

  /**
   * Record gate outcome if the node is a gated leaf clause.
   *
   * @param {object} node - Hierarchical clause node
   * @param {object} context - Evaluation context
   * @param {boolean} clausePassed - Whether the clause passed
   * @param {boolean} inRegime - Whether in mood regime
   * @param {object|null} gateContextCache - Gate context cache
   * @param {(target: object, moodAxes: object, sexualAxes: object, traitAxes: object) => object} evalSampleFn - Prototype sample evaluator
   */
  recordGateOutcomeIfApplicable(
    node,
    context,
    clausePassed,
    inRegime,
    gateContextCache,
    evalSampleFn
  ) {
    if (!node || node.nodeType !== 'leaf') {
      return;
    }

    const gateTarget = this.resolveGateTarget(node.variablePath);
    if (!gateTarget) {
      return;
    }

    const prototype = this.#getPrototype(gateTarget.prototypeId, gateTarget.type);
    if (!prototype) {
      return;
    }

    const normalizedContext = this.resolveGateContext(
      gateContextCache,
      context,
      gateTarget.usePrevious
    );
    if (!normalizedContext) {
      return;
    }

    const evaluation = evalSampleFn(
      {
        weights: prototype.weights ?? null,
        gates: Array.isArray(prototype.gates) ? prototype.gates : null,
      },
      normalizedContext.moodAxes ?? {},
      normalizedContext.sexualAxes ?? {},
      normalizedContext.traitAxes ?? {}
    );

    node.recordGateEvaluation(evaluation.gatePass, clausePassed, inRegime);

    if (
      node.comparisonOperator === '>=' &&
      typeof node.thresholdValue === 'number'
    ) {
      const rawPass = evaluation.rawValue >= node.thresholdValue;
      node.recordLostPassInRegime(rawPass, clausePassed, inRegime);
    }
  }

  /**
   * Denormalize a gate threshold from normalized (0-1) to raw scale.
   *
   * @param {string} axis - Axis name
   * @param {number} value - Normalized value
   * @returns {number|null} Raw threshold value or null if axis unknown
   */
  denormalizeGateThreshold(axis, value) {
    const scale = this.#getGateAxisRawScale(axis);
    if (typeof scale !== 'number') {
      return null;
    }
    return value * scale;
  }

  /**
   * Build axis intervals from mood constraints.
   *
   * @param {Array} moodConstraints - Mood regime constraints
   * @returns {Map<string, AxisInterval>} Constrained axis intervals
   */
  buildAxisIntervalsFromMoodConstraints(moodConstraints) {
    const intervals = new Map();
    for (const constraint of moodConstraints || []) {
      const axis = constraint.varPath
        .replace('moodAxes.', '')
        .replace('mood.', '');
      const normalizedValue = this.#normalizeMoodAxisValue(constraint.threshold);
      const current =
        intervals.get(axis) ?? this.#getDefaultIntervalForAxis(axis);
      const updated = current.applyConstraint(
        constraint.operator,
        normalizedValue
      );
      intervals.set(axis, updated);
    }
    return intervals;
  }

  /**
   * Get raw scale for gate axis.
   *
   * @param {string} axis - Axis name
   * @returns {number|null} Scale factor or null if unknown
   */
  #getGateAxisRawScale(axis) {
    if (DERIVED_AXIS_RAW_SCALES.has(axis)) {
      return DERIVED_AXIS_RAW_SCALES.get(axis);
    }
    if (MOOD_AXIS_NAMES.has(axis)) {
      return 100;
    }
    if (AFFECT_TRAIT_NAMES.has(axis)) {
      return 100;
    }
    if (SEXUAL_AXIS_NAMES.has(axis)) {
      return 100;
    }
    return null;
  }

  /**
   * Get default interval for an axis.
   *
   * @param {string} axis - Axis name
   * @returns {AxisInterval} Default interval for the axis
   */
  #getDefaultIntervalForAxis(axis) {
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
   * Normalize mood axis value to 0-1 range.
   *
   * @param {number} value - Raw mood axis value (-100 to 100)
   * @returns {number} Normalized value (0 to 1)
   */
  #normalizeMoodAxisValue(value) {
    return value / 100;
  }

  /**
   * Collect gate plan leaves from a hierarchical tree node.
   *
   * @param {object} node - Hierarchical clause node
   * @param {object} clauseGateMap - Map of clause IDs to gate info
   * @param {Set<string>} trackedGateAxes - Set of tracked gate axes
   */
  #collectGatePlanLeaves(node, clauseGateMap, trackedGateAxes) {
    if (!node) {
      return;
    }

    if (node.nodeType !== 'leaf') {
      for (const child of node.children || []) {
        this.#collectGatePlanLeaves(child, clauseGateMap, trackedGateAxes);
      }
      return;
    }

    const clauseId = node.clauseId;
    if (!clauseId) {
      return;
    }

    const gateTarget = this.resolveGateTarget(node.variablePath);
    if (!gateTarget) {
      return;
    }

    const prototype = this.#getPrototype(gateTarget.prototypeId, gateTarget.type);
    if (!prototype) {
      return;
    }

    const gates = Array.isArray(prototype.gates) ? prototype.gates : [];
    if (gates.length === 0) {
      return;
    }

    const gatePredicates = [];
    for (const gateStr of gates) {
      let constraint;
      try {
        constraint = GateConstraint.parse(gateStr);
      } catch {
        continue;
      }

      const thresholdRaw = this.denormalizeGateThreshold(
        constraint.axis,
        constraint.value
      );
      gatePredicates.push({
        axis: constraint.axis,
        operator: constraint.operator,
        thresholdNormalized: constraint.value,
        thresholdRaw,
      });
      trackedGateAxes.add(constraint.axis);
    }

    if (gatePredicates.length === 0) {
      return;
    }

    clauseGateMap[clauseId] = {
      prototypeId: gateTarget.prototypeId,
      type: gateTarget.type,
      usePrevious: gateTarget.usePrevious,
      gatePredicates,
    };
  }

  /**
   * Get prototype from data registry.
   *
   * @param {string} prototypeId - Prototype identifier
   * @param {'emotion'|'sexual'} type - Prototype type
   * @returns {object|null} Prototype data or null if not found
   */
  #getPrototype(prototypeId, type) {
    const lookupId =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.get('lookups', lookupId);
    return lookup?.entries?.[prototypeId] || null;
  }
}

export default GateEvaluator;
