/**
 * @file Service for computing sensitivity analysis on Monte Carlo results.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  advancedMetricsConfig,
  getSensitivityStepSize,
  isIntegerDomain,
  isTunableVariable,
} from '../config/advancedMetricsConfig.js';
import { buildPopulationHash } from '../utils/populationHashUtils.js';
import { evaluateConstraint } from '../utils/moodRegimeUtils.js';

class SensitivityAnalyzer {
  #logger;
  #monteCarloSimulator;

  constructor({ logger, monteCarloSimulator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(monteCarloSimulator, 'IMonteCarloSimulator', logger, {
      requiredMethods: ['computeThresholdSensitivity', 'computeExpressionSensitivity'],
    });

    this.#logger = logger;
    this.#monteCarloSimulator = monteCarloSimulator;
  }

  /**
   * Compute sensitivity data for individual clauses.
   *
   * @param {Array} storedContexts - Stored simulation contexts.
   * @param {Array} blockers - Hierarchical blocker data.
   * @param {object} [options] - Optional configuration
   * @param {number} [options.baselineTriggerRate] - Expression trigger rate (0-1)
   * @param {Array} [options.moodConstraints] - Mood regime constraints [{varPath, operator, threshold}]
   * @returns {Array} Sensitivity grid data.
   */
  computeSensitivityData(storedContexts, blockers, options = {}) {
    if (!storedContexts || storedContexts.length === 0) {
      this.#logger.debug('No stored contexts available for sensitivity analysis');
      return [];
    }

    const { baselineTriggerRate, moodConstraints = [] } = options;
    const config = advancedMetricsConfig.nearMissSensitivity;

    // Determine if we should use near-miss pool
    let effectiveContexts = storedContexts;
    let nearMissMetadata = null;

    if (
      config.enabled &&
      baselineTriggerRate === 0 &&
      blockers &&
      blockers.length >= 2
    ) {
      const { pool, metadata } = this.#buildNearMissPool(
        storedContexts,
        blockers,
        moodConstraints,
        config.excludeTopBlockerCount
      );

      if (pool.length >= config.minPoolSize) {
        effectiveContexts = pool;
        nearMissMetadata = metadata;
        this.#logger.info(
          `Using near-miss pool for clause sensitivity: ${pool.length} contexts`
        );
      } else {
        this.#logger.debug(
          `Near-miss pool too small (${pool.length} < ${config.minPoolSize}), using original contexts`
        );
      }
    }

    const populationHash =
      this.#buildStoredContextPopulationHash(effectiveContexts);
    const sensitivityResults = [];
    const processedConditions = new Set();

    for (const blocker of blockers ?? []) {
      const hb = blocker?.hierarchicalBreakdown ?? {};
      const leaves = hb.isCompound ? this.#flattenLeavesForSensitivity(hb) : [hb];

      for (const leaf of leaves) {
        const varPath = leaf?.variablePath ?? '';
        const threshold = leaf?.thresholdValue;
        const operator = leaf?.comparisonOperator ?? '>=';

        if (isTunableVariable(varPath) && typeof threshold === 'number') {
          const conditionKey = `${varPath}:${operator}:${threshold}`;
          if (processedConditions.has(conditionKey)) {
            continue;
          }
          processedConditions.add(conditionKey);

          try {
            const result = this.#monteCarloSimulator.computeThresholdSensitivity(
              effectiveContexts,
              varPath,
              operator,
              threshold,
              { stepSize: getSensitivityStepSize(varPath) }
            );

            const annotatedResult = this.#annotateSensitivityResult(
              result,
              varPath,
              operator,
              populationHash
            );

            // Add near-miss metadata if applicable
            if (nearMissMetadata) {
              annotatedResult.nearMissPoolMetadata = nearMissMetadata;
            }

            sensitivityResults.push(annotatedResult);
          } catch (err) {
            this.#logger.warn(
              `Failed to compute sensitivity for ${varPath}: ${err.message}`
            );
          }
        }
      }
    }

    return sensitivityResults;
  }

  /**
   * Compute global sensitivity data across all conditions.
   *
   * @param {Array} storedContexts - Stored simulation contexts.
   * @param {Array} blockers - Hierarchical blocker data.
   * @param {Object} prerequisites - Expression prerequisites.
   * @param {object} [options] - Optional configuration
   * @param {number} [options.baselineTriggerRate] - Expression trigger rate (0-1)
   * @param {Array} [options.moodConstraints] - Mood regime constraints [{varPath, operator, threshold}]
   * @returns {Array} Global sensitivity data.
   */
  computeGlobalSensitivityData(storedContexts, blockers, prerequisites, options = {}) {
    if (!storedContexts || storedContexts.length === 0) {
      this.#logger.debug(
        'No stored contexts available for global sensitivity analysis'
      );
      return [];
    }

    if (!prerequisites || prerequisites.length === 0) {
      this.#logger.debug('No prerequisites available for global sensitivity');
      return [];
    }

    const expressionLogic = prerequisites[0]?.logic;
    if (!expressionLogic) {
      this.#logger.debug('No logic found in prerequisites');
      return [];
    }

    const { baselineTriggerRate, moodConstraints = [] } = options;
    const config = advancedMetricsConfig.nearMissSensitivity;

    // Determine if we should use near-miss pool
    let effectiveContexts = storedContexts;
    let nearMissMetadata = null;

    if (
      config.enabled &&
      baselineTriggerRate === 0 &&
      blockers &&
      blockers.length >= 2
    ) {
      const { pool, metadata } = this.#buildNearMissPool(
        storedContexts,
        blockers,
        moodConstraints,
        config.excludeTopBlockerCount
      );

      if (pool.length >= config.minPoolSize) {
        effectiveContexts = pool;
        nearMissMetadata = metadata;
        this.#logger.info(
          `Using near-miss pool for global sensitivity: ${pool.length} contexts`
        );
      } else {
        this.#logger.debug(
          `Near-miss pool too small (${pool.length} < ${config.minPoolSize}), using original contexts`
        );
      }
    }

    const populationHash =
      this.#buildStoredContextPopulationHash(effectiveContexts);
    const globalSensitivityResults = [];
    const processedVars = new Set();
    const tunableCandidates = [];

    for (const blocker of blockers ?? []) {
      const hb = blocker?.hierarchicalBreakdown ?? {};
      const leaves = hb.isCompound ? this.#flattenLeavesForSensitivity(hb) : [hb];

      for (const leaf of leaves) {
        const varPath = leaf?.variablePath ?? '';
        const threshold = leaf?.thresholdValue;
        const operator = leaf?.comparisonOperator ?? '>=';
        const nearMissRate = leaf?.nearMissRate ?? 0;

        if (isTunableVariable(varPath) && typeof threshold === 'number') {
          const key = `${varPath}:${operator}:${threshold}`;
          if (processedVars.has(key)) continue;
          processedVars.add(key);

          const failureRate = leaf?.failureRate ?? 0;
          const lastMileRate = leaf?.lastMileFailRate ?? failureRate;

          tunableCandidates.push({
            varPath,
            operator,
            threshold,
            nearMissRate,
            failureRate,
            lastMileRate,
          });
        }
      }
    }

    tunableCandidates.sort((a, b) => {
      const scoreA =
        a.lastMileRate * 0.5 + a.nearMissRate * 0.3 + a.failureRate * 0.2;
      const scoreB =
        b.lastMileRate * 0.5 + b.nearMissRate * 0.3 + b.failureRate * 0.2;
      return scoreB - scoreA;
    });
    const topCandidates = tunableCandidates.slice(0, 3);

    for (const candidate of topCandidates) {
      try {
        const result = this.#monteCarloSimulator.computeExpressionSensitivity(
          effectiveContexts,
          expressionLogic,
          candidate.varPath,
          candidate.operator,
          candidate.threshold,
          {
            steps: 9,
            stepSize: getSensitivityStepSize(candidate.varPath),
          }
        );

        const annotatedResult = this.#annotateSensitivityResult(
          result,
          candidate.varPath,
          candidate.operator,
          populationHash
        );

        // Add near-miss metadata if applicable
        if (nearMissMetadata) {
          annotatedResult.nearMissPoolMetadata = nearMissMetadata;
        }

        globalSensitivityResults.push(annotatedResult);
      } catch (err) {
        this.#logger.warn(
          `Failed to compute global sensitivity for ${candidate.varPath}: ${err.message}`
        );
      }
    }

    return globalSensitivityResults;
  }

  #flattenLeavesForSensitivity(node) {
    if (!node?.isCompound) {
      return [node];
    }

    const leaves = [];
    for (const child of node.children ?? []) {
      leaves.push(...this.#flattenLeavesForSensitivity(child));
    }
    return leaves;
  }

  #annotateSensitivityResult(result, varPath, operator, populationHash) {
    if (!result || typeof result !== 'object') {
      return result;
    }

    const integerDomain = isIntegerDomain(varPath);
    const inferredKind =
      result.kind ??
      (result.isExpressionLevel
        ? 'expressionTriggerRateSweep'
        : 'marginalClausePassRateSweep');
    const grid = Array.isArray(result.grid)
      ? result.grid.map((point) =>
        integerDomain
          ? {
            ...point,
            effectiveThreshold: this.#getEffectiveThreshold(
              operator,
              point.threshold
            ),
          }
          : point
      )
      : result.grid;
    const resolvedPopulationHash =
      populationHash ?? result.populationHash ?? null;

    return {
      ...result,
      kind: inferredKind,
      isIntegerDomain: integerDomain,
      grid,
      ...(resolvedPopulationHash
        ? { populationHash: resolvedPopulationHash }
        : {}),
    };
  }

  #getEffectiveThreshold(operator, threshold) {
    if (typeof threshold !== 'number' || Number.isNaN(threshold)) {
      return null;
    }

    switch (operator) {
      case '>=':
      case '>':
        return Math.ceil(threshold);
      case '<=':
      case '<':
        return Math.floor(threshold);
      default:
        return null;
    }
  }

  #buildStoredContextPopulationHash(storedContexts) {
    if (!Array.isArray(storedContexts) || storedContexts.length === 0) {
      return null;
    }

    const sampleIds = storedContexts.map((_, index) => index);
    return buildPopulationHash(sampleIds, 'all');
  }

  /**
   * Build a near-miss pool of contexts that pass all conditions except top blockers.
   * Used for importance sampling when baseline trigger rate is 0%.
   *
   * @param {Array} storedContexts - All stored simulation contexts
   * @param {Array} blockers - Sorted blocker candidates (by composite score, descending)
   * @param {Array} moodConstraints - Mood regime constraints [{varPath, operator, threshold}]
   * @param {number} excludeTopN - Number of top blockers to exclude from filtering
   * @returns {{pool: Array, metadata: object}} Filtered contexts and metadata
   */
  #buildNearMissPool(
    storedContexts,
    blockers,
    moodConstraints = [],
    excludeTopN = 2
  ) {
    const metadata = {
      isNearMissPool: false,
      originalSize: storedContexts?.length ?? 0,
      poolSize: 0,
      excludedBlockers: [],
      includedBlockers: [],
      moodConstraintCount: moodConstraints?.length ?? 0,
    };

    if (!storedContexts || storedContexts.length === 0) {
      return { pool: [], metadata };
    }

    if (!blockers || blockers.length < 2) {
      // Need at least 2 blockers to meaningfully exclude top N
      this.#logger.debug(
        'Insufficient blockers for near-miss pool (need >= 2)'
      );
      return { pool: storedContexts, metadata };
    }

    // Extract all leaf conditions from blockers
    const allLeaves = [];
    for (const blocker of blockers) {
      const hb = blocker?.hierarchicalBreakdown ?? {};
      const leaves = hb.isCompound
        ? this.#flattenLeavesForSensitivity(hb)
        : [hb];

      for (const leaf of leaves) {
        if (leaf?.variablePath && typeof leaf?.thresholdValue === 'number') {
          allLeaves.push({
            varPath: leaf.variablePath,
            operator: leaf.comparisonOperator ?? '>=',
            threshold: leaf.thresholdValue,
            // Compute composite score for sorting (same formula as computeGlobalSensitivityData)
            compositeScore:
              (leaf.lastMileFailRate ?? leaf.failureRate ?? 0) * 0.5 +
              (leaf.nearMissRate ?? 0) * 0.3 +
              (leaf.failureRate ?? 0) * 0.2,
          });
        }
      }
    }

    // Deduplicate and sort by composite score descending
    const uniqueLeaves = this.#deduplicateLeaves(allLeaves);
    uniqueLeaves.sort((a, b) => b.compositeScore - a.compositeScore);

    // Split into excluded (top N) and included (rest)
    const excludedLeaves = uniqueLeaves.slice(0, excludeTopN);
    const includedLeaves = uniqueLeaves.slice(excludeTopN);

    metadata.excludedBlockers = excludedLeaves.map(
      (l) => `${l.varPath} ${l.operator} ${l.threshold}`
    );
    metadata.includedBlockers = includedLeaves.map(
      (l) => `${l.varPath} ${l.operator} ${l.threshold}`
    );

    // Filter contexts that:
    // 1. Pass mood constraints (if any)
    // 2. Pass all included leaf conditions
    const pool = storedContexts.filter((context) => {
      // Check mood constraints
      if (moodConstraints && moodConstraints.length > 0) {
        const passesMood = moodConstraints.every((constraint) => {
          const value = this.#getNestedValue(context, constraint.varPath);
          return evaluateConstraint(
            value,
            constraint.operator,
            constraint.threshold
          );
        });
        if (!passesMood) return false;
      }

      // Check included leaf conditions
      for (const leaf of includedLeaves) {
        const value = this.#getNestedValue(context, leaf.varPath);
        const passes = evaluateConstraint(value, leaf.operator, leaf.threshold);
        if (!passes) return false;
      }

      return true;
    });

    metadata.poolSize = pool.length;
    metadata.isNearMissPool = true;

    this.#logger.debug(
      `Near-miss pool built: ${pool.length}/${storedContexts.length} contexts ` +
        `(excluded ${excludedLeaves.length} blockers, checked ${includedLeaves.length})`
    );

    return { pool, metadata };
  }

  /**
   * Deduplicate leaves by varPath:operator:threshold key.
   *
   * @param {Array} leaves - Leaf conditions with compositeScore
   * @returns {Array} Deduplicated leaves (keeps highest composite score)
   */
  #deduplicateLeaves(leaves) {
    const seen = new Map();
    for (const leaf of leaves) {
      const key = `${leaf.varPath}:${leaf.operator}:${leaf.threshold}`;
      const existing = seen.get(key);
      if (!existing || leaf.compositeScore > existing.compositeScore) {
        seen.set(key, leaf);
      }
    }
    return Array.from(seen.values());
  }

  /**
   * Get a nested value from context using dot-notation path.
   *
   * @param {object} context - The context object
   * @param {string} path - Dot-notation path (e.g., 'emotions.joy')
   * @returns {*} The value at the path, or undefined
   */
  #getNestedValue(context, path) {
    if (!context || !path) return undefined;
    const parts = path.split('.');
    let current = context;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = current[part];
    }
    return current;
  }
}

export default SensitivityAnalyzer;
