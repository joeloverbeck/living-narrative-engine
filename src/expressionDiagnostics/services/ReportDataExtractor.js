/**
 * @file ReportDataExtractor - Extracts specific data from simulation results and blockers
 * @description Provides data extraction utilities for Monte Carlo report generation.
 * Methods in this class retrieve and transform data from simulation outputs,
 * prerequisites, and sensitivity analysis results.
 */

import { getTunableVariableInfo } from '../config/advancedMetricsConfig.js';
import { findBaselineGridPoint } from '../utils/sweepIntegrityUtils.js';

class ReportDataExtractor {
  #logger;
  #prototypeConstraintAnalyzer;

  /**
   * @param {object} options - Configuration options
   * @param {object} [options.logger] - Logger instance for warnings/errors
   * @param {object} [options.prototypeConstraintAnalyzer] - Prototype constraint analyzer service
   */
  constructor({ logger = null, prototypeConstraintAnalyzer = null } = {}) {
    this.#logger = logger;
    this.#prototypeConstraintAnalyzer = prototypeConstraintAnalyzer;
  }

  /**
   * Extracts axis constraints from prerequisites using the prototype constraint analyzer.
   * @param {object} prerequisites - Expression prerequisites
   * @returns {Map|null} Axis constraints map or null if unavailable
   */
  extractAxisConstraints(prerequisites) {
    if (!prerequisites || !this.#prototypeConstraintAnalyzer) {
      return null;
    }
    try {
      return this.#prototypeConstraintAnalyzer.extractAxisConstraints(prerequisites);
    } catch (err) {
      if (this.#logger) {
        this.#logger.warn('Failed to extract axis constraints:', err.message);
      }
      return null;
    }
  }

  /**
   * Extracts baseline trigger rate from global sensitivity data.
   * @param {Array} globalSensitivityData - Sensitivity analysis results
   * @returns {number|null} Baseline trigger rate or null if not found
   */
  extractBaselineTriggerRate(globalSensitivityData) {
    if (!Array.isArray(globalSensitivityData)) {
      return null;
    }

    for (const result of globalSensitivityData) {
      const baselinePoint = findBaselineGridPoint(
        result?.grid,
        result?.originalThreshold
      );
      if (baselinePoint && typeof baselinePoint.triggerRate === 'number') {
        return baselinePoint.triggerRate;
      }
    }

    return null;
  }

  /**
   * Extracts emotion/sexual state conditions from a blocker's hierarchical breakdown.
   * @param {object} blocker - Blocker with hierarchicalBreakdown
   * @param {Function} flattenLeavesFn - Function to flatten hierarchical leaves
   * @returns {Array<object>} Array of emotion condition objects
   */
  extractEmotionConditions(blocker, flattenLeavesFn) {
    const conditions = [];
    const hb = blocker.hierarchicalBreakdown ?? {};

    // Check if this blocker or its leaves contain emotion/sexual conditions
    const leaves = hb.isCompound ? flattenLeavesFn(hb) : [hb];

    for (const leaf of leaves) {
      const varPath = leaf.variablePath ?? '';
      const threshold = leaf.thresholdValue;
      const operator = leaf.comparisonOperator ?? leaf.operator;
      const desc = leaf.description ?? '';

      // Match patterns like "emotions.anger" or "sexual.arousal"
      const tunableInfo = getTunableVariableInfo(varPath);
      if (tunableInfo?.domain === 'emotions' && typeof threshold === 'number') {
        conditions.push({
          prototypeId: tunableInfo.name,
          type: 'emotion',
          threshold,
          operator,
          description: desc,
        });
      } else if (tunableInfo?.domain === 'sexual' && typeof threshold === 'number') {
        conditions.push({
          prototypeId: tunableInfo.name,
          type: 'sexual',
          threshold,
          operator,
          description: desc,
        });
      }
    }

    return conditions;
  }

  /**
   * Extracts emotion conditions from prerequisites by traversing their logic.
   * @param {Array} prerequisites - Expression prerequisites array
   * @returns {Array<object>} Deduplicated array of emotion conditions
   */
  extractEmotionConditionsFromPrereqs(prerequisites) {
    const conditions = [];
    if (!prerequisites || !Array.isArray(prerequisites)) {
      return conditions;
    }

    for (const prereq of prerequisites) {
      this.extractEmotionConditionsFromLogic(prereq.logic, conditions);
    }

    // Deduplicate by varPath + operator + threshold
    const seen = new Set();
    return conditions.filter((c) => {
      const key = `${c.varPath}:${c.operator}:${c.threshold}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Recursively extracts emotion conditions from JSON Logic structure.
   * @param {object} logic - JSON Logic object
   * @param {Array} conditions - Array to accumulate conditions into
   */
  extractEmotionConditionsFromLogic(logic, conditions) {
    if (!logic || typeof logic !== 'object') return;

    // Check comparison operators
    const operators = ['>=', '<=', '>', '<'];
    for (const op of operators) {
      if (logic[op]) {
        const [left, right] = logic[op];
        if (typeof left === 'object' && left.var && typeof right === 'number') {
          const varPath = left.var;
          // Only emotion or sexual state conditions
          if (varPath.startsWith('emotions.') || varPath.startsWith('sexualStates.')) {
            conditions.push({
              varPath,
              operator: op,
              threshold: right,
              display: `${varPath} ${op} ${right}`,
            });
          }
        }
      }
    }

    // Recurse into AND and OR blocks
    if (logic.and && Array.isArray(logic.and)) {
      for (const clause of logic.and) {
        this.extractEmotionConditionsFromLogic(clause, conditions);
      }
    }
    if (logic.or && Array.isArray(logic.or)) {
      for (const clause of logic.or) {
        this.extractEmotionConditionsFromLogic(clause, conditions);
      }
    }
  }

  /**
   * Extracts the worst ceiling gap from hierarchical breakdown leaves.
   * @param {object} hb - Hierarchical breakdown object
   * @param {Function} flattenLeavesFn - Function to flatten hierarchical leaves
   * @returns {object|null} Worst ceiling data or null if none found
   */
  extractWorstCeilingFromLeaves(hb, flattenLeavesFn) {
    const leaves = flattenLeavesFn(hb);
    if (leaves.length === 0) return null;

    let worstCeiling = null;

    for (const leaf of leaves) {
      const gap = leaf.ceilingGap;
      const threshold = leaf.thresholdValue;
      const maxObserved = leaf.maxObservedValue;

      // Only consider leaves with ceiling data and positive gaps (unreachable)
      if (typeof gap === 'number' && gap > 0 && typeof threshold === 'number' && typeof maxObserved === 'number') {
        if (!worstCeiling || gap > worstCeiling.gap) {
          worstCeiling = {
            description: leaf.description ?? 'Unknown condition',
            maxObserved,
            threshold,
            gap,
            insight: `Max observed (${maxObserved.toFixed(2)}) never reached threshold (${threshold.toFixed(2)})`,
            totalLeaves: leaves.length,
          };
        }
      }
    }

    return worstCeiling;
  }

  /**
   * Gets the context path for a prototype based on type.
   * @param {string} type - Prototype type ('emotion' or 'sexual')
   * @param {string} prototypeId - Prototype identifier
   * @returns {string|null} Context path or null for unknown types
   */
  getPrototypeContextPath(type, prototypeId) {
    if (type === 'emotion') {
      return `emotions.${prototypeId}`;
    }
    if (type === 'sexual') {
      return `sexualStates.${prototypeId}`;
    }
    return null;
  }

  /**
   * Gets prototype weights by performing threshold analysis.
   * @param {string} prototypeId - Prototype identifier
   * @param {string} [type='emotion'] - Prototype type
   * @returns {object|null} Weights object or null if unavailable
   */
  getPrototypeWeights(prototypeId, type = 'emotion') {
    if (!this.#prototypeConstraintAnalyzer) return null;

    try {
      const analysis = this.#prototypeConstraintAnalyzer.analyzeEmotionThreshold(
        prototypeId,
        type,
        0.5, // Threshold doesn't matter for weight extraction
        null
      );
      return analysis?.weights ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Gets gate trace signals from a context for a specific prototype.
   * @param {object} context - Stored context with gateTrace
   * @param {string} type - Prototype type ('emotion' or 'sexual')
   * @param {string} prototypeId - Prototype identifier
   * @returns {object|null} Gate trace signals or null if unavailable
   */
  getGateTraceSignals(context, type, prototypeId) {
    const gateTrace = context?.gateTrace ?? null;
    if (!gateTrace || !prototypeId) {
      return null;
    }
    if (type === 'emotion') {
      return gateTrace.emotions?.[prototypeId] ?? null;
    }
    if (type === 'sexual') {
      return gateTrace.sexualStates?.[prototypeId] ?? null;
    }
    return null;
  }

  /**
   * Gets the variables with lowest coverage ratings, sorted by severity.
   * @param {Array} variables - Array of variable coverage objects
   * @param {number} limit - Maximum number of variables to return
   * @returns {Array} Sorted and limited array of lowest coverage variables
   */
  getLowestCoverageVariables(variables, limit) {
    if (!Array.isArray(variables) || variables.length === 0) {
      return [];
    }

    const ratingRank = {
      poor: 0,
      partial: 1,
      good: 2,
    };

    return variables
      .filter((variable) => variable && variable.rating && variable.rating !== 'unknown')
      .sort((a, b) => {
        const rankA = ratingRank[a.rating] ?? 99;
        const rankB = ratingRank[b.rating] ?? 99;
        if (rankA !== rankB) return rankA - rankB;

        const rangeA = typeof a.rangeCoverage === 'number' ? a.rangeCoverage : 1;
        const rangeB = typeof b.rangeCoverage === 'number' ? b.rangeCoverage : 1;
        if (rangeA !== rangeB) return rangeA - rangeB;

        const binA = typeof a.binCoverage === 'number' ? a.binCoverage : 1;
        const binB = typeof b.binCoverage === 'number' ? b.binCoverage : 1;
        if (binA !== binB) return binA - binB;

        return String(a.variablePath).localeCompare(String(b.variablePath));
      })
      .slice(0, limit);
  }
}

export default ReportDataExtractor;
