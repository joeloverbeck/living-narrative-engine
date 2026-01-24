/**
 * @file AgreementMetricsCalculator - Compute agreement metrics for prototype output vectors.
 * @see specs/prototype-analysis-overhaul-v3.md
 */

import { validateDependency } from '../../../utils/dependencyUtils.js';

const DEFAULT_CONFIDENCE_LEVEL = 0.95;
const DEFAULT_MIN_SAMPLES_FOR_RELIABLE_CORRELATION = 500;

const Z_SCORES = {
  0.9: 1.645,
  0.95: 1.96,
  0.99: 2.576,
};

class AgreementMetricsCalculator {
  #wilsonInterval;
  #logger;
  #confidenceLevel;
  #minSamplesForReliableCorrelation;
  #zScore;

  /**
   * Create an agreement metrics calculator.
   *
   * @param {object} options - Constructor options.
   * @param {(successes: number, trials: number, z?: number) => {lower: number, upper: number}} options.wilsonInterval - Wilson CI calculator (z-score input).
   * @param {number} [options.confidenceLevel] - Confidence level for Wilson CI (default 0.95).
   * @param {number} [options.minSamplesForReliableCorrelation] - Co-pass samples required for reliable correlation (default 500).
   * @param {import('../../../interfaces/coreServices.js').ILogger} options.logger - Logger instance.
   */
  constructor({
    wilsonInterval,
    confidenceLevel = DEFAULT_CONFIDENCE_LEVEL,
    minSamplesForReliableCorrelation = DEFAULT_MIN_SAMPLES_FOR_RELIABLE_CORRELATION,
    logger,
  }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error'],
    });
    validateDependency(wilsonInterval, 'wilsonInterval', logger, {
      isFunction: true,
    });

    this.#logger = logger;
    this.#wilsonInterval = wilsonInterval;
    this.#confidenceLevel = Number.isFinite(confidenceLevel)
      ? confidenceLevel
      : DEFAULT_CONFIDENCE_LEVEL;
    this.#minSamplesForReliableCorrelation = Number.isFinite(
      minSamplesForReliableCorrelation
    )
      ? minSamplesForReliableCorrelation
      : DEFAULT_MIN_SAMPLES_FOR_RELIABLE_CORRELATION;
    this.#zScore = Z_SCORES[this.#confidenceLevel] ?? Z_SCORES[0.95];
  }

  /**
   * Calculate agreement metrics between two prototype output vectors.
   *
   * @param {PrototypeOutputVector} vectorA - First prototype output vector.
   * @param {PrototypeOutputVector} vectorB - Second prototype output vector.
   * @returns {AgreementMetrics} Agreement metrics payload.
   */
  calculate(vectorA, vectorB) {
    const { gateResults: gateResultsA, intensities: intensitiesA } =
      this.#validateVector(vectorA, 'vectorA');
    const { gateResults: gateResultsB, intensities: intensitiesB } =
      this.#validateVector(vectorB, 'vectorB');

    if (gateResultsA.length !== gateResultsB.length) {
      const message =
        'AgreementMetricsCalculator: gateResults lengths must match.';
      this.#logger.error(message, {
        lengthA: gateResultsA.length,
        lengthB: gateResultsB.length,
      });
      throw new Error(message);
    }

    const sampleCount = gateResultsA.length;

    let onEitherCount = 0;
    let passACount = 0;
    let passBCount = 0;
    let coPassCount = 0;

    let globalSumAbsDiff = 0;
    let globalSumSqDiff = 0;
    let coSumAbsDiff = 0;
    let coSumSqDiff = 0;

    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumYY = 0;
    let sumXY = 0;

    let coSumX = 0;
    let coSumY = 0;
    let coSumXX = 0;
    let coSumYY = 0;
    let coSumXY = 0;

    for (let i = 0; i < sampleCount; i += 1) {
      const passA = gateResultsA[i] > 0;
      const passB = gateResultsB[i] > 0;
      const intensityA = intensitiesA[i] ?? 0;
      const intensityB = intensitiesB[i] ?? 0;
      const diff = intensityA - intensityB;
      const absDiff = Math.abs(diff);

      globalSumAbsDiff += absDiff;
      globalSumSqDiff += diff * diff;

      sumX += intensityA;
      sumY += intensityB;
      sumXX += intensityA * intensityA;
      sumYY += intensityB * intensityB;
      sumXY += intensityA * intensityB;

      if (passA || passB) {
        onEitherCount += 1;
      }
      if (passA) {
        passACount += 1;
      }
      if (passB) {
        passBCount += 1;
      }
      if (passA && passB) {
        coPassCount += 1;
        coSumAbsDiff += absDiff;
        coSumSqDiff += diff * diff;
        coSumX += intensityA;
        coSumY += intensityB;
        coSumXX += intensityA * intensityA;
        coSumYY += intensityB * intensityB;
        coSumXY += intensityA * intensityB;
      }
    }

    const maeCoPass =
      coPassCount > 0 ? coSumAbsDiff / coPassCount : NaN;
    const rmseCoPass =
      coPassCount > 0 ? Math.sqrt(coSumSqDiff / coPassCount) : NaN;
    const maeGlobal =
      sampleCount > 0 ? globalSumAbsDiff / sampleCount : 0;
    const rmseGlobal =
      sampleCount > 0 ? Math.sqrt(globalSumSqDiff / sampleCount) : 0;
    const activationJaccard =
      onEitherCount > 0 ? coPassCount / onEitherCount : 0;

    const pA_given_B = passBCount > 0 ? coPassCount / passBCount : 0;
    const pB_given_A = passACount > 0 ? coPassCount / passACount : 0;

    const pAInterval = this.#wilsonInterval(
      coPassCount,
      passBCount,
      this.#zScore
    );
    const pBInterval = this.#wilsonInterval(
      coPassCount,
      passACount,
      this.#zScore
    );

    const pearsonCoPass = this.#computeCorrelationFromSums(
      coPassCount,
      coSumX,
      coSumY,
      coSumXX,
      coSumYY,
      coSumXY
    );
    const pearsonGlobal = this.#computeCorrelationFromSums(
      sampleCount,
      sumX,
      sumY,
      sumXX,
      sumYY,
      sumXY
    );

    return {
      maeCoPass,
      rmseCoPass,
      maeGlobal,
      rmseGlobal,
      activationJaccard,
      pA_given_B,
      pB_given_A,
      pA_given_B_lower: pAInterval.lower,
      pA_given_B_upper: pAInterval.upper,
      pB_given_A_lower: pBInterval.lower,
      pB_given_A_upper: pBInterval.upper,
      pearsonCoPass,
      pearsonGlobal,
      coPassCount,
      correlationReliable:
        coPassCount >= this.#minSamplesForReliableCorrelation,
    };
  }

  #validateVector(vector, label) {
    if (!vector || typeof vector !== 'object') {
      const message = `AgreementMetricsCalculator: ${label} must be an object.`;
      this.#logger.error(message, { vector });
      throw new Error(message);
    }

    const { gateResults, intensities } = vector;
    if (!gateResults || typeof gateResults.length !== 'number') {
      const message = `AgreementMetricsCalculator: ${label}.gateResults must be array-like.`;
      this.#logger.error(message, { gateResults });
      throw new Error(message);
    }

    if (!intensities || typeof intensities.length !== 'number') {
      const message = `AgreementMetricsCalculator: ${label}.intensities must be array-like.`;
      this.#logger.error(message, { intensities });
      throw new Error(message);
    }

    if (gateResults.length !== intensities.length) {
      const message = `AgreementMetricsCalculator: ${label} vector lengths must match.`;
      this.#logger.error(message, {
        gateResultsLength: gateResults.length,
        intensitiesLength: intensities.length,
      });
      throw new Error(message);
    }

    return { gateResults, intensities };
  }

  #computeCorrelationFromSums(count, sumX, sumY, sumXX, sumYY, sumXY) {
    if (count < 2) {
      return NaN;
    }

    const cov = sumXY - (sumX * sumY) / count;
    const varX = sumXX - (sumX * sumX) / count;
    const varY = sumYY - (sumY * sumY) / count;

    if (varX <= 0 || varY <= 0) {
      return NaN;
    }

    const correlation = cov / Math.sqrt(varX * varY);
    return Math.max(-1, Math.min(1, correlation));
  }
}

export default AgreementMetricsCalculator;

/**
 * @typedef {object} PrototypeOutputVector
 * @property {string} prototypeId - Prototype identifier.
 * @property {Float32Array} gateResults - Binary pass/fail per context (0 or 1).
 * @property {Float32Array} intensities - Output intensity per context (0 if gate fails).
 * @property {number} activationRate - Fraction of contexts where gate passes.
 * @property {number} meanIntensity - Mean intensity when activated.
 * @property {number} stdIntensity - Std dev of intensity when activated.
 */

/**
 * @typedef {object} AgreementMetrics
 * @property {number} maeCoPass - MAE on samples where both gates pass.
 * @property {number} rmseCoPass - RMSE on samples where both gates pass.
 * @property {number} maeGlobal - MAE on all samples (zero when gate fails).
 * @property {number} rmseGlobal - RMSE on all samples.
 * @property {number} activationJaccard - P(both) / P(either).
 * @property {number} pA_given_B - P(A passes | B passes).
 * @property {number} pB_given_A - P(B passes | A passes).
 * @property {number} pA_given_B_lower - Wilson CI lower bound.
 * @property {number} pA_given_B_upper - Wilson CI upper bound.
 * @property {number} pB_given_A_lower - Wilson CI lower bound.
 * @property {number} pB_given_A_upper - Wilson CI upper bound.
 * @property {number} pearsonCoPass - Correlation on co-pass (diagnostic only).
 * @property {number} pearsonGlobal - Global correlation (diagnostic only).
 * @property {number} coPassCount - Number of co-pass samples.
 * @property {boolean} correlationReliable - Whether correlation should be trusted.
 */
