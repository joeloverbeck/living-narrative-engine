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

    let summary = '';

    if (triggerRate === 0) {
      summary = `Expression never triggers. ${blockers.length > 0 ? `Primary blocker: ${blockers[0].clauseDescription}` : 'No specific blocker identified.'}`;
    } else if (triggerRate < RARITY_THRESHOLDS.EXTREMELY_RARE) {
      summary = `Expression is extremely rare (${ratePercent}%). Top blocker: ${blockers[0]?.clauseDescription || 'Unknown'}`;
    } else if (triggerRate < RARITY_THRESHOLDS.RARE) {
      summary = `Expression triggers rarely (${ratePercent}%). ${blockers.length} clause(s) frequently fail.`;
    } else if (triggerRate < RARITY_THRESHOLDS.NORMAL) {
      summary = `Expression triggers occasionally (${ratePercent}%). Consider adjusting thresholds.`;
    } else {
      summary = `Expression triggers at healthy rate (${ratePercent}%).`;
    }

    // NEW: Add advanced insights if available
    const decisiveBlocker = blockers.find(
      (b) => b.advancedAnalysis?.lastMileAnalysis?.isDecisive
    );

    if (decisiveBlocker) {
      const lastMilePercent = (
        (decisiveBlocker.lastMileFailRate ?? 0) * 100
      ).toFixed(1);
      summary += ` Focus on "${decisiveBlocker.clauseDescription}" (${lastMilePercent}% last-mile failure).`;
    }

    const ceilingBlocker = blockers.find(
      (b) => b.advancedAnalysis?.ceilingAnalysis?.status === 'ceiling_detected'
    );

    if (ceilingBlocker) {
      summary += ` Warning: "${ceilingBlocker.clauseDescription}" has a ceiling effect and cannot be triggered.`;
    }

    return summary;
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

    // Collect all last-mile failure rates for relative ranking
    const allLastMileRates = clauseFailures
      .map((c) => c.lastMileFailRate)
      .filter((r) => r !== null && r !== undefined);

    return (
      clauseFailures
        .map((clause) => {
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
            // Pass through new metrics for summary access
            lastMileFailRate: clause.lastMileFailRate ?? null,
            explanation: this.#generateExplanation(clause, context),
            rank: 0, // Will be set after sort
            severity: this.#categorizeSeverity(clause.failureRate),
            // NEW: Advanced metrics analysis with sibling context for relative ranking
            advancedAnalysis: this.#analyzeAdvancedMetrics(
              clause,
              allLastMileRates
            ),
            // NEW: Priority score for sorting
            priorityScore: this.#calculatePriorityScore(clause),
            // Existing hierarchy fields
            hasHierarchy,
            hierarchicalBreakdown: clause.hierarchicalBreakdown || null,
            worstOffenders,
          };
        })
        // NEW: Sort by priority score (last-mile weighted)
        .sort((a, b) => b.priorityScore - a.priorityScore)
        // Re-rank after sorting
        .map((blocker, index) => ({ ...blocker, rank: index + 1 }))
    );
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
          parentNodeType: node.parentNodeType || null,
          isOrChild: node.parentNodeType === 'or',
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

  // ========================================================================
  // Advanced Metrics Analysis Methods (MONCARADVMET-008)
  // ========================================================================

  /**
   * Analyze violation percentile distribution
   *
   * @private
   * @param {object} clause - Clause result with advanced metrics
   * @returns {{status: string, insight: string|null}}
   */
  #analyzePercentiles(clause) {
    const { averageViolation, violationP50, violationP90 } = clause;

    if (violationP50 === null || violationP50 === undefined) {
      return { status: 'no_data', insight: null };
    }

    // Heavy-tailed: median much lower than mean
    if (violationP50 < averageViolation * 0.5) {
      return {
        status: 'heavy_tail',
        insight: 'Outliers are skewing the mean; most failures are minor',
      };
    }

    // Some severe: p90 much higher than mean
    if (violationP90 > averageViolation * 2) {
      return {
        status: 'some_severe',
        insight: 'Some samples fail badly while most are moderate',
      };
    }

    return {
      status: 'normal',
      insight: 'Violations are normally distributed; mean is trustworthy',
    };
  }

  /**
   * Analyze near-miss tunability
   *
   * @private
   * @param {object} clause - Clause result with advanced metrics
   * @returns {{status: string, tunability: string|null, insight?: string}}
   */
  #analyzeNearMiss(clause) {
    const { nearMissRate } = clause;

    if (nearMissRate === null || nearMissRate === undefined) {
      return { status: 'no_data', tunability: null };
    }

    if (nearMissRate > 0.1) {
      return {
        status: 'high',
        tunability: 'high',
        insight: 'Many samples are borderline; threshold tweaks will help',
      };
    }

    if (nearMissRate < 0.02) {
      return {
        status: 'low',
        tunability: 'low',
        insight: 'Values are far from threshold; tune prototypes/gates instead',
      };
    }

    return {
      status: 'moderate',
      tunability: 'moderate',
      insight: 'Some samples are near threshold; tweaks may help',
    };
  }

  /**
   * Detect ceiling effects (threshold unreachable)
   *
   * @private
   * @param {object} clause - Clause result with advanced metrics
   * @returns {{status: string, achievable: boolean|null, gap?: number, headroom?: number, insight?: string}}
   */
  #analyzeCeiling(clause) {
    const { ceilingGap, maxObserved, thresholdValue } = clause;

    if (
      ceilingGap === null ||
      ceilingGap === undefined ||
      maxObserved === null ||
      maxObserved === undefined
    ) {
      return { status: 'no_data', achievable: null };
    }

    if (ceilingGap > 0) {
      return {
        status: 'ceiling_detected',
        achievable: false,
        gap: ceilingGap,
        insight: `Max observed (${maxObserved.toFixed(2)}) never reached threshold (${thresholdValue.toFixed(2)})`,
      };
    }

    return {
      status: 'achievable',
      achievable: true,
      headroom: -ceilingGap,
      insight: `Threshold is achievable (max observed: ${maxObserved.toFixed(2)})`,
    };
  }

  /**
   * Analyze last-mile blocker status using relative ranking among siblings.
   *
   * The previous implementation used an absolute ratio threshold (> 1.5) that was
   * mathematically unreachable in practice, causing all clauses to show
   * "Other clauses fail first" which created circular, unhelpful recommendations.
   *
   * The new approach uses relative ranking: the clause with the highest last-mile
   * failure rate among its siblings is considered decisive, with contextual
   * recommendations for other clauses based on their relative position.
   *
   * @private
   * @param {object} clause - Clause result with advanced metrics
   * @param {number[]} [siblingLastMileRates] - All sibling last-mile rates for relative ranking
   * @returns {{status: string, isDecisive: boolean, insight?: string}}
   */
  #analyzeLastMile(clause, siblingLastMileRates = []) {
    const { lastMileFailRate, isSingleClause } = clause;

    // Check if this is a compound node (AND/OR block)
    const isCompound = clause.hierarchicalBreakdown?.isCompound ?? false;

    if (isSingleClause && isCompound) {
      // This is a compound block that is the only prerequisite
      // The "single clause" logic doesn't apply meaningfully here
      return {
        status: 'compound_single_prereq',
        insight:
          'This compound block contains the only prerequisite; analyze individual leaf conditions for actionable insights',
        isDecisive: true,
      };
    }

    if (isSingleClause) {
      return {
        status: 'single_clause',
        insight: 'This is the only clause; last-mile equals failure rate',
        isDecisive: true,
      };
    }

    if (lastMileFailRate === null || lastMileFailRate === undefined) {
      return { status: 'no_data', isDecisive: false };
    }

    // Relative ranking: compare against all sibling rates
    const validSiblingRates = siblingLastMileRates.filter(
      (r) => r !== null && r !== undefined
    );
    const maxSiblingRate =
      validSiblingRates.length > 0 ? Math.max(...validSiblingRates) : 0;

    // Thresholds for relative ranking
    const NEAR_TOP_THRESHOLD = 0.8; // Within 80% of max is "near top"
    const SIGNIFICANT_IMPACT_MIN = 0.05; // 5% minimum for significance
    const LOW_PRIORITY_THRESHOLD = 0.5; // Below 50% of max is "lower priority"

    // Handle edge case: only one clause with data
    if (validSiblingRates.length <= 1) {
      // If only one clause, it's decisive by default if it has significant impact
      if (lastMileFailRate >= SIGNIFICANT_IMPACT_MIN) {
        return {
          status: 'decisive_blocker',
          isDecisive: true,
          insight: 'This is the primary bottleneck - tune this first',
        };
      }
      return {
        status: 'rarely_decisive',
        isDecisive: false,
        insight: 'This clause rarely blocks alone',
      };
    }

    // Relative ranking with multiple clauses
    const isHighestOrNear = lastMileFailRate >= maxSiblingRate * NEAR_TOP_THRESHOLD;
    const hasSignificantImpact = lastMileFailRate >= SIGNIFICANT_IMPACT_MIN;
    const isLowRelativePriority = lastMileFailRate < maxSiblingRate * LOW_PRIORITY_THRESHOLD;

    // Primary blocker: highest or near-highest with significant absolute impact
    if (isHighestOrNear && hasSignificantImpact) {
      return {
        status: 'decisive_blocker',
        isDecisive: true,
        insight: 'This is the primary bottleneck - tune this first',
      };
    }

    // Very low relative impact: other clauses are more important
    if (isLowRelativePriority && maxSiblingRate >= SIGNIFICANT_IMPACT_MIN) {
      return {
        status: 'lower_priority',
        isDecisive: false,
        insight: 'Other clauses fail more often - focus on those first',
      };
    }

    // Absolute low impact: rarely blocks alone
    if (lastMileFailRate < 0.01) {
      return {
        status: 'rarely_decisive',
        isDecisive: false,
        insight: 'This clause rarely blocks alone; other clauses fail first',
      };
    }

    // Moderate contributor: not primary but still contributes
    return {
      status: 'moderate',
      isDecisive: false,
      insight: 'This clause contributes to blocking; consider tuning after primary blockers',
    };
  }

  /**
   * Generate actionable recommendation based on advanced metrics
   *
   * @private
   * @param {object} clause - Clause result with advanced metrics
   * @param {object} [lastMileAnalysis] - Pre-computed last-mile analysis (with relative ranking)
   * @returns {{action: string, priority: string, message: string}}
   */
  #generateRecommendation(clause, lastMileAnalysis = null) {
    const ceiling = this.#analyzeCeiling(clause);
    const lastMile = lastMileAnalysis || this.#analyzeLastMile(clause);
    const nearMiss = this.#analyzeNearMiss(clause);

    // Priority 1: Ceiling effect (can't be fixed by tuning)
    if (ceiling.status === 'ceiling_detected') {
      return {
        action: 'redesign',
        priority: 'critical',
        message:
          'Threshold is unreachable - consider lowering or adjusting gates/prototypes',
      };
    }

    // Priority 2: Decisive blocker with high tunability
    if (lastMile.isDecisive && nearMiss.tunability === 'high') {
      return {
        action: 'tune_threshold',
        priority: 'high',
        message: 'TUNE THIS FIRST: Decisive blocker with many near-misses',
      };
    }

    // Priority 3: Decisive blocker with low tunability
    if (lastMile.isDecisive && nearMiss.tunability === 'low') {
      return {
        action: 'adjust_upstream',
        priority: 'medium',
        message:
          'Decisive blocker but values are far from threshold - adjust prototypes',
      };
    }

    // Priority 4: Lower priority - not the primary blocker
    // Use contextual message based on status
    if (lastMile.status === 'lower_priority') {
      return {
        action: 'lower_priority',
        priority: 'low',
        message: 'Other clauses fail more often - focus on those first',
      };
    }

    // Priority 5: Moderate contributor
    if (lastMile.status === 'moderate') {
      return {
        action: 'consider_tuning',
        priority: 'low',
        message: 'Contributes to blocking - consider tuning after primary blockers',
      };
    }

    // Priority 6: Rarely decisive
    if (lastMile.status === 'rarely_decisive') {
      return {
        action: 'lower_priority',
        priority: 'low',
        message: 'This clause rarely blocks alone - focus on other clauses',
      };
    }

    return {
      action: 'investigate',
      priority: 'medium',
      message: 'Review clause configuration',
    };
  }

  /**
   * Aggregate all advanced metrics analyses
   *
   * @private
   * @param {object} clause - Clause result with advanced metrics
   * @param {number[]} [siblingLastMileRates] - All sibling last-mile rates for relative ranking
   * @returns {{percentileAnalysis: object, nearMissAnalysis: object, ceilingAnalysis: object, lastMileAnalysis: object, recommendation: object}}
   */
  #analyzeAdvancedMetrics(clause, siblingLastMileRates = []) {
    const lastMileAnalysis = this.#analyzeLastMile(clause, siblingLastMileRates);
    return {
      percentileAnalysis: this.#analyzePercentiles(clause),
      nearMissAnalysis: this.#analyzeNearMiss(clause),
      ceilingAnalysis: this.#analyzeCeiling(clause),
      lastMileAnalysis,
      recommendation: this.#generateRecommendation(clause, lastMileAnalysis),
    };
  }

  /**
   * Calculate priority score for sorting blockers
   * Higher score = tune this first
   *
   * Weighting:
   * - Last-mile rate: 40%
   * - Failure rate: 30%
   * - Near-miss (tunability): 20%
   * - Ceiling effect: 10% penalty if detected
   *
   * @private
   * @param {object} clause - Clause result with advanced metrics
   * @returns {number}
   */
  #calculatePriorityScore(clause) {
    const { failureRate, lastMileFailRate, nearMissRate, ceilingGap } = clause;

    let score = 0;

    // Last-mile contribution (40%)
    if (lastMileFailRate !== null && lastMileFailRate !== undefined) {
      score += lastMileFailRate * 0.4;
    } else {
      score += (failureRate || 0) * 0.4; // Fallback to failure rate
    }

    // Failure rate contribution (30%)
    score += (failureRate || 0) * 0.3;

    // Near-miss tunability bonus (20%)
    if (nearMissRate !== null && nearMissRate !== undefined && nearMissRate > 0.05) {
      score += nearMissRate * 0.2;
    }

    // Ceiling penalty (reduce priority if unreachable)
    if (ceilingGap !== null && ceilingGap !== undefined && ceilingGap > 0) {
      score *= 0.5; // Halve priority - can't fix by tuning
    }

    return score;
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
