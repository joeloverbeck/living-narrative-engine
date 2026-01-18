/**
 * @file ImportanceSamplingValidator - Validates edit proposals via importance sampling
 * @see specs/monte-carlo-actionability-improvements.md
 * @see tickets/MONCARACTIMP-008-importance-sampling-validator.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { actionabilityConfig } from '../config/actionabilityConfig.js';

/** @typedef {import('../config/actionabilityConfig.js').ValidationResult} ValidationResult */
/** @typedef {import('../config/actionabilityConfig.js').EditProposal} EditProposal */
/** @typedef {import('../config/actionabilityConfig.js').SingleEdit} SingleEdit */

/**
 * Validates edit proposals using importance sampling with Wilson score confidence intervals.
 *
 * Uses importance sampling to efficiently estimate trigger rates under modified expressions
 * without full re-simulation. Wilson score intervals provide statistically sound confidence
 * bounds that work well even for small sample sizes.
 */
class ImportanceSamplingValidator {
  #logger;
  #config;

  // Z-score for 95% confidence (default)
  static #Z_SCORES = {
    0.9: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };

  /**
   * Create a new ImportanceSamplingValidator instance.
   *
   * @param {object} deps - Dependencies
   * @param {object} deps.logger - Logger implementing ILogger
   * @param {object} [deps.config] - Optional config override
   */
  constructor({ logger, config = null }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#logger = logger;
    this.#config = config ?? actionabilityConfig.editSetGeneration.importanceSampling;
  }

  /**
   * Validate an edit proposal using importance sampling.
   *
   * @param {EditProposal} proposal - The edit proposal to validate
   * @param {object[]} originalSamples - Samples from original simulation
   * @param {object} expressionContext - Expression structure and evaluation context
   * @returns {ValidationResult} Validation results with estimated rate and confidence
   */
  validate(proposal, originalSamples, expressionContext) {
    if (!proposal || !Array.isArray(originalSamples) || originalSamples.length === 0) {
      this.#logger.debug('ImportanceSamplingValidator: Invalid input, returning low-confidence result');
      return this.#lowConfidenceResult();
    }

    try {
      const weights = this.#computeWeights(proposal.edits, originalSamples, expressionContext);
      const { estimatedRate, effectiveSampleSize } = this.#computeWeightedEstimate(
        weights,
        originalSamples,
        proposal.edits,
        expressionContext
      );

      const confidenceInterval = this.#wilsonScoreInterval(
        estimatedRate,
        effectiveSampleSize
      );

      const confidence = this.#assessConfidence(effectiveSampleSize, confidenceInterval);

      this.#logger.debug(
        `ImportanceSamplingValidator: Estimated rate ${(estimatedRate * 100).toFixed(2)}% ` +
        `[${(confidenceInterval[0] * 100).toFixed(2)}%, ${(confidenceInterval[1] * 100).toFixed(2)}%] ` +
        `(ESS: ${effectiveSampleSize.toFixed(0)}, confidence: ${confidence})`
      );

      return {
        estimatedRate,
        confidenceInterval,
        confidence,
        sampleCount: originalSamples.length,
        effectiveSampleSize,
      };
    } catch (err) {
      this.#logger.error('ImportanceSamplingValidator: Validation error', err);
      return this.#lowConfidenceResult();
    }
  }

  /**
   * Validate multiple proposals efficiently.
   *
   * @param {EditProposal[]} proposals - Array of proposals
   * @param {object[]} originalSamples - Samples from original simulation
   * @param {object} expressionContext - Expression context
   * @returns {Map<EditProposal, ValidationResult>} Map of proposals to their validation results
   */
  validateBatch(proposals, originalSamples, expressionContext) {
    const results = new Map();

    if (!Array.isArray(proposals)) {
      return results;
    }

    for (const proposal of proposals) {
      results.set(proposal, this.validate(proposal, originalSamples, expressionContext));
    }

    return results;
  }

  /**
   * Compute importance weights for each sample.
   *
   * @param {SingleEdit[]} edits - Edits to apply
   * @param {object[]} samples - Original samples
   * @param {object} context - Expression context
   * @returns {number[]} Array of importance weights for each sample
   */
  #computeWeights(edits, samples, context) {
    if (!Array.isArray(edits) || edits.length === 0) {
      return samples.map(() => 1.0);
    }

    return samples.map((sample) => {
      let weight = 1.0;

      for (const edit of edits) {
        if (edit.editType === 'threshold') {
          const clauseWeight = this.#computeThresholdWeight(edit, sample, context);
          weight *= clauseWeight;
        }
        // Structure edits have weight 1.0 (no importance correction needed)
      }

      return weight;
    });
  }

  /**
   * Compute weight for a threshold edit.
   *
   * @param {SingleEdit} edit - Threshold edit
   * @param {object} sample - Sample state
   * @param {object} context - Expression context
   * @returns {number} Weight adjustment for this edit
   */
  #computeThresholdWeight(edit, sample, context) {
    const clause = this.#findClause(edit.clauseId, context);
    if (!clause) {
      return 1.0;
    }

    const observedValue = this.#extractValue(sample, clause);
    const oldThreshold = edit.before;
    const newThreshold = edit.after;

    // Validate thresholds are numbers
    if (typeof oldThreshold !== 'number' || typeof newThreshold !== 'number') {
      return 1.0;
    }

    // Weight = P(pass|new) / P(pass|old)
    const passedOld = observedValue >= oldThreshold;
    const passedNew = observedValue >= newThreshold;

    if (passedOld && passedNew) {
      return 1.0;
    }
    if (!passedOld && !passedNew) {
      return 1.0;
    }
    if (!passedOld && passedNew) {
      // Sample now passes but didn't before - upweight
      return this.#estimatePassRateRatio(newThreshold, oldThreshold);
    }
    if (passedOld && !passedNew) {
      // Sample passed before but doesn't now - downweight
      return this.#estimatePassRateRatio(oldThreshold, newThreshold);
    }

    return 1.0;
  }

  /**
   * Estimate ratio of pass rates for threshold change.
   *
   * @param {number} targetThreshold - Target threshold value
   * @param {number} baseThreshold - Base threshold to compare against
   * @returns {number} Estimated ratio of pass rates clamped to [0.1, 10]
   */
  #estimatePassRateRatio(targetThreshold, baseThreshold) {
    // Use linear approximation based on threshold delta
    // More sophisticated: use CDF if distribution known
    const delta = Math.abs(targetThreshold - baseThreshold);
    const direction = targetThreshold < baseThreshold ? 1 : -1;

    // Heuristic: 10% threshold change ≈ proportional pass rate change
    const estimatedRatio = 1 + (direction * delta * 2);
    return Math.max(0.1, Math.min(10, estimatedRatio)); // Clamp to prevent extreme weights
  }

  /**
   * Compute weighted estimate and effective sample size.
   *
   * @param {number[]} weights - Importance weights for each sample
   * @param {object[]} samples - Original simulation samples
   * @param {SingleEdit[]} edits - Edits to apply when evaluating
   * @param {object} context - Expression context for evaluation
   * @returns {{ estimatedRate: number, effectiveSampleSize: number }} Weighted estimate and ESS
   */
  #computeWeightedEstimate(weights, samples, edits, context) {
    let weightedSum = 0;
    let totalWeight = 0;
    let sumSquaredWeights = 0;

    for (let i = 0; i < samples.length; i++) {
      const w = weights[i];
      const passesWithEdit = this.#evaluateWithEdits(samples[i], edits, context);

      weightedSum += w * (passesWithEdit ? 1 : 0);
      totalWeight += w;
      sumSquaredWeights += w * w;
    }

    const estimatedRate = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const effectiveSampleSize = totalWeight > 0
      ? (totalWeight * totalWeight) / sumSquaredWeights
      : 0;

    return { estimatedRate, effectiveSampleSize };
  }

  /**
   * Evaluate if sample passes with edits applied.
   *
   * @param {object} sample - Sample state to evaluate
   * @param {SingleEdit[]} edits - Edits to apply to thresholds
   * @param {object} context - Expression context with clauses
   * @returns {boolean} True if sample passes all clauses with edits applied
   */
  #evaluateWithEdits(sample, edits, context) {
    // Create modified context with edited thresholds
    const modifiedContext = this.#applyEditsToContext(context, edits);

    // Check if all clauses pass
    const clauses = modifiedContext?.clauses ?? [];
    for (const clause of clauses) {
      const value = this.#extractValue(sample, clause);
      const threshold = clause.threshold ?? 0;

      if (value < threshold) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply edits to create modified context.
   *
   * @param {object} context - Original expression context
   * @param {SingleEdit[]} edits - Edits to apply to thresholds
   * @returns {object} Modified context with edited thresholds
   */
  #applyEditsToContext(context, edits) {
    if (!context) {
      return { clauses: [] };
    }

    const modified = JSON.parse(JSON.stringify(context));

    if (!Array.isArray(edits)) {
      return modified;
    }

    for (const edit of edits) {
      if (edit.editType === 'threshold') {
        const clause = this.#findClause(edit.clauseId, modified);
        if (clause) {
          clause.threshold = edit.after;
        }
      }
    }

    return modified;
  }

  /**
   * Compute Wilson score confidence interval.
   *
   * Wilson score interval formula:
   * center = (p + z²/2n) / (1 + z²/n)
   * margin = z × √(p(1-p)/n + z²/4n²) / (1 + z²/n)
   *
   * @param {number} p - Estimated proportion
   * @param {number} n - Effective sample size
   * @returns {[number, number]} Lower and upper bounds of confidence interval
   */
  #wilsonScoreInterval(p, n) {
    if (n <= 0) {
      return [0, 1];
    }

    const confidenceLevel = this.#config?.confidenceLevel ?? 0.95;
    const z = ImportanceSamplingValidator.#Z_SCORES[confidenceLevel] ?? 1.96;
    const z2 = z * z;

    const denominator = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / denominator;
    const margin = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denominator;

    return [
      Math.max(0, center - margin),
      Math.min(1, center + margin),
    ];
  }

  /**
   * Assess confidence level based on effective sample size and interval width.
   *
   * @param {number} ess - Effective sample size
   * @param {[number, number]} interval - Confidence interval
   * @returns {'high'|'medium'|'low'} Confidence classification based on ESS and interval width
   */
  #assessConfidence(ess, interval) {
    const intervalWidth = interval[1] - interval[0];

    if (ess >= 100 && intervalWidth < 0.05) {
      return 'high';
    }
    if (ess >= 30 && intervalWidth < 0.15) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Find clause by ID in context.
   *
   * @param {string} clauseId - ID of the clause to find
   * @param {object} context - Expression context containing clauses
   * @returns {object|null} Found clause object or null if not found
   */
  #findClause(clauseId, context) {
    const clauses = context?.clauses ?? [];
    return clauses.find((c) => c.id === clauseId) ?? null;
  }

  /**
   * Extract value for clause from sample.
   *
   * @param {object} sample - Sample state containing values
   * @param {object} clause - Clause with valuePath or id for extraction
   * @returns {number} Extracted value or 0 if not found
   */
  #extractValue(sample, clause) {
    // Use clause's value path or default to direct property access
    const path = clause.valuePath ?? clause.id;
    return this.#getNestedValue(sample, path) ?? 0;
  }

  /**
   * Get nested value from object by dot-separated path.
   *
   * @param {object} obj - Object to extract value from
   * @param {string} path - Dot-separated path to the value
   * @returns {number|string|object|undefined} Value at the path or undefined
   */
  #getNestedValue(obj, path) {
    if (!obj || typeof path !== 'string') {
      return undefined;
    }
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  /**
   * Return low-confidence result for error cases.
   *
   * @returns {ValidationResult} Default result with zero rate and low confidence
   */
  #lowConfidenceResult() {
    return {
      estimatedRate: 0,
      confidenceInterval: [0, 1],
      confidence: 'low',
      sampleCount: 0,
      effectiveSampleSize: 0,
    };
  }
}

export default ImportanceSamplingValidator;
