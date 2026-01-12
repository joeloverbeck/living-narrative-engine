/**
 * @file Service for computing sensitivity analysis on Monte Carlo results.
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  getSensitivityStepSize,
  isIntegerDomain,
  isTunableVariable,
} from '../config/advancedMetricsConfig.js';
import { buildPopulationHash } from '../utils/populationHashUtils.js';

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
   * @returns {Array} Sensitivity grid data.
   */
  computeSensitivityData(storedContexts, blockers) {
    if (!storedContexts || storedContexts.length === 0) {
      this.#logger.debug('No stored contexts available for sensitivity analysis');
      return [];
    }

    const populationHash =
      this.#buildStoredContextPopulationHash(storedContexts);
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
              storedContexts,
              varPath,
              operator,
              threshold,
              { stepSize: getSensitivityStepSize(varPath) }
            );
            sensitivityResults.push(
              this.#annotateSensitivityResult(
                result,
                varPath,
                operator,
                populationHash
              )
            );
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
   * @returns {Array} Global sensitivity data.
   */
  computeGlobalSensitivityData(storedContexts, blockers, prerequisites) {
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

    const populationHash =
      this.#buildStoredContextPopulationHash(storedContexts);
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
          storedContexts,
          expressionLogic,
          candidate.varPath,
          candidate.operator,
          candidate.threshold,
          {
            steps: 9,
            stepSize: getSensitivityStepSize(candidate.varPath),
          }
        );
        globalSensitivityResults.push(
          this.#annotateSensitivityResult(
            result,
            candidate.varPath,
            candidate.operator,
            populationHash
          )
        );
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
}

export default SensitivityAnalyzer;
