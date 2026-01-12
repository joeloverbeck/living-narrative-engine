/**
 * @file Sampling coverage calculator utilities for Monte Carlo diagnostics.
 */

const DEFAULT_BIN_COUNT = 10;
const DEFAULT_MIN_SAMPLES_PER_BIN = 1;
const DEFAULT_TAIL_PERCENT = 0.1;

/**
 * @typedef {object} SamplingCoverageVariableConfig
 * @property {string} variablePath
 * @property {string} domain
 * @property {number} min
 * @property {number} max
 */

/**
 * @typedef {object} SamplingCoverageConfig
 * @property {SamplingCoverageVariableConfig[]} variables
 * @property {number} [binCount=10]
 * @property {number} [minSamplesPerBin=1]
 * @property {number} [tailPercent=0.1]
 */

/**
 * @param {SamplingCoverageConfig} [config]
 */
export function createSamplingCoverageCalculator(config = {}) {
  const {
    variables = [],
    binCount = DEFAULT_BIN_COUNT,
    minSamplesPerBin = DEFAULT_MIN_SAMPLES_PER_BIN,
    tailPercent = DEFAULT_TAIL_PERCENT,
  } = config;

  const trackers = new Map();

  for (const variable of variables) {
    const domainMin = variable?.min;
    const domainMax = variable?.max;
    const hasKnownDomain =
      Number.isFinite(domainMin) &&
      Number.isFinite(domainMax) &&
      domainMax > domainMin;

    trackers.set(variable.variablePath, {
      variablePath: variable.variablePath,
      domain: variable.domain,
      domainMin,
      domainMax,
      hasKnownDomain,
      sampleCount: 0,
      minObserved: null,
      maxObserved: null,
      binHits: new Array(binCount).fill(0),
      lowTailCount: 0,
      highTailCount: 0,
    });
  }

  const tailPercentValue = tailPercent;

  function recordObservation(variablePath, value) {
    const tracker = trackers.get(variablePath);
    if (!tracker || !Number.isFinite(value)) {
      return false;
    }

    tracker.sampleCount += 1;
    tracker.minObserved =
      tracker.minObserved === null
        ? value
        : Math.min(tracker.minObserved, value);
    tracker.maxObserved =
      tracker.maxObserved === null
        ? value
        : Math.max(tracker.maxObserved, value);

    if (!tracker.hasKnownDomain) {
      return true;
    }

    const clamped = clamp(value, tracker.domainMin, tracker.domainMax);
    const domainSpan = tracker.domainMax - tracker.domainMin;
    const relative = domainSpan === 0 ? 0 : (clamped - tracker.domainMin) / domainSpan;
    const rawIndex = Math.floor(relative * binCount);
    const binIndex = Math.max(0, Math.min(binCount - 1, rawIndex));
    tracker.binHits[binIndex] += 1;

    const tailLowMax = tracker.domainMin + domainSpan * tailPercentValue;
    const tailHighMin = tracker.domainMax - domainSpan * tailPercentValue;
    if (clamped <= tailLowMax) {
      tracker.lowTailCount += 1;
    }
    if (clamped >= tailHighMin) {
      tracker.highTailCount += 1;
    }

    return true;
  }

  function recordSample(sampleByVariable) {
    if (!sampleByVariable || typeof sampleByVariable !== 'object') {
      return 0;
    }

    let recorded = 0;
    for (const [variablePath, value] of Object.entries(sampleByVariable)) {
      if (recordObservation(variablePath, value)) {
        recorded += 1;
      }
    }

    return recorded;
  }

  function finalize() {
    const variablesPayload = [];
    const domainSummaries = new Map();

    for (const tracker of trackers.values()) {
      const variablePayload = buildVariablePayload(
        tracker,
        binCount,
        minSamplesPerBin,
        tailPercentValue
      );
      variablesPayload.push(variablePayload);

      if (variablePayload.rating === 'unknown') {
        continue;
      }

      const domainKey = variablePayload.domain;
      if (!domainSummaries.has(domainKey)) {
        domainSummaries.set(domainKey, {
          domain: domainKey,
          variableCount: 0,
          rangeCoverageTotal: 0,
          binCoverageTotal: 0,
          tailLowTotal: 0,
          tailHighTotal: 0,
        });
      }

      const summary = domainSummaries.get(domainKey);
      summary.variableCount += 1;
      summary.rangeCoverageTotal += variablePayload.rangeCoverage;
      summary.binCoverageTotal += variablePayload.binCoverage;
      summary.tailLowTotal += variablePayload.tailCoverage.low;
      summary.tailHighTotal += variablePayload.tailCoverage.high;
    }

    const summaryByDomain = [];
    for (const summary of domainSummaries.values()) {
      const rangeCoverageAvg = summary.rangeCoverageTotal / summary.variableCount;
      const binCoverageAvg = summary.binCoverageTotal / summary.variableCount;
      const tailCoverageAvg = {
        low: summary.tailLowTotal / summary.variableCount,
        high: summary.tailHighTotal / summary.variableCount,
      };

      summaryByDomain.push({
        domain: summary.domain,
        variableCount: summary.variableCount,
        rangeCoverageAvg,
        binCoverageAvg,
        tailCoverageAvg,
        rating: getCoverageRating(rangeCoverageAvg, binCoverageAvg),
      });
    }

    return {
      summaryByDomain,
      variables: variablesPayload,
      config: {
        binCount,
        minSamplesPerBin,
        tailPercent: tailPercentValue,
      },
    };
  }

  return {
    recordObservation,
    recordSample,
    finalize,
  };
}

function buildVariablePayload(
  tracker,
  binCount,
  minSamplesPerBin,
  tailPercentValue
) {
  if (!tracker.hasKnownDomain) {
    return {
      variablePath: tracker.variablePath,
      domain: tracker.domain,
      minObserved: tracker.minObserved,
      maxObserved: tracker.maxObserved,
      rangeCoverage: null,
      binCoverage: null,
      tailCoverage: null,
      rating: 'unknown',
      sampleCount: tracker.sampleCount,
    };
  }

  const domainSpan = tracker.domainMax - tracker.domainMin;
  const sampleCount = tracker.sampleCount;

  if (sampleCount === 0 || domainSpan <= 0) {
    return {
      variablePath: tracker.variablePath,
      domain: tracker.domain,
      minObserved: null,
      maxObserved: null,
      rangeCoverage: 0,
      binCoverage: 0,
      tailCoverage: { low: 0, high: 0 },
      rating: 'poor',
      sampleCount,
    };
  }

  const minObserved = clamp(tracker.minObserved, tracker.domainMin, tracker.domainMax);
  const maxObserved = clamp(tracker.maxObserved, tracker.domainMin, tracker.domainMax);
  const rangeCoverage = Math.max(0, (maxObserved - minObserved) / domainSpan);
  const binsCovered = tracker.binHits.filter(
    (count) => count >= minSamplesPerBin
  ).length;
  const binCoverage = binsCovered / binCount;
  const tailCoverage = {
    low: tracker.lowTailCount / sampleCount,
    high: tracker.highTailCount / sampleCount,
  };

  return {
    variablePath: tracker.variablePath,
    domain: tracker.domain,
    minObserved: tracker.minObserved,
    maxObserved: tracker.maxObserved,
    rangeCoverage,
    binCoverage,
    tailCoverage,
    rating: getCoverageRating(rangeCoverage, binCoverage),
    sampleCount,
  };
}

function getCoverageRating(rangeCoverage, binCoverage) {
  if (rangeCoverage >= 0.75 && binCoverage >= 0.6) {
    return 'good';
  }
  if (rangeCoverage >= 0.4 && binCoverage >= 0.3) {
    return 'partial';
  }
  return 'poor';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
