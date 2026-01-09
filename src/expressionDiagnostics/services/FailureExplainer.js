/**
 * @file FailureExplainer - Generates human-readable failure explanations
 * @see specs/expression-diagnostics.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import DiagnosticResult from '../models/DiagnosticResult.js';

/**
 * @typedef {object} FailureExplanation
 * @property {string} summary - One-line summary
 * @property {string} detail - Detailed explanation
 * @property {string} severity - 'critical' | 'high' | 'medium' | 'low'
 * @property {string[]} suggestions - Actionable suggestions
 */

/**
 * @typedef {object} BlockerAnalysis
 * @property {string} clauseDescription
 * @property {number} failureRate
 * @property {number} averageViolation
 * @property {FailureExplanation} explanation
 * @property {number} rank - 1 = worst blocker
 */

/**
 * Analyzes Monte Carlo clause failure data and generates human-readable
 * explanations. Transforms raw statistical data into actionable insights
 * that help content authors understand why expressions are rare or failing.
 */
class FailureExplainer {
  /** @type {object} */
  #dataRegistry;

  /** @type {object} */
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.dataRegistry - IDataRegistry for prototype lookups
   * @param {object} deps.logger - ILogger
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Analyze clause failures and generate explanations
   *
   * @param {import('./MonteCarloSimulator.js').ClauseResult[]} clauseFailures
   * @param {object} [context] - Additional context (expression, etc.)
   * @returns {BlockerAnalysis[]}
   */
  analyzeBlockers(clauseFailures, context = {}) {
    if (!clauseFailures || clauseFailures.length === 0) {
      this.#logger.debug('FailureExplainer: No clause failures to analyze');
      return [];
    }

    this.#logger.debug(
      `FailureExplainer: Analyzing ${clauseFailures.length} clause failures`
    );

    // Sort by failure rate descending
    const sorted = [...clauseFailures].sort(
      (a, b) => b.failureRate - a.failureRate
    );

    return sorted.map((clause, index) => ({
      clauseDescription: clause.clauseDescription,
      failureRate: clause.failureRate,
      averageViolation: clause.averageViolation,
      explanation: this.#generateExplanation(clause, context),
      rank: index + 1,
    }));
  }

  /**
   * Get top N blockers
   *
   * @param {import('./MonteCarloSimulator.js').ClauseResult[]} clauseFailures
   * @param {number} [n] - Number of top blockers
   * @returns {BlockerAnalysis[]}
   */
  getTopBlockers(clauseFailures, n = 3) {
    const analyzed = this.analyzeBlockers(clauseFailures);
    return analyzed.slice(0, n);
  }

  /**
   * Generate overall summary for an expression
   *
   * @param {number} triggerRate
   * @param {BlockerAnalysis[]} blockers
   * @returns {string}
   */
  generateSummary(triggerRate, blockers) {
    const ratePercent = (triggerRate * 100).toFixed(3);
    const { RARITY_THRESHOLDS } = DiagnosticResult;

    if (triggerRate === 0) {
      return `Expression never triggers. ${blockers.length > 0 ? `Primary blocker: ${blockers[0].clauseDescription}` : 'No specific blocker identified.'}`;
    }

    if (triggerRate < RARITY_THRESHOLDS.EXTREMELY_RARE) {
      return `Expression is extremely rare (${ratePercent}%). Top blocker: ${blockers[0]?.clauseDescription || 'Unknown'}`;
    }

    if (triggerRate < RARITY_THRESHOLDS.RARE) {
      return `Expression triggers rarely (${ratePercent}%). ${blockers.length} clause(s) frequently fail.`;
    }

    if (triggerRate < RARITY_THRESHOLDS.NORMAL) {
      return `Expression triggers occasionally (${ratePercent}%). Consider adjusting thresholds.`;
    }

    return `Expression triggers at healthy rate (${ratePercent}%).`;
  }


  /**
   * Analyze blockers with hierarchical breakdown support.
   * Returns enhanced blocker data including hierarchical tree and worst offenders.
   *
   * @param {import('./MonteCarloSimulator.js').ClauseResult[]} clauseFailures
   * @param {object} [context] - Additional context
   * @returns {Array<BlockerAnalysis & {hasHierarchy: boolean, hierarchicalBreakdown: object|null, worstOffenders: Array}>}
   */
  analyzeHierarchicalBlockers(clauseFailures, context = {}) {
    if (!clauseFailures || clauseFailures.length === 0) {
      this.#logger.debug(
        'FailureExplainer: No clause failures to analyze hierarchically'
      );
      return [];
    }

    this.#logger.debug(
      `FailureExplainer: Analyzing ${clauseFailures.length} clause failures with hierarchy`
    );

    // Sort by failure rate descending
    const sorted = [...clauseFailures].sort(
      (a, b) => b.failureRate - a.failureRate
    );

    return sorted.map((clause, index) => {
      const hasHierarchy =
        clause.hierarchicalBreakdown !== null &&
        clause.hierarchicalBreakdown !== undefined;

      let worstOffenders = [];
      if (hasHierarchy) {
        worstOffenders = this.flattenHierarchy(
          clause.hierarchicalBreakdown,
          0.5
        ).slice(0, 5);
      }

      return {
        clauseDescription: clause.clauseDescription,
        failureRate: clause.failureRate,
        averageViolation: clause.averageViolation,
        explanation: this.#generateExplanation(clause, context),
        rank: index + 1,
        hasHierarchy,
        hierarchicalBreakdown: clause.hierarchicalBreakdown || null,
        worstOffenders,
      };
    });
  }

  /**
   * Flatten a hierarchical tree to a sorted list of leaf nodes.
   * Filters to only include nodes above the minimum failure rate threshold.
   *
   * @param {object} tree - Hierarchical breakdown tree (from toJSON)
   * @param {number} [minFailureRate] - Minimum failure rate to include
   * @returns {Array<{id: string, description: string, failureRate: number, averageViolation: number, severity: string, depth: number}>}
   */
  flattenHierarchy(tree, minFailureRate = 0) {
    if (!tree) return [];

    const results = [];
    this.#collectLeafNodes(tree, results, minFailureRate, 0);

    // Sort by failure rate descending
    return results.sort((a, b) => b.failureRate - a.failureRate);
  }

  /**
   * Recursively collect leaf nodes from hierarchical tree.
   *
   * @private
   * @param {object} node - Current tree node
   * @param {Array} results - Array to collect results into
   * @param {number} minFailureRate - Minimum failure rate threshold
   * @param {number} depth - Current depth in tree
   */
  #collectLeafNodes(node, results, minFailureRate, depth) {
    if (!node) return;

    // If this is a leaf node, add it if above threshold
    if (!node.isCompound || node.nodeType === 'leaf') {
      if (node.failureRate >= minFailureRate) {
        results.push({
          id: node.id,
          description: node.description,
          failureRate: node.failureRate,
          averageViolation: node.averageViolation,
          severity: this.#categorizeSeverity(node.failureRate),
          depth,
        });
      }
    }

    // Recurse into children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        this.#collectLeafNodes(child, results, minFailureRate, depth + 1);
      }
    }
  }

  /**
   * Generate explanation for a single clause failure
   *
   * @private
   * @param {import('./MonteCarloSimulator.js').ClauseResult} clause
   * @param {object} context
   * @param _context
   * @returns {FailureExplanation}
   */
  #generateExplanation(clause, _context) {
    const severity = this.#categorizeSeverity(clause.failureRate);
    const parsed = this.#parseClauseDescription(clause.clauseDescription);

    let summary = '';
    let detail = '';
    const suggestions = [];

    if (parsed.type === 'threshold') {
      summary = `${parsed.variable} rarely reaches ${parsed.threshold}`;
      detail = this.#generateThresholdDetail(parsed, clause);
      suggestions.push(...this.#generateThresholdSuggestions(parsed, clause));
    } else if (parsed.type === 'compound') {
      summary = `Compound condition fails ${(clause.failureRate * 100).toFixed(1)}% of the time`;
      detail = `This ${parsed.operator} clause with ${parsed.count} conditions is too restrictive.`;
      suggestions.push(
        'Consider simplifying or splitting into separate expressions'
      );
    } else {
      summary = `Clause fails ${(clause.failureRate * 100).toFixed(1)}% of the time`;
      detail = clause.clauseDescription;
      suggestions.push('Review the clause logic for overly strict conditions');
    }

    return { summary, detail, severity, suggestions };
  }

  /**
   * Parse clause description into structured data
   *
   * @private
   * @param {string} description
   * @returns {{type: string, [key: string]: any}}
   */
  #parseClauseDescription(description) {
    // Match "variable >= threshold" pattern
    const thresholdMatch = description.match(
      /^([\w.]+)\s*(>=|<=|>|<|==)\s*([\d.]+)$/
    );
    if (thresholdMatch) {
      return {
        type: 'threshold',
        variable: thresholdMatch[1],
        operator: thresholdMatch[2],
        threshold: parseFloat(thresholdMatch[3]),
      };
    }

    // Match "AND/OR of N conditions"
    const compoundMatch = description.match(
      /^(AND|OR)\s+of\s+(\d+)\s+conditions$/
    );
    if (compoundMatch) {
      return {
        type: 'compound',
        operator: compoundMatch[1],
        count: parseInt(compoundMatch[2], 10),
      };
    }

    return { type: 'unknown', raw: description };
  }

  /**
   * Generate detailed explanation for threshold failures
   *
   * @private
   * @param {{type: string, variable: string, operator: string, threshold: number}} parsed
   * @param {import('./MonteCarloSimulator.js').ClauseResult} clause
   * @returns {string}
   */
  #generateThresholdDetail(parsed, clause) {
    const violationInfo =
      clause.averageViolation > 0
        ? ` Average shortfall: ${clause.averageViolation.toFixed(3)}`
        : '';

    if (parsed.variable.startsWith('emotions.')) {
      const emotionId = parsed.variable.replace('emotions.', '');
      const prototype = this.#getEmotionPrototype(emotionId);
      if (prototype) {
        return `Emotion "${emotionId}" requires ${parsed.operator} ${parsed.threshold}.${violationInfo} This emotion is weighted toward: ${this.#describeWeights(prototype.weights)}`;
      }
    }

    if (parsed.variable.startsWith('sexualStates.')) {
      const stateId = parsed.variable.replace('sexualStates.', '');
      return `Sexual state "${stateId}" requires ${parsed.operator} ${parsed.threshold}.${violationInfo}`;
    }

    return `Value ${parsed.variable} must be ${parsed.operator} ${parsed.threshold}.${violationInfo}`;
  }

  /**
   * Generate suggestions for threshold failures
   *
   * @private
   * @param {{type: string, variable: string, operator: string, threshold: number}} parsed
   * @param {import('./MonteCarloSimulator.js').ClauseResult} clause
   * @returns {string[]}
   */
  #generateThresholdSuggestions(parsed, clause) {
    const suggestions = [];

    if (parsed.threshold > 0.8) {
      suggestions.push(
        `Consider lowering threshold from ${parsed.threshold} to ~${(parsed.threshold * 0.8).toFixed(2)}`
      );
    }

    if (clause.averageViolation > 0.2) {
      const suggestedThreshold = Math.max(
        0,
        parsed.threshold - clause.averageViolation
      );
      suggestions.push(
        `Based on violations, try threshold ~${suggestedThreshold.toFixed(2)}`
      );
    }

    if (suggestions.length === 0) {
      suggestions.push(
        'This threshold may be appropriate - consider if rarity is intentional'
      );
    }

    return suggestions;
  }

  /**
   * Categorize severity based on failure rate
   *
   * @private
   * @param {number} failureRate
   * @returns {'critical' | 'high' | 'medium' | 'low'}
   */
  #categorizeSeverity(failureRate) {
    if (failureRate >= 0.99) return 'critical';
    if (failureRate >= 0.9) return 'high';
    if (failureRate >= 0.7) return 'medium';
    return 'low';
  }

  /**
   * Get emotion prototype from registry
   *
   * @private
   * @param {string} emotionId
   * @returns {object|null}
   */
  #getEmotionPrototype(emotionId) {
    const lookup = this.#dataRegistry.get('lookups', 'core:emotion_prototypes');
    return lookup?.entries?.[emotionId] || null;
  }

  /**
   * Describe prototype weights in human-readable form
   *
   * @private
   * @param {Object<string, number>} weights
   * @returns {string}
   */
  #describeWeights(weights) {
    if (!weights) return 'unknown';

    return (
      Object.entries(weights)
        .filter(([, w]) => Math.abs(w) > 0.1)
        .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
        .slice(0, 3)
        .map(
          ([axis, weight]) =>
            `${axis} (${weight > 0 ? '+' : ''}${weight.toFixed(2)})`
        )
        .join(', ') || 'no significant weights'
    );
  }
}

export default FailureExplainer;
