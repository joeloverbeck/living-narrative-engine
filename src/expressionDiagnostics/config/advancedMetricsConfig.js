/**
 * @file Configuration for advanced Monte Carlo metrics
 * @see specs/monte-carlo-advanced-metrics.md
 */

/**
 * @typedef {'emotions'|'moodAxes'|'sexualStates'|'traits'|'sexualArousal'|'previousSexualArousal'|'default'} DomainName
 */

/**
 * @typedef {object} NearMissEpsilonConfig
 * @property {number} emotions - Epsilon for emotions domain [0, 1] range
 * @property {number} moodAxes - Epsilon for mood axes domain [-100, 100] range
 * @property {number} sexualStates - Epsilon for sexual states domain [0, 1] range (calculated weighted sums)
 * @property {number} traits - Epsilon for traits domain [0, 1] range
 * @property {number} default - Fallback epsilon for unknown domains
 */

/**
 * @typedef {object} GateClassificationThresholds
 * @property {number} gateClampRateHigh - Gate clamp rate (mood-regime) threshold for mismatch
 * @property {number} passGivenGateLow - Pass | gate (mood-regime) threshold for high threshold
 */

/**
 * @typedef {object} AdvancedMetricsConfig
 * @property {boolean} enabled - Enable/disable advanced metrics
 * @property {NearMissEpsilonConfig} nearMissEpsilon - Epsilon values by domain
 * @property {number} maxViolationsSampled - Memory optimization limit
 * @property {number} maxObservedSampled - Memory optimization limit for observed values
 * @property {boolean} includePercentiles - Include percentile metrics
 * @property {boolean} includeNearMiss - Include near-miss metrics
 * @property {boolean} includeLastMile - Include last-mile metrics
 * @property {boolean} includeMaxObserved - Include max observed metrics
 * @property {GateClassificationThresholds} gateClassificationThresholds - Heuristic thresholds for gate vs threshold badges
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
    sexualStates: 0.05, // [0, 1] range → 5% (calculated weighted sums)
    traits: 0.1, // [0, 1] range → 10% (traits change slowly)
    sexualArousal: 0.05, // [0, 1] range → 5% (scalar)
    previousSexualArousal: 0.05, // [0, 1] range → 5% (scalar)
    default: 0.05, // Fallback for unknown domains
  },

  /**
   * Memory optimization settings
   */
  maxViolationsSampled: 2000,
  maxObservedSampled: 2000,

  /**
   * Which metrics to include in output
   */
  includePercentiles: true,
  includeNearMiss: true,
  includeLastMile: true,
  includeMaxObserved: true,

  /**
   * Heuristic thresholds for UI gate/threshold classification badges.
   */
  gateClassificationThresholds: {
    gateClampRateHigh: 0.5,
    passGivenGateLow: 0.2,
  },
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
  { pattern: /^moodAxes\./, domain: /** @type {DomainName} */ ('moodAxes') },
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
  {
    pattern: /^sexualArousal$/,
    domain: /** @type {DomainName} */ ('sexualArousal'),
  },
  {
    pattern: /^previousSexualArousal$/,
    domain: /** @type {DomainName} */ ('previousSexualArousal'),
  },
];

/**
 * @typedef {object} TunableVariableInfo
 * @property {string} domain - The tunable variable domain key
 * @property {boolean} isScalar - Whether the variable is a scalar path
 * @property {string} name - The leaf name or full path for scalars
 */

/**
 * Complete list of tunable variable patterns, including scalars.
 *
 * @type {Record<string, RegExp>}
 */
export const TUNABLE_VARIABLE_PATTERNS = {
  emotions: /^emotions\.(\w+)$/,
  sexualStates: /^sexualStates\.(\w+)$/,
  sexual: /^sexual\.(\w+)$/,
  mood: /^mood\.(\w+)$/,
  moodAxes: /^moodAxes\.(\w+)$/,
  traits: /^traits\.(\w+)$/,
  affectTraits: /^affectTraits\.(\w+)$/,
  sexualArousal: /^sexualArousal$/,
  previousSexualArousal: /^previousSexualArousal$/,
};

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
 * Check if a variable path represents a tunable variable.
 *
 * @param {string} variablePath - The variable path (e.g., 'emotions.joy', 'sexualArousal')
 * @returns {boolean}
 */
export function isTunableVariable(variablePath) {
  return Boolean(getTunableVariableInfo(variablePath));
}

/**
 * Get tunable variable metadata.
 *
 * @param {string} variablePath - The variable path
 * @returns {TunableVariableInfo | null}
 */
export function getTunableVariableInfo(variablePath) {
  if (!variablePath || typeof variablePath !== 'string') {
    return null;
  }

  for (const [domain, pattern] of Object.entries(TUNABLE_VARIABLE_PATTERNS)) {
    const match = variablePath.match(pattern);
    if (match) {
      return {
        domain,
        isScalar:
          domain === 'sexualArousal' || domain === 'previousSexualArousal',
        name: match[1] || variablePath,
      };
    }
  }

  return null;
}

/**
 * Get the epsilon value for a given variable path.
 *
 * @param {string} variablePath - The variable path
 * @returns {number} The epsilon value for near-miss detection
 * @example
 * getEpsilonForVariable('emotions.joy')    // → 0.05
 * getEpsilonForVariable('mood.valence')    // → 5
 * getEpsilonForVariable('sexualStates.x')  // → 0.05
 * getEpsilonForVariable('sexualArousal')   // → 0.05
 */
export function getEpsilonForVariable(variablePath) {
  const domain = detectDomain(variablePath);
  return (
    advancedMetricsConfig.nearMissEpsilon[domain] ??
    advancedMetricsConfig.nearMissEpsilon.default
  );
}

/**
 * Check if a variable path belongs to an integer-valued domain.
 *
 * @param {string} variablePath - The variable path
 * @returns {boolean}
 */
export function isIntegerDomain(variablePath) {
  const domain = detectDomain(variablePath);
  return domain === 'moodAxes' || domain === 'traits';
}

/**
 * Get sensitivity step size based on variable domain granularity.
 *
 * @param {string} variablePath - The variable path
 * @param {number} [defaultStepSize=0.05] - Default step size for float domains
 * @returns {number}
 */
export function getSensitivityStepSize(variablePath, defaultStepSize = 0.05) {
  return isIntegerDomain(variablePath) ? 1 : defaultStepSize;
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
