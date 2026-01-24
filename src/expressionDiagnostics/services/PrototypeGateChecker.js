/**
 * @file Gate evaluation service for prototype fit analysis
 */

import GateConstraint from '../models/GateConstraint.js';
import { resolveAxisValue } from '../utils/axisNormalizationUtils.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

class PrototypeGateChecker {
  #logger;
  #contextAxisNormalizer;
  #prototypeConstraintAnalyzer;

  /**
   * Create a gate checker with normalized axis access.
   *
   * @param {object} deps - Dependency container.
   * @param {object} deps.logger - ILogger instance.
   * @param {object} deps.contextAxisNormalizer - IContextAxisNormalizer instance.
   * @param {object|null} [deps.prototypeConstraintAnalyzer] - Optional IPrototypeConstraintAnalyzer.
   */
  constructor({ logger, contextAxisNormalizer, prototypeConstraintAnalyzer = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(contextAxisNormalizer, 'IContextAxisNormalizer', logger, {
      requiredMethods: ['filterToMoodRegime', 'normalizeConstraints', 'getNormalizedAxes'],
    });
    this.#logger = logger;
    this.#contextAxisNormalizer = contextAxisNormalizer;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
    if (this.#prototypeConstraintAnalyzer) {
      validateDependency(
        this.#prototypeConstraintAnalyzer,
        'IPrototypeConstraintAnalyzer',
        logger,
        {
          requiredMethods: ['analyzeEmotionThreshold'],
        }
      );
    }
  }

  /**
   * Check if all gates pass for a context.
   *
   * @param {string[]} gates - Gate strings to evaluate.
   * @param {object} ctx - Context to evaluate.
   * @returns {boolean} True when all gates are satisfied.
   */
  checkAllGatesPass(gates, ctx) {
    const normalized = this.#contextAxisNormalizer.getNormalizedAxes(ctx);
    for (const gateStr of gates) {
      let parsed;
      try {
        parsed = GateConstraint.parse(gateStr);
      } catch {
        continue;
      }

      const value = resolveAxisValue(
        parsed.axis,
        normalized.moodAxes,
        normalized.sexualAxes,
        normalized.traitAxes
      );
      if (!parsed.isSatisfiedBy(value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Pre-parse gate strings into GateConstraint objects for reuse.
   * Use this to avoid parsing the same gates repeatedly across many contexts.
   *
   * @param {string[]} gates - Gate strings to parse.
   * @returns {GateConstraint[]} Array of successfully parsed constraints.
   */
  preParseGates(gates) {
    if (!gates || gates.length === 0) {
      return [];
    }
    const parsed = [];
    for (const gateStr of gates) {
      try {
        parsed.push(GateConstraint.parse(gateStr));
      } catch {
        // Skip invalid gates (consistent with checkAllGatesPass behavior)
      }
    }
    return parsed;
  }

  /**
   * Check gates using pre-parsed constraints against pre-normalized axes.
   * This is the optimized hot path for batch evaluation.
   *
   * @param {GateConstraint[]} parsedGates - Pre-parsed gate constraints.
   * @param {{moodAxes: object, sexualAxes: object, traitAxes: object}} normalizedAxes - Pre-normalized context axes.
   * @returns {boolean} True when all gates are satisfied.
   */
  checkParsedGatesPass(parsedGates, normalizedAxes) {
    for (const constraint of parsedGates) {
      const value = resolveAxisValue(
        constraint.axis,
        normalizedAxes.moodAxes,
        normalizedAxes.sexualAxes,
        normalizedAxes.traitAxes
      );
      if (!constraint.isSatisfiedBy(value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Compute fraction of contexts passing all gates.
   *
   * @param {{gates: string[]}} proto - Prototype with gate strings.
   * @param {Array<object>} contexts - Sampled contexts to evaluate.
   * @returns {number} Pass rate for all gates.
   */
  computeGatePassRate(proto, contexts) {
    if (!contexts || contexts.length === 0) return 0;
    if (!proto.gates || proto.gates.length === 0) return 1;

    let passCount = 0;
    for (const ctx of contexts) {
      if (this.checkAllGatesPass(proto.gates, ctx)) {
        passCount++;
      }
    }

    return passCount / contexts.length;
  }

  /**
   * Check if prototype gates are compatible with the mood regime constraints.
   *
   * @param {object} proto - Prototype metadata including id/type.
   * @param {Map<string, {min: number, max: number}>} axisConstraints - Axis constraints to validate.
   * @param {number} threshold - Threshold used in compatibility analysis.
   * @returns {{compatible: boolean, reason: string|null}|null} Compatibility result or null.
   */
  getGateCompatibility(proto, axisConstraints, threshold) {
    if (!this.#prototypeConstraintAnalyzer) {
      return null;
    }

    try {
      const analysis =
        this.#prototypeConstraintAnalyzer.analyzeEmotionThreshold(
          proto.id,
          proto.type,
          threshold,
          axisConstraints,
          '>='
        );
      const blocking = analysis.gateStatus?.blockingGates ?? [];
      return {
        compatible: analysis.gateStatus?.allSatisfiable ?? true,
        reason: blocking.length > 0 ? blocking[0].reason : null,
      };
    } catch (err) {
      this.#logger.warn(
        `PrototypeGateChecker: Gate compatibility check failed for ${proto.id}: ${err.message}`
      );
      return null;
    }
  }

  /**
   * Infer gate ranges from axis constraints.
   *
   * @param {Map<string, {min: number, max: number}>} constraints - Axis constraints.
   * @returns {object} Axis-to-range map for distance comparisons.
   */
  inferGatesFromConstraints(constraints) {
    const gates = {};
    for (const [axis, constraint] of constraints) {
      gates[axis] = {
        min: constraint.min,
        max: constraint.max,
      };
    }
    return gates;
  }

  /**
   * Compute gate compatibility distance.
   *
   * @param {object} desiredGates - Desired axis ranges.
   * @param {string[]} protoGates - Prototype gate strings.
   * @returns {number} Normalized conflict score.
   */
  computeGateDistance(desiredGates, protoGates) {
    if (!protoGates || protoGates.length === 0) return 0;

    let conflicts = 0;
    let total = Object.keys(desiredGates).length;

    for (const [axis, desired] of Object.entries(desiredGates)) {
      for (const gateStr of protoGates) {
        let parsed;
        try {
          parsed = GateConstraint.parse(gateStr);
        } catch {
          continue;
        }
        if (parsed.axis === axis) {
          // Check if proto gate conflicts with desired range
          if (parsed.operator === '>=' && desired.max < parsed.value) {
            conflicts++;
          } else if (parsed.operator === '<=' && desired.min > parsed.value) {
            conflicts++;
          } else if (parsed.operator === '>' && desired.max <= parsed.value) {
            conflicts++;
          } else if (parsed.operator === '<' && desired.min >= parsed.value) {
            conflicts++;
          } else if (
            parsed.operator === '==' &&
            (parsed.value < desired.min || parsed.value > desired.max)
          ) {
            conflicts++;
          }
        }
      }
    }

    return total > 0 ? conflicts / total : 0;
  }

  /**
   * Build gate constraint ranges from prototype gate strings.
   *
   * @param {string[]} protoGates - Prototype gate strings.
   * @returns {object} Axis constraints inferred from gates.
   */
  buildGateConstraints(protoGates) {
    const constraints = {};
    if (!protoGates || protoGates.length === 0) {
      return constraints;
    }

    for (const gateStr of protoGates) {
      let parsed;
      try {
        parsed = GateConstraint.parse(gateStr);
      } catch {
        continue;
      }

      const axis = parsed.axis;
      if (!constraints[axis]) {
        constraints[axis] = { min: -1, max: 1 };
      }

      if (parsed.operator === '>=' || parsed.operator === '>') {
        constraints[axis].min = Math.max(constraints[axis].min, parsed.value);
      } else if (parsed.operator === '<=' || parsed.operator === '<') {
        constraints[axis].max = Math.min(constraints[axis].max, parsed.value);
      } else if (parsed.operator === '==') {
        constraints[axis].min = parsed.value;
        constraints[axis].max = parsed.value;
      }
    }

    return constraints;
  }
}

export default PrototypeGateChecker;
