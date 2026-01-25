/**
 * @file Candidate axis validation for axis gap analysis.
 * @description Validates candidate axes by measuring improvement metrics.
 */

import { collectAxes } from '../../utils/vectorMathUtils.js';

/**
 * @typedef {object} CandidateAxisResult
 * @property {string} candidateId - Candidate identifier from extractor.
 * @property {'pca_residual'|'coverage_gap'|'hub_derived'} source - Origin of candidate.
 * @property {Record<string, number>} direction - Normalized direction vector.
 * @property {ImprovementMetrics} improvement - Measured improvement metrics.
 * @property {boolean} isRecommended - Whether this candidate is recommended.
 * @property {'add_axis'|'refine_prototypes'|'insufficient_data'} recommendation - Recommendation type.
 * @property {string[]} affectedPrototypes - Prototype IDs that would benefit.
 * @property {string} rationale - Human-readable explanation.
 * @property {string|null} [validationError] - Error code if direction validation failed (e.g., 'direction_null_or_invalid', 'direction_near_zero_magnitude').
 */

/**
 * @typedef {object} ImprovementMetrics
 * @property {number} rmseReduction - RMSE reduction ratio (0-1).
 * @property {number} strongAxisReduction - Reduction in strong axis count.
 * @property {number} coUsageReduction - Reduction in co-usage metric (0-1).
 * @property {number} combinedScore - Weighted combined improvement score.
 */

/**
 * @typedef {object} BaselineMetrics
 * @property {number} rmse - Baseline RMSE.
 * @property {number} strongAxisCount - Average strong axis count.
 * @property {number} coUsageScore - Co-usage metric.
 */

/**
 * @typedef {import('./CandidateAxisExtractor.js').ExtractedCandidate} ExtractedCandidate
 */

/**
 * Service for validating candidate axes by measuring improvement metrics.
 */
export class CandidateAxisValidator {
  #config;
  #logger;

  /**
   * Create a CandidateAxisValidator.
   *
   * @param {object} [config] - Configuration options.
   * @param {number} [config.candidateAxisMinRMSEReduction] - Minimum RMSE reduction for recommendation (default: 0.10).
   * @param {number} [config.candidateAxisMinStrongAxisReduction] - Minimum strong axis reduction (default: 1).
   * @param {number} [config.candidateAxisMinCoUsageReduction] - Minimum co-usage reduction (default: 0.05).
   * @param {number} [config.candidateAxisMinAffectedPrototypes] - Minimum affected prototypes (default: 5).
   * @param {number} [config.candidateAxisRMSEWeight] - Weight for RMSE in combined score (default: 0.5).
   * @param {number} [config.candidateAxisStrongAxisWeight] - Weight for strong axis in combined score (default: 0.3).
   * @param {number} [config.candidateAxisCoUsageWeight] - Weight for co-usage in combined score (default: 0.2).
   * @param {number} [config.candidateAxisMinCombinedScore] - Minimum combined score for recommendation (default: 0.15).
   * @param {number} [config.strongAxisThreshold] - Threshold for strong axis detection (default: 0.25).
   * @param {object} [logger] - Optional logger.
   */
  constructor(config = {}, logger = null) {
    this.#config = {
      candidateAxisMinRMSEReduction: config.candidateAxisMinRMSEReduction ?? 0.1,
      candidateAxisMinStrongAxisReduction:
        config.candidateAxisMinStrongAxisReduction ?? 1,
      candidateAxisMinCoUsageReduction:
        config.candidateAxisMinCoUsageReduction ?? 0.05,
      candidateAxisMinAffectedPrototypes:
        config.candidateAxisMinAffectedPrototypes ?? 5,
      candidateAxisRMSEWeight: config.candidateAxisRMSEWeight ?? 0.5,
      candidateAxisStrongAxisWeight: config.candidateAxisStrongAxisWeight ?? 0.3,
      candidateAxisCoUsageWeight: config.candidateAxisCoUsageWeight ?? 0.2,
      candidateAxisMinCombinedScore: config.candidateAxisMinCombinedScore ?? 0.15,
      strongAxisThreshold: config.strongAxisThreshold ?? 0.25,
    };
    this.#logger = logger;
  }

  /**
   * Validate candidates and measure improvement metrics.
   *
   * @param {Array<{id?: string, prototypeId?: string, weights?: Record<string, number>}>} prototypes - Prototype objects.
   * @param {string[]} existingAxes - Current axis names.
   * @param {ExtractedCandidate[]} candidates - Candidates to validate.
   * @returns {CandidateAxisResult[]} Validation results.
   */
  validate(prototypes, existingAxes, candidates) {
    if (
      !Array.isArray(prototypes) ||
      prototypes.length < 2 ||
      !Array.isArray(candidates) ||
      candidates.length === 0
    ) {
      return [];
    }

    const axes = existingAxes.length > 0 ? existingAxes : collectAxes(prototypes);
    if (axes.length === 0) {
      return [];
    }

    // Compute baseline metrics (without any candidate)
    const baseline = this.#computeBaselineMetrics(prototypes, axes);

    this.#logger?.debug('CandidateAxisValidator: Baseline metrics computed', {
      rmse: baseline.rmse,
      strongAxisCount: baseline.strongAxisCount,
      coUsageScore: baseline.coUsageScore,
    });

    const results = [];

    for (const candidate of candidates) {
      const result = this.#validateCandidate(
        candidate,
        prototypes,
        axes,
        baseline
      );
      results.push(result);
    }

    // Sort by combined score descending
    results.sort((a, b) => b.improvement.combinedScore - a.improvement.combinedScore);

    return results;
  }

  /**
   * Validate a single candidate.
   *
   * @param {ExtractedCandidate} candidate - Candidate to validate.
   * @param {Array<object>} prototypes - Prototype objects.
   * @param {string[]} axes - Existing axes.
   * @param {BaselineMetrics} baseline - Baseline metrics.
   * @returns {CandidateAxisResult} Validation result.
   */
  #validateCandidate(candidate, prototypes, axes, baseline) {
    // Validate direction BEFORE computing metrics
    const directionValidation = this.#validateDirection(candidate.direction);
    if (!directionValidation.isValid) {
      this.#logger?.debug(
        `CandidateAxisValidator: Direction validation failed for ${candidate.candidateId}: ${directionValidation.reason}`
      );
      return {
        candidateId: candidate.candidateId,
        source: candidate.source,
        confidence: candidate.confidence,
        direction: candidate.direction,
        improvement: {
          rmseReduction: 0,
          strongAxisReduction: 0,
          coUsageReduction: 0,
          combinedScore: 0,
        },
        isRecommended: false,
        recommendation: /** @type {const} */ ('insufficient_data'),
        affectedPrototypes: [],
        rationale: `Direction validation failed: ${directionValidation.reason}`,
        validationError: directionValidation.errorCode,
      };
    }

    // Compute metrics WITH the candidate axis
    const withCandidate = this.#computeWithCandidateMetrics(
      prototypes,
      axes,
      candidate.direction
    );

    // Compute improvement deltas
    const improvement = this.#computeImprovement(baseline, withCandidate);

    // Determine affected prototypes
    const affectedPrototypes = this.#computeAffectedPrototypes(
      prototypes,
      candidate.direction
    );

    // Make recommendation decision
    const { isRecommended, recommendation, rationale } = this.#makeRecommendation(
      improvement,
      affectedPrototypes.length,
      candidate
    );

    return {
      candidateId: candidate.candidateId,
      source: candidate.source,
      confidence: candidate.confidence,
      direction: candidate.direction,
      improvement,
      isRecommended,
      recommendation,
      affectedPrototypes,
      rationale,
      validationError: null,
    };
  }

  /**
   * Compute baseline metrics without any candidate axis.
   *
   * @param {Array<object>} prototypes - Prototype objects.
   * @param {string[]} axes - Existing axes.
   * @returns {BaselineMetrics} Baseline metrics.
   */
  #computeBaselineMetrics(prototypes, axes) {
    let totalRMSE = 0;
    let totalStrongAxes = 0;
    const axisUsageCounts = new Map();

    for (const prototype of prototypes) {
      const weights = prototype?.weights ?? {};

      // Compute RMSE-like metric (spread of weights)
      let sumSquares = 0;
      let strongCount = 0;
      const strongAxes = [];

      for (const axis of axes) {
        const value = weights[axis] ?? 0;
        sumSquares += value * value;

        if (Math.abs(value) >= this.#config.strongAxisThreshold) {
          strongCount += 1;
          strongAxes.push(axis);
        }
      }

      totalRMSE += Math.sqrt(sumSquares / Math.max(1, axes.length));
      totalStrongAxes += strongCount;

      // Track axis co-usage patterns
      for (const axis of strongAxes) {
        axisUsageCounts.set(axis, (axisUsageCounts.get(axis) ?? 0) + 1);
      }
    }

    const avgRMSE = totalRMSE / prototypes.length;
    const avgStrongAxes = totalStrongAxes / prototypes.length;

    // Co-usage score: how often multiple strong axes occur together
    const coUsageScore = this.#computeCoUsageScore(prototypes, axes);

    return {
      rmse: avgRMSE,
      strongAxisCount: avgStrongAxes,
      coUsageScore,
    };
  }

  /**
   * Compute metrics with the candidate axis added.
   *
   * @param {Array<object>} prototypes - Prototype objects.
   * @param {string[]} existingAxes - Existing axes.
   * @param {Record<string, number>} candidateDirection - Candidate axis direction.
   * @returns {BaselineMetrics} Metrics with candidate.
   */
  #computeWithCandidateMetrics(prototypes, existingAxes, candidateDirection) {
    // Project each prototype onto the candidate direction
    // The "residual" after projection represents what's NOT explained by the candidate
    let totalResidualRMSE = 0;
    let totalStrongAxes = 0;

    for (const prototype of prototypes) {
      const weights = prototype?.weights ?? {};

      // Compute projection onto candidate
      const projection = this.#computeProjection(weights, candidateDirection);

      // Compute residual (original - projection component)
      let sumResidualSquares = 0;
      let strongCount = 0;

      for (const axis of existingAxes) {
        const original = weights[axis] ?? 0;
        // Residual after accounting for candidate direction
        const residual = original - projection * (candidateDirection[axis] ?? 0);
        sumResidualSquares += residual * residual;

        // Strong axis count with residual
        if (Math.abs(residual) >= this.#config.strongAxisThreshold) {
          strongCount += 1;
        }
      }

      totalResidualRMSE += Math.sqrt(sumResidualSquares / Math.max(1, existingAxes.length));
      totalStrongAxes += strongCount;
    }

    const avgRMSE = totalResidualRMSE / prototypes.length;
    const avgStrongAxes = totalStrongAxes / prototypes.length;

    // Recompute co-usage with residuals
    const coUsageScore = this.#computeCoUsageScoreWithCandidate(
      prototypes,
      existingAxes,
      candidateDirection
    );

    return {
      rmse: avgRMSE,
      strongAxisCount: avgStrongAxes,
      coUsageScore,
    };
  }

  /**
   * Compute projection of weights onto candidate direction.
   *
   * @param {Record<string, number>} weights - Prototype weights.
   * @param {Record<string, number>} direction - Candidate direction.
   * @returns {number} Projection scalar.
   */
  #computeProjection(weights, direction) {
    let dotProduct = 0;
    let dirMagnitudeSquared = 0;

    for (const [axis, dirValue] of Object.entries(direction)) {
      const weightValue = weights[axis] ?? 0;
      dotProduct += weightValue * dirValue;
      dirMagnitudeSquared += dirValue * dirValue;
    }

    if (dirMagnitudeSquared === 0) {
      return 0;
    }

    return dotProduct / Math.sqrt(dirMagnitudeSquared);
  }

  /**
   * Compute co-usage score (how often multiple strong axes co-occur).
   *
   * @param {Array<object>} prototypes - Prototype objects.
   * @param {string[]} axes - Axis names.
   * @returns {number} Co-usage score [0, 1].
   */
  #computeCoUsageScore(prototypes, axes) {
    let totalPairs = 0;
    let coUsagePairs = 0;

    for (const prototype of prototypes) {
      const weights = prototype?.weights ?? {};
      const strongAxes = [];

      for (const axis of axes) {
        const value = weights[axis] ?? 0;
        if (Math.abs(value) >= this.#config.strongAxisThreshold) {
          strongAxes.push(axis);
        }
      }

      // Count pairs of strong axes
      const n = strongAxes.length;
      if (n >= 2) {
        const pairs = (n * (n - 1)) / 2;
        coUsagePairs += pairs;
      }
      totalPairs += 1;
    }

    if (totalPairs === 0) {
      return 0;
    }

    // Normalize by maximum possible co-usage
    const maxAxes = axes.length;
    const maxPairs = (maxAxes * (maxAxes - 1)) / 2;
    const maxTotal = maxPairs * prototypes.length;

    if (maxTotal === 0) {
      return 0;
    }

    return coUsagePairs / maxTotal;
  }

  /**
   * Compute co-usage score with candidate axis factored out.
   *
   * @param {Array<object>} prototypes - Prototype objects.
   * @param {string[]} axes - Axis names.
   * @param {Record<string, number>} candidateDirection - Candidate direction.
   * @returns {number} Co-usage score [0, 1].
   */
  #computeCoUsageScoreWithCandidate(prototypes, axes, candidateDirection) {
    let totalPairs = 0;
    let coUsagePairs = 0;

    for (const prototype of prototypes) {
      const weights = prototype?.weights ?? {};
      const projection = this.#computeProjection(weights, candidateDirection);
      const strongAxes = [];

      for (const axis of axes) {
        const original = weights[axis] ?? 0;
        const residual = original - projection * (candidateDirection[axis] ?? 0);

        if (Math.abs(residual) >= this.#config.strongAxisThreshold) {
          strongAxes.push(axis);
        }
      }

      const n = strongAxes.length;
      if (n >= 2) {
        const pairs = (n * (n - 1)) / 2;
        coUsagePairs += pairs;
      }
      totalPairs += 1;
    }

    if (totalPairs === 0) {
      return 0;
    }

    const maxAxes = axes.length;
    const maxPairs = (maxAxes * (maxAxes - 1)) / 2;
    const maxTotal = maxPairs * prototypes.length;

    if (maxTotal === 0) {
      return 0;
    }

    return coUsagePairs / maxTotal;
  }

  /**
   * Compute improvement metrics between baseline and with-candidate.
   *
   * @param {BaselineMetrics} baseline - Baseline metrics.
   * @param {BaselineMetrics} withCandidate - Metrics with candidate.
   * @returns {ImprovementMetrics} Improvement metrics.
   */
  #computeImprovement(baseline, withCandidate) {
    // RMSE reduction (higher is better)
    const rmseReduction =
      baseline.rmse > 0
        ? Math.max(0, (baseline.rmse - withCandidate.rmse) / baseline.rmse)
        : 0;

    // Strong axis reduction (higher is better)
    const strongAxisReduction = Math.max(
      0,
      baseline.strongAxisCount - withCandidate.strongAxisCount
    );

    // Co-usage reduction (higher is better)
    const coUsageReduction =
      baseline.coUsageScore > 0
        ? Math.max(
            0,
            (baseline.coUsageScore - withCandidate.coUsageScore) /
              baseline.coUsageScore
          )
        : 0;

    // Combined weighted score
    const combinedScore =
      rmseReduction * this.#config.candidateAxisRMSEWeight +
      (strongAxisReduction / 5) * this.#config.candidateAxisStrongAxisWeight +
      coUsageReduction * this.#config.candidateAxisCoUsageWeight;

    return {
      rmseReduction,
      strongAxisReduction,
      coUsageReduction,
      combinedScore,
    };
  }

  /**
   * Compute which prototypes are affected by the candidate.
   *
   * @param {Array<object>} prototypes - Prototype objects.
   * @param {Record<string, number>} candidateDirection - Candidate direction.
   * @returns {string[]} Affected prototype IDs.
   */
  #computeAffectedPrototypes(prototypes, candidateDirection) {
    const affected = [];
    const projectionThreshold = 0.2; // Minimum projection to be considered affected

    for (const prototype of prototypes) {
      const id = prototype?.id ?? prototype?.prototypeId ?? null;
      if (!id) {
        continue;
      }

      const weights = prototype?.weights ?? {};
      const projection = Math.abs(
        this.#computeProjection(weights, candidateDirection)
      );

      if (projection >= projectionThreshold) {
        affected.push(id);
      }
    }

    return affected.sort();
  }

  /**
   * Make recommendation decision based on improvement metrics.
   *
   * @param {ImprovementMetrics} improvement - Improvement metrics.
   * @param {number} affectedCount - Number of affected prototypes.
   * @param {ExtractedCandidate} candidate - Original candidate.
   * @returns {{isRecommended: boolean, recommendation: 'add_axis'|'refine_prototypes'|'insufficient_data', rationale: string}} Decision.
   */
  #makeRecommendation(improvement, affectedCount, candidate) {
    const minAffected = this.#config.candidateAxisMinAffectedPrototypes;
    const minRMSE = this.#config.candidateAxisMinRMSEReduction;
    const minCombined = this.#config.candidateAxisMinCombinedScore;

    // Check for insufficient data
    if (affectedCount < minAffected) {
      return {
        isRecommended: false,
        recommendation: /** @type {const} */ ('insufficient_data'),
        rationale: `Only ${affectedCount} prototypes affected (minimum: ${minAffected}). Insufficient evidence to recommend changes.`,
      };
    }

    // Check if improvement justifies adding a new axis
    const passesRMSE = improvement.rmseReduction >= minRMSE;
    const passesCombined = improvement.combinedScore >= minCombined;

    if (passesRMSE && passesCombined) {
      return {
        isRecommended: true,
        recommendation: /** @type {const} */ ('add_axis'),
        rationale: `Adding this axis would reduce RMSE by ${(improvement.rmseReduction * 100).toFixed(1)}% and improve overall fit. Combined score: ${improvement.combinedScore.toFixed(3)}.`,
      };
    }

    // Recommend prototype refinement instead
    return {
      isRecommended: false,
      recommendation: /** @type {const} */ ('refine_prototypes'),
      rationale: `Improvement metrics (RMSE: ${(improvement.rmseReduction * 100).toFixed(1)}%, combined: ${improvement.combinedScore.toFixed(3)}) suggest refining existing prototypes rather than adding a new axis.`,
    };
  }

  /**
   * Validate that a direction vector is valid for metric computation.
   *
   * @param {Record<string, number>|null|undefined} direction - Direction vector to validate.
   * @returns {{isValid: boolean, magnitude: number, reason: string, errorCode: string|null}} Validation result.
   */
  #validateDirection(direction) {
    // Check for null or invalid type
    if (!direction || typeof direction !== 'object') {
      return {
        isValid: false,
        magnitude: 0,
        reason: 'Direction vector is null or invalid type',
        errorCode: 'direction_null_or_invalid',
      };
    }

    // Check for empty direction
    const keys = Object.keys(direction);
    if (keys.length === 0) {
      return {
        isValid: false,
        magnitude: 0,
        reason: 'Direction vector has no dimensions',
        errorCode: 'direction_null_or_invalid',
      };
    }

    // Compute magnitude
    let sumSquares = 0;
    for (const key of keys) {
      const value = direction[key];
      if (typeof value === 'number' && Number.isFinite(value)) {
        sumSquares += value * value;
      }
    }
    const magnitude = Math.sqrt(sumSquares);

    // Check for near-zero magnitude (epsilon threshold)
    const epsilon = 1e-10;
    if (magnitude < epsilon) {
      return {
        isValid: false,
        magnitude,
        reason: 'Direction vector has near-zero magnitude, indicating insufficient signal',
        errorCode: 'direction_near_zero_magnitude',
      };
    }

    return {
      isValid: true,
      magnitude,
      reason: 'Direction is valid',
      errorCode: null,
    };
  }
}
