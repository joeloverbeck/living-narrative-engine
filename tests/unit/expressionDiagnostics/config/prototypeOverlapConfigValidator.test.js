/**
 * @file Unit tests for PrototypeOverlapConfigValidator
 * @see src/expressionDiagnostics/config/prototypeOverlapConfigValidator.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { PrototypeOverlapConfigValidator } from '../../../../src/expressionDiagnostics/config/prototypeOverlapConfigValidator.js';
import { PROTOTYPE_OVERLAP_CONFIG } from '../../../../src/expressionDiagnostics/config/prototypeOverlapConfig.js';

describe('PrototypeOverlapConfigValidator', () => {
  let testBed;
  let validator;
  let mockLogger;

  /**
   * Creates a minimal valid configuration for testing
   *
   * @returns {object} A valid configuration object for testing
   */
  const createValidConfig = () => ({
    // Probability values [0, 1]
    candidateMinActiveAxisOverlap: 0.6,
    candidateMinSignAgreement: 0.8,
    candidateMinCosineSimilarity: 0.85,
    minGateOverlapRatio: 0.9,
    compositeScoreGateOverlapWeight: 0.3,
    compositeScoreCorrelationWeight: 0.2,
    compositeScoreGlobalDiffWeight: 0.5,
    coPassCorrelationWeight: 0.6,
    globalCorrelationWeight: 0.4,

    // Correlation values [-1, 1]
    minCorrelationForMerge: 0.98,
    minCorrelationForSubsumption: 0.95,
    minGlobalCorrelationForMerge: 0.9,
    minGlobalCorrelationForSubsumption: 0.85,
    nearMissCorrelationThreshold: 0.9,
    nearMissGlobalCorrelationThreshold: 0.8,
    strongCorrelationForMerge: 0.97,

    // Positive integers
    sampleCountPerPair: 8000,
    maxCandidatePairs: 5000,

    // Positive numbers
    activeAxisEpsilon: 0.08,
    strongAxisThreshold: 0.25,

    // Boolean values
    enableAxisGapDetection: true,

    // Enums
    stratificationStrategy: 'uniform',
    clusteringMethod: 'k-means',

    // Thresholds with dependencies
    nearMissGateOverlapRatio: 0.75,
    strongGateOverlapRatio: 0.8,
    prescanMinGateOverlap: 0.5,

    // Pool sizes
    quickAnalysisPoolSize: 15000,
    sharedPoolSize: 50000,
    deepAnalysisPoolSize: 100000,

    // Candidate axis weights
    candidateAxisRMSEWeight: 0.5,
    candidateAxisStrongAxisWeight: 0.3,
    candidateAxisCoUsageWeight: 0.2,
  });

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    validator = new PrototypeOverlapConfigValidator({
      logger: mockLogger,
    });
  });

  // ==========================================================================
  // CONSTRUCTOR TESTS
  // ==========================================================================

  describe('Constructor', () => {
    it('should initialize with valid logger dependency', () => {
      expect(validator).toBeInstanceOf(PrototypeOverlapConfigValidator);
    });

    it('should throw error with null logger', () => {
      expect(() => {
        new PrototypeOverlapConfigValidator({ logger: null });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error with undefined logger', () => {
      expect(() => {
        new PrototypeOverlapConfigValidator({ logger: undefined });
      }).toThrow('Missing required dependency: ILogger');
    });

    it('should throw error with logger missing required methods', () => {
      const invalidLogger = { info: () => {} };
      expect(() => {
        new PrototypeOverlapConfigValidator({ logger: invalidLogger });
      }).toThrow("Invalid or missing method 'warn'");
    });
  });

  // ==========================================================================
  // BASIC VALIDATION TESTS (validateConfig)
  // ==========================================================================

  describe('validateConfig', () => {
    describe('null and type checks', () => {
      it('should reject null configuration', () => {
        const result = validator.validateConfig(null);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Configuration must be a non-null object'
        );
      });

      it('should reject undefined configuration', () => {
        const result = validator.validateConfig(undefined);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Configuration must be a non-null object'
        );
      });

      it('should reject non-object configuration', () => {
        const result = validator.validateConfig('invalid');
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'Configuration must be a non-null object'
        );
      });

      it('should accept empty object (no required properties)', () => {
        const result = validator.validateConfig({});
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    describe('probability properties [0, 1]', () => {
      it('should accept valid probability values', () => {
        const result = validator.validateConfig({
          candidateMinActiveAxisOverlap: 0.6,
          minGateOverlapRatio: 0.9,
          confidenceLevel: 0.95,
        });
        expect(result.isValid).toBe(true);
      });

      it('should accept boundary values (0 and 1)', () => {
        const result = validator.validateConfig({
          candidateMinActiveAxisOverlap: 0,
          minGateOverlapRatio: 1,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject negative probability values', () => {
        const result = validator.validateConfig({
          candidateMinActiveAxisOverlap: -0.1,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'candidateMinActiveAxisOverlap must be in range [0, 1], got -0.1'
        );
      });

      it('should reject probability values > 1', () => {
        const result = validator.validateConfig({
          minGateOverlapRatio: 1.5,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'minGateOverlapRatio must be in range [0, 1], got 1.5'
        );
      });

      it('should reject non-number probability values', () => {
        const result = validator.validateConfig({
          candidateMinActiveAxisOverlap: 'high',
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'candidateMinActiveAxisOverlap must be a number, got string'
        );
      });

      it('should reject NaN probability values', () => {
        const result = validator.validateConfig({
          candidateMinActiveAxisOverlap: NaN,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'candidateMinActiveAxisOverlap must be a number, got number'
        );
      });
    });

    describe('correlation properties [-1, 1]', () => {
      it('should accept valid correlation values', () => {
        const result = validator.validateConfig({
          minCorrelationForMerge: 0.98,
          minCorrelationForSubsumption: 0.95,
        });
        expect(result.isValid).toBe(true);
      });

      it('should accept negative correlation values', () => {
        const result = validator.validateConfig({
          minCorrelationForMerge: -0.5,
        });
        expect(result.isValid).toBe(true);
      });

      it('should accept boundary values (-1 and 1)', () => {
        const result = validator.validateConfig({
          minCorrelationForMerge: -1,
          minCorrelationForSubsumption: 1,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject correlation values < -1', () => {
        const result = validator.validateConfig({
          minCorrelationForMerge: -1.5,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'minCorrelationForMerge must be in range [-1, 1], got -1.5'
        );
      });

      it('should reject correlation values > 1', () => {
        const result = validator.validateConfig({
          minCorrelationForMerge: 1.1,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'minCorrelationForMerge must be in range [-1, 1], got 1.1'
        );
      });
    });

    describe('positive integer properties', () => {
      it('should accept valid positive integers', () => {
        const result = validator.validateConfig({
          sampleCountPerPair: 8000,
          maxCandidatePairs: 5000,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject zero for positive integers', () => {
        const result = validator.validateConfig({
          sampleCountPerPair: 0,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('sampleCountPerPair must be >= 1, got 0');
      });

      it('should reject negative integers', () => {
        const result = validator.validateConfig({
          maxCandidatePairs: -100,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('maxCandidatePairs must be >= 1, got -100');
      });

      it('should reject non-integer numbers', () => {
        const result = validator.validateConfig({
          sampleCountPerPair: 8000.5,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'sampleCountPerPair must be an integer, got number'
        );
      });
    });

    describe('positive number properties', () => {
      it('should accept valid positive numbers', () => {
        const result = validator.validateConfig({
          activeAxisEpsilon: 0.08,
          strongAxisThreshold: 0.25,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject zero for positive numbers', () => {
        const result = validator.validateConfig({
          activeAxisEpsilon: 0,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('activeAxisEpsilon must be > 0, got 0');
      });

      it('should reject negative numbers', () => {
        const result = validator.validateConfig({
          strongAxisThreshold: -0.1,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'strongAxisThreshold must be > 0, got -0.1'
        );
      });
    });

    describe('boolean properties', () => {
      it('should accept true boolean values', () => {
        const result = validator.validateConfig({
          enableAxisGapDetection: true,
          enableConvertToExpression: true,
        });
        expect(result.isValid).toBe(true);
      });

      it('should accept false boolean values', () => {
        const result = validator.validateConfig({
          enableAxisGapDetection: false,
          enableMultiRouteFiltering: false,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject non-boolean values', () => {
        const result = validator.validateConfig({
          enableAxisGapDetection: 'true',
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'enableAxisGapDetection must be a boolean, got string'
        );
      });

      it('should reject numeric values for booleans', () => {
        const result = validator.validateConfig({
          enableAxisGapDetection: 1,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'enableAxisGapDetection must be a boolean, got number'
        );
      });
    });

    describe('enum properties', () => {
      it('should accept valid enum values', () => {
        const result = validator.validateConfig({
          stratificationStrategy: 'uniform',
          clusteringMethod: 'k-means',
          pcaComponentSignificanceMethod: 'broken-stick',
          coverageGapClusteringMethod: 'dbscan',
        });
        expect(result.isValid).toBe(true);
      });

      it('should accept all valid stratificationStrategy values', () => {
        for (const value of ['uniform', 'mood-regime', 'extremes-enhanced']) {
          const result = validator.validateConfig({
            stratificationStrategy: value,
          });
          expect(result.isValid).toBe(true);
        }
      });

      it('should reject invalid enum values', () => {
        const result = validator.validateConfig({
          stratificationStrategy: 'invalid',
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          'stratificationStrategy must be one of'
        );
        expect(result.errors[0]).toContain('invalid');
      });
    });

    describe('nullable properties', () => {
      it('should accept null for nullable properties', () => {
        const result = validator.validateConfig({
          poolRandomSeed: null,
          jacobiMaxIterationsOverride: null,
        });
        expect(result.isValid).toBe(true);
      });

      it('should accept positive integers for nullable properties', () => {
        const result = validator.validateConfig({
          poolRandomSeed: 42,
          jacobiMaxIterationsOverride: 1000,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject negative values for nullable properties', () => {
        const result = validator.validateConfig({
          poolRandomSeed: -1,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'poolRandomSeed must be null or a positive integer, got -1'
        );
      });

      it('should reject non-integers for nullable properties', () => {
        const result = validator.validateConfig({
          poolRandomSeed: 42.5,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'poolRandomSeed must be null or a positive integer, got 42.5'
        );
      });
    });

    describe('bounded range properties', () => {
      it('should accept values within bounds', () => {
        const result = validator.validateConfig({
          coverageGapMaxSubspaceDimension: 2,
          adaptiveThresholdPercentile: 95,
        });
        expect(result.isValid).toBe(true);
      });

      it('should accept boundary values', () => {
        const result = validator.validateConfig({
          coverageGapMaxSubspaceDimension: 1,
          adaptiveThresholdPercentile: 0,
        });
        expect(result.isValid).toBe(true);

        const result2 = validator.validateConfig({
          coverageGapMaxSubspaceDimension: 3,
          adaptiveThresholdPercentile: 100,
        });
        expect(result2.isValid).toBe(true);
      });

      it('should reject values below minimum', () => {
        const result = validator.validateConfig({
          coverageGapMaxSubspaceDimension: 0,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'coverageGapMaxSubspaceDimension must be in range [1, 3], got 0'
        );
      });

      it('should reject values above maximum', () => {
        const result = validator.validateConfig({
          coverageGapMaxSubspaceDimension: 4,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'coverageGapMaxSubspaceDimension must be in range [1, 3], got 4'
        );
      });
    });

    describe('array properties', () => {
      it('should accept valid highThresholds array', () => {
        const result = validator.validateConfig({
          highThresholds: [0.4, 0.6, 0.75],
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject non-array highThresholds', () => {
        const result = validator.validateConfig({
          highThresholds: 0.5,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'highThresholds must be an array, got number'
        );
      });

      it('should reject highThresholds with invalid values', () => {
        const result = validator.validateConfig({
          highThresholds: [0.4, 1.5, 0.75],
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          'highThresholds[1] must be a number in range (0, 1)'
        );
      });

      it('should reject highThresholds with boundary values', () => {
        const result = validator.validateConfig({
          highThresholds: [0, 0.5],
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          'highThresholds[0] must be a number in range (0, 1)'
        );
      });

      it('should accept valid changeEmotionNameHints array', () => {
        const result = validator.validateConfig({
          changeEmotionNameHints: ['relief', 'surprise'],
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject changeEmotionNameHints with non-string values', () => {
        const result = validator.validateConfig({
          changeEmotionNameHints: ['relief', 123],
        });
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain(
          'changeEmotionNameHints[1] must be a string, got number'
        );
      });
    });

    describe('object properties', () => {
      it('should accept valid minHighJaccardForMergeAtT object', () => {
        const result = validator.validateConfig({
          minHighJaccardForMergeAtT: { '0.6': 0.75 },
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject minHighJaccardForMergeAtT with invalid values', () => {
        const result = validator.validateConfig({
          minHighJaccardForMergeAtT: { '0.6': 1.5 },
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          "minHighJaccardForMergeAtT['0.6'] must be a number in [0, 1]"
        );
      });

      it('should accept valid coverageGapSubspaceThresholds object', () => {
        const result = validator.validateConfig({
          coverageGapSubspaceThresholds: { 1: 0.6, 2: 0.5, 3: 0.4 },
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject coverageGapSubspaceThresholds with invalid keys', () => {
        const result = validator.validateConfig({
          coverageGapSubspaceThresholds: { 4: 0.4 },
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          "coverageGapSubspaceThresholds key '4' must be 1, 2, or 3"
        );
      });

      it('should reject coverageGapSubspaceThresholds with invalid values', () => {
        const result = validator.validateConfig({
          coverageGapSubspaceThresholds: { 1: 0 },
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          "coverageGapSubspaceThresholds['1'] must be a number in (0, 1]"
        );
      });
    });

    describe('error handling', () => {
      it('should handle validation exceptions gracefully', () => {
        // Create a config with a getter that throws
        const badConfig = {};
        Object.defineProperty(badConfig, 'candidateMinActiveAxisOverlap', {
          get() {
            throw new Error('Property access error');
          },
          enumerable: true,
        });

        const result = validator.validateConfig(badConfig);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Validation error');
      });
    });
  });

  // ==========================================================================
  // THRESHOLD DEPENDENCY TESTS (validateThresholdDependencies)
  // ==========================================================================

  describe('validateThresholdDependencies', () => {
    describe('null and type checks', () => {
      it('should reject null configuration', () => {
        const result = validator.validateThresholdDependencies(null);
        expect(result.isValid).toBe(false);
      });
    });

    describe('ordering constraints', () => {
      it('should accept valid ordering (activeAxisEpsilon < strongAxisThreshold)', () => {
        const result = validator.validateThresholdDependencies({
          activeAxisEpsilon: 0.08,
          strongAxisThreshold: 0.25,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject invalid ordering (activeAxisEpsilon >= strongAxisThreshold)', () => {
        const result = validator.validateThresholdDependencies({
          activeAxisEpsilon: 0.3,
          strongAxisThreshold: 0.25,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          'activeAxisEpsilon must be less than strongAxisThreshold'
        );
      });

      it('should accept valid correlation ordering', () => {
        const result = validator.validateThresholdDependencies({
          minCorrelationForSubsumption: 0.95,
          minCorrelationForMerge: 0.98,
        });
        expect(result.isValid).toBe(true);
      });

      it('should accept equal values for <= constraints', () => {
        const result = validator.validateThresholdDependencies({
          minCorrelationForSubsumption: 0.98,
          minCorrelationForMerge: 0.98,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject near-miss threshold >= merge threshold', () => {
        const result = validator.validateThresholdDependencies({
          nearMissCorrelationThreshold: 0.98,
          minCorrelationForMerge: 0.98,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain(
          'nearMissCorrelationThreshold must be less than minCorrelationForMerge'
        );
      });
    });

    describe('pool size ordering', () => {
      it('should accept valid pool size ordering', () => {
        const result = validator.validateThresholdDependencies({
          quickAnalysisPoolSize: 15000,
          sharedPoolSize: 50000,
          deepAnalysisPoolSize: 100000,
        });
        expect(result.isValid).toBe(true);
      });

      it('should accept equal pool sizes', () => {
        const result = validator.validateThresholdDependencies({
          quickAnalysisPoolSize: 50000,
          sharedPoolSize: 50000,
          deepAnalysisPoolSize: 50000,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject inverted pool size ordering', () => {
        const result = validator.validateThresholdDependencies({
          quickAnalysisPoolSize: 100000,
          sharedPoolSize: 50000,
          deepAnalysisPoolSize: 100000,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('quickAnalysisPoolSize');
      });
    });

    describe('weight sum constraints', () => {
      it('should accept valid composite score weights summing to 1.0', () => {
        const result = validator.validateThresholdDependencies({
          compositeScoreGateOverlapWeight: 0.3,
          compositeScoreCorrelationWeight: 0.2,
          compositeScoreGlobalDiffWeight: 0.5,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject composite score weights not summing to 1.0', () => {
        const result = validator.validateThresholdDependencies({
          compositeScoreGateOverlapWeight: 0.3,
          compositeScoreCorrelationWeight: 0.3,
          compositeScoreGlobalDiffWeight: 0.5,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Composite score weights must sum to 1.0');
      });

      it('should accept valid correlation weights summing to 1.0', () => {
        const result = validator.validateThresholdDependencies({
          coPassCorrelationWeight: 0.6,
          globalCorrelationWeight: 0.4,
        });
        expect(result.isValid).toBe(true);
      });

      it('should reject correlation weights not summing to 1.0', () => {
        const result = validator.validateThresholdDependencies({
          coPassCorrelationWeight: 0.7,
          globalCorrelationWeight: 0.4,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('Correlation weights must sum to 1.0');
      });

      it('should accept valid candidate axis weights', () => {
        const result = validator.validateThresholdDependencies({
          candidateAxisRMSEWeight: 0.5,
          candidateAxisStrongAxisWeight: 0.3,
          candidateAxisCoUsageWeight: 0.2,
        });
        expect(result.isValid).toBe(true);
      });

      it('should allow small tolerance in weight sums', () => {
        const result = validator.validateThresholdDependencies({
          compositeScoreGateOverlapWeight: 0.3,
          compositeScoreCorrelationWeight: 0.2,
          compositeScoreGlobalDiffWeight: 0.5001, // Within 0.001 tolerance
        });
        expect(result.isValid).toBe(true);
      });
    });

    describe('semantic warnings', () => {
      it('should warn when prescanSampleCount is high relative to sampleCountPerPair', () => {
        const result = validator.validateThresholdDependencies({
          prescanSampleCount: 5000,
          sampleCountPerPair: 8000,
        });
        expect(result.isValid).toBe(true);
        expect(result.warnings).toBeDefined();
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('prescanSampleCount');
      });

      it('should not warn when prescanSampleCount is appropriately low', () => {
        const result = validator.validateThresholdDependencies({
          prescanSampleCount: 500,
          sampleCountPerPair: 8000,
        });
        expect(result.isValid).toBe(true);
        expect(
          result.warnings?.filter((w) => w.includes('prescanSampleCount'))
        ).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // AXIS GAP CONFIG TESTS (validateAxisGapConfig)
  // ==========================================================================

  describe('validateAxisGapConfig', () => {
    describe('null and type checks', () => {
      it('should reject null configuration', () => {
        const result = validator.validateAxisGapConfig(null);
        expect(result.isValid).toBe(false);
      });
    });

    describe('PCA configuration', () => {
      it('should warn about Kaiser with z-score normalization', () => {
        const result = validator.validateAxisGapConfig({
          pcaComponentSignificanceMethod: 'kaiser',
          pcaNormalizationMethod: 'z-score',
        });
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('Kaiser');
      });

      it('should not warn about Kaiser with center-only normalization', () => {
        const result = validator.validateAxisGapConfig({
          pcaComponentSignificanceMethod: 'kaiser',
          pcaNormalizationMethod: 'center-only',
        });
        expect(result.isValid).toBe(true);
        expect(
          result.warnings.filter((w) => w.includes('Kaiser'))
        ).toHaveLength(0);
      });
    });

    describe('DBSCAN configuration', () => {
      it('should warn when DBSCAN enabled without parameters', () => {
        const result = validator.validateAxisGapConfig({
          coverageGapClusteringMethod: 'dbscan',
        });
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('DBSCAN');
      });

      it('should not warn when DBSCAN has all parameters', () => {
        const result = validator.validateAxisGapConfig({
          coverageGapClusteringMethod: 'dbscan',
          dbscanEpsilon: 0.4,
          dbscanMinPoints: 3,
        });
        expect(result.isValid).toBe(true);
        expect(
          result.warnings.filter((w) => w.includes('DBSCAN'))
        ).toHaveLength(0);
      });
    });

    describe('adaptive thresholds configuration', () => {
      it('should warn when adaptive thresholds enabled without parameters', () => {
        const result = validator.validateAxisGapConfig({
          enableAdaptiveThresholds: true,
        });
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('Adaptive thresholds');
      });

      it('should not warn when adaptive thresholds have all parameters', () => {
        const result = validator.validateAxisGapConfig({
          enableAdaptiveThresholds: true,
          adaptiveThresholdPercentile: 95,
          adaptiveThresholdIterations: 100,
        });
        expect(result.isValid).toBe(true);
        expect(
          result.warnings.filter((w) => w.includes('Adaptive thresholds'))
        ).toHaveLength(0);
      });
    });

    describe('hub detection configuration', () => {
      it('should warn about very high hubMinDegreeRatio', () => {
        const result = validator.validateAxisGapConfig({
          hubMinDegree: 4,
          hubMinDegreeRatio: 0.6,
        });
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('hubMinDegreeRatio');
      });
    });

    describe('Jacobi convergence', () => {
      it('should warn about large tolerance', () => {
        const result = validator.validateAxisGapConfig({
          jacobiConvergenceTolerance: 1e-4,
        });
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('jacobiConvergenceTolerance');
      });
    });

    describe('candidate axis validation', () => {
      it('should error when validation enabled but all weights are zero', () => {
        const result = validator.validateAxisGapConfig({
          enableCandidateAxisValidation: true,
          candidateAxisRMSEWeight: 0,
          candidateAxisStrongAxisWeight: 0,
          candidateAxisCoUsageWeight: 0,
        });
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toContain('all weights are 0');
      });

      it('should pass when validation enabled with non-zero weights', () => {
        const result = validator.validateAxisGapConfig({
          enableCandidateAxisValidation: true,
          candidateAxisRMSEWeight: 0.5,
          candidateAxisStrongAxisWeight: 0.3,
          candidateAxisCoUsageWeight: 0.2,
        });
        expect(result.isValid).toBe(true);
      });
    });
  });

  // ==========================================================================
  // validateOrThrow TESTS
  // ==========================================================================

  describe('validateOrThrow', () => {
    it('should not throw for valid configuration', () => {
      expect(() => {
        validator.validateOrThrow(createValidConfig());
      }).not.toThrow();
    });

    it('should throw for invalid configuration', () => {
      expect(() => {
        validator.validateOrThrow({ activeAxisEpsilon: -1 });
      }).toThrow('Invalid prototype overlap configuration');
    });

    it('should throw for null configuration', () => {
      expect(() => {
        validator.validateOrThrow(null);
      }).toThrow('Invalid prototype overlap configuration');
    });

    it('should include error details in thrown message', () => {
      expect(() => {
        validator.validateOrThrow({ activeAxisEpsilon: -1 });
      }).toThrow('activeAxisEpsilon');
    });
  });

  // ==========================================================================
  // performComprehensiveValidation TESTS
  // ==========================================================================

  describe('performComprehensiveValidation', () => {
    it('should validate all layers for valid config', () => {
      const result = validator.performComprehensiveValidation(
        createValidConfig()
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.details.layers.basic).toBeDefined();
      expect(result.details.layers.dependencies).toBeDefined();
      expect(result.details.layers.axisGap).toBeDefined();
    });

    it('should aggregate errors from all layers', () => {
      const result = validator.performComprehensiveValidation({
        activeAxisEpsilon: -1, // Basic validation error
        nearMissCorrelationThreshold: 0.99, // Dependency error (need to add minCorrelationForMerge)
        minCorrelationForMerge: 0.98,
        enableCandidateAxisValidation: true, // Axis gap error (weights all zero)
        candidateAxisRMSEWeight: 0,
        candidateAxisStrongAxisWeight: 0,
        candidateAxisCoUsageWeight: 0,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it('should collect warnings from all layers', () => {
      const result = validator.performComprehensiveValidation({
        prescanSampleCount: 5000,
        sampleCountPerPair: 8000,
        pcaComponentSignificanceMethod: 'kaiser',
        pcaNormalizationMethod: 'z-score',
      });
      expect(result.warnings.length).toBeGreaterThanOrEqual(2);
    });

    it('should include validation duration', () => {
      const result = validator.performComprehensiveValidation({});
      expect(result.details.validationDurationMs).toBeDefined();
      expect(result.details.validationDurationMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // INTEGRATION WITH ACTUAL CONFIG
  // ==========================================================================

  describe('Integration with PROTOTYPE_OVERLAP_CONFIG', () => {
    it('should validate actual production config successfully', () => {
      const result = validator.performComprehensiveValidation(
        PROTOTYPE_OVERLAP_CONFIG
      );
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate basic types of actual config', () => {
      const result = validator.validateConfig(PROTOTYPE_OVERLAP_CONFIG);
      expect(result.isValid).toBe(true);
    });

    it('should validate threshold dependencies of actual config', () => {
      const result = validator.validateThresholdDependencies(
        PROTOTYPE_OVERLAP_CONFIG
      );
      expect(result.isValid).toBe(true);
    });

    it('should validate axis gap config of actual config', () => {
      const result = validator.validateAxisGapConfig(PROTOTYPE_OVERLAP_CONFIG);
      expect(result.isValid).toBe(true);
    });

    it('validateOrThrow should not throw for actual config', () => {
      expect(() => {
        validator.validateOrThrow(PROTOTYPE_OVERLAP_CONFIG);
      }).not.toThrow();
    });
  });
});
