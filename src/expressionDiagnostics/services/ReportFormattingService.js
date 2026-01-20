/**
 * @file ReportFormattingService - Pure formatting utilities for Monte Carlo reports
 * @description Stateless service containing formatting functions extracted from
 * MonteCarloReportGenerator. All methods are pure functions with no dependencies
 * on external state.
 * @see MonteCarloReportGenerator.js
 */

class ReportFormattingService {
  // ============================================================================
  // Number Formatting
  // ============================================================================

  /**
   * Format a percentage value with adaptive precision.
   * @param {number} value - Value in 0-1 range
   * @param {number} decimals - Default decimal places (increased for small values)
   * @returns {string}
   */
  formatPercentage(value, decimals = 2) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'number' ||
      isNaN(value)
    ) {
      return 'N/A';
    }

    // Handle exact zero
    if (value === 0) {
      return '0.00%';
    }

    const pct = value * 100;

    // For very small non-zero values, show more precision or use descriptive format
    // 0.01% = 0.0001 in value, 0.001% = 0.00001, etc.
    if (pct > 0 && pct < 0.01) {
      // For extremely small values (< 0.001%), use scientific notation
      if (pct < 0.001) {
        return `${pct.toExponential(2)}%`;
      }
      // For small values (0.001% to 0.01%), show 4 decimal places
      return `${pct.toFixed(4)}%`;
    }

    return `${pct.toFixed(decimals)}%`;
  }

  /**
   * Format a number with specified decimal places.
   * @param {number} value
   * @param {number} decimals
   * @returns {string}
   */
  formatNumber(value, decimals = 2) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'number' ||
      isNaN(value)
    ) {
      return 'N/A';
    }
    return value.toFixed(decimals);
  }

  /**
   * Format a count value with locale-specific thousands separators.
   * @param {number} value
   * @returns {string}
   */
  formatCount(value) {
    if (!Number.isFinite(value)) {
      return 'N/A';
    }
    return value.toLocaleString();
  }

  /**
   * Format signed numbers for slack display.
   * @param {number|null} value
   * @returns {string}
   */
  formatSignedNumber(value) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'number' ||
      isNaN(value)
    ) {
      return 'N/A';
    }
    const formatted = this.formatNumber(Math.abs(value), 3);
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  }

  /**
   * Format signed percentage points.
   * @param {number} value - Value in 0-1 range
   * @returns {string}
   */
  formatSignedPercentagePoints(value) {
    // Note: This function is only called when typeof value === 'number',
    // so null/undefined/non-number checks are unnecessary. Only NaN check is relevant.
    if (isNaN(value)) {
      return 'N/A';
    }
    const points = value * 100;
    const sign = points > 0 ? '+' : points < 0 ? '-' : '';
    return `${sign}${Math.abs(points).toFixed(2)} pp`;
  }

  /**
   * Format boolean values with yes/no/N/A.
   * @param {boolean|null} value
   * @returns {string}
   */
  formatBooleanValue(value) {
    if (value === true) return 'yes';
    if (value === false) return 'no';
    return 'N/A';
  }

  // ============================================================================
  // Rate Formatting
  // ============================================================================

  /**
   * Format a failure rate with optional counts.
   * @param {number|null} rate
   * @param {number|null} failures
   * @param {number|null} total
   * @returns {string}
   */
  formatFailRate(rate, failures = null, total = null) {
    if (
      rate === null ||
      rate === undefined ||
      typeof rate !== 'number' ||
      isNaN(rate)
    ) {
      return 'N/A';
    }
    const pct = this.formatPercentage(rate);
    if (typeof failures === 'number' && typeof total === 'number' && total > 0) {
      return `${pct} (${failures} / ${total})`;
    }
    return pct;
  }

  /**
   * Format an arbitrary rate with optional counts.
   * @param {number|null} rate
   * @param {number|null} count
   * @param {number|null} total
   * @returns {string}
   */
  formatRateWithCounts(rate, count = null, total = null) {
    if (
      rate === null ||
      rate === undefined ||
      typeof rate !== 'number' ||
      isNaN(rate)
    ) {
      return 'N/A';
    }
    const pct = this.formatPercentage(rate);
    if (typeof count === 'number' && typeof total === 'number' && total > 0) {
      return `${pct} (${count} / ${total})`;
    }
    return pct;
  }

  // ============================================================================
  // Threshold Formatting
  // ============================================================================

  /**
   * Format threshold values with integer-domain awareness.
   * @param {number} value
   * @param {boolean} isIntegerDomain
   * @returns {string}
   */
  formatThresholdValue(value, isIntegerDomain) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'number' ||
      isNaN(value)
    ) {
      return 'N/A';
    }

    if (isIntegerDomain) {
      const rounded = Math.round(value);
      if (Math.abs(value - rounded) < 0.000001) {
        return String(rounded);
      }
    }

    return this.formatNumber(value);
  }

  /**
   * Format effective thresholds for integer domains.
   * @param {number|null} value
   * @returns {string}
   */
  formatEffectiveThreshold(value) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'number' ||
      isNaN(value)
    ) {
      return '—';
    }
    return String(Math.round(value));
  }

  // ============================================================================
  // Population Formatting
  // ============================================================================

  /**
   * Format a population header with explicit population type tag.
   * @param {object} population
   * @returns {string}
   */
  formatPopulationHeader(population) {
    if (!population || !Number.isFinite(population.count)) {
      return '';
    }

    const countStr = this.formatCount(population.count);
    const predicate = population.predicate ?? 'all';
    const hash = population.hash ?? 'unknown';
    const populationType = this.#getPopulationType(population.name, predicate);

    return `**Population**: ${populationType} (N=${countStr}; predicate: ${predicate}; hash: ${hash}).\n`;
  }

  /**
   * Determine the population type label based on name and predicate.
   * @param {string} name - Population name
   * @param {string} predicate - Predicate filter
   * @returns {string} Clear population type label
   */
  #getPopulationType(name, predicate) {
    if (predicate === 'all' || predicate === 'none') {
      return 'full';
    }
    if (name?.toLowerCase().includes('mood') || name?.toLowerCase().includes('regime')) {
      return 'stored-mood-regime';
    }
    if (name?.toLowerCase().includes('stored')) {
      return 'stored';
    }
    return name || 'unknown';
  }

  /**
   * Format a stored context population label with explicit population type tags.
   * Displays three population layers: full → stored → stored-mood-regime
   * @param {object|null} populationSummary
   * @param {object|null} population
   * @returns {string}
   */
  formatStoredContextPopulationLabel(populationSummary, population = null) {
    if (population) {
      return this.formatPopulationHeader(population);
    }

    if (!populationSummary) {
      return '';
    }

    const {
      sampleCount,
      storedContextCount,
      storedContextLimit,
      storedInRegimeCount,
    } = populationSummary;

    if (!Number.isFinite(storedContextCount) || storedContextCount <= 0) {
      return '';
    }

    const totalStr = this.formatCount(sampleCount);
    const storedStr = this.formatCount(storedContextCount);
    const limitStr = this.formatCount(storedContextLimit);
    const inRegimeStr = this.formatCount(storedInRegimeCount);

    // Use explicit population type tags for clarity
    const lines = [
      `**Population layers**:`,
      `- full: N=${totalStr}`,
      `- stored: N=${storedStr} (limit: ${limitStr})`,
      `- stored-mood-regime: N=${inRegimeStr}`,
    ];

    return `${lines.join('\n')}\n`;
  }

  /**
   * Format a population evidence label.
   * @param {object} population
   * @returns {string|null}
   */
  formatPopulationEvidenceLabel(population) {
    if (!population || typeof population.name !== 'string') {
      return null;
    }
    if (!Number.isFinite(population.count)) {
      return null;
    }
    const countStr = this.formatCount(population.count);
    return `Population: ${population.name} (N=${countStr})`;
  }

  // ============================================================================
  // Evidence Formatting
  // ============================================================================

  /**
   * Format an evidence count value.
   * @param {number} value
   * @returns {string|number}
   */
  formatEvidenceCount(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '?';
    }
    return Number.isInteger(value) ? value : this.formatNumber(value);
  }

  /**
   * Format an evidence value.
   * @param {number} value
   * @param {number} denominator
   * @returns {string}
   */
  formatEvidenceValue(value, denominator) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 'n/a';
    }
    if (value >= 0 && value <= 1 && denominator !== 1) {
      return this.formatPercentage(value);
    }
    return this.formatNumber(value);
  }

  // ============================================================================
  // Misc Formatting
  // ============================================================================

  /**
   * Format a warning for OR mood constraints in AND-only analyses.
   * @returns {string}
   */
  formatOrMoodConstraintWarning() {
    return '> ⚠️ This analysis treats mood-axis constraints as AND-only. OR-based mood constraints are present, so results are conservative (may be overly strict).\n\n';
  }

  /**
   * Format sweep warnings inline.
   * @param {Array} warnings
   * @returns {string}
   */
  formatSweepWarningsInline(warnings) {
    if (!Array.isArray(warnings) || warnings.length === 0) {
      return '';
    }

    const lines = warnings.map((warning) => `> ⚠️ ${warning.message}`);
    return `${lines.join('\n')}\n\n`;
  }

  /**
   * Format a funnel clause label.
   * @param {object} leaf
   * @returns {string}
   */
  formatFunnelClauseLabel(leaf) {
    const description = leaf?.description;
    if (description) {
      return `\`${description}\``;
    }
    const variablePath = leaf?.variablePath ?? 'unknown';
    const operator = leaf?.comparisonOperator ?? '?';
    const thresholdValue = leaf?.thresholdValue;
    const threshold =
      typeof thresholdValue === 'number'
        ? this.formatNumber(thresholdValue)
        : thresholdValue ?? 'N/A';
    return `\`${variablePath} ${operator} ${threshold}\``;
  }

  /**
   * Format a clamp trivial label.
   * @param {boolean|null} value
   * @returns {string}
   */
  formatClampTrivialLabel(value) {
    if (value === true) {
      return 'Trivially satisfied (clamped)';
    }
    return this.formatBooleanValue(value);
  }

  /**
   * Format tuning direction labels.
   * @param {string} operator
   * @returns {{loosen: string, tighten: string}}
   */
  formatTuningDirection(operator) {
    switch (operator) {
      case '>=':
      case '>':
        return { loosen: 'threshold down', tighten: 'threshold up' };
      case '<=':
      case '<':
        return { loosen: 'threshold up', tighten: 'threshold down' };
      default:
        return { loosen: 'unknown', tighten: 'unknown' };
    }
  }


  // ============================================================================
  // Sanity Box Formatting
  // ============================================================================

  /**
   * Format very small probabilities in scientific notation.
   * @param {number} value - Probability value (0-1)
   * @param {number} threshold - Use scientific notation below this (default 0.0001)
   * @returns {string} Formatted string
   */
  formatScientificNotation(value, threshold = 0.0001) {
    if (value === null || value === undefined || typeof value !== 'number' || isNaN(value)) {
      return 'N/A';
    }
    if (value === 0) return '0';
    if (value >= threshold) return this.formatPercentage(value);
    return value.toExponential(2);
  }

  /**
   * Format sanity status with descriptive label.
   * @param {'expected_rare'|'statistically_plausible'|'unexpected_zero'|'normal'} status
   * @returns {string} Formatted status
   */
  formatSanityStatus(status) {
    const statusMap = {
      expected_rare: '✅ **Expected Rare**',
      statistically_plausible: '✅ **Statistically Plausible**',
      unexpected_zero: '⚠️ **Unexpected Zero**',
      normal: '✅ **Normal**',
      large_deviation: '⚠️ **Large Deviation**',
      data_inconsistency: '❌ **Data Inconsistency**',
    };
    return statusMap[status] ?? status;
  }


  /**
   * Format multiplicative headroom for rarity decomposition analysis.
   * Shows how much trigger rate would improve if pass rate were lifted to target.
   * @param {number|null} inRegimeFailureRate - Failure rate within mood regime (0-1)
   * @param {number} targetPassRate - Target pass rate (default 0.10 = 10%)
   * @returns {string} Formatted headroom string
   */
  formatHeadroomMultiplier(inRegimeFailureRate, targetPassRate = 0.1) {
    if (
      inRegimeFailureRate === null ||
      inRegimeFailureRate === undefined ||
      typeof inRegimeFailureRate !== 'number' ||
      isNaN(inRegimeFailureRate)
    ) {
      return 'N/A';
    }

    const currentPassRate = 1 - inRegimeFailureRate;

    // Edge case: pass rate is 0 (always fails)
    if (currentPassRate <= 0) {
      return '∞ [blocked]';
    }

    // Edge case: already at or above target
    if (currentPassRate >= targetPassRate) {
      return '—';
    }

    const headroom = targetPassRate / currentPassRate;
    return `×${headroom.toFixed(1)}`;
  }
}

export default ReportFormattingService;
