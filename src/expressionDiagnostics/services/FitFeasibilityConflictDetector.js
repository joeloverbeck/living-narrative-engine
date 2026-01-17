/**
 * @file FitFeasibilityConflictDetector - Detects conflicts between prototype fit results
 * and clause feasibility, generating structured warnings when "fit looks clean" but
 * clauses are impossible.
 * @see NonAxisFeasibilityAnalyzer.js
 * @see PrototypeGateAlignmentAnalyzer.js
 * @see PrototypeFitRankingService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Conflict types indicating why fit results may be misleading.
 *
 * @typedef {'fit_vs_clause_impossible' | 'gate_contradiction'} ConflictType
 */

/**
 * @typedef {object} TopPrototype
 * @property {string} prototypeId - Prototype identifier
 * @property {number} score - Composite score from fit analysis
 */

/**
 * @typedef {object} FitFeasibilityConflict
 * @property {ConflictType} type - Type of conflict detected
 * @property {TopPrototype[]} topPrototypes - Top 3 prototypes from fit leaderboard
 * @property {string[]} impossibleClauseIds - IDs of impossible clauses or gate contradictions
 * @property {string} explanation - Human-readable explanation of the conflict
 * @property {string[]} suggestedFixes - Up to 5 deduplicated suggestions for resolution
 */

/**
 * @typedef {import('./NonAxisFeasibilityAnalyzer.js').NonAxisClauseFeasibility} NonAxisClauseFeasibility
 * @typedef {import('./PrototypeGateAlignmentAnalyzer.js').AlignmentAnalysisResult} AlignmentAnalysisResult
 * @typedef {import('./PrototypeFitRankingService.js').PrototypeFitAnalysis} PrototypeFitAnalysis
 */

/**
 * Threshold for considering a prototype fit as "clean" (top score >= this value).
 *
 * @constant {number}
 */
const FIT_SCORE_THRESHOLD = 0.3;

/**
 * Maximum number of suggested fixes to return.
 *
 * @constant {number}
 */
const MAX_SUGGESTED_FIXES = 5;

/**
 * Maximum number of top prototypes to include in conflict reports.
 *
 * @constant {number}
 */
const MAX_TOP_PROTOTYPES = 3;

/**
 * Detects conflicts between prototype fit results and clause feasibility.
 * Generates warnings when fit analysis looks clean but clauses are impossible.
 */
class FitFeasibilityConflictDetector {
  /** @type {import('../../interfaces/ILogger.js').ILogger} */
  #logger;

  /**
   * Creates a new FitFeasibilityConflictDetector instance.
   *
   * @param {object} params - Constructor parameters.
   * @param {import('../../interfaces/ILogger.js').ILogger} params.logger - Logger instance.
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info'],
    });
    this.#logger = logger;
  }

  /**
   * Detect conflicts between prototype fit results and feasibility analysis.
   *
   * @param {PrototypeFitAnalysis | null} prototypeFitResult - Prototype fit analysis result.
   * @param {NonAxisClauseFeasibility[] | null} feasibilityResults - Feasibility analysis results.
   * @param {AlignmentAnalysisResult | null} gateAlignmentResult - Gate alignment analysis result.
   * @returns {FitFeasibilityConflict[]} Array of detected conflicts (may be empty).
   */
  detect(prototypeFitResult, feasibilityResults, gateAlignmentResult) {
    const conflicts = [];

    // Check for fit_vs_clause_impossible conflict
    const fitClauseConflict = this.#detectFitVsClauseConflict(
      prototypeFitResult,
      feasibilityResults
    );
    if (fitClauseConflict) {
      conflicts.push(fitClauseConflict);
    }

    // Check for gate_contradiction conflict
    const gateConflict = this.#detectGateContradictionConflict(
      prototypeFitResult,
      gateAlignmentResult
    );
    if (gateConflict) {
      conflicts.push(gateConflict);
    }

    this.#logger.debug(
      `FitFeasibilityConflictDetector: detected ${conflicts.length} conflict(s)`
    );

    return conflicts;
  }

  /**
   * Detect fit_vs_clause_impossible conflict when fit looks clean but clauses are impossible.
   *
   * @private
   * @param {PrototypeFitAnalysis | null} fitResult - Prototype fit analysis result.
   * @param {NonAxisClauseFeasibility[] | null} feasibilityResults - Feasibility results.
   * @returns {FitFeasibilityConflict | null} Conflict object or null if none detected.
   */
  #detectFitVsClauseConflict(fitResult, feasibilityResults) {
    // Guard: no fit result or not clean fit
    if (!this.#isFitClean(fitResult)) {
      return null;
    }

    // Guard: no feasibility results
    if (!Array.isArray(feasibilityResults) || feasibilityResults.length === 0) {
      return null;
    }

    // Find IMPOSSIBLE clauses
    const impossibleClauses = feasibilityResults.filter(
      (f) => f.classification === 'IMPOSSIBLE'
    );

    if (impossibleClauses.length === 0) {
      return null;
    }

    const topPrototypes = this.#extractTopPrototypes(fitResult);
    const impossibleClauseIds = impossibleClauses.map((c) => c.clauseId);

    return {
      type: 'fit_vs_clause_impossible',
      topPrototypes,
      impossibleClauseIds,
      explanation: this.#buildFitClauseExplanation(
        topPrototypes,
        impossibleClauses
      ),
      suggestedFixes: this.#generateFitClauseFixes(impossibleClauses),
    };
  }

  /**
   * Detect gate_contradiction conflict when gate alignment has contradictions.
   *
   * @private
   * @param {PrototypeFitAnalysis | null} fitResult - Prototype fit analysis result.
   * @param {AlignmentAnalysisResult | null} gateAlignmentResult - Gate alignment result.
   * @returns {FitFeasibilityConflict | null} Conflict object or null if none detected.
   */
  #detectGateContradictionConflict(fitResult, gateAlignmentResult) {
    // Guard: no gate alignment result or no contradictions
    if (
      !gateAlignmentResult ||
      !Array.isArray(gateAlignmentResult.contradictions) ||
      gateAlignmentResult.contradictions.length === 0
    ) {
      return null;
    }

    const topPrototypes = this.#extractTopPrototypes(fitResult);
    const impossibleClauseIds = gateAlignmentResult.contradictions.map(
      (c) => `gate:${c.emotionId}:${c.axis}`
    );

    return {
      type: 'gate_contradiction',
      topPrototypes,
      impossibleClauseIds,
      explanation: this.#buildGateContradictionExplanation(
        gateAlignmentResult.contradictions
      ),
      suggestedFixes: this.#generateGateContradictionFixes(
        gateAlignmentResult.contradictions
      ),
    };
  }

  /**
   * Check if fit result indicates a "clean" fit (top score >= threshold).
   *
   * @private
   * @param {PrototypeFitAnalysis | null} fitResult - Fit analysis result.
   * @returns {boolean} True if fit is considered clean.
   */
  #isFitClean(fitResult) {
    if (!fitResult || !Array.isArray(fitResult.leaderboard)) {
      return false;
    }

    if (fitResult.leaderboard.length === 0) {
      return false;
    }

    const topScore = fitResult.leaderboard[0]?.compositeScore;
    return typeof topScore === 'number' && topScore >= FIT_SCORE_THRESHOLD;
  }

  /**
   * Extract top N prototypes from fit result leaderboard.
   *
   * @private
   * @param {PrototypeFitAnalysis | null} fitResult - Fit analysis result.
   * @returns {TopPrototype[]} Array of top prototypes (up to MAX_TOP_PROTOTYPES).
   */
  #extractTopPrototypes(fitResult) {
    if (!fitResult || !Array.isArray(fitResult.leaderboard)) {
      return [];
    }

    return fitResult.leaderboard
      .slice(0, MAX_TOP_PROTOTYPES)
      .map((entry) => ({
        prototypeId: entry.prototypeId,
        score: entry.compositeScore,
      }));
  }

  /**
   * Build human-readable explanation for fit_vs_clause_impossible conflict.
   *
   * @private
   * @param {TopPrototype[]} topPrototypes - Top prototypes from fit.
   * @param {NonAxisClauseFeasibility[]} impossibleClauses - Impossible clauses.
   * @returns {string} Human-readable explanation.
   */
  #buildFitClauseExplanation(topPrototypes, impossibleClauses) {
    const prototypeNames = topPrototypes
      .map((p) => p.prototypeId)
      .join(', ');
    const varPaths = [...new Set(impossibleClauses.map((c) => c.varPath))].join(
      ', '
    );
    const clauseCount = impossibleClauses.length;

    return (
      `Prototype fit analysis shows good matches (${prototypeNames}), ` +
      `but ${clauseCount} non-axis clause(s) are IMPOSSIBLE to satisfy: ${varPaths}. ` +
      `The fit score may be misleading since expression will never fire.`
    );
  }

  /**
   * Build human-readable explanation for gate_contradiction conflict.
   *
   * @private
   * @param {import('./PrototypeGateAlignmentAnalyzer.js').GateContradiction[]} contradictions - Gate contradictions array.
   * @returns {string} Human-readable explanation.
   */
  #buildGateContradictionExplanation(contradictions) {
    const uniqueEmotions = [
      ...new Set(contradictions.map((c) => c.emotionId)),
    ].join(', ');
    const uniqueAxes = [...new Set(contradictions.map((c) => c.axis))].join(
      ', '
    );

    return (
      `Gate alignment analysis detected ${contradictions.length} contradiction(s) ` +
      `affecting emotion(s): ${uniqueEmotions} on axis/axes: ${uniqueAxes}. ` +
      `The mood regime constraints conflict with prototype gate requirements.`
    );
  }

  /**
   * Generate suggested fixes for fit_vs_clause_impossible conflict.
   *
   * @private
   * @param {NonAxisClauseFeasibility[]} impossibleClauses - Impossible clauses.
   * @returns {string[]} Array of suggested fixes (up to MAX_SUGGESTED_FIXES).
   */
  #generateFitClauseFixes(impossibleClauses) {
    const fixes = new Set();

    for (const clause of impossibleClauses) {
      // Generate threshold-based fix
      if (clause.maxValue !== null) {
        const operator = clause.operator;
        if (operator === '>=' || operator === '>') {
          fixes.add(
            `Lower threshold for "${clause.varPath}" from ${clause.threshold.toFixed(3)} ` +
            `to at most ${clause.maxValue.toFixed(3)} (max observed value)`
          );
        } else if (operator === '<=' || operator === '<') {
          fixes.add(
            `Raise threshold for "${clause.varPath}" from ${clause.threshold.toFixed(3)} ` +
            `to allow values up to ${clause.maxValue.toFixed(3)}`
          );
        }
      }

      // Generate clause-specific fixes
      if (clause.varPath.startsWith('emotions.')) {
        const emotionName = clause.varPath.replace('emotions.', '');
        fixes.add(
          `Consider adjusting or removing the "${emotionName}" emotion condition`
        );
      } else if (clause.signal === 'delta') {
        fixes.add(
          `Delta clause "${clause.varPath}" requires value changes that don't occur; ` +
          `consider using a final-value condition instead`
        );
      }
    }

    return [...fixes].slice(0, MAX_SUGGESTED_FIXES);
  }

  /**
   * Generate suggested fixes for gate_contradiction conflict.
   *
   * @private
   * @param {import('./PrototypeGateAlignmentAnalyzer.js').GateContradiction[]} contradictions - Gate contradictions array.
   * @returns {string[]} Array of suggested fixes (up to MAX_SUGGESTED_FIXES).
   */
  #generateGateContradictionFixes(contradictions) {
    const fixes = new Set();

    for (const contradiction of contradictions) {
      // Suggest axis constraint adjustment
      fixes.add(
        `Adjust mood regime constraint on "${contradiction.axis}" axis ` +
        `(current: [${contradiction.regime.min.toFixed(2)}, ${contradiction.regime.max.toFixed(2)}]) ` +
        `to overlap with gate requirement ` +
        `([${contradiction.gate.min.toFixed(2)}, ${contradiction.gate.max.toFixed(2)}])`
      );

      // Suggest emotion removal
      fixes.add(
        `Remove or replace emotion condition for "${contradiction.emotionId}" ` +
        `which requires incompatible "${contradiction.axis}" values`
      );
    }

    return [...fixes].slice(0, MAX_SUGGESTED_FIXES);
  }
}

export default FitFeasibilityConflictDetector;
