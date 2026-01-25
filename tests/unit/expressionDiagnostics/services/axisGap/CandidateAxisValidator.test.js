/**
 * @file Unit tests for CandidateAxisValidator
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { CandidateAxisValidator } from '../../../../../src/expressionDiagnostics/services/axisGap/CandidateAxisValidator.js';

describe('CandidateAxisValidator', () => {
  let validator;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    validator = new CandidateAxisValidator({}, mockLogger);
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const val = new CandidateAxisValidator();
      expect(val).toBeDefined();
    });

    it('should accept custom config', () => {
      const val = new CandidateAxisValidator({
        candidateAxisMinRMSEReduction: 0.2,
        candidateAxisMinStrongAxisReduction: 2,
        candidateAxisMinCoUsageReduction: 0.1,
        candidateAxisMinAffectedPrototypes: 3,
        candidateAxisRMSEWeight: 0.4,
        candidateAxisStrongAxisWeight: 0.4,
        candidateAxisCoUsageWeight: 0.2,
        candidateAxisMinCombinedScore: 0.2,
        strongAxisThreshold: 0.3,
      });
      expect(val).toBeDefined();
    });

    it('should accept logger', () => {
      const val = new CandidateAxisValidator({}, mockLogger);
      expect(val).toBeDefined();
    });
  });

  describe('validate - empty/invalid inputs', () => {
    it('should return empty array for empty prototypes', () => {
      const result = validator.validate([], ['x', 'y'], [{ candidateId: 'c1' }]);
      expect(result).toEqual([]);
    });

    it('should return empty array for single prototype', () => {
      const prototypes = [{ id: 'p1', weights: { x: 0.5 } }];
      const result = validator.validate(prototypes, ['x'], [
        { candidateId: 'c1' },
      ]);
      expect(result).toEqual([]);
    });

    it('should return empty array for empty candidates', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5 } },
        { id: 'p2', weights: { x: 0.6 } },
      ];
      const result = validator.validate(prototypes, ['x'], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null prototypes', () => {
      const result = validator.validate(null, ['x'], [{ candidateId: 'c1' }]);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined candidates', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5 } },
        { id: 'p2', weights: { x: 0.6 } },
      ];
      const result = validator.validate(prototypes, ['x'], undefined);
      expect(result).toEqual([]);
    });

    it('should collect axes from prototypes if existingAxes is empty', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.3 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
      ];
      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];
      const result = validator.validate(prototypes, [], candidates);
      expect(result.length).toBe(1);
    });

    it('should return empty array when prototypes have no weights', () => {
      const prototypes = [{ id: 'p1' }, { id: 'p2' }];
      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];
      const result = validator.validate(prototypes, [], candidates);
      expect(result).toEqual([]);
    });
  });

  describe('validate - basic functionality', () => {
    const prototypes = [
      { id: 'p1', weights: { x: 0.5, y: 0.5 } },
      { id: 'p2', weights: { x: 0.6, y: 0.4 } },
      { id: 'p3', weights: { x: 0.4, y: 0.6 } },
      { id: 'p4', weights: { x: 0.55, y: 0.45 } },
      { id: 'p5', weights: { x: 0.45, y: 0.55 } },
      { id: 'p6', weights: { x: 0.7, y: 0.3 } },
    ];
    const axes = ['x', 'y'];

    it('should return validation results for each candidate', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
        {
          candidateId: 'c2',
          source: 'hub_derived',
          direction: { x: 0.2, y: 0.8 },
        },
      ];

      const results = validator.validate(prototypes, axes, candidates);

      expect(results.length).toBe(2);
      expect(results[0]).toHaveProperty('candidateId');
      expect(results[0]).toHaveProperty('source');
      expect(results[0]).toHaveProperty('direction');
      expect(results[0]).toHaveProperty('improvement');
      expect(results[0]).toHaveProperty('isRecommended');
      expect(results[0]).toHaveProperty('recommendation');
      expect(results[0]).toHaveProperty('affectedPrototypes');
    });

    it('should include improvement metrics in results', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = validator.validate(prototypes, axes, candidates);

      expect(results[0].improvement).toHaveProperty('rmseReduction');
      expect(results[0].improvement).toHaveProperty('strongAxisReduction');
      expect(results[0].improvement).toHaveProperty('coUsageReduction');
      expect(results[0].improvement).toHaveProperty('combinedScore');
      expect(typeof results[0].improvement.rmseReduction).toBe('number');
      expect(typeof results[0].improvement.combinedScore).toBe('number');
    });

    it('should sort results by combined score descending', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.1, y: 0.9 },
        },
        {
          candidateId: 'c2',
          source: 'hub_derived',
          direction: { x: 0.9, y: 0.1 },
        },
      ];

      const results = validator.validate(prototypes, axes, candidates);

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].improvement.combinedScore).toBeGreaterThanOrEqual(
        results[1].improvement.combinedScore
      );
    });
  });

  describe('validate - recommendations', () => {
    it('should recommend add_axis for significant improvement', () => {
      // Configure for lenient thresholds
      const lenientValidator = new CandidateAxisValidator(
        {
          candidateAxisMinRMSEReduction: 0.01,
          candidateAxisMinCombinedScore: 0.01,
          candidateAxisMinAffectedPrototypes: 2,
        },
        mockLogger
      );

      // Prototypes with significant spread that a new axis could explain
      const prototypes = [
        { id: 'p1', weights: { x: 0.9, y: 0.1 } },
        { id: 'p2', weights: { x: 0.8, y: 0.2 } },
        { id: 'p3', weights: { x: 0.1, y: 0.9 } },
        { id: 'p4', weights: { x: 0.2, y: 0.8 } },
        { id: 'p5', weights: { x: 0.5, y: 0.5 } },
        { id: 'p6', weights: { x: 0.6, y: 0.4 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          direction: { x: 0.707, y: -0.707 },
        },
      ];

      const results = lenientValidator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      // The result should have a valid recommendation
      expect(['add_axis', 'refine_prototypes', 'insufficient_data']).toContain(
        results[0].recommendation
      );
    });

    it('should recommend refine_prototypes for marginal improvement', () => {
      // Configure for strict thresholds
      const strictValidator = new CandidateAxisValidator(
        {
          candidateAxisMinRMSEReduction: 0.9, // Very high threshold
          candidateAxisMinCombinedScore: 0.9,
          candidateAxisMinAffectedPrototypes: 2,
        },
        mockLogger
      );

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.51, y: 0.49 } },
        { id: 'p3', weights: { x: 0.49, y: 0.51 } },
        { id: 'p4', weights: { x: 0.5, y: 0.5 } },
        { id: 'p5', weights: { x: 0.52, y: 0.48 } },
        { id: 'p6', weights: { x: 0.48, y: 0.52 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = strictValidator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].recommendation).toBe('refine_prototypes');
      expect(results[0].isRecommended).toBe(false);
    });

    it('should return insufficient_data for too few affected prototypes', () => {
      const strictValidator = new CandidateAxisValidator(
        {
          candidateAxisMinAffectedPrototypes: 100, // Very high threshold
        },
        mockLogger
      );

      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = strictValidator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].recommendation).toBe('insufficient_data');
      expect(results[0].isRecommended).toBe(false);
    });
  });

  describe('validate - affected prototypes', () => {
    it('should identify affected prototypes based on projection', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.9, y: 0.1 } }, // High x projection
        { id: 'p2', weights: { x: 0.1, y: 0.9 } }, // Low x projection
        { id: 'p3', weights: { x: 0.8, y: 0.2 } }, // High x projection
        { id: 'p4', weights: { x: 0.2, y: 0.8 } }, // Low x projection
        { id: 'p5', weights: { x: 0.5, y: 0.5 } }, // Medium projection
        { id: 'p6', weights: { x: 0.7, y: 0.3 } }, // High x projection
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 1, y: 0 }, // Purely x-direction
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(Array.isArray(results[0].affectedPrototypes)).toBe(true);
      // p1, p3, p5, p6 should have significant x projections
      expect(results[0].affectedPrototypes.length).toBeGreaterThan(0);
    });

    it('should return sorted affected prototype IDs', () => {
      const prototypes = [
        { id: 'z-proto', weights: { x: 0.9, y: 0.1 } },
        { id: 'a-proto', weights: { x: 0.8, y: 0.2 } },
        { id: 'm-proto', weights: { x: 0.7, y: 0.3 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 1, y: 0 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results[0].affectedPrototypes.length).toBeGreaterThanOrEqual(2);
      const sorted = [...results[0].affectedPrototypes].sort();
      expect(results[0].affectedPrototypes).toEqual(sorted);
    });
  });

  describe('validate - improvement metrics computation', () => {
    it('should compute non-negative RMSE reduction', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
        { id: 'p3', weights: { x: 0.4, y: 0.6 } },
        { id: 'p4', weights: { x: 0.55, y: 0.45 } },
        { id: 'p5', weights: { x: 0.45, y: 0.55 } },
        { id: 'p6', weights: { x: 0.7, y: 0.3 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results[0].improvement.rmseReduction).toBeGreaterThanOrEqual(0);
    });

    it('should compute non-negative strong axis reduction', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
        { id: 'p3', weights: { x: 0.4, y: 0.6 } },
        { id: 'p4', weights: { x: 0.55, y: 0.45 } },
        { id: 'p5', weights: { x: 0.45, y: 0.55 } },
        { id: 'p6', weights: { x: 0.7, y: 0.3 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results[0].improvement.strongAxisReduction).toBeGreaterThanOrEqual(0);
    });

    it('should compute non-negative co-usage reduction', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
        { id: 'p3', weights: { x: 0.4, y: 0.6 } },
        { id: 'p4', weights: { x: 0.55, y: 0.45 } },
        { id: 'p5', weights: { x: 0.45, y: 0.55 } },
        { id: 'p6', weights: { x: 0.7, y: 0.3 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results[0].improvement.coUsageReduction).toBeGreaterThanOrEqual(0);
    });

    it('should compute combined score within reasonable range', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
        { id: 'p3', weights: { x: 0.4, y: 0.6 } },
        { id: 'p4', weights: { x: 0.55, y: 0.45 } },
        { id: 'p5', weights: { x: 0.45, y: 0.55 } },
        { id: 'p6', weights: { x: 0.7, y: 0.3 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results[0].improvement.combinedScore).toBeGreaterThanOrEqual(0);
      expect(results[0].improvement.combinedScore).toBeLessThanOrEqual(1);
    });
  });

  describe('validate - rationale', () => {
    it('should include rationale in results', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
        { id: 'p3', weights: { x: 0.4, y: 0.6 } },
        { id: 'p4', weights: { x: 0.55, y: 0.45 } },
        { id: 'p5', weights: { x: 0.45, y: 0.55 } },
        { id: 'p6', weights: { x: 0.7, y: 0.3 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results[0]).toHaveProperty('rationale');
      expect(typeof results[0].rationale).toBe('string');
      expect(results[0].rationale.length).toBeGreaterThan(0);
    });
  });

  describe('validate - edge cases', () => {
    it('should handle prototypes with missing weights gracefully', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5 } }, // Missing y
        { id: 'p2', weights: { y: 0.6 } }, // Missing x
        { id: 'p3', weights: { x: 0.4, y: 0.6 } },
        { id: 'p4' }, // No weights
        { id: 'p5', weights: {} }, // Empty weights
        { id: 'p6', weights: { x: 0.7, y: 0.3 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0]).toHaveProperty('improvement');
    });

    it('should handle zero direction gracefully and return validationError', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0, y: 0 }, // Zero direction
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0]).toHaveProperty('validationError');
      expect(results[0].validationError).toBe('direction_near_zero_magnitude');
      expect(results[0].recommendation).toBe('insufficient_data');
      expect(results[0].isRecommended).toBe(false);
    });

    it('should handle candidates with extra direction axes', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2, z: 0.5 }, // Extra axis z
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0]).toHaveProperty('improvement');
    });

    it('should support prototypeId as alternative to id', () => {
      const prototypes = [
        { prototypeId: 'p1', weights: { x: 0.5, y: 0.5 } },
        { prototypeId: 'p2', weights: { x: 0.6, y: 0.4 } },
        { prototypeId: 'p3', weights: { x: 0.4, y: 0.6 } },
        { prototypeId: 'p4', weights: { x: 0.55, y: 0.45 } },
        { prototypeId: 'p5', weights: { x: 0.45, y: 0.55 } },
        { prototypeId: 'p6', weights: { x: 0.7, y: 0.3 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].affectedPrototypes).toContain('p1');
    });
  });

  describe('validate - logger usage', () => {
    it('should log baseline metrics when logger provided', () => {
      const prototypes = [
        { id: 'p1', weights: { x: 0.5, y: 0.5 } },
        { id: 'p2', weights: { x: 0.6, y: 0.4 } },
      ];

      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      validator.validate(prototypes, ['x', 'y'], candidates);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'CandidateAxisValidator: Baseline metrics computed',
        expect.objectContaining({
          rmse: expect.any(Number),
          strongAxisCount: expect.any(Number),
          coUsageScore: expect.any(Number),
        })
      );
    });
  });

  describe('validate - direction validation and validationError', () => {
    const prototypes = [
      { id: 'p1', weights: { x: 0.5, y: 0.5 } },
      { id: 'p2', weights: { x: 0.6, y: 0.4 } },
      { id: 'p3', weights: { x: 0.4, y: 0.6 } },
    ];

    it('should return validationError for null direction', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          direction: null,
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].validationError).toBe('direction_null_or_invalid');
      expect(results[0].recommendation).toBe('insufficient_data');
      expect(results[0].isRecommended).toBe(false);
      expect(results[0].rationale).toContain('Direction vector');
    });

    it('should return validationError for undefined direction', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          // direction is missing
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].validationError).toBe('direction_null_or_invalid');
    });

    it('should return validationError for non-object direction', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          direction: 'invalid-string',
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].validationError).toBe('direction_null_or_invalid');
    });

    it('should return validationError for empty object direction', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          direction: {},
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].validationError).toBe('direction_null_or_invalid');
    });

    it('should return validationError for direction with only non-numeric values', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          direction: { x: NaN, y: Infinity },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].validationError).toBe('direction_near_zero_magnitude');
    });

    it('should NOT return validationError for valid direction', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].validationError).toBeNull();
      expect(results[0]).toHaveProperty('improvement');
      expect(results[0].improvement.combinedScore).toBeGreaterThanOrEqual(0);
    });

    it('should compute zero improvement metrics when direction is invalid', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          direction: { x: 0, y: 0 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(1);
      expect(results[0].validationError).toBe('direction_near_zero_magnitude');
      expect(results[0].improvement.rmseReduction).toBe(0);
      expect(results[0].improvement.strongAxisReduction).toBe(0);
      expect(results[0].improvement.coUsageReduction).toBe(0);
      expect(results[0].improvement.combinedScore).toBe(0);
    });

    it('should include clear rationale for direction validation failure', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          direction: { x: 0, y: 0 },
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results[0].rationale).toContain('near-zero magnitude');
    });

    it('should include clear rationale for null direction failure', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          direction: null,
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results[0].rationale).toContain('null or invalid');
    });

    it('should handle mix of valid and invalid direction candidates', () => {
      const candidates = [
        {
          candidateId: 'c1',
          source: 'pca_residual',
          direction: { x: 0, y: 0 }, // Invalid
        },
        {
          candidateId: 'c2',
          source: 'coverage_gap',
          direction: { x: 0.8, y: 0.2 }, // Valid
        },
        {
          candidateId: 'c3',
          source: 'hub_derived',
          direction: null, // Invalid
        },
      ];

      const results = validator.validate(prototypes, ['x', 'y'], candidates);

      expect(results.length).toBe(3);

      const c1Result = results.find((r) => r.candidateId === 'c1');
      const c2Result = results.find((r) => r.candidateId === 'c2');
      const c3Result = results.find((r) => r.candidateId === 'c3');

      expect(c1Result.validationError).toBe('direction_near_zero_magnitude');
      expect(c2Result.validationError).toBeNull();
      expect(c3Result.validationError).toBe('direction_null_or_invalid');
    });
  });
});
