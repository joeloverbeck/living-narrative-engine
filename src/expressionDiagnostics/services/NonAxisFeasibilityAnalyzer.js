/**
 * @file NonAxisFeasibilityAnalyzer - Analyzes feasibility of non-axis clauses
 * @description Service to analyze feasibility of non-axis clauses within the mood regime
 * population, computing pass rates, max values, and classifying each clause as
 * IMPOSSIBLE, RARE, or OK.
 * @see specs/prototype-fit-blockers-scope-disambiguation.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Simple djb2 hash for generating deterministic clause IDs.
 * Not cryptographically secure - used only for identifier generation.
 *
 * @param {string} str - Input string to hash
 * @returns {string} Hexadecimal hash string
 */
function hashString(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Classification result for a non-axis clause feasibility analysis.
 *
 * @typedef {'IMPOSSIBLE' | 'RARE' | 'OK' | 'UNKNOWN'} FeasibilityClassification
 */

/**
 * Evidence object for feasibility result.
 *
 * @typedef {object} FeasibilityEvidence
 * @property {string | null} bestSampleRef - Reference to the best sample (if any).
 * @property {string} note - Explanatory note about the classification.
 */

/**
 * Result of analyzing a single non-axis clause's feasibility.
 *
 * @typedef {object} NonAxisClauseFeasibility
 * @property {string} clauseId - Deterministic hash identifier for the clause.
 * @property {string} sourcePath - Path in the original prerequisites tree for tracing.
 * @property {string} varPath - Normalized variable path (e.g., 'emotions.confusion').
 * @property {string} operator - Comparison operator (>=, >, <=, <, ==, !=).
 * @property {number} threshold - Threshold value for the comparison.
 * @property {'final' | 'delta'} signal - Signal type: 'final' for non-delta, 'delta' for delta clauses.
 * @property {'in_regime'} population - Always 'in_regime' for this analyzer.
 * @property {number | null} passRate - Proportion of contexts passing the clause (0-1).
 * @property {number | null} maxValue - Maximum observed value for the variable.
 * @property {number | null} p95Value - 95th percentile value for the variable.
 * @property {number | null} marginMax - Difference between maxValue and threshold.
 * @property {FeasibilityClassification} classification - Feasibility classification result.
 * @property {FeasibilityEvidence} evidence - Evidence supporting the classification.
 */

/**
 * Epsilon tolerance for floating point comparisons.
 *
 * @type {number}
 */
const EPS = 1e-6;

/**
 * Threshold for RARE classification (0.1%).
 *
 * @type {number}
 */
const RARE_THRESHOLD = 0.001;

/**
 * Analyzes feasibility of non-axis clauses within the mood regime population.
 */
class NonAxisFeasibilityAnalyzer {
  /** @type {import('../../interfaces/ILogger.js').ILogger} */
  #logger;

  /** @type {import('./NonAxisClauseExtractor.js').default} */
  #clauseExtractor;

  /**
   * Create a NonAxisFeasibilityAnalyzer instance.
   *
   * @param {object} params - Constructor parameters.
   * @param {import('../../interfaces/ILogger.js').ILogger} params.logger - Logger instance.
   * @param {import('./NonAxisClauseExtractor.js').default} params.clauseExtractor - Clause extractor service.
   */
  constructor({ logger, clauseExtractor }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(clauseExtractor, 'INonAxisClauseExtractor', logger, {
      requiredMethods: ['extract'],
    });
    this.#logger = logger;
    this.#clauseExtractor = clauseExtractor;
  }

  /**
   * Analyze non-axis clause feasibility within the in-regime population.
   *
   * @param {Array<{logic?: object}>} prerequisites - Expression prerequisites array.
   * @param {Array<object>} inRegimeContexts - Array of Monte Carlo contexts that passed prototype gates.
   * @param {string} expressionId - Expression identifier for deterministic clause ID generation.
   * @returns {NonAxisClauseFeasibility[]} Array of feasibility results for each non-axis clause.
   */
  analyze(prerequisites, inRegimeContexts, expressionId) {
    const clauses = this.#clauseExtractor.extract(prerequisites);

    if (clauses.length === 0) {
      this.#logger.debug(
        'NonAxisFeasibilityAnalyzer: no non-axis clauses found'
      );
      return [];
    }

    const results = clauses.map((clause) =>
      this.#analyzeClause(clause, inRegimeContexts, expressionId)
    );

    this.#logger.debug(
      `NonAxisFeasibilityAnalyzer: analyzed ${results.length} clause(s)`
    );

    return results;
  }

  /**
   * Analyze a single clause against the in-regime contexts.
   *
   * @param {import('./NonAxisClauseExtractor.js').ExtractedClause} clause - Extracted clause.
   * @param {Array<object>} contexts - In-regime contexts.
   * @param {string} expressionId - Expression identifier.
   * @returns {NonAxisClauseFeasibility} Feasibility result.
   */
  #analyzeClause(clause, contexts, expressionId) {
    const clauseId = this.#generateClauseId(expressionId, clause);
    const signal = clause.isDelta ? 'delta' : 'final';

    if (!Array.isArray(contexts) || contexts.length === 0) {
      return this.#createEmptyFeasibility(clause, clauseId, signal);
    }

    const values = this.#collectValues(clause, contexts, signal);

    if (values.length === 0) {
      return this.#createEmptyFeasibility(clause, clauseId, signal);
    }

    const passCount = values.filter((v) =>
      this.#clausePasses(clause, v)
    ).length;
    const passRate = passCount / values.length;

    const sortedValues = [...values].sort((a, b) => a - b);
    const maxValue = sortedValues[sortedValues.length - 1];
    const p95Value = this.#computePercentile(sortedValues, 0.95);
    const marginMax = maxValue - clause.threshold;

    const classification = this.#classify(
      passRate,
      maxValue,
      clause.threshold,
      clause.operator
    );

    const bestSampleRef = passCount > 0 ? this.#findBestSampleRef(clause, contexts, signal) : null;
    const note = this.#generateEvidenceNote(
      passRate,
      maxValue,
      clause.threshold,
      clause.varPath,
      clause.operator,
      classification,
      signal
    );

    return {
      clauseId,
      sourcePath: clause.sourcePath,
      varPath: clause.varPath,
      operator: clause.operator,
      threshold: clause.threshold,
      signal,
      population: 'in_regime',
      passRate,
      maxValue,
      p95Value,
      marginMax,
      classification,
      evidence: {
        bestSampleRef,
        note,
      },
    };
  }

  /**
   * Collect values for a clause from contexts.
   *
   * @param {import('./NonAxisClauseExtractor.js').ExtractedClause} clause - The clause.
   * @param {Array<object>} contexts - In-regime contexts.
   * @param {'final' | 'delta'} signal - Signal type.
   * @returns {number[]} Array of numeric values.
   */
  #collectValues(clause, contexts, signal) {
    const values = [];

    for (const context of contexts) {
      let value;

      if (signal === 'delta') {
        // For delta clauses, we need both current and previous values
        const currentValue = this.#evaluateVarPath(clause.varPath, context);
        const previousPath = this.#getPreviousPath(clause.varPath);
        const previousValue = this.#evaluateVarPath(previousPath, context);

        if (typeof currentValue === 'number' && typeof previousValue === 'number') {
          value = currentValue - previousValue;
        } else {
          value = null;
        }
      } else {
        value = this.#evaluateVarPath(clause.varPath, context);
      }

      if (typeof value === 'number' && !Number.isNaN(value)) {
        values.push(value);
      }
    }

    return values;
  }

  /**
   * Get the previous path for a delta clause.
   *
   * @param {string} varPath - Current variable path.
   * @returns {string} Previous variable path.
   */
  #getPreviousPath(varPath) {
    if (varPath.startsWith('emotions.')) {
      return 'previousEmotions.' + varPath.slice('emotions.'.length);
    }
    if (varPath.startsWith('sexualStates.')) {
      return 'previousSexualStates.' + varPath.slice('sexualStates.'.length);
    }
    // Fallback: prefix with 'previous'
    return 'previous' + varPath.charAt(0).toUpperCase() + varPath.slice(1);
  }

  /**
   * Evaluate a variable path on a context object.
   *
   * @param {string} varPath - Dot-separated path (e.g., 'emotions.confusion').
   * @param {object} context - Context object.
   * @returns {unknown} Value at the path or null if not found.
   */
  #evaluateVarPath(varPath, context) {
    if (!context || typeof context !== 'object') {
      return null;
    }

    const parts = varPath.split('.');
    let current = context;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return null;
      }
      if (typeof current !== 'object') {
        return null;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Check if a clause passes for a given value.
   *
   * @param {import('./NonAxisClauseExtractor.js').ExtractedClause} clause - The clause.
   * @param {number} value - Value to test.
   * @returns {boolean} True if the clause condition is satisfied.
   */
  #clausePasses(clause, value) {
    const { operator, threshold } = clause;

    switch (operator) {
      case '>=':
        return value >= threshold;
      case '>':
        return value > threshold;
      case '<=':
        return value <= threshold;
      case '<':
        return value < threshold;
      case '==':
        return Math.abs(value - threshold) < EPS;
      case '!=':
        return Math.abs(value - threshold) >= EPS;
      default:
        this.#logger.warn(
          `NonAxisFeasibilityAnalyzer: unknown operator "${operator}"`
        );
        return false;
    }
  }

  /**
   * Classify clause feasibility based on pass rate and max value.
   *
   * @param {number} passRate - Pass rate (0-1).
   * @param {number} maxValue - Maximum observed value.
   * @param {number} threshold - Clause threshold.
   * @param {string} operator - Comparison operator.
   * @returns {FeasibilityClassification} Classification result.
   */
  #classify(passRate, maxValue, threshold, operator) {
    // For >= and > operators, IMPOSSIBLE if passRate === 0 AND maxValue < threshold - eps
    // For <= and < operators, IMPOSSIBLE if passRate === 0 AND minValue > threshold + eps
    // Since we track maxValue, we use a simplified rule for >= and >
    if (passRate === 0) {
      const isUpperBoundOp = operator === '>=' || operator === '>';
      if (isUpperBoundOp && maxValue < threshold - EPS) {
        return 'IMPOSSIBLE';
      }
      // For lower-bound operators, we would need minValue
      // But since passRate === 0, that's also effectively impossible
      return 'IMPOSSIBLE';
    }

    if (passRate > 0 && passRate < RARE_THRESHOLD) {
      return 'RARE';
    }

    return 'OK';
  }

  /**
   * Compute a percentile value from sorted data.
   *
   * @param {number[]} sortedValues - Sorted array of values.
   * @param {number} percentile - Percentile (0-1).
   * @returns {number} Percentile value.
   */
  #computePercentile(sortedValues, percentile) {
    if (sortedValues.length === 0) {
      return 0;
    }
    if (sortedValues.length === 1) {
      return sortedValues[0];
    }

    const index = percentile * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const fraction = index - lower;

    if (lower === upper) {
      return sortedValues[lower];
    }

    return sortedValues[lower] * (1 - fraction) + sortedValues[upper] * fraction;
  }

  /**
   * Generate a deterministic clause ID.
   *
   * @param {string} expressionId - Expression identifier.
   * @param {import('./NonAxisClauseExtractor.js').ExtractedClause} clause - Extracted clause.
   * @returns {string} Deterministic clause ID.
   */
  #generateClauseId(expressionId, clause) {
    const components = [
      expressionId,
      clause.varPath,
      clause.operator,
      String(clause.threshold),
      clause.isDelta ? 'delta' : 'final',
    ];

    const hash = hashString(components.join('|'));
    return `clause_${hash}`;
  }

  /**
   * Find the best sample reference (first passing context).
   *
   * @param {import('./NonAxisClauseExtractor.js').ExtractedClause} clause - The clause.
   * @param {Array<object>} contexts - In-regime contexts.
   * @param {'final' | 'delta'} signal - Signal type.
   * @returns {string | null} Sample reference or null.
   */
  #findBestSampleRef(clause, contexts, signal) {
    for (let i = 0; i < contexts.length; i++) {
      const context = contexts[i];
      let value;

      if (signal === 'delta') {
        const currentValue = this.#evaluateVarPath(clause.varPath, context);
        const previousPath = this.#getPreviousPath(clause.varPath);
        const previousValue = this.#evaluateVarPath(previousPath, context);

        if (typeof currentValue === 'number' && typeof previousValue === 'number') {
          value = currentValue - previousValue;
        }
      } else {
        value = this.#evaluateVarPath(clause.varPath, context);
      }

      if (typeof value === 'number' && this.#clausePasses(clause, value)) {
        return `sample_${i}`;
      }
    }
    return null;
  }

  /**
   * Generate an evidence note for the classification.
   *
   * @param {number} passRate - Pass rate (0-1).
   * @param {number} maxValue - Maximum observed value.
   * @param {number} threshold - Clause threshold.
   * @param {string} varPath - Variable path.
   * @param {string} operator - Comparison operator.
   * @param {FeasibilityClassification} classification - Classification result.
   * @param {'final' | 'delta'} signal - Signal type.
   * @returns {string} Evidence note.
   */
  #generateEvidenceNote(
    passRate,
    maxValue,
    threshold,
    varPath,
    operator,
    classification,
    signal
  ) {
    const percentStr = (passRate * 100).toFixed(1);
    const maxStr = maxValue.toFixed(3);
    const thresholdStr = threshold.toFixed(3);

    switch (classification) {
      case 'IMPOSSIBLE': {
        const gap = Math.abs(threshold - maxValue).toFixed(3);
        return `${varPath} ${operator} ${thresholdStr} but max(${signal})=${maxStr} in-regime (${gap} short, ${percentStr}% pass)`;
      }
      case 'RARE':
        return `${varPath} ${operator} ${thresholdStr}: rarely met (${percentStr}% pass, max(${signal})=${maxStr})`;
      case 'OK':
        return `${varPath} ${operator} ${thresholdStr}: achievable (${percentStr}% pass, max(${signal})=${maxStr})`;
      case 'UNKNOWN':
        return `${varPath} ${operator} ${thresholdStr}: insufficient data for analysis`;
      default:
        return `${varPath} ${operator} ${thresholdStr}: ${percentStr}% pass rate`;
    }
  }

  /**
   * Create an empty feasibility result for when contexts are unavailable.
   *
   * @param {import('./NonAxisClauseExtractor.js').ExtractedClause} clause - The clause.
   * @param {string} clauseId - Generated clause ID.
   * @param {'final' | 'delta'} signal - Signal type.
   * @returns {NonAxisClauseFeasibility} Empty feasibility result.
   */
  #createEmptyFeasibility(clause, clauseId, signal) {
    return {
      clauseId,
      sourcePath: clause.sourcePath,
      varPath: clause.varPath,
      operator: clause.operator,
      threshold: clause.threshold,
      signal,
      population: 'in_regime',
      passRate: null,
      maxValue: null,
      p95Value: null,
      marginMax: null,
      classification: 'UNKNOWN',
      evidence: {
        bestSampleRef: null,
        note: `${clause.varPath} ${clause.operator} ${clause.threshold.toFixed(3)}: insufficient data for analysis`,
      },
    };
  }
}

export default NonAxisFeasibilityAnalyzer;
