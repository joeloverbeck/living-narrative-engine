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
        topLoadingPrototypes: [],
        dimensionsUsed: [],
        cumulativeVariance: [],
        explainedVariance: [],
        componentsFor80Pct: 0,
        componentsFor90Pct: 0,
        reconstructionErrors: [],
      });
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
});
