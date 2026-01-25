/**
 * @file Configuration validator for Prototype Overlap Analysis
 * Addresses Issue 13 (Threshold Sensitivity) and Issue 14 (Missing Validation)
 * from Section 10.5 of reports/axis-space-analysis.md
 * @see prototypeOverlapConfig.js
 * @see reports/axis-space-analysis.md Section 10.5
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} [warnings] - Array of warning messages
 * @property {string} formattedErrors - Formatted error string
 * @property {object} [details] - Additional validation details
 */

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

/**
 * Properties that must be in the range [0, 1] (probabilities/ratios)
 */
const PROBABILITY_PROPERTIES = [
  'candidateMinActiveAxisOverlap',
  'candidateMinSignAgreement',
  'candidateMinCosineSimilarity',
  'jaccardEmptySetValue',
  'minOnEitherRateForMerge',
  'minGateOverlapRatio',
  'minCoPassRatioForReliable',
  'compositeScoreGateOverlapWeight',
  'compositeScoreCorrelationWeight',
  'compositeScoreGlobalDiffWeight',
  'coPassCorrelationWeight',
  'globalCorrelationWeight',
  'nearMissGateOverlapRatio',
  'minPctWithinEpsForMerge',
  'nestedConditionalThreshold',
  'strongGateOverlapRatio',
  'minExclusiveForBroader',
  'gateBasedMinIntervalOverlap',
  'prescanMinGateOverlap',
  'confidenceLevel',
  'minActivationJaccardForMerge',
  'minConditionalProbForNesting',
  'minConditionalProbCILowerForNesting',
  'symmetryTolerance',
  'asymmetryRequired',
  'lowVolumeThreshold',
  'lowNoveltyThreshold',
  'singleAxisFocusThreshold',
  'minInfoGainForSuggestion',
  'minOverlapReductionForSuggestion',
  'minActivationRateAfterSuggestion',
  'pcaResidualVarianceThreshold',
  'pcaMinAxisUsageRatio',
  'hubMinDegreeRatio',
  'hubBetweennessWeight',
  'residualVarianceThreshold',
  'candidateAxisMinRMSEReduction',
  'candidateAxisMinCoUsageReduction',
  'candidateAxisRMSEWeight',
  'candidateAxisStrongAxisWeight',
  'candidateAxisCoUsageWeight',
  'candidateAxisMinCombinedScore',
  'candidateAxisMinExtractionConfidence',
];

/**
 * Properties that must be in the range [-1, 1] (correlations)
 */
const CORRELATION_PROPERTIES = [
  'minCorrelationForMerge',
  'minCorrelationForSubsumption',
  'minGlobalCorrelationForMerge',
  'minGlobalCorrelationForSubsumption',
  'nearMissCorrelationThreshold',
  'nearMissGlobalCorrelationThreshold',
  'strongCorrelationForMerge',
];

/**
 * Properties that must be positive integers (>= 1)
 */
const POSITIVE_INTEGER_PROPERTIES = [
  'sampleCountPerPair',
  'divergenceExamplesK',
  'maxCandidatePairs',
  'maxSamplesTotal',
  'minCoPassSamples',
  'maxNearMissPairsToReport',
  'minPassSamplesForConditional',
  'prescanSampleCount',
  'maxPrescanPairs',
  'sharedPoolSize',
  'quickAnalysisPoolSize',
  'deepAnalysisPoolSize',
  'stratumCount',
  'minSamplesForReliableCorrelation',
  'coPassSampleConfidenceThreshold',
  'clusterCount',
  'minSamplesForStump',
  'maxSuggestionsPerPair',
  'hubMinDegree',
  'hubMinNeighborhoodDiversity',
  'coverageGapMinClusterSize',
  'dbscanMinPoints',
  'adaptiveThresholdIterations',
  'signTensionMinHighAxes',
  'candidateAxisMinStrongAxisReduction',
  'candidateAxisMinAffectedPrototypes',
  'candidateAxisMaxCandidates',
];

/**
 * Properties that must be positive numbers (> 0)
 */
const POSITIVE_NUMBER_PROPERTIES = [
  'activeAxisEpsilon',
  'strongAxisThreshold',
  'softSignThreshold',
  'dominanceDelta',
  'maxMeanAbsDiffForMerge',
  'maxExclusiveRateForSubsumption',
  'maxGlobalMeanAbsDiffForMerge',
  'intensityEps',
  'strictEpsilon',
  'bandMargin',
  'maxMaeCoPassForMerge',
  'maxRmseCoPassForMerge',
  'maxMaeGlobalForMerge',
  'maxMaeDeltaForExpression',
  'maxExclusiveForSubsumption',
  'divergenceThreshold',
  'pcaKaiserThreshold',
  'hubMaxEdgeWeight',
  'coverageGapAxisDistanceThreshold',
  'multiAxisUsageThreshold',
  'multiAxisSignBalanceThreshold',
  'highAxisLoadingThreshold',
  'signTensionMinMagnitude',
  'reconstructionErrorThreshold',
  'jacobiConvergenceTolerance',
  'dbscanEpsilon',
];

/**
 * Boolean properties
 */
const BOOLEAN_PROPERTIES = [
  'enableConvertToExpression',
  'enableMultiRouteFiltering',
  'enableStratifiedSampling',
  'enableAxisGapDetection',
  'pcaRequireCorroboration',
  'enableMagnitudeAwareGapScoring',
  'enableAdaptiveThresholds',
  'enableCandidateAxisValidation',
];

/**
 * Enum property definitions with valid values
 */
const ENUM_PROPERTIES = {
  stratificationStrategy: ['uniform', 'mood-regime', 'extremes-enhanced'],
  clusteringMethod: ['k-means', 'hierarchical'],
  pcaComponentSignificanceMethod: ['broken-stick', 'kaiser'],
  pcaNormalizationMethod: ['center-only', 'z-score'],
  pcaExpectedDimensionMethod: [
    'variance-80',
    'variance-90',
    'broken-stick',
    'median-active',
  ],
  coverageGapClusteringMethod: ['profile-based', 'dbscan'],
};

/**
 * Ordering constraints where lesser property must be < greater property
 */
const ORDERING_CONSTRAINTS = [
  {
    lesser: 'activeAxisEpsilon',
    greater: 'strongAxisThreshold',
    description: 'activeAxisEpsilon must be less than strongAxisThreshold',
  },
  {
    lesser: 'minCorrelationForSubsumption',
    greater: 'minCorrelationForMerge',
    operator: '<=',
    description:
      'minCorrelationForSubsumption must be <= minCorrelationForMerge',
  },
  {
    lesser: 'minGlobalCorrelationForSubsumption',
    greater: 'minGlobalCorrelationForMerge',
    operator: '<=',
    description:
      'minGlobalCorrelationForSubsumption must be <= minGlobalCorrelationForMerge',
  },
  {
    lesser: 'nearMissCorrelationThreshold',
    greater: 'minCorrelationForMerge',
    description:
      'nearMissCorrelationThreshold must be less than minCorrelationForMerge',
  },
  {
    lesser: 'nearMissGlobalCorrelationThreshold',
    greater: 'minGlobalCorrelationForMerge',
    description:
      'nearMissGlobalCorrelationThreshold must be less than minGlobalCorrelationForMerge',
  },
  {
    lesser: 'nearMissGateOverlapRatio',
    greater: 'minGateOverlapRatio',
    description:
      'nearMissGateOverlapRatio must be less than minGateOverlapRatio',
  },
  {
    lesser: 'strongGateOverlapRatio',
    greater: 'minGateOverlapRatio',
    description: 'strongGateOverlapRatio must be less than minGateOverlapRatio',
  },
  {
    lesser: 'strongCorrelationForMerge',
    greater: 'minCorrelationForMerge',
    description:
      'strongCorrelationForMerge must be less than minCorrelationForMerge',
  },
  {
    lesser: 'prescanMinGateOverlap',
    greater: 'minGateOverlapRatio',
    description:
      'prescanMinGateOverlap must be less than minGateOverlapRatio for escalation to work',
  },
  {
    lesser: 'minConditionalProbCILowerForNesting',
    greater: 'minConditionalProbForNesting',
    description:
      'minConditionalProbCILowerForNesting must be less than minConditionalProbForNesting',
  },
];

/**
 * Pool size ordering constraints (special case with chaining)
 */
const POOL_SIZE_ORDERING = [
  {
    lesser: 'quickAnalysisPoolSize',
    greater: 'sharedPoolSize',
    operator: '<=',
    description: 'quickAnalysisPoolSize must be <= sharedPoolSize',
  },
  {
    lesser: 'sharedPoolSize',
    greater: 'deepAnalysisPoolSize',
    operator: '<=',
    description: 'sharedPoolSize must be <= deepAnalysisPoolSize',
  },
];

/**
 * Weight sum constraints where properties must sum to 1.0
 */
const WEIGHT_SUM_CONSTRAINTS = [
  {
    props: [
      'compositeScoreGateOverlapWeight',
      'compositeScoreCorrelationWeight',
      'compositeScoreGlobalDiffWeight',
    ],
    sum: 1.0,
    tolerance: 0.001,
    description: 'Composite score weights must sum to 1.0',
  },
  {
    props: ['coPassCorrelationWeight', 'globalCorrelationWeight'],
    sum: 1.0,
    tolerance: 0.001,
    description: 'Correlation weights must sum to 1.0',
  },
  {
    props: [
      'candidateAxisRMSEWeight',
      'candidateAxisStrongAxisWeight',
      'candidateAxisCoUsageWeight',
    ],
    sum: 1.0,
    tolerance: 0.001,
    description: 'Candidate axis weights must sum to 1.0',
  },
];

/**
 * Properties that can be null
 */
const NULLABLE_PROPERTIES = ['poolRandomSeed', 'jacobiMaxIterationsOverride'];

/**
 * Bounded range properties
 */
const BOUNDED_RANGE_PROPERTIES = {
  coverageGapMaxSubspaceDimension: { min: 1, max: 3 },
  adaptiveThresholdPercentile: { min: 0, max: 100 },
};

// ============================================================================
// VALIDATOR CLASS
// ============================================================================

/**
 * Validator for prototype overlap analysis configuration.
 * Implements multi-layer validation: basic types → semantic constraints → dependencies.
 */
export class PrototypeOverlapConfigValidator {
  /**
   * @private
   * @type {import('../../interfaces/coreServices.js').ILogger}
   */
  #logger;

  /**
   * Creates an instance of PrototypeOverlapConfigValidator
   *
   * @param {object} dependencies - Dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#logger = logger;
  }

  /**
   * Validates basic type and range constraints on configuration values.
   *
   * @param {object} config - Configuration object to validate
   * @returns {ValidationResult} Validation result with success flag and errors
   */
  validateConfig(config) {
    try {
      if (!config || typeof config !== 'object') {
        return {
          isValid: false,
          errors: ['Configuration must be a non-null object'],
          formattedErrors: 'Configuration must be a non-null object',
        };
      }

      this.#logger.debug(
        'Validating prototype overlap configuration basic types'
      );

      const errors = [];

      // Validate probability properties [0, 1]
      for (const prop of PROBABILITY_PROPERTIES) {
        if (prop in config) {
          const value = config[prop];
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`${prop} must be a number, got ${typeof value}`);
          } else if (value < 0 || value > 1) {
            errors.push(`${prop} must be in range [0, 1], got ${value}`);
          }
        }
      }

      // Validate correlation properties [-1, 1]
      for (const prop of CORRELATION_PROPERTIES) {
        if (prop in config) {
          const value = config[prop];
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`${prop} must be a number, got ${typeof value}`);
          } else if (value < -1 || value > 1) {
            errors.push(`${prop} must be in range [-1, 1], got ${value}`);
          }
        }
      }

      // Validate positive integer properties
      for (const prop of POSITIVE_INTEGER_PROPERTIES) {
        if (prop in config) {
          const value = config[prop];
          if (
            typeof value !== 'number' ||
            isNaN(value) ||
            !Number.isInteger(value)
          ) {
            errors.push(`${prop} must be an integer, got ${typeof value}`);
          } else if (value < 1) {
            errors.push(`${prop} must be >= 1, got ${value}`);
          }
        }
      }

      // Validate positive number properties
      for (const prop of POSITIVE_NUMBER_PROPERTIES) {
        if (prop in config) {
          const value = config[prop];
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`${prop} must be a number, got ${typeof value}`);
          } else if (value <= 0) {
            errors.push(`${prop} must be > 0, got ${value}`);
          }
        }
      }

      // Validate boolean properties
      for (const prop of BOOLEAN_PROPERTIES) {
        if (prop in config) {
          const value = config[prop];
          if (typeof value !== 'boolean') {
            errors.push(`${prop} must be a boolean, got ${typeof value}`);
          }
        }
      }

      // Validate enum properties
      for (const [prop, validValues] of Object.entries(ENUM_PROPERTIES)) {
        if (prop in config) {
          const value = config[prop];
          if (!validValues.includes(value)) {
            errors.push(
              `${prop} must be one of [${validValues.join(', ')}], got '${value}'`
            );
          }
        }
      }

      // Validate nullable properties that must be positive integers when set
      for (const prop of NULLABLE_PROPERTIES) {
        if (prop in config && config[prop] !== null) {
          const value = config[prop];
          if (
            typeof value !== 'number' ||
            isNaN(value) ||
            !Number.isInteger(value) ||
            value < 1
          ) {
            errors.push(
              `${prop} must be null or a positive integer, got ${value}`
            );
          }
        }
      }

      // Validate bounded range properties
      for (const [prop, bounds] of Object.entries(BOUNDED_RANGE_PROPERTIES)) {
        if (prop in config) {
          const value = config[prop];
          if (typeof value !== 'number' || isNaN(value)) {
            errors.push(`${prop} must be a number, got ${typeof value}`);
          } else if (value < bounds.min || value > bounds.max) {
            errors.push(
              `${prop} must be in range [${bounds.min}, ${bounds.max}], got ${value}`
            );
          }
        }
      }

      // Validate highThresholds array
      if ('highThresholds' in config) {
        const value = config.highThresholds;
        if (!Array.isArray(value)) {
          errors.push(
            `highThresholds must be an array, got ${typeof value}`
          );
        } else {
          for (let i = 0; i < value.length; i++) {
            const threshold = value[i];
            if (
              typeof threshold !== 'number' ||
              isNaN(threshold) ||
              threshold <= 0 ||
              threshold >= 1
            ) {
              errors.push(
                `highThresholds[${i}] must be a number in range (0, 1), got ${threshold}`
              );
            }
          }
        }
      }

      // Validate changeEmotionNameHints array
      if ('changeEmotionNameHints' in config) {
        const value = config.changeEmotionNameHints;
        if (!Array.isArray(value)) {
          errors.push(
            `changeEmotionNameHints must be an array, got ${typeof value}`
          );
        } else {
          for (let i = 0; i < value.length; i++) {
            if (typeof value[i] !== 'string') {
              errors.push(
                `changeEmotionNameHints[${i}] must be a string, got ${typeof value[i]}`
              );
            }
          }
        }
      }

      // Validate minHighJaccardForMergeAtT object
      if ('minHighJaccardForMergeAtT' in config) {
        const value = config.minHighJaccardForMergeAtT;
        if (typeof value !== 'object' || value === null) {
          errors.push(
            `minHighJaccardForMergeAtT must be an object, got ${typeof value}`
          );
        } else {
          for (const [key, val] of Object.entries(value)) {
            if (typeof val !== 'number' || isNaN(val) || val < 0 || val > 1) {
              errors.push(
                `minHighJaccardForMergeAtT['${key}'] must be a number in [0, 1], got ${val}`
              );
            }
          }
        }
      }

      // Validate coverageGapSubspaceThresholds object
      if ('coverageGapSubspaceThresholds' in config) {
        const value = config.coverageGapSubspaceThresholds;
        if (typeof value !== 'object' || value === null) {
          errors.push(
            `coverageGapSubspaceThresholds must be an object, got ${typeof value}`
          );
        } else {
          for (const [key, val] of Object.entries(value)) {
            const keyNum = parseInt(key, 10);
            if (isNaN(keyNum) || keyNum < 1 || keyNum > 3) {
              errors.push(
                `coverageGapSubspaceThresholds key '${key}' must be 1, 2, or 3`
              );
            }
            if (typeof val !== 'number' || isNaN(val) || val <= 0 || val > 1) {
              errors.push(
                `coverageGapSubspaceThresholds['${key}'] must be a number in (0, 1], got ${val}`
              );
            }
          }
        }
      }

      const isValid = errors.length === 0;

      if (!isValid) {
        this.#logger.warn(
          'Prototype overlap configuration basic validation failed',
          { errorCount: errors.length }
        );
      } else {
        this.#logger.debug(
          'Prototype overlap configuration basic validation passed'
        );
      }

      return {
        isValid,
        errors,
        formattedErrors: errors.join('; '),
      };
    } catch (error) {
      this.#logger.error(
        'Error during prototype overlap configuration validation',
        error
      );

      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        formattedErrors: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validates threshold dependency constraints (ordering and sums).
   *
   * @param {object} config - Configuration object to validate
   * @returns {ValidationResult} Validation result with dependency errors
   */
  validateThresholdDependencies(config) {
    try {
      if (!config || typeof config !== 'object') {
        return {
          isValid: false,
          errors: ['Configuration must be a non-null object'],
          formattedErrors: 'Configuration must be a non-null object',
        };
      }

      this.#logger.debug('Validating threshold dependencies');

      const errors = [];
      const warnings = [];

      // Check ordering constraints
      for (const constraint of ORDERING_CONSTRAINTS) {
        const { lesser, greater, operator = '<', description } = constraint;

        if (lesser in config && greater in config) {
          const lesserValue = config[lesser];
          const greaterValue = config[greater];

          if (
            typeof lesserValue === 'number' &&
            typeof greaterValue === 'number'
          ) {
            let satisfied;
            if (operator === '<=') {
              satisfied = lesserValue <= greaterValue;
            } else {
              satisfied = lesserValue < greaterValue;
            }

            if (!satisfied) {
              errors.push(
                `${description}: ${lesser}=${lesserValue} must be ${operator} ${greater}=${greaterValue}`
              );
            }
          }
        }
      }

      // Check pool size ordering
      for (const constraint of POOL_SIZE_ORDERING) {
        const { lesser, greater, operator = '<=', description } = constraint;

        if (lesser in config && greater in config) {
          const lesserValue = config[lesser];
          const greaterValue = config[greater];

          if (
            typeof lesserValue === 'number' &&
            typeof greaterValue === 'number'
          ) {
            let satisfied;
            if (operator === '<=') {
              satisfied = lesserValue <= greaterValue;
            } else {
              satisfied = lesserValue < greaterValue;
            }

            if (!satisfied) {
              errors.push(
                `${description}: ${lesser}=${lesserValue} must be ${operator} ${greater}=${greaterValue}`
              );
            }
          }
        }
      }

      // Check weight sum constraints
      for (const constraint of WEIGHT_SUM_CONSTRAINTS) {
        const { props, sum, tolerance, description } = constraint;

        // Check if all properties exist
        const allPropsExist = props.every((p) => p in config);

        if (allPropsExist) {
          const actualSum = props.reduce((acc, p) => acc + (config[p] || 0), 0);
          const diff = Math.abs(actualSum - sum);

          if (diff > tolerance) {
            errors.push(
              `${description}: [${props.join(', ')}] sum to ${actualSum.toFixed(4)}, expected ${sum}`
            );
          }
        }
      }

      // Semantic warnings (not errors)
      // Check if prescan sample count is significantly lower than full sample count
      if ('prescanSampleCount' in config && 'sampleCountPerPair' in config) {
        const prescan = config.prescanSampleCount;
        const full = config.sampleCountPerPair;
        if (prescan > full * 0.5) {
          warnings.push(
            `prescanSampleCount (${prescan}) is > 50% of sampleCountPerPair (${full}), ` +
              'prescan efficiency benefit may be minimal'
          );
        }
      }

      // Check subspace thresholds are decreasing
      if ('coverageGapSubspaceThresholds' in config) {
        const thresholds = config.coverageGapSubspaceThresholds;
        if (thresholds[1] && thresholds[2] && thresholds[1] < thresholds[2]) {
          warnings.push(
            'coverageGapSubspaceThresholds should generally decrease as dimension increases'
          );
        }
        if (thresholds[2] && thresholds[3] && thresholds[2] < thresholds[3]) {
          warnings.push(
            'coverageGapSubspaceThresholds should generally decrease as dimension increases'
          );
        }
      }

      const isValid = errors.length === 0;

      if (!isValid) {
        this.#logger.warn('Threshold dependency validation failed', {
          errorCount: errors.length,
        });
      } else {
        this.#logger.debug('Threshold dependency validation passed');
      }

      return {
        isValid,
        errors,
        warnings,
        formattedErrors: errors.join('; '),
        details: { constraintsChecked: ORDERING_CONSTRAINTS.length + POOL_SIZE_ORDERING.length + WEIGHT_SUM_CONSTRAINTS.length },
      };
    } catch (error) {
      this.#logger.error('Error during threshold dependency validation', error);

      return {
        isValid: false,
        errors: [`Dependency validation error: ${error.message}`],
        warnings: [],
        formattedErrors: `Dependency validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validates axis gap detection specific configuration.
   *
   * @param {object} config - Configuration object to validate
   * @returns {ValidationResult} Validation result for axis gap config
   */
  validateAxisGapConfig(config) {
    try {
      if (!config || typeof config !== 'object') {
        return {
          isValid: false,
          errors: ['Configuration must be a non-null object'],
          formattedErrors: 'Configuration must be a non-null object',
        };
      }

      this.#logger.debug('Validating axis gap detection configuration');

      const errors = [];
      const warnings = [];

      // Validate PCA configuration consistency
      if (config.pcaComponentSignificanceMethod === 'kaiser') {
        if (config.pcaNormalizationMethod === 'z-score') {
          warnings.push(
            'Kaiser criterion with z-score normalization may cause false positives ' +
              '(all eigenvalues become 1 for uncorrelated data)'
          );
        }
      }

      // Validate DBSCAN configuration when enabled
      if (config.coverageGapClusteringMethod === 'dbscan') {
        if (!('dbscanEpsilon' in config) || !('dbscanMinPoints' in config)) {
          warnings.push(
            'DBSCAN clustering enabled but dbscanEpsilon or dbscanMinPoints not configured'
          );
        }
      }

      // Validate adaptive threshold configuration when enabled
      if (config.enableAdaptiveThresholds) {
        if (
          !('adaptiveThresholdPercentile' in config) ||
          !('adaptiveThresholdIterations' in config)
        ) {
          warnings.push(
            'Adaptive thresholds enabled but adaptiveThresholdPercentile or ' +
              'adaptiveThresholdIterations not configured'
          );
        }
      }

      // Validate hub detection configuration consistency
      if ('hubMinDegree' in config && 'hubMinDegreeRatio' in config) {
        // hubMinDegreeRatio should be reasonable (not too high)
        if (config.hubMinDegreeRatio > 0.5) {
          warnings.push(
            `hubMinDegreeRatio (${config.hubMinDegreeRatio}) is > 0.5, ` +
              'which may exclude most prototypes from hub consideration'
          );
        }
      }

      // Validate Jacobi convergence settings
      if (
        'jacobiConvergenceTolerance' in config &&
        config.jacobiConvergenceTolerance > 1e-6
      ) {
        warnings.push(
          `jacobiConvergenceTolerance (${config.jacobiConvergenceTolerance}) is relatively large, ` +
            'eigenvalue precision may be reduced'
        );
      }

      // Validate PCA axis usage ratio
      if (
        'pcaMinAxisUsageRatio' in config &&
        config.pcaMinAxisUsageRatio > 0.5
      ) {
        warnings.push(
          `pcaMinAxisUsageRatio (${config.pcaMinAxisUsageRatio}) > 0.5 may exclude too many axes from PCA`
        );
      }

      // Validate candidate axis configuration consistency
      if (config.enableCandidateAxisValidation) {
        const weights = [
          config.candidateAxisRMSEWeight || 0,
          config.candidateAxisStrongAxisWeight || 0,
          config.candidateAxisCoUsageWeight || 0,
        ];
        const allZero = weights.every((w) => w === 0);
        if (allZero) {
          errors.push(
            'Candidate axis validation enabled but all weights are 0'
          );
        }
      }

      const isValid = errors.length === 0;

      if (!isValid) {
        this.#logger.warn('Axis gap configuration validation failed', {
          errorCount: errors.length,
        });
      } else {
        this.#logger.debug('Axis gap configuration validation passed');
      }

      return {
        isValid,
        errors,
        warnings,
        formattedErrors: errors.join('; '),
      };
    } catch (error) {
      this.#logger.error(
        'Error during axis gap configuration validation',
        error
      );

      return {
        isValid: false,
        errors: [`Axis gap validation error: ${error.message}`],
        warnings: [],
        formattedErrors: `Axis gap validation error: ${error.message}`,
      };
    }
  }

  /**
   * Validates configuration and throws an error if invalid.
   * Useful for fail-fast scenarios.
   *
   * @param {object} config - Configuration object to validate
   * @throws {Error} If configuration is invalid
   * @returns {void}
   */
  validateOrThrow(config) {
    const result = this.performComprehensiveValidation(config);

    if (!result.isValid) {
      throw new Error(
        `Invalid prototype overlap configuration: ${result.formattedErrors}`
      );
    }
  }

  /**
   * Performs comprehensive multi-layer configuration validation.
   *
   * @param {object} config - Configuration object to validate
   * @returns {ValidationResult} Comprehensive validation result
   */
  performComprehensiveValidation(config) {
    const startTime = Date.now();
    const allErrors = [];
    const allWarnings = [];
    const layers = {
      basic: null,
      dependencies: null,
      axisGap: null,
    };

    try {
      // Layer 1: Basic type and range validation
      layers.basic = this.validateConfig(config);
      if (!layers.basic.isValid) {
        allErrors.push(...layers.basic.errors);
      }

      // Layer 2: Threshold dependency validation
      layers.dependencies = this.validateThresholdDependencies(config);
      if (!layers.dependencies.isValid) {
        allErrors.push(...layers.dependencies.errors);
      }
      if (layers.dependencies.warnings) {
        allWarnings.push(...layers.dependencies.warnings);
      }

      // Layer 3: Axis gap specific validation
      layers.axisGap = this.validateAxisGapConfig(config);
      if (!layers.axisGap.isValid) {
        allErrors.push(...layers.axisGap.errors);
      }
      if (layers.axisGap.warnings) {
        allWarnings.push(...layers.axisGap.warnings);
      }

      const validationDurationMs = Date.now() - startTime;

      this.#logger.debug(
        `Comprehensive validation completed in ${validationDurationMs}ms`,
        {
          isValid: allErrors.length === 0,
          errorCount: allErrors.length,
          warningCount: allWarnings.length,
        }
      );

      return {
        isValid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings,
        formattedErrors: allErrors.join('; '),
        details: {
          layers,
          validationDurationMs,
        },
      };
    } catch (error) {
      this.#logger.error('Error during comprehensive validation', error);

      return {
        isValid: false,
        errors: [`Comprehensive validation error: ${error.message}`],
        warnings: allWarnings,
        formattedErrors: `Comprehensive validation error: ${error.message}`,
        details: {
          layers,
          validationDurationMs: Date.now() - startTime,
        },
      };
    }
  }
}

export default PrototypeOverlapConfigValidator;
