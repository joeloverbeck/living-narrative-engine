/**
 * @file PrototypeEvaluator.js
 * @description Evaluates emotion/sexual prototypes for Monte Carlo simulation.
 * Handles prototype reference collection, lookup, evaluation, and statistics tracking.
 * @see reports/monte-carlo-simulator-architecture-refactoring.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';
import GateConstraint from '../../models/GateConstraint.js';
import { resolveAxisValue } from '../../utils/axisNormalizationUtils.js';

/**
 * @typedef {Object} PrototypeTarget
 * @property {string} prototypeId - The prototype identifier
 * @property {Object|null} weights - Weight map for mood axes
 * @property {string[]|null} gates - Gate constraint strings
 */

/**
 * @typedef {Object} PrototypeEvaluationStats
 * @property {number} moodSampleCount - Number of samples evaluated
 * @property {number} gatePassCount - Number of samples that passed all gates
 * @property {number} gateFailCount - Number of samples that failed at least one gate
 * @property {Object<string, number>} failedGateCounts - Count of failures per gate
 * @property {number} rawScoreSum - Sum of raw (unclamped) scores
 * @property {number} valueSum - Sum of clamped [0,1] scores
 * @property {number} valueSumGivenGate - Sum of values only when gates pass
 */

/**
 * @typedef {Object} PrototypeEvaluation
 * @property {boolean} gatePass - Whether all gates passed
 * @property {string[]} failedGates - List of failed gate strings
 * @property {number} rawScore - Unclamped weighted score
 * @property {number} rawValue - Clamped [0,1] score
 * @property {number} value - Final value (rawValue if gates pass, else 0)
 */

class PrototypeEvaluator {
  #logger;
  #dataRegistry;

  /**
   * @param {Object} deps
   * @param {import('../../../interfaces/ILogger.js').ILogger} deps.logger
   * @param {import('../../../interfaces/IDataRegistry.js').IDataRegistry} deps.dataRegistry
   */
  constructor({ logger, dataRegistry }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });

    this.#logger = logger;
    this.#dataRegistry = dataRegistry;
  }

  /**
   * Extracts prototype references (emotion and sexual) from prerequisites.
   * @param {Array<{logic: Object}>} prerequisites - Array of prerequisite objects with logic
   * @returns {{emotions: string[], sexualStates: string[]}} Collected prototype IDs
   */
  extractPrototypeReferences(prerequisites) {
    const emotions = new Set();
    const sexualStates = new Set();

    if (!Array.isArray(prerequisites)) {
      return { emotions: [], sexualStates: [] };
    }

    for (const prereq of prerequisites) {
      this.collectPrototypeReferencesFromLogic(prereq.logic, emotions, sexualStates);
    }

    return {
      emotions: [...emotions],
      sexualStates: [...sexualStates],
    };
  }

  /**
   * Prepares prototype evaluation targets from prerequisites.
   * Resolves prototype definitions and logs warnings for missing prototypes.
   * @param {Array<{logic: Object}>} prerequisites - Array of prerequisite objects
   * @returns {{emotions: PrototypeTarget[], sexualStates: PrototypeTarget[]}} Resolved targets
   */
  preparePrototypeEvaluationTargets(prerequisites) {
    const references = this.extractPrototypeReferences(prerequisites);
    const emotions = [];
    const sexualStates = [];

    for (const prototypeId of references.emotions) {
      const prototype = this.getPrototype(prototypeId, 'emotion');
      if (!prototype) {
        this.#logger.warn(
          `MonteCarloSimulator: Prototype not found for evaluation: emotions.${prototypeId}`
        );
        continue;
      }
      emotions.push({
        prototypeId,
        weights: prototype.weights ?? null,
        gates: Array.isArray(prototype.gates) ? prototype.gates : null,
      });
    }

    for (const prototypeId of references.sexualStates) {
      const prototype = this.getPrototype(prototypeId, 'sexual');
      if (!prototype) {
        this.#logger.warn(
          `MonteCarloSimulator: Prototype not found for evaluation: sexualStates.${prototypeId}`
        );
        continue;
      }
      sexualStates.push({
        prototypeId,
        weights: prototype.weights ?? null,
        gates: Array.isArray(prototype.gates) ? prototype.gates : null,
      });
    }

    return { emotions, sexualStates };
  }

  /**
   * Initializes prototype evaluation summary structure.
   * @param {{emotions: PrototypeTarget[], sexualStates: PrototypeTarget[]}|null} targets - Targets to initialize
   * @returns {Object|null} Initialized summary or null if no targets
   */
  initializePrototypeEvaluationSummary(targets) {
    if (!targets) {
      return null;
    }
    if (targets.emotions.length === 0 && targets.sexualStates.length === 0) {
      return null;
    }

    const summary = {
      emotions: {},
      sexualStates: {},
    };

    for (const target of targets.emotions) {
      summary.emotions[target.prototypeId] = this.createPrototypeEvaluationStats();
    }

    for (const target of targets.sexualStates) {
      summary.sexualStates[target.prototypeId] = this.createPrototypeEvaluationStats();
    }

    return summary;
  }

  /**
   * Creates a new prototype evaluation stats object with all fields initialized.
   * @returns {PrototypeEvaluationStats} Initialized stats object
   */
  createPrototypeEvaluationStats() {
    return {
      moodSampleCount: 0,
      gatePassCount: 0,
      gateFailCount: 0,
      failedGateCounts: {},
      rawScoreSum: 0,
      valueSum: 0,
      valueSumGivenGate: 0,
    };
  }

  /**
   * Updates prototype evaluation summary with sample data.
   * Evaluates all targets against the normalized context values.
   * @param {Object|null} summary - Summary to update
   * @param {{emotions: PrototypeTarget[], sexualStates: PrototypeTarget[]}|null} targets - Targets to evaluate
   * @param {Object} normalizedMood - Normalized mood axis values (0-1 range)
   * @param {Object} normalizedSexual - Normalized sexual axis values (0-1 range)
   * @param {Object} normalizedTraits - Normalized trait axis values
   */
  updatePrototypeEvaluationSummary(
    summary,
    targets,
    normalizedMood,
    normalizedSexual,
    normalizedTraits
  ) {
    if (!summary || !targets) {
      return;
    }

    for (const target of targets.emotions) {
      const stats = summary.emotions[target.prototypeId];
      if (!stats) {
        continue;
      }
      const evaluation = this.evaluatePrototypeSample(
        target,
        normalizedMood,
        normalizedSexual,
        normalizedTraits
      );
      this.recordPrototypeEvaluation(stats, evaluation);
    }

    for (const target of targets.sexualStates) {
      const stats = summary.sexualStates[target.prototypeId];
      if (!stats) {
        continue;
      }
      const evaluation = this.evaluatePrototypeSample(
        target,
        normalizedMood,
        normalizedSexual,
        {}
      );
      this.recordPrototypeEvaluation(stats, evaluation);
    }
  }

  /**
   * Evaluates a single prototype sample against normalized axis values.
   * Computes weighted score and checks gate constraints.
   * @param {PrototypeTarget} target - Prototype target to evaluate
   * @param {Object} normalizedMood - Normalized mood axes
   * @param {Object} normalizedSexual - Normalized sexual axes
   * @param {Object} normalizedTraits - Normalized trait axes
   * @returns {PrototypeEvaluation} Evaluation result
   */
  evaluatePrototypeSample(target, normalizedMood, normalizedSexual, normalizedTraits) {
    const clamp01 = (value) => Math.max(0, Math.min(1, value));

    let rawSum = 0;
    let sumAbsWeights = 0;
    if (target.weights && typeof target.weights === 'object') {
      for (const [axis, weight] of Object.entries(target.weights)) {
        if (typeof weight !== 'number') {
          continue;
        }
        const axisValue = resolveAxisValue(
          axis,
          normalizedMood,
          normalizedSexual,
          normalizedTraits
        );
        rawSum += weight * axisValue;
        sumAbsWeights += Math.abs(weight);
      }
    }

    const rawScore = sumAbsWeights === 0 ? 0 : rawSum / sumAbsWeights;
    const clampedRaw = clamp01(rawScore);

    const failedGates = [];
    const gates = Array.isArray(target.gates) ? target.gates : [];
    for (const gateStr of gates) {
      let constraint;
      try {
        constraint = GateConstraint.parse(gateStr);
      } catch {
        continue;
      }
      const axisValue = resolveAxisValue(
        constraint.axis,
        normalizedMood,
        normalizedSexual,
        normalizedTraits
      );
      if (!constraint.isSatisfiedBy(axisValue)) {
        failedGates.push(gateStr);
      }
    }

    const gatePass = failedGates.length === 0;
    const value = gatePass ? clampedRaw : 0;

    return { gatePass, failedGates, rawScore, rawValue: clampedRaw, value };
  }

  /**
   * Records a prototype evaluation outcome into statistics.
   * @param {PrototypeEvaluationStats} stats - Statistics accumulator
   * @param {PrototypeEvaluation} evaluation - Evaluation result to record
   */
  recordPrototypeEvaluation(stats, evaluation) {
    if (!stats || !evaluation) {
      return;
    }

    stats.moodSampleCount++;
    if (evaluation.gatePass) {
      stats.gatePassCount++;
    } else {
      stats.gateFailCount++;
    }

    for (const gateId of evaluation.failedGates) {
      stats.failedGateCounts[gateId] = (stats.failedGateCounts[gateId] ?? 0) + 1;
    }

    stats.rawScoreSum += evaluation.rawScore;
    stats.valueSum += evaluation.value;
    if (evaluation.gatePass) {
      stats.valueSumGivenGate += evaluation.value;
    }
  }

  /**
   * Collects prototype references from JSON Logic expression.
   * Recursively traverses comparison and boolean operators.
   * @param {Object} logic - JSON Logic expression
   * @param {Set<string>} emotions - Set to collect emotion prototype IDs
   * @param {Set<string>} sexualStates - Set to collect sexual prototype IDs
   */
  collectPrototypeReferencesFromLogic(logic, emotions, sexualStates) {
    if (!logic || typeof logic !== 'object') return;

    for (const op of ['>=', '<=', '>', '<', '==']) {
      if (logic[op]) {
        const [left, right] = logic[op];
        const candidates = [left, right];
        for (const candidate of candidates) {
          if (candidate?.var && typeof candidate.var === 'string') {
            if (candidate.var.startsWith('emotions.')) {
              emotions.add(candidate.var.replace('emotions.', ''));
            } else if (candidate.var.startsWith('sexualStates.')) {
              sexualStates.add(candidate.var.replace('sexualStates.', ''));
            }
          }
        }
      }
    }

    if (logic.and || logic.or) {
      const clauses = logic.and || logic.or;
      for (const clause of clauses) {
        this.collectPrototypeReferencesFromLogic(clause, emotions, sexualStates);
      }
    }
  }

  /**
   * Gets a prototype definition from the data registry.
   * @param {string} prototypeId - Prototype identifier (e.g., 'joy', 'aroused')
   * @param {string} type - Prototype type ('emotion' or 'sexual')
   * @returns {Object|null} Prototype definition or null if not found
   */
  getPrototype(prototypeId, type) {
    const lookupId =
      type === 'emotion' ? 'core:emotion_prototypes' : 'core:sexual_prototypes';
    const lookup = this.#dataRegistry.get('lookups', lookupId);
    return lookup?.entries?.[prototypeId] || null;
  }
}

export default PrototypeEvaluator;
