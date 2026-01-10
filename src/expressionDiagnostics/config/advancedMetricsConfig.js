/**
 * @file Configuration for advanced Monte Carlo metrics
 * @see specs/monte-carlo-advanced-metrics.md
 */

/**
 * @typedef {'emotions'|'moodAxes'|'sexualStates'|'traits'|'default'} DomainName
 */

/**
 * @typedef {object} NearMissEpsilonConfig
 * @property {number} emotions - Epsilon for emotions domain [0, 1] range
 * @property {number} moodAxes - Epsilon for mood axes domain [-100, 100] range
 * @property {number} sexualStates - Epsilon for sexual states domain [0, 100] range
 * @property {number} traits - Epsilon for traits domain [0, 1] range
 * @property {number} default - Fallback epsilon for unknown domains
 */

/**
 * @typedef {object} AdvancedMetricsConfig
 * @property {boolean} enabled - Enable/disable advanced metrics
 * @property {NearMissEpsilonConfig} nearMissEpsilon - Epsilon values by domain
 * @property {number} maxViolationsSampled - Memory optimization limit
 * @property {boolean} includePercentiles - Include percentile metrics
 * @property {boolean} includeNearMiss - Include near-miss metrics
 * @property {boolean} includeLastMile - Include last-mile metrics
 * @property {boolean} includeMaxObserved - Include max observed metrics
 */

/**
 * Configuration for advanced metrics calculation.
 *
 * @type {AdvancedMetricsConfig}
 */
export const advancedMetricsConfig = {
  /**
   * Enable/disable advanced metrics (for performance tuning)
   */
  enabled: true,

  /**
   * Epsilon values for near-miss calculation by domain
   * Key is the domain name, value is the epsilon threshold
   */
  nearMissEpsilon: {
    emotions: 0.05, // [0, 1] range → 5%
    moodAxes: 5, // [-100, 100] range → 2.5%
    sexualStates: 5, // [0, 100] range → 5%
    traits: 0.1, // [0, 1] range → 10% (traits change slowly)
    default: 0.05, // Fallback for unknown domains
  },

  /**
   * Memory optimization settings
   * (Reservoir sampling deferred to future work)
   */
  maxViolationsSampled: Infinity, // No limit currently

  /**
   * Which metrics to include in output
   */
  includePercentiles: true,
  includeNearMiss: true,
  includeLastMile: true,
  includeMaxObserved: true,
};

/**
 * @typedef {object} DomainPattern
 * @property {RegExp} pattern - Regular expression to match variable path prefix
 * @property {DomainName} domain - The domain name to return on match
 */

/**
 * Domain patterns for variable path matching.
 * Maps regex patterns to domain names.
 *
 * @type {DomainPattern[]}
 */
const domainPatterns = [
  { pattern: /^emotions\./, domain: /** @type {DomainName} */ ('emotions') },
  { pattern: /^mood\./, domain: /** @type {DomainName} */ ('moodAxes') },
  {
    pattern: /^sexualStates\./,
    domain: /** @type {DomainName} */ ('sexualStates'),
  },
  {
    pattern: /^sexual\./,
    domain: /** @type {DomainName} */ ('sexualStates'),
  }, // Alternative naming
  { pattern: /^traits\./, domain: /** @type {DomainName} */ ('traits') },
  {
    pattern: /^personalityTraits\./,
    domain: /** @type {DomainName} */ ('traits'),
  },
];

/**
 * Detect the domain from a variable path.
 *
 * @param {string} variablePath - The variable path (e.g., 'emotions.joy', 'mood.valence')
 * @returns {DomainName} The detected domain name, or 'default' if unknown
 * @example
 * detectDomain('emotions.joy') // → 'emotions'
 * detectDomain('mood.valence') // → 'moodAxes'
 * detectDomain('unknown.var')  // → 'default'
 */
export function detectDomain(variablePath) {
  if (!variablePath || typeof variablePath !== 'string') {
    return 'default';
  }

  for (const { pattern, domain } of domainPatterns) {
    if (pattern.test(variablePath)) {
      return domain;
    }
  }

  return 'default';
}

/**
 * Get the epsilon value for a given variable path.
 *
 * @param {string} variablePath - The variable path
 * @returns {number} The epsilon value for near-miss detection
 * @example
 * getEpsilonForVariable('emotions.joy')    // → 0.05
 * getEpsilonForVariable('mood.valence')    // → 5
 * getEpsilonForVariable('sexualStates.x')  // → 5
 */
export function getEpsilonForVariable(variablePath) {
  const domain = detectDomain(variablePath);
  return (
    advancedMetricsConfig.nearMissEpsilon[domain] ??
    advancedMetricsConfig.nearMissEpsilon.default
  );
}

/**
 * Check if advanced metrics are enabled.
 *
 * @returns {boolean} Whether advanced metrics are enabled
 */
export function isAdvancedMetricsEnabled() {
  return advancedMetricsConfig.enabled;
}

/**
 * Get specific metric enablement.
 *
 * @param {string} metricName - One of: 'percentiles', 'nearMiss', 'lastMile', 'maxObserved'
 * @returns {boolean} Whether the specified metric is enabled
 */
export function isMetricEnabled(metricName) {
  if (!advancedMetricsConfig.enabled) {
    return false;
  }

  switch (metricName) {
    case 'percentiles':
      return advancedMetricsConfig.includePercentiles;
    case 'nearMiss':
      return advancedMetricsConfig.includeNearMiss;
    case 'lastMile':
      return advancedMetricsConfig.includeLastMile;
    case 'maxObserved':
      return advancedMetricsConfig.includeMaxObserved;
    default:
      return false;
  }
}

export default advancedMetricsConfig;
