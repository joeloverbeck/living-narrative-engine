/**
 * @file Build sampling coverage conclusions for reports and UI.
 */

const DEFAULT_TAIL_PERCENT = 0.1;
const SEVERITY_RANK = {
  critical: 0,
  warn: 1,
  info: 2,
};

/**
 * @typedef {object} CoverageConclusion
 * @property {string} severity
 * @property {string} text
 */

/**
 * @param {object} samplingCoverage
 * @param {object} [options]
 * @param {boolean} [options.includeWatchlist=false]
 * @returns {{domainConclusions: CoverageConclusion[], variableSummary: CoverageConclusion[], globalImplications: CoverageConclusion[], watchlist: CoverageConclusion[]}}
 */
export function buildSamplingCoverageConclusions(
  samplingCoverage,
  options = {}
) {
  const empty = {
    domainConclusions: [],
    variableSummary: [],
    globalImplications: [],
    watchlist: [],
  };

  if (!samplingCoverage || typeof samplingCoverage !== 'object') {
    return empty;
  }

  const summaryByDomain = Array.isArray(samplingCoverage.summaryByDomain)
    ? samplingCoverage.summaryByDomain
    : [];
  const variables = Array.isArray(samplingCoverage.variables)
    ? samplingCoverage.variables
    : [];
  const config = samplingCoverage.config ?? {};
  const tailPercent = Number.isFinite(config.tailPercent)
    ? config.tailPercent
    : DEFAULT_TAIL_PERCENT;

  const domainConclusions = [];
  let hasStarvedHighTail = false;
  let hasStarvedLowTail = false;
  let hasClumpedBins = false;

  for (const summary of summaryByDomain) {
    if (!summary || typeof summary !== 'object') {
      continue;
    }

    const domain = summary.domain ?? 'unknown';
    const rangeCoverage = toNumber(summary.rangeCoverageAvg);
    const binCoverage = toNumber(summary.binCoverageAvg);
    const tailLow = toNumber(summary.tailCoverageAvg?.low);
    const tailHigh = toNumber(summary.tailCoverageAvg?.high);

    const tailLowRatio =
      tailLow !== null && tailPercent > 0 ? tailLow / tailPercent : null;
    const tailHighRatio =
      tailHigh !== null && tailPercent > 0 ? tailHigh / tailPercent : null;

    const hasTailRatios = tailLowRatio !== null && tailHighRatio !== null;
    const tailMinRatio = hasTailRatios
      ? Math.min(tailLowRatio, tailHighRatio)
      : null;
    const tailMaxRatio = hasTailRatios
      ? Math.max(tailLowRatio, tailHighRatio)
      : null;
    const tailAsymmetry = hasTailRatios
      ? tailMaxRatio / Math.max(tailMinRatio, 1e-9)
      : null;

    if (tailHighRatio !== null && tailHighRatio < 0.2) {
      hasStarvedHighTail = true;
    }
    if (tailLowRatio !== null && tailLowRatio < 0.2) {
      hasStarvedLowTail = true;
    }
    if (binCoverage !== null && binCoverage < 0.75) {
      hasClumpedBins = true;
    }

    const domainFindings = [];
    let hasTailNearZero = false;

    if (tailHighRatio !== null && tailHighRatio < 0.05) {
      hasTailNearZero = true;
      domainFindings.push({
        severity: 'critical',
        text: `${domain}: upper tail is effectively untested (top ${formatPercent(
          tailPercent,
          0
        )} has ${formatPercent(tailHigh, 4)} of samples). High-threshold feasibility results are not trustworthy here.`,
      });
    }

    if (tailLowRatio !== null && tailLowRatio < 0.05) {
      hasTailNearZero = true;
      domainFindings.push({
        severity: 'critical',
        text: `${domain}: lower tail is effectively untested (bottom ${formatPercent(
          tailPercent,
          0
        )} has ${formatPercent(tailLow, 2)} of samples). Low-threshold feasibility results are not trustworthy here.`,
      });
    }

    if (!hasTailNearZero && tailAsymmetry !== null && tailAsymmetry >= 6) {
      const severity = tailAsymmetry >= 20 ? 'critical' : 'warn';
      const starvedSide =
        tailHighRatio !== null && tailLowRatio !== null && tailHighRatio < tailLowRatio
          ? 'upper'
          : 'lower';
      domainFindings.push({
        severity,
        text: `${domain}: tail coverage is strongly lopsided; the ${starvedSide} extreme is effectively untested. Interpret threshold-driven conclusions asymmetrically.`,
      });
    }

    if (rangeCoverage !== null) {
      if (rangeCoverage < 0.65) {
        domainFindings.push({
          severity: 'critical',
          text: `${domain}: observed range spans only ${formatPercent(
            rangeCoverage,
            0
          )} of the domain. This suggests ceilings/floors or gating; feasibility conclusions involving missing ranges are low-confidence.`,
        });
      } else if (rangeCoverage < 0.8) {
        domainFindings.push({
          severity: 'warn',
          text: `${domain}: observed range spans only ${formatPercent(
            rangeCoverage,
            0
          )} of the domain. This suggests ceilings/floors or gating; feasibility conclusions involving missing ranges are low-confidence.`,
        });
      }
    }

    if (binCoverage !== null && binCoverage < 0.75) {
      domainFindings.push({
        severity: 'warn',
        text: `${domain}: bin coverage is ${formatPercent(
          binCoverage,
          0
        )}, indicating clumping. Rates may be biased toward a few common regimes.`,
      });
    }

    if (
      rangeCoverage !== null &&
      binCoverage !== null &&
      tailLowRatio !== null &&
      tailHighRatio !== null &&
      rangeCoverage >= 0.9 &&
      binCoverage >= 0.9 &&
      tailLowRatio >= 0.7 &&
      tailHighRatio >= 0.7
    ) {
      domainFindings.push({
        severity: 'info',
        text: `${domain}: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.`,
      });
    }

    domainConclusions.push(...domainFindings);
  }

  domainConclusions.sort(compareBySeverityThenText);

  const variableSummary = buildVariableSummary(variables, tailPercent);

  const globalImplications = [];
  if (hasStarvedHighTail) {
    globalImplications.push({
      severity: 'critical',
      text: 'Do not trust feasibility estimates for prerequisites that target the upper end of a domain; the sampler is not generating those states often enough to test them.',
    });
  }
  if (hasStarvedLowTail) {
    globalImplications.push({
      severity: 'critical',
      text: 'Do not trust feasibility estimates for prerequisites that target the lower end of a domain; the sampler is not generating those states often enough to test them.',
    });
  }
  if (hasClumpedBins) {
    globalImplications.push({
      severity: 'warn',
      text: 'Feasibility rates may be biased by overrepresented regimes; edge-case prerequisites may be incorrectly labeled rare/impossible.',
    });
  }

  globalImplications.sort(compareBySeverityThenText);

  const watchlist = options.includeWatchlist
    ? buildWatchlist(variables)
    : [];

  return {
    domainConclusions,
    variableSummary,
    globalImplications,
    watchlist,
  };
}

function buildVariableSummary(variables, tailPercent) {
  if (!Array.isArray(variables) || variables.length === 0) {
    return [];
  }

  const knownVariables = variables.filter(
    (variable) => variable && variable.rating && variable.rating !== 'unknown'
  );

  if (knownVariables.length === 0) {
    return [];
  }

  let upperStarvedCount = 0;
  let lowerStarvedCount = 0;
  let rangeTruncatedCount = 0;

  for (const variable of knownVariables) {
    const rangeCoverage = toNumber(variable.rangeCoverage);
    const tailLow = toNumber(variable.tailCoverage?.low);
    const tailHigh = toNumber(variable.tailCoverage?.high);
    const tailLowRatio =
      tailLow !== null && tailPercent > 0 ? tailLow / tailPercent : null;
    const tailHighRatio =
      tailHigh !== null && tailPercent > 0 ? tailHigh / tailPercent : null;

    if (tailHighRatio !== null && tailHighRatio < 0.05) {
      upperStarvedCount += 1;
    }
    if (tailLowRatio !== null && tailLowRatio < 0.05) {
      lowerStarvedCount += 1;
    }
    if (rangeCoverage !== null && rangeCoverage < 0.8) {
      rangeTruncatedCount += 1;
    }
  }

  if (upperStarvedCount === 0 && lowerStarvedCount === 0 && rangeTruncatedCount === 0) {
    return [];
  }

  const maxCount = Math.max(
    upperStarvedCount,
    lowerStarvedCount,
    rangeTruncatedCount
  );
  const severity =
    maxCount / knownVariables.length >= 0.25 ? 'critical' : 'warn';

  const segments = [];
  if (upperStarvedCount > 0) {
    segments.push(`${upperStarvedCount} show near-zero upper-tail coverage`);
  }
  if (lowerStarvedCount > 0) {
    segments.push(`${lowerStarvedCount} show near-zero lower-tail coverage`);
  }
  if (rangeTruncatedCount > 0) {
    segments.push(`${rangeTruncatedCount} show truncated range`);
  }

  const summaryText = `Across variables: ${segments.join('; ')}. Those regions are effectively unvalidated by current sampling.`;

  return [{ severity, text: summaryText }];
}

function buildWatchlist(variables) {
  if (!Array.isArray(variables) || variables.length === 0) {
    return [];
  }

  let minRange = null;
  let minTailHigh = null;
  let minTailLow = null;

  for (const variable of variables) {
    if (!variable || variable.rating === 'unknown') {
      continue;
    }

    const rangeCoverage = toNumber(variable.rangeCoverage);
    const tailLow = toNumber(variable.tailCoverage?.low);
    const tailHigh = toNumber(variable.tailCoverage?.high);

    if (rangeCoverage !== null) {
      minRange = minRange === null ? rangeCoverage : Math.min(minRange, rangeCoverage);
    }
    if (tailHigh !== null) {
      minTailHigh = minTailHigh === null ? tailHigh : Math.min(minTailHigh, tailHigh);
    }
    if (tailLow !== null) {
      minTailLow = minTailLow === null ? tailLow : Math.min(minTailLow, tailLow);
    }
  }

  const entries = [];

  if (minRange !== null) {
    entries.push({
      severity: 'info',
      text: `Worst range coverage: min=${formatPercent(minRange, 0)}.`,
    });
  }
  if (minTailHigh !== null) {
    entries.push({
      severity: 'info',
      text: `Worst upper-tail coverage: min tailHigh=${formatPercent(
        minTailHigh,
        4
      )}.`,
    });
  }
  if (minTailLow !== null) {
    entries.push({
      severity: 'info',
      text: `Worst lower-tail coverage: min tailLow=${formatPercent(minTailLow, 4)}.`,
    });
  }

  return entries;
}

function compareBySeverityThenText(a, b) {
  const rankA = SEVERITY_RANK[a.severity] ?? 99;
  const rankB = SEVERITY_RANK[b.severity] ?? 99;
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return a.text.localeCompare(b.text);
}

function formatPercent(value, digits) {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  return `${(value * 100).toFixed(digits)}%`;
}

function toNumber(value) {
  return Number.isFinite(value) ? value : null;
}
