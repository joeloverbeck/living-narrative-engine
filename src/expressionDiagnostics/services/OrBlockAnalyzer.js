/**
 * @file OrBlockAnalyzer service for identifying OR alternatives with negligible coverage.
 * @see specs/monte-carlo-actionability-improvements.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../config/actionabilityConfig.js';

/** @typedef {import('../config/actionabilityConfig.js').OrBlockAnalysis} OrBlockAnalysis */
/** @typedef {import('../config/actionabilityConfig.js').OrAlternativeAnalysis} OrAlternativeAnalysis */
/** @typedef {import('../config/actionabilityConfig.js').RestructureRecommendation} RestructureRecommendation */
/** @typedef {import('../config/actionabilityConfig.js').OrBlockAnalysisConfig} OrBlockAnalysisConfig */

/**
 * Analyzes OR blocks to identify dead-weight alternatives and recommend restructuring.
 *
 * Dead-weight alternatives are those contributing negligible exclusive coverage
 * (< 1% of cases where only that alternative passes the OR block).
 */
class OrBlockAnalyzer {
  #logger;
  #config;

  /**
   * Create a new OrBlockAnalyzer instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.logger - Logger implementing ILogger
   * @param {OrBlockAnalysisConfig} [deps.config] - Optional config override
   */
  constructor({ logger, config = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
    this.#config = config ?? actionabilityConfig.orBlockAnalysis;
  }

  /**
   * Analyze an OR block to identify dead-weight and weak contributors.
   *
   * @param {object} orBlock - OR block with alternatives and tracking data
   * @param {object} simulationResult - Full simulation result with metadata
   * @returns {OrBlockAnalysis} Analysis of the OR block
   */
  analyze(orBlock, simulationResult) {
    if (!orBlock || !orBlock.alternatives || orBlock.alternatives.length === 0) {
      this.#logger.debug('No OR block or alternatives provided for analysis');
      return this.#createEmptyAnalysis(orBlock?.blockId ?? 'unknown');
    }

    if (!simulationResult) {
      this.#logger.debug('No simulation result provided for OR block analysis');
      return this.#createEmptyAnalysis(orBlock.blockId ?? 'unknown');
    }

    const blockId = orBlock.blockId ?? orBlock.id ?? 'unknown';
    this.#logger.debug(`Analyzing OR block ${blockId} with ${orBlock.alternatives.length} alternatives`);

    // Analyze each alternative
    const alternatives = orBlock.alternatives.map((alt, index) =>
      this.#analyzeAlternative(alt, index, orBlock, simulationResult)
    );

    // Identify dead-weight and weak contributors
    const deadWeightAlts = alternatives.filter((a) => a.classification === 'dead-weight');
    const weakAlts = alternatives.filter((a) => a.classification === 'weak');

    // Generate recommendations
    const recommendations = [
      ...this.#generateRecommendations(deadWeightAlts, orBlock),
      ...this.#generateWeakRecommendations(weakAlts, orBlock),
    ];

    // Build impact summary
    const impactSummary = this.#summarizeImpact(deadWeightAlts, orBlock);

    this.#logger.debug(
      `OR block ${blockId}: ${deadWeightAlts.length} dead-weight, ` +
        `${weakAlts.length} weak, ${recommendations.length} recommendations`
    );

    return {
      blockId,
      blockDescription: this.#buildDescription(orBlock),
      alternatives,
      deadWeightCount: deadWeightAlts.length,
      recommendations,
      impactSummary,
    };
  }

  /**
   * Analyze multiple OR blocks.
   *
   * @param {object[]} orBlocks - Array of OR blocks
   * @param {object} simulationResult - Simulation result
   * @returns {OrBlockAnalysis[]} Analysis results for each block
   */
  analyzeAll(orBlocks, simulationResult) {
    if (!Array.isArray(orBlocks)) {
      this.#logger.debug('Non-array input to analyzeAll');
      return [];
    }

    return orBlocks.map((block) => this.analyze(block, simulationResult));
  }

  /**
   * Analyze a single alternative within an OR block.
   *
   * @param {object} alt - Alternative tracking data
   * @param {number} index - Alternative index
   * @param {object} orBlock - Parent OR block
   * @param {object} simulationResult - Simulation result
   * @returns {OrAlternativeAnalysis} Analysis of the alternative
   */
  #analyzeAlternative(alt, index, orBlock, simulationResult) {
    // Extract tracking data
    const exclusiveCoverage = this.#extractExclusiveCoverage(alt, orBlock, simulationResult);
    const marginalContribution = this.#estimateMarginalContribution(alt, orBlock, simulationResult);
    const overlapRatio = this.#calculateOverlapRatio(alt, orBlock, simulationResult);
    const classification = this.#classify(exclusiveCoverage);
    const clauseDescription = this.#extractDescription(alt);

    return {
      alternativeIndex: index,
      clauseDescription,
      exclusiveCoverage,
      marginalContribution,
      overlapRatio,
      classification,
    };
  }

  /**
   * Extract exclusive coverage for an alternative.
   * Exclusive coverage = cases where ONLY this alternative passes.
   *
   * @param {object} alt - Alternative tracking data
   * @param {object} orBlock - Parent OR block
   * @param {object} simulationResult - Simulation result
   * @returns {number} Exclusive coverage rate (0-1)
   */
  #extractExclusiveCoverage(alt, orBlock, simulationResult) {
    // Check for pre-computed exclusive coverage
    if (typeof alt.exclusiveCoverage === 'number') {
      return alt.exclusiveCoverage;
    }

    // Compute from tracking data if available
    const exclusivePassCount = alt.exclusivePassCount ?? 0;
    const totalSamples = simulationResult?.sampleCount ?? 1000;

    if (totalSamples === 0) {
      return 0;
    }

    return exclusivePassCount / totalSamples;
  }

  /**
   * Estimate marginal contribution: Δ OR pass rate if this alternative removed.
   *
   * @param {object} alt - Alternative tracking data
   * @param {object} orBlock - Parent OR block
   * @param {object} simulationResult - Simulation result
   * @returns {number} Marginal contribution (0-1)
   */
  #estimateMarginalContribution(alt, orBlock, simulationResult) {
    // Check for pre-computed marginal contribution
    if (typeof alt.marginalContribution === 'number') {
      return alt.marginalContribution;
    }

    // Estimate from exclusive pass count
    const exclusivePassCount = alt.exclusivePassCount ?? 0;
    const totalOrPasses = this.#computeTotalOrPasses(orBlock, simulationResult);

    if (totalOrPasses === 0) {
      return 0;
    }

    // Marginal contribution = exclusive cases / total OR passes
    return exclusivePassCount / totalOrPasses;
  }

  /**
   * Compute total OR block pass count.
   *
   * @param {object} orBlock - OR block
   * @param {object} simulationResult - Simulation result
   * @returns {number} Total pass count for OR block
   */
  #computeTotalOrPasses(orBlock, simulationResult) {
    // Check for pre-computed value
    if (typeof orBlock.passCount === 'number') {
      return orBlock.passCount;
    }

    // Fallback to sample count * trigger rate estimate
    const totalSamples = simulationResult?.sampleCount ?? 1000;
    const triggerRate = simulationResult?.triggerRate ?? 0;

    // If OR block is part of triggering, estimate pass count
    return Math.round(totalSamples * Math.max(triggerRate, 0.01));
  }

  /**
   * Calculate overlap ratio: fraction of passes covered by other alternatives too.
   *
   * @param {object} alt - Alternative tracking data
   * @param {object} _orBlock - Parent OR block (unused, for signature consistency)
   * @param {object} _simulationResult - Simulation result (unused, for signature consistency)
   * @returns {number} Overlap ratio (0-1)
   */
  #calculateOverlapRatio(alt, _orBlock, _simulationResult) {
    // Check for pre-computed overlap ratio
    if (typeof alt.overlapRatio === 'number') {
      return alt.overlapRatio;
    }

    const passCount = alt.passCount ?? 0;
    const exclusivePassCount = alt.exclusivePassCount ?? 0;

    if (passCount === 0) {
      return 0;
    }

    // Overlap = (passes - exclusive passes) / passes
    const overlappingPasses = passCount - exclusivePassCount;
    return overlappingPasses / passCount;
  }

  /**
   * Classify alternative based on exclusive coverage.
   *
   * @param {number} exclusiveCoverage - Exclusive coverage rate
   * @returns {'meaningful'|'weak'|'dead-weight'} Classification
   */
  #classify(exclusiveCoverage) {
    const { deadWeightThreshold, weakContributorThreshold } = this.#config;

    if (exclusiveCoverage < deadWeightThreshold) {
      return 'dead-weight';
    }

    if (exclusiveCoverage < weakContributorThreshold) {
      return 'weak';
    }

    return 'meaningful';
  }

  /**
   * Generate recommendations for dead-weight alternatives.
   *
   * @param {OrAlternativeAnalysis[]} deadWeightAlts - Dead-weight alternatives
   * @param {object} orBlock - Parent OR block
   * @returns {RestructureRecommendation[]} Recommendations
   */
  #generateRecommendations(deadWeightAlts, orBlock) {
    const recommendations = [];

    for (const alt of deadWeightAlts) {
      // Primary recommendation: delete
      recommendations.push({
        action: 'delete',
        targetAlternative: alt.alternativeIndex,
        rationale: `Exclusive coverage ${(alt.exclusiveCoverage * 100).toFixed(2)}% < ${(this.#config.deadWeightThreshold * 100).toFixed(0)}% threshold`,
        predictedImpact: `Removes complexity with minimal coverage loss (${(alt.marginalContribution * 100).toFixed(2)}%)`,
      });

      // Check for threshold lowering opportunity
      const originalAlt = orBlock.alternatives[alt.alternativeIndex];
      if (this.#hasNumericThreshold(originalAlt)) {
        const suggestedValue = this.#calculateThresholdForTargetCoverage(
          originalAlt,
          this.#config.targetExclusiveCoverage
        );

        if (suggestedValue !== null) {
          recommendations.push({
            action: 'lower-threshold',
            targetAlternative: alt.alternativeIndex,
            suggestedValue,
            rationale: `Lowering threshold could increase exclusive coverage to ~${(this.#config.targetExclusiveCoverage * 100).toFixed(0)}%`,
            predictedImpact: `May increase alternative utility while preserving OR block structure`,
          });
        }
      }

      // Optional: replacement suggestion
      if (this.#config.enableReplacementSuggestions) {
        recommendations.push({
          action: 'replace',
          targetAlternative: alt.alternativeIndex,
          suggestedReplacement: 'Consider replacing with a condition that targets a different state space segment',
          rationale: `Current alternative overlaps ${(alt.overlapRatio * 100).toFixed(0)}% with other alternatives`,
          predictedImpact: `Could improve OR block diversity and coverage`,
        });
      }
    }

    return recommendations;
  }

  /**
   * Generate recommendations for weak contributors.
   *
   * @param {OrAlternativeAnalysis[]} weakAlts - Weak alternatives
   * @param {object} orBlock - Parent OR block
   * @returns {RestructureRecommendation[]} Recommendations
   */
  #generateWeakRecommendations(weakAlts, orBlock) {
    const recommendations = [];

    for (const alt of weakAlts) {
      const originalAlt = orBlock.alternatives[alt.alternativeIndex];

      if (this.#hasNumericThreshold(originalAlt)) {
        const suggestedValue = this.#calculateThresholdForTargetCoverage(
          originalAlt,
          this.#config.targetExclusiveCoverage
        );

        if (suggestedValue !== null) {
          recommendations.push({
            action: 'lower-threshold',
            targetAlternative: alt.alternativeIndex,
            suggestedValue,
            rationale: `Weak contributor (${(alt.exclusiveCoverage * 100).toFixed(2)}%) could be improved`,
            predictedImpact: `Lowering threshold may increase exclusive coverage to ~${(this.#config.targetExclusiveCoverage * 100).toFixed(0)}%`,
          });
        }
      }
    }

    return recommendations;
  }

  /**
   * Check if alternative has a numeric threshold that can be adjusted.
   *
   * @param {object} alt - Alternative data
   * @returns {boolean} True if threshold exists
   */
  #hasNumericThreshold(alt) {
    if (!alt) return false;

    // Check for common threshold patterns
    return (
      typeof alt.threshold === 'number' ||
      typeof alt._threshold === 'number' ||
      (alt.condition && typeof alt.condition.threshold === 'number')
    );
  }

  /**
   * Calculate suggested threshold to achieve target coverage.
   *
   * @param {object} alt - Alternative with threshold data
   * @param {number} targetCoverage - Target exclusive coverage rate
   * @returns {number|null} Suggested threshold or null if not applicable
   */
  #calculateThresholdForTargetCoverage(alt, targetCoverage) {
    const currentThreshold = alt.threshold ?? alt._threshold ?? alt.condition?.threshold;
    if (typeof currentThreshold !== 'number') return null;

    // Check for quantile data for threshold estimation
    const quantiles = alt._quantiles ?? alt.quantiles;
    if (!quantiles || typeof quantiles !== 'object') {
      // Fallback: suggest 10% reduction
      return currentThreshold * 0.9;
    }

    // Find quantile closest to target coverage
    const targetKey = `p${Math.round(targetCoverage * 100)}`;
    if (typeof quantiles[targetKey] === 'number') {
      return quantiles[targetKey];
    }

    // Fallback to linear estimation
    return currentThreshold * (1 - targetCoverage);
  }

  /**
   * Summarize impact if all dead-weight alternatives removed.
   *
   * @param {OrAlternativeAnalysis[]} deadWeightAlts - Dead-weight alternatives
   * @param {object} orBlock - Parent OR block
   * @returns {string} Impact summary
   */
  #summarizeImpact(deadWeightAlts, orBlock) {
    if (deadWeightAlts.length === 0) {
      return 'No dead-weight alternatives identified. OR block structure appears efficient.';
    }

    const totalAlts = orBlock.alternatives?.length ?? 0;
    const complexityReduction = totalAlts > 0 ? (deadWeightAlts.length / totalAlts) * 100 : 0;

    const totalCoverageLoss = deadWeightAlts.reduce(
      (sum, alt) => sum + alt.marginalContribution,
      0
    );
    const coverageLossPercent = totalCoverageLoss * 100;

    return (
      `Removing ${deadWeightAlts.length} dead-weight alternative(s) would reduce ` +
      `complexity by ${complexityReduction.toFixed(0)}% with ~${coverageLossPercent.toFixed(2)}% coverage loss.`
    );
  }

  /**
   * Build human-readable description for OR block.
   *
   * @param {object} orBlock - OR block data
   * @returns {string} Block description
   */
  #buildDescription(orBlock) {
    if (orBlock.description) return orBlock.description;
    if (orBlock.blockDescription) return orBlock.blockDescription;

    const altCount = orBlock.alternatives?.length ?? 0;
    return `OR block with ${altCount} alternative(s)`;
  }

  /**
   * Extract description from alternative.
   *
   * @param {object} alt - Alternative data
   * @returns {string} Clause description
   */
  #extractDescription(alt) {
    if (alt.description) return alt.description;
    if (alt.clauseDescription) return alt.clauseDescription;
    if (alt.condition) return JSON.stringify(alt.condition);
    if (alt.variablePath && alt.operator && alt.threshold !== undefined) {
      return `${alt.variablePath} ${alt.operator} ${alt.threshold}`;
    }
    return alt.clauseId ?? alt.id ?? 'Unknown alternative';
  }

  /**
   * Create empty analysis result.
   *
   * @param {string} blockId - Block identifier
   * @returns {OrBlockAnalysis} Empty analysis
   */
  #createEmptyAnalysis(blockId) {
    return {
      blockId,
      blockDescription: 'No OR block data available',
      alternatives: [],
      deadWeightCount: 0,
      recommendations: [],
      impactSummary: 'No analysis performed.',
    };
  }
}

export default OrBlockAnalyzer;
