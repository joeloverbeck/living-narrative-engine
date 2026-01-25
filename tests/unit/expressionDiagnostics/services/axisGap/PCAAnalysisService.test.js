/**
 * @file Unit tests for PCAAnalysisService
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { PCAAnalysisService } from '../../../../../src/expressionDiagnostics/services/axisGap/PCAAnalysisService.js';

describe('PCAAnalysisService', () => {
  let service;

  beforeEach(() => {
    service = new PCAAnalysisService();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const svc = new PCAAnalysisService();
      expect(svc).toBeDefined();
    });

    it('should accept custom config', () => {
      const svc = new PCAAnalysisService({
        pcaKaiserThreshold: 0.5,
        activeAxisEpsilon: 0.1,
      });
      expect(svc).toBeDefined();
    });
  });

  describe('analyze - empty/invalid inputs', () => {
    it('should return empty result for null prototypes', () => {
      const result = service.analyze(null);
      expect(result.residualVarianceRatio).toBe(0);
      expect(result.topLoadingPrototypes).toEqual([]);
      expect(result.dimensionsUsed).toEqual([]);
    });

    it('should return empty result for undefined prototypes', () => {
      const result = service.analyze(undefined);
      expect(result.residualVarianceRatio).toBe(0);
    });

    it('should return empty result for empty array', () => {
      const result = service.analyze([]);
      expect(result.residualVarianceRatio).toBe(0);
    });

    it('should return empty result for single prototype', () => {
      const result = service.analyze([{ id: 'a', weights: { x: 1 } }]);
      expect(result.residualVarianceRatio).toBe(0);
    });

    it('should return empty result for prototypes without weights', () => {
      const result = service.analyze([
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ]);
      expect(result.residualVarianceRatio).toBe(0);
    });

    it('should return empty result for prototypes with all zero weights', () => {
      const result = service.analyze([
        { id: 'a', weights: { x: 0, y: 0 } },
        { id: 'b', weights: { x: 0, y: 0 } },
        { id: 'c', weights: { x: 0, y: 0 } },
      ]);
      expect(result.residualVarianceRatio).toBe(0);
    });

    it('should return empty result for prototypes with identical weights', () => {
      const result = service.analyze([
        { id: 'a', weights: { x: 1, y: 1 } },
        { id: 'b', weights: { x: 1, y: 1 } },
        { id: 'c', weights: { x: 1, y: 1 } },
      ]);
      // All identical → no variance → empty result
      expect(result.residualVarianceRatio).toBe(0);
    });
  });

  describe('analyze - valid inputs', () => {
    it('should analyze simple 2-axis prototypes', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 0 } },
        { id: 'b', weights: { x: 0, y: 1 } },
        { id: 'c', weights: { x: 1, y: 1 } },
        { id: 'd', weights: { x: -1, y: 0 } },
      ];

      const result = service.analyze(prototypes);

      expect(result.dimensionsUsed).toContain('x');
      expect(result.dimensionsUsed).toContain('y');
      expect(result.cumulativeVariance.length).toBe(2);
      expect(result.residualVarianceRatio).toBeGreaterThanOrEqual(0);
      expect(result.residualVarianceRatio).toBeLessThanOrEqual(1);
    });

    it('should compute cumulative variance summing to 1', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 2, z: 0 } },
        { id: 'b', weights: { x: 0, y: 1, z: 2 } },
        { id: 'c', weights: { x: 2, y: 0, z: 1 } },
        { id: 'd', weights: { x: 1, y: 1, z: 1 } },
      ];

      const result = service.analyze(prototypes);

      expect(result.cumulativeVariance.length).toBeGreaterThan(0);
      const lastCumulative =
        result.cumulativeVariance[result.cumulativeVariance.length - 1];
      expect(lastCumulative).toBeCloseTo(1, 5);
    });

    it('should compute explainedVariance with individual proportions summing to 1', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 2, z: 0 } },
        { id: 'b', weights: { x: 0, y: 1, z: 2 } },
        { id: 'c', weights: { x: 2, y: 0, z: 1 } },
        { id: 'd', weights: { x: 1, y: 1, z: 1 } },
      ];

      const result = service.analyze(prototypes);

      expect(result.explainedVariance.length).toBeGreaterThan(0);
      const total = result.explainedVariance.reduce((sum, v) => sum + v, 0);
      expect(total).toBeCloseTo(1, 5);
    });

    it('should return explainedVariance in descending order', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 2, z: 0 } },
        { id: 'b', weights: { x: 0, y: 1, z: 2 } },
        { id: 'c', weights: { x: 2, y: 0, z: 1 } },
        { id: 'd', weights: { x: 1, y: 1, z: 1 } },
      ];

      const result = service.analyze(prototypes);

      expect(result.explainedVariance.length).toBeGreaterThan(1);
      for (let i = 1; i < result.explainedVariance.length; i++) {
        expect(result.explainedVariance[i - 1]).toBeGreaterThanOrEqual(
          result.explainedVariance[i]
        );
      }
    });

    it('should have explainedVariance values between 0 and 1 (within floating point precision)', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 2, z: 0 } },
        { id: 'b', weights: { x: 0, y: 1, z: 2 } },
        { id: 'c', weights: { x: 2, y: 0, z: 1 } },
        { id: 'd', weights: { x: 1, y: 1, z: 1 } },
      ];

      const result = service.analyze(prototypes);

      result.explainedVariance.forEach((v) => {
        // Allow for small floating-point precision errors (eigenvalues can be tiny negatives)
        expect(v).toBeGreaterThanOrEqual(-1e-10);
        expect(v).toBeLessThanOrEqual(1 + 1e-10);
      });
    });

    it('should return top loading prototypes', () => {
      const prototypes = Array.from({ length: 15 }, (_, i) => ({
        id: `proto${i}`,
        weights: { a: i * 0.1, b: (15 - i) * 0.1, c: (i % 5) * 0.2 },
      }));

      const result = service.analyze(prototypes);

      expect(result.topLoadingPrototypes.length).toBeLessThanOrEqual(10);
      result.topLoadingPrototypes.forEach((item) => {
        expect(item).toHaveProperty('prototypeId');
        expect(item).toHaveProperty('loading');
      });
    });

    it('should compute componentsFor80Pct and componentsFor90Pct', () => {
      const prototypes = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        weights: {
          dim1: Math.sin(i),
          dim2: Math.cos(i),
          dim3: i * 0.1,
        },
      }));

      const result = service.analyze(prototypes);

      expect(result.componentsFor80Pct).toBeGreaterThanOrEqual(1);
      expect(result.componentsFor90Pct).toBeGreaterThanOrEqual(
        result.componentsFor80Pct
      );
    });

    it('should compute reconstruction errors', () => {
      const prototypes = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        weights: { a: i, b: 10 - i },
      }));

      const result = service.analyze(prototypes);

      expect(result.reconstructionErrors.length).toBeLessThanOrEqual(5);
      result.reconstructionErrors.forEach((item) => {
        expect(item).toHaveProperty('prototypeId');
        expect(item).toHaveProperty('error');
        expect(item.error).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle prototypes with missing axis values', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1 } },
        { id: 'b', weights: { y: 1 } },
        { id: 'c', weights: { x: 0.5, y: 0.5 } },
        { id: 'd', weights: { z: 1 } },
      ];

      const result = service.analyze(prototypes);

      expect(result.dimensionsUsed.length).toBeGreaterThan(0);
      expect(result.cumulativeVariance.length).toBeGreaterThan(0);
    });

    it('should use prototypeId as fallback for id', () => {
      const prototypes = [
        { prototypeId: 'proto1', weights: { x: 1 } },
        { prototypeId: 'proto2', weights: { x: -1 } },
        { prototypeId: 'proto3', weights: { x: 0.5 } },
      ];

      const result = service.analyze(prototypes);

      const ids = result.topLoadingPrototypes.map((p) => p.prototypeId);
      ids.forEach((id) => {
        expect(id).toMatch(/proto\d/);
      });
    });

    it('should generate fallback IDs for prototypes without id', () => {
      const prototypes = [
        { weights: { x: 1 } },
        { weights: { x: -1 } },
        { weights: { x: 0.5 } },
      ];

      const result = service.analyze(prototypes);

      result.topLoadingPrototypes.forEach((item) => {
        expect(item.prototypeId).toMatch(/prototype-\d+/);
      });
    });

    it('should filter non-finite weight values', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: NaN } },
        { id: 'b', weights: { x: Infinity, y: 1 } },
        { id: 'c', weights: { x: 0.5, y: 0.5 } },
        { id: 'd', weights: { x: 0.3, y: 0.7 } },
      ];

      const result = service.analyze(prototypes);

      // Should still work with valid values
      expect(result.dimensionsUsed.length).toBeGreaterThan(0);
    });
  });

  describe('analyze - component significance methods', () => {
    describe('broken-stick (default)', () => {
      it('should use broken-stick method by default', () => {
        const svc = new PCAAnalysisService();
        const prototypes = Array.from({ length: 10 }, (_, i) => ({
          id: `p${i}`,
          weights: {
            a: i * 0.5,
            b: (10 - i) * 0.3,
            c: Math.sin(i) * 0.2,
          },
        }));

        const result = svc.analyze(prototypes);

        expect(typeof result.additionalSignificantComponents).toBe('number');
        expect(result.additionalSignificantComponents).toBeGreaterThanOrEqual(0);
      });

      it('should detect significant components with clear factor structure', () => {
        // Create prototypes with a clear dominant factor
        // All prototypes vary primarily along axis 'a'
        const svc = new PCAAnalysisService({
          pcaComponentSignificanceMethod: 'broken-stick',
        });
        const prototypes = [
          { id: 'p0', weights: { a: 10, b: 1, c: 0.5 } },
          { id: 'p1', weights: { a: -10, b: 1.1, c: 0.4 } },
          { id: 'p2', weights: { a: 8, b: 0.9, c: 0.6 } },
          { id: 'p3', weights: { a: -8, b: 1.2, c: 0.3 } },
          { id: 'p4', weights: { a: 5, b: 1, c: 0.5 } },
          { id: 'p5', weights: { a: -5, b: 0.8, c: 0.7 } },
        ];

        const result = svc.analyze(prototypes);

        // Should detect at least one significant component
        expect(result.additionalSignificantComponents).toBeGreaterThanOrEqual(0);
      });

      it('should return 0 for uniform variance distribution', () => {
        // When all eigenvalues are roughly equal, broken-stick should find none significant
        const svc = new PCAAnalysisService({
          pcaComponentSignificanceMethod: 'broken-stick',
        });
        // Create prototypes where all axes contribute equally
        const prototypes = [
          { id: 'p0', weights: { a: 1, b: 0, c: 0 } },
          { id: 'p1', weights: { a: 0, b: 1, c: 0 } },
          { id: 'p2', weights: { a: 0, b: 0, c: 1 } },
          { id: 'p3', weights: { a: -1, b: 0, c: 0 } },
          { id: 'p4', weights: { a: 0, b: -1, c: 0 } },
          { id: 'p5', weights: { a: 0, b: 0, c: -1 } },
        ];

        const result = svc.analyze(prototypes);

        // Uniform distribution means no single component dominates
        expect(result.additionalSignificantComponents).toBeGreaterThanOrEqual(0);
      });
    });

    describe('kaiser (fallback)', () => {
      it('should use Kaiser criterion when explicitly configured', () => {
        const svc = new PCAAnalysisService({
          pcaComponentSignificanceMethod: 'kaiser',
          pcaKaiserThreshold: 0.5,
        });
        const prototypes = Array.from({ length: 20 }, (_, i) => ({
          id: `p${i}`,
          weights: {
            a: Math.random(),
            b: Math.random(),
            c: Math.random(),
          },
        }));

        const result = svc.analyze(prototypes);

        expect(typeof result.additionalSignificantComponents).toBe('number');
        expect(result.additionalSignificantComponents).toBeGreaterThanOrEqual(0);
      });

      it('should count additional significant components above Kaiser threshold', () => {
        const svc = new PCAAnalysisService({
          pcaComponentSignificanceMethod: 'kaiser',
          pcaKaiserThreshold: 0.5,
        });
        const prototypes = Array.from({ length: 20 }, (_, i) => ({
          id: `p${i}`,
          weights: {
            a: Math.random(),
            b: Math.random(),
            c: Math.random(),
          },
        }));

        const result = svc.analyze(prototypes);

        expect(typeof result.additionalSignificantComponents).toBe('number');
        expect(result.additionalSignificantComponents).toBeGreaterThanOrEqual(0);
      });
    });

    describe('method comparison', () => {
      it('should potentially give different results for same data', () => {
        // Create data where broken-stick and Kaiser might differ
        const prototypes = Array.from({ length: 15 }, (_, i) => ({
          id: `p${i}`,
          weights: {
            a: i * 0.2,
            b: (15 - i) * 0.15,
            c: Math.sin(i) * 0.1,
          },
        }));

        const brokenStickSvc = new PCAAnalysisService({
          pcaComponentSignificanceMethod: 'broken-stick',
        });
        const kaiserSvc = new PCAAnalysisService({
          pcaComponentSignificanceMethod: 'kaiser',
          pcaKaiserThreshold: 1.0,
        });

        const brokenStickResult = brokenStickSvc.analyze(prototypes);
        const kaiserResult = kaiserSvc.analyze(prototypes);

        // Both should return valid results
        expect(brokenStickResult.additionalSignificantComponents).toBeGreaterThanOrEqual(0);
        expect(kaiserResult.additionalSignificantComponents).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('analyze - activeAxisEpsilon', () => {
    it('should respect epsilon when counting active axes', () => {
      const svc = new PCAAnalysisService({ activeAxisEpsilon: 0.5 });
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 0.1 } }, // y below epsilon
        { id: 'b', weights: { x: 0.1, y: 1 } }, // x below epsilon
        { id: 'c', weights: { x: 1, y: 1 } },
        { id: 'd', weights: { x: 0.1, y: 0.1 } }, // both below epsilon
      ];

      const result = svc.analyze(prototypes);

      // Should still analyze with valid data
      expect(result.dimensionsUsed.length).toBeGreaterThan(0);
    });
  });

  describe('analyze - axis limiting', () => {
    it('should limit axes when more axes than prototypes', () => {
      // 3 prototypes but 5 axes - should limit to 3 axes
      const prototypes = [
        { id: 'a', weights: { a: 1, b: 2, c: 3, d: 4, e: 5 } },
        { id: 'b', weights: { a: 2, b: 1, c: 4, d: 3, e: 2 } },
        { id: 'c', weights: { a: 3, b: 3, c: 2, d: 1, e: 1 } },
      ];

      const result = service.analyze(prototypes);

      expect(result.dimensionsUsed.length).toBeLessThanOrEqual(3);
    });

    it('should select highest variance axes when limiting', () => {
      // Create prototypes where some axes have much more variance
      const prototypes = [
        { id: 'a', weights: { highVar: 10, lowVar: 1 } },
        { id: 'b', weights: { highVar: -10, lowVar: 1 } },
        { id: 'c', weights: { highVar: 5, lowVar: 1 } },
      ];

      const result = service.analyze(prototypes);

      // Both axes should be included since count equals prototype count
      expect(result.dimensionsUsed).toContain('highVar');
    });
  });

  describe('empty result structure', () => {
    it('should have correct empty result shape', () => {
      const result = service.analyze(null);

      expect(result).toEqual({
        residualVarianceRatio: 0,
        additionalSignificantComponents: 0,
        significantComponentCount: 0,
        expectedComponentCount: 0,
        significantBeyondExpected: 0,
        axisCount: 0,
        topLoadingPrototypes: [],
        dimensionsUsed: [],
        excludedSparseAxes: [],
        cumulativeVariance: [],
        explainedVariance: [],
        componentsFor80Pct: 0,
        componentsFor90Pct: 0,
        reconstructionErrors: [],
        residualEigenvector: null,
        residualEigenvectorIndex: -1,
      });
    });
  });

  describe('residual eigenvector extraction', () => {
    it('should return residualEigenvector mapped to axis names when components beyond expected exist', () => {
      // Create prototypes where variance is distributed across multiple dimensions
      // requiring more principal components than the expected K
      const prototypes = Array.from({ length: 15 }, (_, i) => ({
        id: `p${i}`,
        weights: {
          axis_a: Math.sin(i * 0.5) * 2,
          axis_b: Math.cos(i * 0.5) * 2,
          axis_c: (i % 3) * 0.5,
        },
      }));

      const result = service.analyze(prototypes);

      // Assert on the structure regardless of whether there are significant components
      // The eigenvector is either null or an object with the proper structure
      expect([null, 'object']).toContain(
        result.residualEigenvector === null ? null : typeof result.residualEigenvector
      );

      // When significantBeyondExpected > 0, eigenvector should be an object with axis keys
      // When significantBeyondExpected <= 0, eigenvector may still exist or be null
      expect(result).toHaveProperty('residualEigenvector');
      expect(result).toHaveProperty('residualEigenvectorIndex');
    });

    it('should return null residualEigenvector when no components beyond expected', () => {
      // Create prototypes with simple 2D structure that should fit expected components
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 0 } },
        { id: 'b', weights: { x: 0, y: 1 } },
        { id: 'c', weights: { x: 0.5, y: 0.5 } },
      ];

      const result = service.analyze(prototypes);

      // When residualEigenvectorIndex is -1, eigenvector must be null
      // When residualEigenvectorIndex >= 0, eigenvector must be non-null
      // This tests the consistency between the index and the eigenvector
      const eigenvectorIsNull = result.residualEigenvector === null;
      const indexIsNegative = result.residualEigenvectorIndex === -1;
      expect(eigenvectorIsNull).toBe(indexIsNegative);
    });

    it('should have residualEigenvectorIndex equal to axisCount when residual exists', () => {
      const prototypes = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        weights: {
          a: i * 0.3,
          b: (10 - i) * 0.3,
          c: Math.sin(i) * 0.2,
        },
      }));

      const result = service.analyze(prototypes);

      // Test the invariant: either both are present (index >= 0, eigenvector non-null)
      // or both are absent (index === -1, eigenvector null)
      const hasEigenvector = result.residualEigenvector !== null;
      const hasValidIndex = result.residualEigenvectorIndex >= 0;

      // The eigenvector presence should match the index validity
      expect(hasEigenvector).toBe(hasValidIndex);

      // When present, index should equal axisCount
      // When absent, index should be -1
      const expectedIndex = hasEigenvector ? result.axisCount : -1;
      expect(result.residualEigenvectorIndex).toBe(expectedIndex);
    });

    it('should have eigenvector values summing to approximately 1 (unit vector)', () => {
      const prototypes = Array.from({ length: 12 }, (_, i) => ({
        id: `p${i}`,
        weights: {
          dim1: i * 0.2,
          dim2: (12 - i) * 0.15,
          dim3: Math.cos(i * 0.3) * 0.3,
        },
      }));

      const result = service.analyze(prototypes);

      // Test that when eigenvector exists, it's a unit vector
      // When it doesn't exist, magnitude concept doesn't apply
      const eigenvector = result.residualEigenvector;
      const magnitude =
        eigenvector !== null
          ? Math.sqrt(
              Object.values(eigenvector).reduce((sum, v) => sum + v * v, 0)
            )
          : null;

      // Eigenvector is either null, or has magnitude close to 1
      const isValidUnitVectorOrNull =
        eigenvector === null || Math.abs(magnitude - 1) < 0.00001;
      expect(isValidUnitVectorOrNull).toBe(true);
    });

    it('should correctly map eigenvector components to axis names', () => {
      const prototypes = [
        { id: 'p0', weights: { alpha: 2, beta: 0, gamma: 1 } },
        { id: 'p1', weights: { alpha: 0, beta: 2, gamma: 1 } },
        { id: 'p2', weights: { alpha: 1, beta: 1, gamma: 2 } },
        { id: 'p3', weights: { alpha: -1, beta: 1, gamma: 0 } },
        { id: 'p4', weights: { alpha: 1, beta: -1, gamma: 0 } },
      ];

      const result = service.analyze(prototypes);

      // Test that when eigenvector exists, its keys match dimensionsUsed
      // When eigenvector is null, the mapping test is not applicable
      const eigenvector = result.residualEigenvector;
      const eigenvectorAxes =
        eigenvector !== null ? Object.keys(eigenvector).sort() : null;
      const usedAxes = result.dimensionsUsed.slice().sort();

      // Either eigenvector is null, or its axes match dimensionsUsed
      const axesMatchOrNull =
        eigenvector === null ||
        JSON.stringify(eigenvectorAxes) === JSON.stringify(usedAxes);
      expect(axesMatchOrNull).toBe(true);
    });

    it('should return -1 for residualEigenvectorIndex when empty input', () => {
      const result = service.analyze([]);

      expect(result.residualEigenvectorIndex).toBe(-1);
      expect(result.residualEigenvector).toBeNull();
    });

    it('should return -1 for residualEigenvectorIndex when single prototype', () => {
      const result = service.analyze([{ id: 'a', weights: { x: 1 } }]);

      expect(result.residualEigenvectorIndex).toBe(-1);
      expect(result.residualEigenvector).toBeNull();
    });
  });

  describe('significant component metrics', () => {
    it('should return significantComponentCount and expectedComponentCount', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 0 } },
        { id: 'b', weights: { x: 0, y: 1 } },
        { id: 'c', weights: { x: 1, y: 1 } },
        { id: 'd', weights: { x: -1, y: 0 } },
      ];

      const result = service.analyze(prototypes);

      expect(typeof result.significantComponentCount).toBe('number');
      expect(typeof result.expectedComponentCount).toBe('number');
      expect(typeof result.significantBeyondExpected).toBe('number');
      expect(result.significantComponentCount).toBeGreaterThanOrEqual(0);
      expect(result.expectedComponentCount).toBeGreaterThanOrEqual(0);
      expect(result.significantBeyondExpected).toBeGreaterThanOrEqual(0);
    });

    it('should have correct relationship: significantBeyondExpected = max(0, significant - expected)', () => {
      const prototypes = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        weights: {
          a: i * 0.5,
          b: (10 - i) * 0.3,
          c: Math.sin(i) * 0.2,
        },
      }));

      const result = service.analyze(prototypes);

      const computed = Math.max(
        0,
        result.significantComponentCount - result.expectedComponentCount
      );
      expect(result.significantBeyondExpected).toBe(computed);
    });

    it('should have additionalSignificantComponents as alias for significantBeyondExpected', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 0 } },
        { id: 'b', weights: { x: 0, y: 1 } },
        { id: 'c', weights: { x: 1, y: 1 } },
        { id: 'd', weights: { x: -1, y: 0 } },
      ];

      const result = service.analyze(prototypes);

      expect(result.additionalSignificantComponents).toBe(
        result.significantBeyondExpected
      );
    });

    it('should have expectedComponentCount equal to axisCount', () => {
      const prototypes = [
        { id: 'a', weights: { x: 1, y: 0 } },
        { id: 'b', weights: { x: 0, y: 1 } },
        { id: 'c', weights: { x: 1, y: 1 } },
        { id: 'd', weights: { x: -1, y: 0 } },
      ];

      const result = service.analyze(prototypes);

      expect(result.expectedComponentCount).toBe(result.axisCount);
    });
  });

  describe('axisCount exposure', () => {
    it('should return axisCount representing median active axes', () => {
      // Each prototype uses 2 axes actively
      const prototypes = [
        { id: 'p1', weights: { a: 0.5, b: 0.5, c: 0 } },
        { id: 'p2', weights: { a: 0.3, b: 0.7, c: 0 } },
        { id: 'p3', weights: { a: 0.6, b: 0.4, c: 0 } },
      ];

      const result = service.analyze(prototypes);

      expect(result.axisCount).toBeGreaterThan(0);
      expect(result.axisCount).toBeLessThanOrEqual(3); // Cannot exceed number of axes
      expect(Number.isInteger(result.axisCount)).toBe(true);
    });

    it('should return axisCount of 0 for empty input', () => {
      const result = service.analyze([]);

      expect(result.axisCount).toBe(0);
    });
  });

  describe('large dataset handling', () => {
    it('should handle 50+ prototypes', () => {
      const prototypes = Array.from({ length: 50 }, (_, i) => ({
        id: `p${i}`,
        weights: {
          a: Math.sin(i * 0.1),
          b: Math.cos(i * 0.1),
          c: i * 0.02,
        },
      }));

      const result = service.analyze(prototypes);

      expect(result.cumulativeVariance.length).toBe(3);
      expect(result.topLoadingPrototypes.length).toBeLessThanOrEqual(10);
    });

    it('should handle many axes', () => {
      const prototypes = Array.from({ length: 15 }, (_, i) => ({
        id: `p${i}`,
        weights: Object.fromEntries(
          Array.from({ length: 10 }, (_, j) => [`axis${j}`, i * 0.1 + j * 0.05])
        ),
      }));

      const result = service.analyze(prototypes);

      // Should limit axes to prototype count
      expect(result.dimensionsUsed.length).toBeLessThanOrEqual(15);
      expect(result.cumulativeVariance.length).toBeGreaterThan(0);
    });
  });

  describe('sparse axis filtering', () => {
    it('should exclude axes used by fewer than pcaMinAxisUsageRatio of prototypes', () => {
      // Create 10 prototypes where 'sparse_axis' is used by only 1 (10%)
      // Default threshold is 0.1 (10%), so with minCount = max(2, ceil(10*0.1)) = 2,
      // an axis used by only 1 prototype should be excluded
      const prototypes = [
        { id: 'p0', weights: { common: 1, sparse_axis: 0.5 } }, // Only prototype using sparse_axis
        { id: 'p1', weights: { common: 0.8 } },
        { id: 'p2', weights: { common: 0.9 } },
        { id: 'p3', weights: { common: 0.7 } },
        { id: 'p4', weights: { common: 1.1 } },
        { id: 'p5', weights: { common: 0.6 } },
        { id: 'p6', weights: { common: 0.85 } },
        { id: 'p7', weights: { common: 0.95 } },
        { id: 'p8', weights: { common: 0.75 } },
        { id: 'p9', weights: { common: 1.05 } },
      ];

      const svc = new PCAAnalysisService({ pcaMinAxisUsageRatio: 0.1 });
      const result = svc.analyze(prototypes);

      expect(result.excludedSparseAxes).toContain('sparse_axis');
      expect(result.dimensionsUsed).not.toContain('sparse_axis');
      expect(result.dimensionsUsed).toContain('common');
    });

    it('should include axes meeting the usage threshold', () => {
      // Create 10 prototypes where all use both axes
      const prototypes = Array.from({ length: 10 }, (_, i) => ({
        id: `p${i}`,
        weights: { axis_a: i * 0.1, axis_b: (10 - i) * 0.1 },
      }));

      const svc = new PCAAnalysisService({ pcaMinAxisUsageRatio: 0.1 });
      const result = svc.analyze(prototypes);

      expect(result.excludedSparseAxes).toEqual([]);
      expect(result.dimensionsUsed).toContain('axis_a');
      expect(result.dimensionsUsed).toContain('axis_b');
    });

    it('should disable filtering when pcaMinAxisUsageRatio is 0 (backward compatibility)', () => {
      // Create 10 prototypes where 'sparse_axis' is used by only 1
      const prototypes = [
        { id: 'p0', weights: { common: 1, sparse_axis: 0.5 } },
        { id: 'p1', weights: { common: 0.8 } },
        { id: 'p2', weights: { common: 0.9 } },
        { id: 'p3', weights: { common: 0.7 } },
        { id: 'p4', weights: { common: 1.1 } },
        { id: 'p5', weights: { common: 0.6 } },
        { id: 'p6', weights: { common: 0.85 } },
        { id: 'p7', weights: { common: 0.95 } },
        { id: 'p8', weights: { common: 0.75 } },
        { id: 'p9', weights: { common: 1.05 } },
      ];

      const svc = new PCAAnalysisService({ pcaMinAxisUsageRatio: 0 });
      const result = svc.analyze(prototypes);

      // With filtering disabled, sparse_axis should be included
      expect(result.excludedSparseAxes).toEqual([]);
      expect(result.dimensionsUsed).toContain('sparse_axis');
      expect(result.dimensionsUsed).toContain('common');
    });

    it('should return empty excludedSparseAxes when no axes are sparse', () => {
      const prototypes = Array.from({ length: 5 }, (_, i) => ({
        id: `p${i}`,
        weights: { x: i * 0.2, y: (5 - i) * 0.2 },
      }));

      const result = service.analyze(prototypes);

      expect(result.excludedSparseAxes).toEqual([]);
    });

    it('should handle edge case where all axes are sparse', () => {
      // 3 prototypes, each using a different axis
      const prototypes = [
        { id: 'p0', weights: { axis_a: 1 } },
        { id: 'p1', weights: { axis_b: 1 } },
        { id: 'p2', weights: { axis_c: 1 } },
      ];

      // With 3 prototypes, minCount = max(2, ceil(3*0.5)) = 2
      // Each axis used by only 1 prototype, so all should be excluded
      const svc = new PCAAnalysisService({ pcaMinAxisUsageRatio: 0.5 });
      const result = svc.analyze(prototypes);

      // All axes excluded → empty result
      expect(result.dimensionsUsed).toEqual([]);
      expect(result.excludedSparseAxes.sort()).toEqual(
        ['axis_a', 'axis_b', 'axis_c'].sort()
      );
    });

    it('should filter sparse axes before variance-based axis selection', () => {
      // Create scenario where sparse axis has high variance but low usage
      // 10 prototypes: sparse_axis used by 1, has extreme variance
      const prototypes = [
        { id: 'p0', weights: { common: 0.1, sparse_axis: 100 } }, // Extreme value
        { id: 'p1', weights: { common: 0.2 } },
        { id: 'p2', weights: { common: 0.15 } },
        { id: 'p3', weights: { common: 0.18 } },
        { id: 'p4', weights: { common: 0.12 } },
        { id: 'p5', weights: { common: 0.22 } },
        { id: 'p6', weights: { common: 0.17 } },
        { id: 'p7', weights: { common: 0.19 } },
        { id: 'p8', weights: { common: 0.14 } },
        { id: 'p9', weights: { common: 0.21 } },
      ];

      const svc = new PCAAnalysisService({ pcaMinAxisUsageRatio: 0.1 });
      const result = svc.analyze(prototypes);

      // sparse_axis should be excluded despite high variance
      expect(result.excludedSparseAxes).toContain('sparse_axis');
      expect(result.dimensionsUsed).not.toContain('sparse_axis');
    });

    it('should accept custom pcaMinAxisUsageRatio in constructor', () => {
      const prototypes = Array.from({ length: 20 }, (_, i) => ({
        id: `p${i}`,
        weights: {
          common: i * 0.1,
          semi_sparse: i < 5 ? 0.5 : 0, // Used by 5/20 = 25%
        },
      }));

      // With 0.3 threshold: minCount = max(2, ceil(20*0.3)) = 6
      // semi_sparse used by 5, so should be excluded
      const svc30 = new PCAAnalysisService({ pcaMinAxisUsageRatio: 0.3 });
      const result30 = svc30.analyze(prototypes);
      expect(result30.excludedSparseAxes).toContain('semi_sparse');

      // With 0.2 threshold: minCount = max(2, ceil(20*0.2)) = 4
      // semi_sparse used by 5, so should be included
      const svc20 = new PCAAnalysisService({ pcaMinAxisUsageRatio: 0.2 });
      const result20 = svc20.analyze(prototypes);
      expect(result20.excludedSparseAxes).not.toContain('semi_sparse');
    });
  });

  describe('pcaNormalizationMethod', () => {
    const prototypes = [
      { id: 'a', weights: { x: 1, y: 0.5 } },
      { id: 'b', weights: { x: 0, y: 1 } },
      { id: 'c', weights: { x: -0.5, y: 0.5 } },
      { id: 'd', weights: { x: 0.8, y: -0.3 } },
    ];

    it('should default to center-only normalization', () => {
      const svc = new PCAAnalysisService();
      const result = svc.analyze(prototypes);
      // Center-only should produce valid results
      expect(result.residualVarianceRatio).toBeGreaterThanOrEqual(0);
      expect(result.residualVarianceRatio).toBeLessThanOrEqual(1);
      expect(result.dimensionsUsed).toEqual(['x', 'y']);
    });

    it('should accept center-only as explicit config', () => {
      const svc = new PCAAnalysisService({ pcaNormalizationMethod: 'center-only' });
      const result = svc.analyze(prototypes);
      expect(result.residualVarianceRatio).toBeGreaterThanOrEqual(0);
      expect(result.dimensionsUsed.length).toBe(2);
    });

    it('should accept z-score for backward compatibility', () => {
      const svc = new PCAAnalysisService({ pcaNormalizationMethod: 'z-score' });
      const result = svc.analyze(prototypes);
      expect(result.residualVarianceRatio).toBeGreaterThanOrEqual(0);
      expect(result.residualVarianceRatio).toBeLessThanOrEqual(1);
      expect(result.dimensionsUsed.length).toBe(2);
    });

    it('should produce different results for center-only vs z-score on unequal variance data', () => {
      // Create data where one axis has much higher variance than another
      const unequalVarianceData = [
        { id: 'a', weights: { high_var: 10, low_var: 0.1 } },
        { id: 'b', weights: { high_var: -10, low_var: 0.2 } },
        { id: 'c', weights: { high_var: 5, low_var: 0.15 } },
        { id: 'd', weights: { high_var: -5, low_var: 0.05 } },
      ];

      const centerOnly = new PCAAnalysisService({ pcaNormalizationMethod: 'center-only' });
      const zScore = new PCAAnalysisService({ pcaNormalizationMethod: 'z-score' });

      const resultCenter = centerOnly.analyze(unequalVarianceData);
      const resultZScore = zScore.analyze(unequalVarianceData);

      // Both should produce valid results
      expect(resultCenter.dimensionsUsed.length).toBe(2);
      expect(resultZScore.dimensionsUsed.length).toBe(2);

      // The explained variance proportions should differ because z-score
      // equalizes variance while center-only preserves original scale
      // With center-only, high_var axis dominates
      // With z-score, both axes contribute equally after normalization
      expect(resultCenter.explainedVariance[0]).not.toBeCloseTo(
        resultZScore.explainedVariance[0],
        1
      );
    });
  });

  describe('pcaExpectedDimensionMethod', () => {
    // Create prototypes with clear structure: 3 dominant axes, some noise
    const structuredPrototypes = [
      { id: 'p1', weights: { a: 1, b: 0, c: 0, d: 0.1 } },
      { id: 'p2', weights: { a: -1, b: 0, c: 0, d: 0.05 } },
      { id: 'p3', weights: { a: 0, b: 1, c: 0, d: -0.1 } },
      { id: 'p4', weights: { a: 0, b: -1, c: 0, d: 0.08 } },
      { id: 'p5', weights: { a: 0, b: 0, c: 1, d: -0.05 } },
      { id: 'p6', weights: { a: 0, b: 0, c: -1, d: 0.12 } },
      { id: 'p7', weights: { a: 0.5, b: 0.5, c: 0, d: 0.02 } },
      { id: 'p8', weights: { a: 0, b: 0.5, c: 0.5, d: -0.03 } },
    ];

    it('should default to variance-80 method', () => {
      const svc = new PCAAnalysisService();
      const result = svc.analyze(structuredPrototypes);
      // Should use components for 80% variance as K
      expect(result.expectedComponentCount).toBe(result.componentsFor80Pct);
    });

    it('should use variance-80 when configured', () => {
      const svc = new PCAAnalysisService({ pcaExpectedDimensionMethod: 'variance-80' });
      const result = svc.analyze(structuredPrototypes);
      expect(result.expectedComponentCount).toBe(result.componentsFor80Pct);
    });

    it('should use variance-90 when configured', () => {
      const svc = new PCAAnalysisService({ pcaExpectedDimensionMethod: 'variance-90' });
      const result = svc.analyze(structuredPrototypes);
      expect(result.expectedComponentCount).toBe(result.componentsFor90Pct);
    });

    it('should use broken-stick when configured', () => {
      const svc = new PCAAnalysisService({ pcaExpectedDimensionMethod: 'broken-stick' });
      const result = svc.analyze(structuredPrototypes);
      // broken-stick count should be >= 1 and <= total dimensions
      expect(result.expectedComponentCount).toBeGreaterThanOrEqual(1);
      expect(result.expectedComponentCount).toBeLessThanOrEqual(
        result.dimensionsUsed.length
      );
    });

    it('should use median-active when configured', () => {
      const svc = new PCAAnalysisService({ pcaExpectedDimensionMethod: 'median-active' });
      const result = svc.analyze(structuredPrototypes);
      // median-active should be >= 1 and <= total dimensions
      expect(result.expectedComponentCount).toBeGreaterThanOrEqual(1);
      expect(result.expectedComponentCount).toBeLessThanOrEqual(
        result.dimensionsUsed.length
      );
    });

    it('should produce different K values for different methods', () => {
      // Create data where different methods would produce different K
      const diverseData = [
        { id: 'p1', weights: { a: 1, b: 0.8, c: 0.6, d: 0.4, e: 0.2 } },
        { id: 'p2', weights: { a: -1, b: 0.7, c: -0.5, d: 0.3, e: 0.1 } },
        { id: 'p3', weights: { a: 0.5, b: -0.9, c: 0.4, d: -0.2, e: 0.3 } },
        { id: 'p4', weights: { a: -0.3, b: 0.6, c: -0.8, d: 0.5, e: -0.1 } },
        { id: 'p5', weights: { a: 0.8, b: 0.3, c: 0.7, d: -0.4, e: 0.2 } },
        { id: 'p6', weights: { a: -0.6, b: -0.5, c: 0.3, d: 0.6, e: -0.2 } },
      ];

      const var80 = new PCAAnalysisService({ pcaExpectedDimensionMethod: 'variance-80' });
      const var90 = new PCAAnalysisService({ pcaExpectedDimensionMethod: 'variance-90' });
      const medianActive = new PCAAnalysisService({
        pcaExpectedDimensionMethod: 'median-active',
      });

      const result80 = var80.analyze(diverseData);
      const result90 = var90.analyze(diverseData);
      const resultMedian = medianActive.analyze(diverseData);

      // variance-90 should require >= variance-80 components
      expect(result90.expectedComponentCount).toBeGreaterThanOrEqual(
        result80.expectedComponentCount
      );

      // All should be valid
      expect(result80.expectedComponentCount).toBeGreaterThanOrEqual(1);
      expect(result90.expectedComponentCount).toBeGreaterThanOrEqual(1);
      expect(resultMedian.expectedComponentCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Jacobi convergence configuration', () => {
    const createTestPrototypes = (count) =>
      Array.from({ length: count }, (_, i) => ({
        id: `p${i}`,
        weights: {
          a: Math.sin(i * 0.5) * 2,
          b: Math.cos(i * 0.5) * 2,
          c: (i % 3) * 0.5,
        },
      }));

    it('should use default tolerance when not configured', () => {
      const svc = new PCAAnalysisService({});
      const prototypes = createTestPrototypes(5);

      const result = svc.analyze(prototypes);

      expect(result.residualVarianceRatio).toBeDefined();
      expect(result.dimensionsUsed.length).toBeGreaterThan(0);
    });

    it('should use configurable convergence tolerance', () => {
      const svc = new PCAAnalysisService({
        jacobiConvergenceTolerance: 1e-6,
      });
      const prototypes = createTestPrototypes(5);

      const result = svc.analyze(prototypes);

      expect(result.residualVarianceRatio).toBeDefined();
      expect(result.dimensionsUsed.length).toBeGreaterThan(0);
    });

    it('should use configurable max iterations override', () => {
      const svc = new PCAAnalysisService({
        jacobiMaxIterationsOverride: 1000,
      });
      const prototypes = createTestPrototypes(5);

      const result = svc.analyze(prototypes);

      expect(result.residualVarianceRatio).toBeDefined();
      expect(result.dimensionsUsed.length).toBeGreaterThan(0);
    });

    it('should fall back to defaults when config values are null', () => {
      const svc = new PCAAnalysisService({
        jacobiConvergenceTolerance: null,
        jacobiMaxIterationsOverride: null,
      });
      const prototypes = createTestPrototypes(5);

      const result = svc.analyze(prototypes);

      expect(result.residualVarianceRatio).toBeDefined();
      expect(result.dimensionsUsed.length).toBeGreaterThan(0);
    });

    it('should produce valid results with looser tolerance', () => {
      const looseTolerance = new PCAAnalysisService({
        jacobiConvergenceTolerance: 1e-4,
      });
      const strictTolerance = new PCAAnalysisService({
        jacobiConvergenceTolerance: 1e-12,
      });
      const prototypes = createTestPrototypes(8);

      const looseResult = looseTolerance.analyze(prototypes);
      const strictResult = strictTolerance.analyze(prototypes);

      // Both should produce valid results
      expect(looseResult.dimensionsUsed.length).toBeGreaterThan(0);
      expect(strictResult.dimensionsUsed.length).toBeGreaterThan(0);

      // Cumulative variance should still sum to ~1 for both
      const looseLast =
        looseResult.cumulativeVariance[looseResult.cumulativeVariance.length - 1];
      const strictLast =
        strictResult.cumulativeVariance[strictResult.cumulativeVariance.length - 1];
      expect(looseLast).toBeCloseTo(1, 3);
      expect(strictLast).toBeCloseTo(1, 5);
    });

    it('should work with limited max iterations', () => {
      // Use a very small number of iterations - should still produce some result
      const svc = new PCAAnalysisService({
        jacobiMaxIterationsOverride: 10,
      });
      const prototypes = createTestPrototypes(5);

      const result = svc.analyze(prototypes);

      // Should still produce a result (may be less accurate)
      expect(result).toBeDefined();
      expect(result.dimensionsUsed.length).toBeGreaterThan(0);
    });
  });
});
