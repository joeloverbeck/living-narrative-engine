/**
 * @file MinimalBlockerSetCalculator - Identifies dominant blocking constraints
 * @see specs/monte-carlo-actionability-improvements.md
 * @see tickets/MONCARACTIMP-002-minimal-blocker-set-calculator.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../config/actionabilityConfig.js';

/** @typedef {import('../config/actionabilityConfig.js').BlockerInfo} BlockerInfo */
/** @typedef {import('../config/actionabilityConfig.js').DominantCoreResult} DominantCoreResult */
/** @typedef {import('../config/actionabilityConfig.js').MinimalBlockerSetConfig} MinimalBlockerSetConfig */

/**
 * Calculates the minimal set of blocking constraints that explain most failures.
 *
 * Uses composite scoring (impact + last-mile rate) to identify 1-3 "core blockers"
 * that account for the majority of expression failures. Also identifies non-core
 * constraints with high pass rates that don't significantly block triggers.
 */
class MinimalBlockerSetCalculator {
  #logger;
  #config;

  /**
   * Create a new MinimalBlockerSetCalculator instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.logger - Logger implementing ILogger
   * @param {MinimalBlockerSetConfig} [deps.config] - Optional config override
   */
  constructor({ logger, config = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
    this.#config = config ?? actionabilityConfig.minimalBlockerSet;
  }

  /**
   * Calculate the minimal blocker set from clause tracking data.
   *
   * @param {object[]} clauses - Clause tracking data from Monte Carlo simulation
   * @param {object} simulationResult - Full simulation result with metadata
   * @returns {DominantCoreResult} Core blockers and non-core constraints
   */
  calculate(clauses, simulationResult) {
    if (!Array.isArray(clauses) || clauses.length === 0) {
      this.#logger.debug('No clauses provided for minimal blocker set analysis');
      return this.#createEmptyResult();
    }

    if (!simulationResult) {
      this.#logger.debug('No simulation result provided');
      return this.#createEmptyResult();
    }

    this.#logger.debug(`Analyzing ${clauses.length} clauses for core blockers`);

    // Step 1: Score all clauses
    const scoredClauses = this.#scoreAllClauses(clauses, simulationResult);

    // Step 2: Rank by composite score
    const rankedClauses = this.#rankByCompositeScore(scoredClauses);

    // Step 3: Select core blockers (up to maxCoreBlockers)
    const coreBlockers = this.#selectCoreBlockers(rankedClauses);

    // Step 4: Classify non-core constraints
    const nonCoreConstraints = this.#classifyNonCore(
      rankedClauses,
      coreBlockers
    );

    // Step 5: Build composite scores map
    const compositeScores = this.#buildCompositeScoresMap(scoredClauses);

    this.#logger.debug(
      `Identified ${coreBlockers.length} core blockers, ` +
        `${nonCoreConstraints.length} non-core constraints`
    );

    return {
      coreBlockers,
      nonCoreConstraints,
      compositeScores,
    };
  }

  /**
   * Score all clauses using composite scoring formula.
   *
   * @param {object[]} clauses - Clause tracking data
   * @param {object} simulationResult - Simulation result
   * @returns {BlockerInfo[]} Scored clause information
   */
  #scoreAllClauses(clauses, simulationResult) {
    const totalSamples = simulationResult?.sampleCount ?? 1000;

    return clauses.map((clause) => {
      const clauseId = clause.clauseId ?? clause.id ?? 'unknown';
      const clauseDescription = this.#extractDescription(clause);

      // Extract rates from tracking data
      const lastMileRate = this.#extractLastMileRate(clause, totalSamples);
      const inRegimePassRate = this.#extractInRegimePassRate(clause);
      const impactScore = this.#estimateImpact(clause, simulationResult);

      // Compute composite score
      const compositeScore = this.#computeComposite(impactScore, lastMileRate);

      return {
        clauseId,
        clauseDescription,
        lastMileRate,
        impactScore,
        compositeScore,
        inRegimePassRate,
        classification: 'core', // Will be reclassified later
      };
    });
  }

  /**
   * Compute composite score from impact and last-mile rate.
   *
   * @param {number} impactScore - Estimated impact if clause removed
   * @param {number} lastMileRate - Failure rate when all others pass
   * @returns {number} Weighted composite score
   */
  #computeComposite(impactScore, lastMileRate) {
    const { impactWeight, lastMileWeight } = this.#config;
    return impactWeight * impactScore + lastMileWeight * lastMileRate;
  }

  /**
   * Extract last-mile failure rate from clause tracking.
   *
   * The last-mile rate is the probability that this clause fails
   * given that all other clauses pass.
   *
   * @param {object} clause - Clause tracking data
   * @param {number} totalSamples - Total simulation samples
   * @returns {number} Last-mile failure rate (0-1)
   */
  #extractLastMileRate(clause, totalSamples) {
    // Check for pre-computed last-mile rate
    if (typeof clause.lastMileFailRate === 'number') {
      return clause.lastMileFailRate;
    }

    // Compute from conditional tracking if available
    const othersPassCount = clause.othersPassCount ?? 0;
    const failWhenOthersPass = clause.failWhenOthersPassCount ?? 0;

    if (othersPassCount > 0) {
      return failWhenOthersPass / othersPassCount;
    }

    // Fallback to simple failure rate
    const passCount = clause.passCount ?? 0;
    const failCount = clause.failCount ?? totalSamples - passCount;
    return failCount / totalSamples;
  }

  /**
   * Extract in-regime pass rate from clause tracking.
   *
   * @param {object} clause - Clause tracking data
   * @returns {number} Pass rate within mood regime (0-1)
   */
  #extractInRegimePassRate(clause) {
    if (typeof clause.inRegimePassRate === 'number') {
      return clause.inRegimePassRate;
    }

    // Compute from counts if available
    const inRegimeTotal = clause.inRegimeTotal ?? 0;
    const inRegimePass = clause.inRegimePassCount ?? 0;

    if (inRegimeTotal > 0) {
      return inRegimePass / inRegimeTotal;
    }

    // Fallback to overall pass rate
    const passCount = clause.passCount ?? 0;
    const totalCount = (clause.passCount ?? 0) + (clause.failCount ?? 0);
    return totalCount > 0 ? passCount / totalCount : 0;
  }

  /**
   * Estimate impact if this clause were removed (ablation estimate).
   *
   * @param {object} clause - Clause tracking data
   * @param {object} simulationResult - Simulation result
   * @returns {number} Estimated Δ trigger rate (0-1)
   */
  #estimateImpact(clause, simulationResult) {
    // Use pre-computed ablation estimate if available
    if (typeof clause.ablationImpact === 'number') {
      return clause.ablationImpact;
    }

    // Estimate using failure contribution
    const totalFailures = simulationResult?.failureCount ?? 0;
    const clauseFailures = clause.failCount ?? 0;
    const totalSamples = simulationResult?.sampleCount ?? 1000;

    if (totalSamples === 0 || totalFailures === 0) {
      return 0;
    }

    // Estimate impact as proportion of failures this clause contributes to
    // This is a simplified estimate - true ablation would require re-simulation
    const failureContribution = clauseFailures / totalSamples;
    const currentTriggerRate = simulationResult?.triggerRate ?? 0;

    // Cap at 1 - currentTriggerRate (maximum possible improvement)
    return Math.min(failureContribution, 1 - currentTriggerRate);
  }

  /**
   * Extract human-readable description from clause.
   *
   * @param {object} clause - Clause tracking data
   * @returns {string} Clause description
   */
  #extractDescription(clause) {
    if (clause.description) return clause.description;
    if (clause.clauseDescription) return clause.clauseDescription;
    if (clause.condition) return JSON.stringify(clause.condition);
    if (clause.variablePath && clause.operator && clause.threshold !== undefined) {
      return `${clause.variablePath} ${clause.operator} ${clause.threshold}`;
    }
    return clause.clauseId ?? clause.id ?? 'Unknown clause';
  }

  /**
   * Rank clauses by composite score (descending).
   *
   * @param {BlockerInfo[]} scoredClauses - Scored clause information
   * @returns {BlockerInfo[]} Sorted clauses
   */
  #rankByCompositeScore(scoredClauses) {
    return [...scoredClauses].sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * Select core blockers from ranked clauses.
   *
   * Uses greedy selection with marginal explanation check:
   * - Takes top-ranked clauses up to maxCoreBlockers
   * - Stops if marginal explanatory power drops below threshold
   *
   * @param {BlockerInfo[]} rankedClauses - Clauses sorted by composite score
   * @returns {BlockerInfo[]} Core blockers (1-3)
   */
  #selectCoreBlockers(rankedClauses) {
    const { maxCoreBlockers, minMarginalExplanation } = this.#config;
    const coreBlockers = [];

    for (const clause of rankedClauses) {
      if (coreBlockers.length >= maxCoreBlockers) {
        break;
      }

      // Check marginal explanation power (composite score as proxy)
      const marginalExplanation = clause.compositeScore;

      if (
        coreBlockers.length > 0 &&
        marginalExplanation < minMarginalExplanation
      ) {
        this.#logger.debug(
          `Stopping core blocker selection at ${coreBlockers.length} blockers ` +
            `(marginal explanation ${marginalExplanation.toFixed(4)} < threshold)`
        );
        break;
      }

      coreBlockers.push({
        ...clause,
        classification: 'core',
      });
    }

    return coreBlockers;
  }

  /**
   * Classify non-core constraints (high pass rate, not blocking).
   *
   * @param {BlockerInfo[]} rankedClauses - All ranked clauses
   * @param {BlockerInfo[]} coreBlockers - Already-identified core blockers
   * @returns {BlockerInfo[]} Non-core constraints
   */
  #classifyNonCore(rankedClauses, coreBlockers) {
    const { nonCorePassRateThreshold } = this.#config;
    const coreIds = new Set(coreBlockers.map((b) => b.clauseId));

    return rankedClauses
      .filter((clause) => {
        // Not a core blocker
        if (coreIds.has(clause.clauseId)) {
          return false;
        }

        // Has high pass rate (≥95%)
        return clause.inRegimePassRate >= nonCorePassRateThreshold;
      })
      .map((clause) => ({
        ...clause,
        classification: 'non-core',
      }));
  }

  /**
   * Build Map of clause IDs to composite scores.
   *
   * @param {BlockerInfo[]} scoredClauses - Scored clause information
   * @returns {Map<string, number>} Clause ID to composite score
   */
  #buildCompositeScoresMap(scoredClauses) {
    const map = new Map();
    for (const clause of scoredClauses) {
      map.set(clause.clauseId, clause.compositeScore);
    }
    return map;
  }

  /**
   * Create empty result structure.
   *
   * @returns {DominantCoreResult} Empty result
   */
  #createEmptyResult() {
    return {
      coreBlockers: [],
      nonCoreConstraints: [],
      compositeScores: new Map(),
    };
  }
}

export default MinimalBlockerSetCalculator;
