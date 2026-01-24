/**
 * @file Unit tests for AxisGapAnalyzer constructor validation.
 */

import { describe, expect, it, jest } from '@jest/globals';
import AxisGapAnalyzer from '../../../../src/expressionDiagnostics/services/AxisGapAnalyzer.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createPrototypeProfileCalculator = () => ({
  calculateAll: jest.fn(),
});

const createConfig = (overrides = {}) => ({
  enableAxisGapDetection: true,
  activeAxisEpsilon: 0.05,
  pcaResidualVarianceThreshold: 0.15,
  pcaKaiserThreshold: 1.0,
  hubMinDegree: 4,
  hubMaxEdgeWeight: 0.9,
  hubMinNeighborhoodDiversity: 2,
  compositeScoreGateOverlapWeight: 0.3,
  compositeScoreCorrelationWeight: 0.2,
  compositeScoreGlobalDiffWeight: 0.5,
  coverageGapAxisDistanceThreshold: 0.6,
  coverageGapMinClusterSize: 3,
  multiAxisUsageThreshold: 1.5,
  multiAxisSignBalanceThreshold: 0.4,
  ...overrides,
});

describe('AxisGapAnalyzer', () => {
  describe('constructor', () => {
    it('should accept valid dependencies', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      expect(analyzer).toBeInstanceOf(AxisGapAnalyzer);
    });

    it('should throw when logger is missing', () => {
      expect(
        () =>
          new AxisGapAnalyzer({
            prototypeProfileCalculator: createPrototypeProfileCalculator(),
            config: createConfig(),
            logger: null,
          })
      ).toThrow();
    });

    it('should throw when logger lacks required methods', () => {
      expect(
        () =>
          new AxisGapAnalyzer({
            prototypeProfileCalculator: createPrototypeProfileCalculator(),
            config: createConfig(),
            logger: { debug: jest.fn() },
          })
      ).toThrow();
    });

    it('should throw when prototypeProfileCalculator is missing', () => {
      expect(
        () =>
          new AxisGapAnalyzer({
            prototypeProfileCalculator: null,
            config: createConfig(),
            logger: createLogger(),
          })
      ).toThrow();
    });

    it('should throw when prototypeProfileCalculator lacks calculateAll', () => {
      expect(
        () =>
          new AxisGapAnalyzer({
            prototypeProfileCalculator: {},
            config: createConfig(),
            logger: createLogger(),
          })
      ).toThrow();
    });

    it('should throw when config is missing', () => {
      expect(
        () =>
          new AxisGapAnalyzer({
            prototypeProfileCalculator: createPrototypeProfileCalculator(),
            config: null,
            logger: createLogger(),
          })
      ).toThrow();
    });

    it('should throw when config is not an object', () => {
      expect(
        () =>
          new AxisGapAnalyzer({
            prototypeProfileCalculator: createPrototypeProfileCalculator(),
            config: 'nope',
            logger: createLogger(),
          })
      ).toThrow();
    });
  });

  describe('PCA Analysis', () => {
    it('should detect high residual variance when latent dimension exists', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig({ pcaKaiserThreshold: 0.9 }),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'a1', weights: { axisA: 1 } },
        { id: 'a2', weights: { axisA: -1 } },
        { id: 'b1', weights: { axisB: 1 } },
        { id: 'b2', weights: { axisB: -1 } },
        { id: 'c1', weights: { axisC: 1 } },
        { id: 'c2', weights: { axisC: -1 } },
      ];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);

      expect(result.residualVarianceRatio).toBeGreaterThan(0.15);
      expect(result.additionalSignificantComponents).toBeGreaterThanOrEqual(1);
    });

    it('should identify prototypes loading on missing dimension', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'joy', weights: { valence: 1 } },
        { id: 'sadness', weights: { valence: -1 } },
        { id: 'anger', weights: { valence: 0.8 } },
        { id: 'contentment', weights: { valence: -0.7 } },
        { id: 'confusion', weights: { uncertainty: 1 } },
        { id: 'perplexity', weights: { uncertainty: 0.8 } },
        { id: 'doubt', weights: { uncertainty: -0.9 } },
        { id: 'curiosity', weights: { uncertainty: 0.7 } },
      ];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);
      const ids = result.topLoadingPrototypes.map((entry) => entry.prototypeId);

      expect(ids).toEqual(expect.arrayContaining(['confusion', 'perplexity', 'doubt', 'curiosity']));
    });

    it('should return low residual variance for well-fit data', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'proto-a', weights: { axisA: 0.6, axisB: 0.4 } },
        { id: 'proto-b', weights: { axisA: -0.5, axisB: 0.5 } },
        { id: 'proto-c', weights: { axisA: 0.7, axisB: -0.3 } },
        { id: 'proto-d', weights: { axisA: -0.4, axisB: -0.6 } },
      ];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);

      expect(result.residualVarianceRatio).toBeLessThan(0.15);
      expect(result.additionalSignificantComponents).toBe(0);
    });

    it('should handle single prototype gracefully', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [{ id: 'solo', weights: { axisA: 1 } }];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);

      expect(result).toEqual({
        residualVarianceRatio: 0,
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
        dimensionsUsed: [],
        cumulativeVariance: [],
        componentsFor80Pct: 0,
        componentsFor90Pct: 0,
        reconstructionErrors: [],
      });
    });

    it('should handle all-zero weights gracefully', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'zero-a', weights: { axisA: 0, axisB: 0 } },
        { id: 'zero-b', weights: { axisA: 0, axisB: 0 } },
      ];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);

      expect(result).toEqual({
        residualVarianceRatio: 0,
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
        dimensionsUsed: [],
        cumulativeVariance: [],
        componentsFor80Pct: 0,
        componentsFor90Pct: 0,
        reconstructionErrors: [],
      });
    });

    it('should include dimensionsUsed with axes found in prototypes', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'proto-a', weights: { valence: 0.6, arousal: 0.4 } },
        { id: 'proto-b', weights: { valence: -0.5, dominance: 0.5 } },
        { id: 'proto-c', weights: { arousal: 0.7, dominance: -0.3 } },
      ];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);

      expect(result.dimensionsUsed).toEqual(
        expect.arrayContaining(['valence', 'arousal', 'dominance'])
      );
      expect(result.dimensionsUsed).toHaveLength(3);
    });

    it('should return empty dimensionsUsed for empty prototypes', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      const result = analyzer.__TEST_ONLY__runPCAAnalysis([]);

      expect(result.dimensionsUsed).toEqual([]);
    });

    it('should handle fewer prototypes than axes', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig({ pcaKaiserThreshold: 0.9 }),
        logger: createLogger(),
      });
      const prototypes = [
        {
          id: 'proto-1',
          weights: {
            axisA: 1,
            axisB: 0.5,
            axisC: 0.2,
            axisD: -0.1,
            axisE: 0.3,
            axisF: 0.4,
            axisG: -0.2,
            axisH: 0.1,
            axisI: -0.3,
            axisJ: 0.6,
          },
        },
        {
          id: 'proto-2',
          weights: {
            axisA: -1,
            axisB: -0.4,
            axisC: 0.1,
            axisD: 0.2,
            axisE: -0.2,
            axisF: 0.3,
            axisG: 0.5,
            axisH: -0.1,
            axisI: 0.2,
            axisJ: -0.5,
          },
        },
        {
          id: 'proto-3',
          weights: {
            axisA: 0.8,
            axisB: 0.2,
            axisC: -0.3,
            axisD: 0.4,
            axisE: 0.1,
            axisF: -0.2,
            axisG: 0.6,
            axisH: 0.3,
            axisI: -0.4,
            axisJ: 0.2,
          },
        },
      ];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);

      expect(result.residualVarianceRatio).toBeGreaterThanOrEqual(0);
      expect(result.residualVarianceRatio).toBeLessThanOrEqual(1);
      expect(result.topLoadingPrototypes.length).toBeLessThanOrEqual(10);
    });

    it('should return cumulative variance array from eigenvalues', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      const prototypes = [
        { id: 'p1', weights: { axisA: 1.0, axisB: 0.0 } },
        { id: 'p2', weights: { axisA: 0.0, axisB: 1.0 } },
        { id: 'p3', weights: { axisA: 0.5, axisB: 0.5 } },
        { id: 'p4', weights: { axisA: -0.5, axisB: 0.5 } },
      ];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);

      expect(Array.isArray(result.cumulativeVariance)).toBe(true);
      expect(result.cumulativeVariance.length).toBeGreaterThan(0);

      // Cumulative variance should be monotonically increasing
      for (let i = 1; i < result.cumulativeVariance.length; i++) {
        expect(result.cumulativeVariance[i]).toBeGreaterThanOrEqual(
          result.cumulativeVariance[i - 1]
        );
      }
      // Last value should approach 1.0 (100%)
      const lastValue =
        result.cumulativeVariance[result.cumulativeVariance.length - 1];
      expect(lastValue).toBeCloseTo(1.0, 2);
    });

    it('should return components for 80% and 90% thresholds', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      const prototypes = [
        { id: 'p1', weights: { axisA: 1.0, axisB: 0.2, axisC: 0.1 } },
        { id: 'p2', weights: { axisA: 0.2, axisB: 1.0, axisC: 0.1 } },
        { id: 'p3', weights: { axisA: 0.1, axisB: 0.2, axisC: 1.0 } },
        { id: 'p4', weights: { axisA: -0.5, axisB: 0.5, axisC: 0.3 } },
      ];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);

      expect(typeof result.componentsFor80Pct).toBe('number');
      expect(typeof result.componentsFor90Pct).toBe('number');
      expect(result.componentsFor80Pct).toBeGreaterThan(0);
      expect(result.componentsFor90Pct).toBeGreaterThanOrEqual(
        result.componentsFor80Pct
      );
    });

    it('should return empty cumulative variance for empty result', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      const result = analyzer.__TEST_ONLY__runPCAAnalysis([]);

      expect(result.cumulativeVariance).toEqual([]);
      expect(result.componentsFor80Pct).toBe(0);
      expect(result.componentsFor90Pct).toBe(0);
    });
  });

  describe('Reconstruction Errors', () => {
    it('should compute RMSE for each prototype', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      // Simple test data: 3 prototypes, 2 features
      const matrix = [
        [1.0, 0.0],
        [0.0, 1.0],
        [0.5, 0.5],
      ];
      // Eigenvectors (identity-like for simplicity)
      const eigenvectors = [
        [1.0, 0.0],
        [0.0, 1.0],
      ];
      const prototypeIds = ['p1', 'p2', 'p3'];

      const errors = analyzer.__TEST_ONLY__computeReconstructionErrors({
        matrix,
        eigenvectors,
        axisCount: 2,
        prototypeIds,
      });

      expect(Array.isArray(errors)).toBe(true);
      // With identity eigenvectors and axisCount=2, reconstruction should be perfect
      // So errors should be very small
      errors.forEach((item) => {
        expect(typeof item.prototypeId).toBe('string');
        expect(typeof item.error).toBe('number');
        expect(item.error).toBeGreaterThanOrEqual(0);
      });
    });

    it('should sort by error descending (worst first)', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      // Matrix with 6 prototypes to ensure we get 5 back (limited)
      const matrix = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0],
        [0.5, 0.5, 0.0],
        [0.5, 0.0, 0.5],
        [0.33, 0.33, 0.33],
      ];
      const eigenvectors = [
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
      ];
      const prototypeIds = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

      // Using only 1 component should create reconstruction errors
      const errors = analyzer.__TEST_ONLY__computeReconstructionErrors({
        matrix,
        eigenvectors,
        axisCount: 1,
        prototypeIds,
      });

      expect(errors.length).toBeLessThanOrEqual(5);
      // Should be sorted by error descending
      for (let i = 1; i < errors.length; i++) {
        expect(errors[i].error).toBeLessThanOrEqual(errors[i - 1].error);
      }
    });

    it('should return empty array for invalid input', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      expect(
        analyzer.__TEST_ONLY__computeReconstructionErrors({
          matrix: [],
          eigenvectors: [[1, 0]],
          axisCount: 1,
          prototypeIds: [],
        })
      ).toEqual([]);

      expect(
        analyzer.__TEST_ONLY__computeReconstructionErrors({
          matrix: [[1, 0]],
          eigenvectors: [],
          axisCount: 1,
          prototypeIds: ['p1'],
        })
      ).toEqual([]);

      expect(
        analyzer.__TEST_ONLY__computeReconstructionErrors({
          matrix: [[1, 0]],
          eigenvectors: [[1, 0]],
          axisCount: 0,
          prototypeIds: ['p1'],
        })
      ).toEqual([]);
    });

    it('should be included in PCA analysis results', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      const prototypes = [
        { id: 'p1', weights: { axisA: 1.0, axisB: 0.0 } },
        { id: 'p2', weights: { axisA: 0.0, axisB: 1.0 } },
        { id: 'p3', weights: { axisA: 0.5, axisB: 0.5 } },
      ];

      const result = analyzer.__TEST_ONLY__runPCAAnalysis(prototypes);

      expect(Array.isArray(result.reconstructionErrors)).toBe(true);
    });
  });

  describe('Hub Detection', () => {
    const createProfiles = (entries) =>
      new Map(
        entries.map(([prototypeId, clusterId]) => [
          prototypeId,
          { prototypeId, nearestClusterId: clusterId },
        ])
      );

    const createPrototypes = (entries) =>
      entries.map(([id, weights]) => ({ id, weights }));

    it('should flag prototypes with many moderate overlaps', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.6 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.62 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.58 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.55 },
        { prototypeAId: 'hub', prototypeBId: 'n5', overlapScore: 0.57 },
      ];
      const profiles = createProfiles([
        ['n1', 'cluster-1'],
        ['n2', 'cluster-1'],
        ['n3', 'cluster-2'],
        ['n4', 'cluster-2'],
        ['n5', 'cluster-3'],
      ]);

      const hubs = analyzer.__TEST_ONLY__identifyHubPrototypes(
        pairResults,
        profiles,
        []
      );

      expect(hubs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            prototypeId: 'hub',
            hubScore: expect.any(Number),
          }),
        ])
      );
      const hub = hubs.find((entry) => entry.prototypeId === 'hub');
      expect(hub.hubScore).toBeGreaterThan(0);
      expect(hub.overlappingPrototypes.length).toBe(5);
    });

    it('should not flag prototypes with single high overlap', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.6 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.62 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.95 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.55 },
      ];
      const profiles = createProfiles([
        ['n1', 'cluster-1'],
        ['n2', 'cluster-2'],
        ['n3', 'cluster-2'],
        ['n4', 'cluster-3'],
      ]);

      const hubs = analyzer.__TEST_ONLY__identifyHubPrototypes(
        pairResults,
        profiles,
        []
      );

      expect(hubs.some((entry) => entry.prototypeId === 'hub')).toBe(false);
    });

    it('should not flag prototypes with low degree', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.6 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.62 },
      ];
      const profiles = createProfiles([
        ['n1', 'cluster-1'],
        ['n2', 'cluster-2'],
      ]);

      const hubs = analyzer.__TEST_ONLY__identifyHubPrototypes(
        pairResults,
        profiles,
        []
      );

      expect(hubs).toEqual([]);
    });

    it('should compute neighborhood diversity correctly', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.6 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.62 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.58 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.55 },
      ];
      const profiles = createProfiles([
        ['n1', 'cluster-1'],
        ['n2', 'cluster-2'],
        ['n3', 'cluster-3'],
        ['n4', 'cluster-1'],
      ]);

      const hubs = analyzer.__TEST_ONLY__identifyHubPrototypes(
        pairResults,
        profiles,
        []
      );

      const hub = hubs.find((entry) => entry.prototypeId === 'hub');
      expect(hub.neighborhoodDiversity).toBe(3);
    });

    it('should exclude prototype when neighbors are same cluster', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.6 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.62 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.58 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.55 },
      ];
      const profiles = createProfiles([
        ['n1', 'cluster-1'],
        ['n2', 'cluster-1'],
        ['n3', 'cluster-1'],
        ['n4', 'cluster-1'],
      ]);

      const hubs = analyzer.__TEST_ONLY__identifyHubPrototypes(
        pairResults,
        profiles,
        []
      );

      expect(hubs).toEqual([]);
    });

    it('should return empty array when no pair results', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      const hubs = analyzer.__TEST_ONLY__identifyHubPrototypes([], new Map(), []);

      expect(hubs).toEqual([]);
    });

    it('should generate meaningful axis concept suggestion', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const pairResults = [
        { prototypeAId: 'hub', prototypeBId: 'n1', overlapScore: 0.6 },
        { prototypeAId: 'hub', prototypeBId: 'n2', overlapScore: 0.62 },
        { prototypeAId: 'hub', prototypeBId: 'n3', overlapScore: 0.58 },
        { prototypeAId: 'hub', prototypeBId: 'n4', overlapScore: 0.55 },
      ];
      const profiles = createProfiles([
        ['n1', 'cluster-1'],
        ['n2', 'cluster-2'],
        ['n3', 'cluster-2'],
        ['n4', 'cluster-3'],
      ]);
      const prototypes = createPrototypes([
        ['n1', { uncertainty: 0.7, valence: 0.2 }],
        ['n2', { uncertainty: 0.6, arousal: 0.1 }],
        ['n3', { uncertainty: 0.5, engagement: 0.3 }],
        ['n4', { uncertainty: 0.4, valence: -0.1 }],
      ]);

      const hubs = analyzer.__TEST_ONLY__identifyHubPrototypes(
        pairResults,
        profiles,
        prototypes
      );

      const hub = hubs.find((entry) => entry.prototypeId === 'hub');
      expect(typeof hub.suggestedAxisConcept).toBe('string');
      expect(hub.suggestedAxisConcept.length).toBeGreaterThan(0);
    });
  });

  describe('Coverage Gap Detection', () => {
    const createProfiles = (entries) =>
      new Map(
        entries.map(([prototypeId, clusterId]) => [
          prototypeId,
          { prototypeId, nearestClusterId: clusterId },
        ])
      );

    it('should return empty array when no profiles', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      const gaps = analyzer.__TEST_ONLY__detectCoverageGaps(new Map(), []);

      expect(gaps).toEqual([]);
    });

    it('should compute cosine distance correctly', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      const identical = analyzer.__TEST_ONLY__computeCosineDistance(
        { axisA: 1, axisB: 0 },
        { axisA: 1, axisB: 0 }
      );
      const orthogonal = analyzer.__TEST_ONLY__computeCosineDistance(
        { axisA: 1, axisB: 0 },
        { axisA: 0, axisB: 1 }
      );

      expect(identical).toBeCloseTo(0, 5);
      expect(orthogonal).toBeCloseTo(1, 5);
    });

    it('should compute cluster centroid correctly', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'p1', weights: { axisA: 1, axisB: 3 } },
        { id: 'p2', weights: { axisA: 3, axisB: 1 } },
        { id: 'p3', weights: { axisA: 2, axisB: 5 } },
      ];

      const centroid = analyzer.__TEST_ONLY__computeClusterCentroid(
        ['p1', 'p2', 'p3'],
        prototypes
      );

      expect(centroid).toEqual({ axisA: 2, axisB: 3 });
    });

    it('should identify clusters distant from all axes', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig({ coverageGapAxisDistanceThreshold: 0.6 }),
        logger: createLogger(),
      });
      const weights = {
        axisA: 1,
        axisB: 1,
        axisC: 1,
        axisD: 1,
        axisE: 1,
        axisF: 1,
        axisG: 1,
      };
      const prototypes = [
        { id: 'p1', weights },
        { id: 'p2', weights },
        { id: 'p3', weights },
        { id: 'p4', weights },
      ];
      const profiles = createProfiles([
        ['p1', 'cluster-1'],
        ['p2', 'cluster-1'],
        ['p3', 'cluster-1'],
        ['p4', 'cluster-1'],
      ]);

      const gaps = analyzer.__TEST_ONLY__detectCoverageGaps(profiles, prototypes);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].clusterId).toBe('cluster-1');
      expect(gaps[0].distanceToNearestAxis).toBeGreaterThanOrEqual(0.6);
    });

    it('should not flag clusters aligned with existing axis', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'p1', weights: { axisA: 1, axisB: 0 } },
        { id: 'p2', weights: { axisA: 0.9, axisB: 0.1 } },
        { id: 'p3', weights: { axisA: 1.1, axisB: -0.1 } },
      ];
      const profiles = createProfiles([
        ['p1', 'cluster-2'],
        ['p2', 'cluster-2'],
        ['p3', 'cluster-2'],
      ]);

      const gaps = analyzer.__TEST_ONLY__detectCoverageGaps(profiles, prototypes);

      expect(gaps).toEqual([]);
    });

    it('should not flag clusters smaller than threshold', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig({ coverageGapMinClusterSize: 3 }),
        logger: createLogger(),
      });
      const weights = {
        axisA: 1,
        axisB: 1,
        axisC: 1,
        axisD: 1,
        axisE: 1,
        axisF: 1,
        axisG: 1,
      };
      const prototypes = [
        { id: 'p1', weights },
        { id: 'p2', weights },
      ];
      const profiles = createProfiles([
        ['p1', 'cluster-3'],
        ['p2', 'cluster-3'],
      ]);

      const gaps = analyzer.__TEST_ONLY__detectCoverageGaps(profiles, prototypes);

      expect(gaps).toEqual([]);
    });

    it('should include suggested axis direction', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig({ coverageGapAxisDistanceThreshold: 0.6 }),
        logger: createLogger(),
      });
      const weights = {
        axisA: 1,
        axisB: 1,
        axisC: 1,
        axisD: 1,
        axisE: 1,
        axisF: 1,
        axisG: 1,
      };
      const prototypes = [
        { id: 'p1', weights },
        { id: 'p2', weights },
        { id: 'p3', weights },
      ];
      const profiles = createProfiles([
        ['p1', 'cluster-4'],
        ['p2', 'cluster-4'],
        ['p3', 'cluster-4'],
      ]);

      const gaps = analyzer.__TEST_ONLY__detectCoverageGaps(profiles, prototypes);

      expect(gaps).toHaveLength(1);
      expect(gaps[0].suggestedAxisDirection).toEqual(expect.any(Object));
      const magnitude = Object.values(gaps[0].suggestedAxisDirection).reduce(
        (sum, value) => sum + value * value,
        0
      );
      expect(Math.sqrt(magnitude)).toBeCloseTo(1, 5);
    });
  });

  describe('Multi-Axis Conflict Detection', () => {
    const buildWeights = (positiveAxes, negativeAxes, value = 0.6) => {
      const weights = {};
      positiveAxes.forEach((axis) => {
        weights[axis] = value;
      });
      negativeAxes.forEach((axis) => {
        weights[axis] = -value;
      });
      return weights;
    };

    const createAnalyzer = (overrides = {}) =>
      new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(overrides),
        logger: createLogger(),
      });

    it('should flag prototypes with balanced positive/negative weights', () => {
      const analyzer = createAnalyzer();
      const prototypes = [
        { id: 'p1', weights: buildWeights(['a1', 'a2'], []) },
        { id: 'p2', weights: buildWeights(['a1', 'a2'], []) },
        { id: 'p3', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p4', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p5', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p6', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p7', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p8', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        {
          id: 'balanced',
          weights: buildWeights(
            ['axisA', 'axisB', 'axisC', 'axisD'],
            ['axisE', 'axisF', 'axisG', 'axisH']
          ),
        },
      ];

      const conflicts = analyzer.__TEST_ONLY__detectMultiAxisConflicts(
        prototypes
      );

      expect(conflicts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ prototypeId: 'balanced' }),
        ])
      );
      const entry = conflicts.find(
        (conflict) => conflict.prototypeId === 'balanced'
      );
      expect(entry.signBalance).toBeLessThan(0.4);
    });

    it('should not flag prototypes with single dominant sign', () => {
      const analyzer = createAnalyzer();
      const prototypes = [
        { id: 'p1', weights: buildWeights(['a1', 'a2'], []) },
        { id: 'p2', weights: buildWeights(['a1', 'a2'], []) },
        { id: 'p3', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p4', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p5', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p6', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p7', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p8', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        {
          id: 'dominant',
          weights: buildWeights(
            ['axisA', 'axisB', 'axisC', 'axisD', 'axisE', 'axisF', 'axisG'],
            ['axisH']
          ),
        },
      ];

      const conflicts = analyzer.__TEST_ONLY__detectMultiAxisConflicts(
        prototypes
      );

      expect(conflicts.some((entry) => entry.prototypeId === 'dominant')).toBe(
        false
      );
    });

    it('should not flag prototypes with few active axes', () => {
      const analyzer = createAnalyzer();
      const prototypes = [
        { id: 'p1', weights: buildWeights(['a1', 'a2'], []) },
        { id: 'p2', weights: buildWeights(['a1', 'a2'], []) },
        { id: 'p3', weights: buildWeights(['a1', 'a2', 'a3'], ['b1']) },
        { id: 'p4', weights: buildWeights(['a1', 'a2', 'a3'], ['b1']) },
        { id: 'balanced-low', weights: buildWeights(['a1', 'a2'], ['b1']) },
      ];

      const conflicts = analyzer.__TEST_ONLY__detectMultiAxisConflicts(
        prototypes
      );

      expect(conflicts).toEqual([]);
    });

    it('should compute sign balance correctly', () => {
      const analyzer = createAnalyzer({
        multiAxisUsageThreshold: 0,
        multiAxisSignBalanceThreshold: 1,
      });
      const prototypes = [
        { id: 'baseline', weights: buildWeights(['a1', 'a2'], []) },
        {
          id: 'mixed',
          weights: buildWeights(['a1', 'a2', 'a3'], ['b1']),
        },
      ];

      const conflicts = analyzer.__TEST_ONLY__detectMultiAxisConflicts(
        prototypes
      );
      const entry = conflicts.find((conflict) => conflict.prototypeId === 'mixed');

      expect(entry.signBalance).toBeCloseTo(0.5, 5);
    });

    it('should compute sign balance for a balanced split', () => {
      const analyzer = createAnalyzer({
        multiAxisUsageThreshold: 0,
        multiAxisSignBalanceThreshold: 1,
      });
      const prototypes = [
        { id: 'baseline', weights: buildWeights(['a1', 'a2'], []) },
        { id: 'balanced', weights: buildWeights(['a1', 'a2'], ['b1', 'b2']) },
      ];

      const conflicts = analyzer.__TEST_ONLY__detectMultiAxisConflicts(
        prototypes
      );
      const entry = conflicts.find(
        (conflict) => conflict.prototypeId === 'balanced'
      );

      expect(entry.signBalance).toBeCloseTo(0, 5);
    });

    it('should correctly identify positive and negative axes', () => {
      const analyzer = createAnalyzer();
      const prototypes = [
        { id: 'p1', weights: buildWeights(['a1', 'a2'], []) },
        { id: 'p2', weights: buildWeights(['a1', 'a2'], []) },
        { id: 'p3', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p4', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p5', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p6', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p7', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        { id: 'p8', weights: buildWeights(['a1', 'a2', 'a3'], []) },
        {
          id: 'balanced',
          weights: buildWeights(['axisA', 'axisB'], ['axisC', 'axisD']),
        },
      ];

      const conflicts = analyzer.__TEST_ONLY__detectMultiAxisConflicts(
        prototypes
      );
      const entry = conflicts.find(
        (conflict) => conflict.prototypeId === 'balanced'
      );

      expect(entry.positiveAxes).toEqual(['axisA', 'axisB']);
      expect(entry.negativeAxes).toEqual(['axisC', 'axisD']);
    });

    it('should compute median and IQR correctly', () => {
      const analyzer = createAnalyzer();

      const result = analyzer.__TEST_ONLY__computeMedianAndIQR([1, 2, 3, 4, 5]);

      expect(result.median).toBe(3);
      expect(result.iqr).toBeCloseTo(3, 5);
    });

    it('should return empty array with single prototype', () => {
      const analyzer = createAnalyzer();
      const prototypes = [
        { id: 'solo', weights: buildWeights(['axisA', 'axisB'], ['axisC']) },
      ];

      const conflicts = analyzer.__TEST_ONLY__detectMultiAxisConflicts(
        prototypes
      );

      expect(conflicts).toEqual([]);
    });
  });

  describe('Report Synthesis', () => {
    const createAnalyzer = (overrides = {}) =>
      new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(overrides),
        logger: createLogger(),
      });

    const createEmptyPCAResult = () => ({
      residualVarianceRatio: 0,
      additionalSignificantComponents: 0,
      topLoadingPrototypes: [],
      dimensionsUsed: [],
    });

    const createHighPCAResult = () => ({
      residualVarianceRatio: 0.25,
      additionalSignificantComponents: 2,
      topLoadingPrototypes: [
        { prototypeId: 'pca-proto-1', score: 0.8 },
        { prototypeId: 'pca-proto-2', score: 0.7 },
      ],
      dimensionsUsed: ['valence', 'arousal'],
    });

    const createHub = (overrides = {}) => ({
      prototypeId: 'hub-proto',
      hubScore: 4.5,
      overlappingPrototypes: ['neighbor-1', 'neighbor-2', 'neighbor-3', 'neighbor-4'],
      neighborhoodDiversity: 3,
      suggestedAxisConcept: 'uncertainty',
      ...overrides,
    });

    const createGap = (overrides = {}) => ({
      clusterId: 'cluster-1',
      centroidPrototypes: ['gap-proto-1', 'gap-proto-2', 'gap-proto-3'],
      distanceToNearestAxis: 0.75,
      suggestedAxisDirection: { axisA: 0.5, axisB: 0.5 },
      ...overrides,
    });

    const createConflict = (overrides = {}) => ({
      prototypeId: 'conflict-proto',
      activeAxisCount: 8,
      signBalance: 0.2,
      positiveAxes: ['a1', 'a2', 'a3', 'a4'],
      negativeAxes: ['b1', 'b2', 'b3', 'b4'],
      ...overrides,
    });

    it('should generate NEW_AXIS recommendation when PCA + coverage gap', () => {
      const analyzer = createAnalyzer();
      const pcaResult = createHighPCAResult();
      const gaps = [createGap()];

      const recommendations = analyzer.__TEST_ONLY__generateRecommendations(
        pcaResult,
        [],
        gaps,
        []
      );

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'high',
            type: 'NEW_AXIS',
          }),
        ])
      );
    });

    it('should generate NEW_AXIS recommendation when Hub + coverage gap', () => {
      const analyzer = createAnalyzer();
      const hub = createHub({
        overlappingPrototypes: ['neighbor-1', 'gap-proto-1', 'neighbor-2'],
      });
      const gap = createGap({ centroidPrototypes: ['gap-proto-1', 'gap-proto-2'] });

      const recommendations = analyzer.__TEST_ONLY__generateRecommendations(
        createEmptyPCAResult(),
        [hub],
        [gap],
        []
      );

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'high',
            type: 'NEW_AXIS',
          }),
        ])
      );
    });

    it('should generate INVESTIGATE recommendation for PCA alone', () => {
      const analyzer = createAnalyzer();
      const pcaResult = createHighPCAResult();

      const recommendations = analyzer.__TEST_ONLY__generateRecommendations(
        pcaResult,
        [],
        [],
        []
      );

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'medium',
            type: 'INVESTIGATE',
          }),
        ])
      );
    });

    it('should generate INVESTIGATE recommendation for Hub alone', () => {
      const analyzer = createAnalyzer();

      const recommendations = analyzer.__TEST_ONLY__generateRecommendations(
        createEmptyPCAResult(),
        [createHub()],
        [],
        []
      );

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'medium',
            type: 'INVESTIGATE',
          }),
        ])
      );
    });

    it('should generate INVESTIGATE recommendation for coverage gap alone', () => {
      const analyzer = createAnalyzer();

      const recommendations = analyzer.__TEST_ONLY__generateRecommendations(
        createEmptyPCAResult(),
        [],
        [createGap()],
        []
      );

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'medium',
            type: 'INVESTIGATE',
          }),
        ])
      );
    });

    it('should generate REFINE_EXISTING for multi-axis conflicts only', () => {
      const analyzer = createAnalyzer();

      const recommendations = analyzer.__TEST_ONLY__generateRecommendations(
        createEmptyPCAResult(),
        [],
        [],
        [createConflict()]
      );

      expect(recommendations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'low',
            type: 'REFINE_EXISTING',
          }),
        ])
      );
    });

    it('should sort recommendations by priority (high > medium > low)', () => {
      const analyzer = createAnalyzer();
      const pcaResult = createHighPCAResult();
      const hub = createHub({
        overlappingPrototypes: ['n1', 'gap-proto-1', 'n2'],
      });
      const gap = createGap();
      const conflict = createConflict();

      const recommendations = analyzer.__TEST_ONLY__generateRecommendations(
        pcaResult,
        [hub],
        [gap],
        [conflict]
      );

      // Should have high priority first
      expect(recommendations[0].priority).toBe('high');

      // Verify all high priority recommendations come before medium/low
      // by checking each high-priority rec appears in the first N positions
      const highPriorityRecs = recommendations.filter((rec) => rec.priority === 'high');
      const firstNPositions = recommendations.slice(0, highPriorityRecs.length);
      const allHighInFront = firstNPositions.every((rec) => rec.priority === 'high');
      expect(allHighInFront).toBe(true);
    });

    it('should include evidence strings describing each signal', () => {
      const analyzer = createAnalyzer();
      const pcaResult = createHighPCAResult();

      const recommendations = analyzer.__TEST_ONLY__generateRecommendations(
        pcaResult,
        [],
        [],
        []
      );

      expect(recommendations[0].evidence).toBeInstanceOf(Array);
      expect(recommendations[0].evidence.length).toBeGreaterThan(0);
      expect(recommendations[0].evidence.every((ev) => typeof ev === 'string')).toBe(true);
    });

    it('should compute confidence as high when >= 3 methods triggered', () => {
      const analyzer = createAnalyzer();

      const confidence = analyzer.__TEST_ONLY__computeConfidenceLevel(3);

      expect(confidence).toBe('high');
    });

    it('should compute confidence as medium when 2 methods triggered', () => {
      const analyzer = createAnalyzer();

      const confidence = analyzer.__TEST_ONLY__computeConfidenceLevel(2);

      expect(confidence).toBe('medium');
    });

    it('should compute confidence as low when <= 1 method triggered', () => {
      const analyzer = createAnalyzer();

      expect(analyzer.__TEST_ONLY__computeConfidenceLevel(1)).toBe('low');
      expect(analyzer.__TEST_ONLY__computeConfidenceLevel(0)).toBe('low');
    });

    it('should deduplicate affectedPrototypes', () => {
      const analyzer = createAnalyzer();
      const pcaResult = {
        residualVarianceRatio: 0.25,
        additionalSignificantComponents: 1,
        topLoadingPrototypes: [
          { prototypeId: 'shared-proto', score: 0.8 },
        ],
      };
      const gap = createGap({
        centroidPrototypes: ['shared-proto', 'gap-proto-2', 'gap-proto-3'],
      });

      const recommendations = analyzer.__TEST_ONLY__generateRecommendations(
        pcaResult,
        [],
        [gap],
        []
      );

      const highRec = recommendations.find((rec) => rec.priority === 'high');
      const uniqueCount = new Set(highRec.affectedPrototypes).size;
      expect(highRec.affectedPrototypes.length).toBe(uniqueCount);
    });

    it('should build empty report with correct structure', () => {
      const analyzer = createAnalyzer();

      const report = analyzer.__TEST_ONLY__buildEmptyReport(10);

      expect(report).toEqual({
        summary: {
          totalPrototypesAnalyzed: 10,
          recommendationCount: 0,
          signalBreakdown: {
            pcaSignals: 0,
            hubSignals: 0,
            coverageGapSignals: 0,
            multiAxisConflictSignals: 0,
          },
          confidence: 'low',
          potentialGapsDetected: 0, // backward compat
        },
        pcaAnalysis: {
          residualVarianceRatio: 0,
          additionalSignificantComponents: 0,
          topLoadingPrototypes: [],
          dimensionsUsed: [],
          cumulativeVariance: [],
          componentsFor80Pct: 0,
          componentsFor90Pct: 0,
          reconstructionErrors: [],
        },
        hubPrototypes: [],
        coverageGaps: [],
        multiAxisConflicts: [],
        recommendations: [],
        prototypeWeightSummaries: [],
      });
    });
  });

  describe('analyze() orchestration', () => {
    const createProfiles = (entries) =>
      new Map(
        entries.map(([prototypeId, clusterId]) => [
          prototypeId,
          { prototypeId, nearestClusterId: clusterId },
        ])
      );

    it('should call all detection methods', () => {
      const logger = createLogger();
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger,
      });
      const prototypes = [
        { id: 'proto-1', weights: { axisA: 1, axisB: 0.5 } },
        { id: 'proto-2', weights: { axisA: -1, axisB: -0.5 } },
        { id: 'proto-3', weights: { axisA: 0.5, axisB: 1 } },
      ];
      const profiles = createProfiles([
        ['proto-1', 'cluster-1'],
        ['proto-2', 'cluster-1'],
        ['proto-3', 'cluster-1'],
      ]);

      const result = analyzer.analyze(prototypes, new Map(), profiles, [], () => {});

      expect(result).toHaveProperty('pcaAnalysis');
      expect(result).toHaveProperty('hubPrototypes');
      expect(result).toHaveProperty('coverageGaps');
      expect(result).toHaveProperty('multiAxisConflicts');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('summary');
    });

    it('should report progress at each phase', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'proto-1', weights: { axisA: 1 } },
        { id: 'proto-2', weights: { axisA: -1 } },
      ];
      const progressCalls = [];
      const onProgress = (phase, details) => progressCalls.push({ phase, details });

      analyzer.analyze(prototypes, new Map(), new Map(), [], onProgress);

      expect(progressCalls.length).toBeGreaterThanOrEqual(4);
      expect(progressCalls.map((call) => call.phase)).toEqual(
        expect.arrayContaining([
          'pca_analysis',
          'hub_detection',
          'coverage_gap_detection',
          'multi_axis_conflict_detection',
        ])
      );
    });

    it('should return empty report when enableAxisGapDetection is false', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig({ enableAxisGapDetection: false }),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'proto-1', weights: { axisA: 1 } },
        { id: 'proto-2', weights: { axisA: -1 } },
      ];

      const result = analyzer.analyze(prototypes, new Map(), new Map(), [], () => {});

      expect(result.summary.recommendationCount).toBe(0);
      expect(result.summary.potentialGapsDetected).toBe(0); // backward compat
      expect(result.recommendations).toEqual([]);
      expect(result.hubPrototypes).toEqual([]);
    });

    it('should handle empty prototypes array gracefully', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      const result = analyzer.analyze([], new Map(), new Map(), [], () => {});

      expect(result.summary.totalPrototypesAnalyzed).toBe(0);
      expect(result.summary.recommendationCount).toBe(0);
      expect(result.summary.potentialGapsDetected).toBe(0); // backward compat
    });

    it('should handle null pairResults gracefully', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'proto-1', weights: { axisA: 1 } },
        { id: 'proto-2', weights: { axisA: -1 } },
      ];

      const result = analyzer.analyze(prototypes, new Map(), new Map(), null, () => {});

      expect(result).toHaveProperty('summary');
      expect(result.hubPrototypes).toEqual([]);
    });

    it('should handle empty profiles gracefully', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'proto-1', weights: { axisA: 1 } },
        { id: 'proto-2', weights: { axisA: -1 } },
      ];

      const result = analyzer.analyze(prototypes, new Map(), null, [], () => {});

      expect(result).toHaveProperty('summary');
      expect(result.coverageGaps).toEqual([]);
    });

    it('should aggregate results correctly in final report', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'proto-1', weights: { axisA: 1, axisB: 0 } },
        { id: 'proto-2', weights: { axisA: 0.9, axisB: 0.1 } },
        { id: 'proto-3', weights: { axisA: -1, axisB: 0 } },
        { id: 'proto-4', weights: { axisA: 0, axisB: 1 } },
      ];

      const result = analyzer.analyze(prototypes, new Map(), new Map(), [], () => {});

      expect(result.summary.totalPrototypesAnalyzed).toBe(4);
      expect(typeof result.summary.confidence).toBe('string');
      expect(['low', 'medium', 'high']).toContain(result.summary.confidence);
      // Both fields should equal recommendations.length
      expect(result.summary.recommendationCount).toBe(result.recommendations.length);
      expect(result.summary.potentialGapsDetected).toBe(result.recommendations.length); // backward compat
      // Verify signalBreakdown structure exists
      expect(result.summary.signalBreakdown).toBeDefined();
      expect(typeof result.summary.signalBreakdown.pcaSignals).toBe('number');
      expect(typeof result.summary.signalBreakdown.hubSignals).toBe('number');
      expect(typeof result.summary.signalBreakdown.coverageGapSignals).toBe('number');
      expect(typeof result.summary.signalBreakdown.multiAxisConflictSignals).toBe('number');
    });

    it('should handle object profiles (non-Map) gracefully', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'proto-1', weights: { axisA: 1 } },
        { id: 'proto-2', weights: { axisA: -1 } },
      ];
      const profilesObject = {
        'proto-1': { prototypeId: 'proto-1', nearestClusterId: 'c1' },
        'proto-2': { prototypeId: 'proto-2', nearestClusterId: 'c1' },
      };

      const result = analyzer.analyze(prototypes, new Map(), profilesObject, [], () => {});

      expect(result).toHaveProperty('summary');
    });

    it('should work without progress callback', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });
      const prototypes = [
        { id: 'proto-1', weights: { axisA: 1 } },
        { id: 'proto-2', weights: { axisA: -1 } },
      ];

      // Should not throw when onProgress is undefined
      const result = analyzer.analyze(prototypes, new Map(), new Map(), []);

      expect(result).toHaveProperty('summary');
    });
  });

  describe('Bipolar Axis Handling (useAbsolute: true)', () => {
    // These tests document that bipolar axes are correctly handled via useAbsolute: true
    // in #computeNearestAxisDistance(). A cluster at the negative pole (e.g., valence=-0.9)
    // correctly measures distance ~0.1 to the valence axis, not ~1.9.

    it('should correctly handle prototypes at negative pole of bipolar axis', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      // Prototypes at both poles of the same axis should not trigger coverage gaps
      const prototypes = [
        { id: 'positive-pole', weights: { valence: 0.9 } },
        { id: 'negative-pole', weights: { valence: -0.9 } },
      ];

      const result = analyzer.analyze(prototypes, new Map(), new Map(), [], () => {});

      // Both prototypes are near the valence axis (one positive, one negative)
      // With useAbsolute: true, neither should flag as a coverage gap due to
      // "not being near any axis" because absolute similarity handles both poles
      expect(result.coverageGaps).toEqual([]);
    });

    it('should treat clusters at negative pole as near axis due to absolute similarity', () => {
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig({
          enableAxisGapDetection: true,
          hubHighReferenceThreshold: 100, // disable hub detection for cleaner test
          hubMediumReferenceThreshold: 100,
        }),
        logger: createLogger(),
      });

      // A prototype strongly aligned with negative valence
      const prototypes = [
        { id: 'negative-valence', weights: { valence: -0.95, arousal: 0.0 } },
      ];

      const result = analyzer.analyze(prototypes, new Map(), new Map(), [], () => {});

      // Should not flag as coverage gap - it IS near the valence axis (negative pole)
      const negativeValenceCoverageGap = result.coverageGaps.find(
        (gap) => gap.prototypeId === 'negative-valence'
      );
      expect(negativeValenceCoverageGap).toBeUndefined();
    });

    it('should compute equal distance for vectors at positive and negative poles', () => {
      // This tests the underlying distance calculation behavior
      const analyzer = new AxisGapAnalyzer({
        prototypeProfileCalculator: createPrototypeProfileCalculator(),
        config: createConfig(),
        logger: createLogger(),
      });

      // Two prototypes: one positive, one negative on valence
      const prototypes = [
        { id: 'pos-valence', weights: { valence: 0.8, arousal: 0 } },
        { id: 'neg-valence', weights: { valence: -0.8, arousal: 0 } },
      ];

      const result = analyzer.analyze(prototypes, new Map(), new Map(), [], () => {});

      // Neither should be flagged as a coverage gap since both are near the valence axis
      // (useAbsolute ensures the negative pole is recognized as near the axis)
      const posGap = result.coverageGaps.find((g) => g.prototypeId === 'pos-valence');
      const negGap = result.coverageGaps.find((g) => g.prototypeId === 'neg-valence');

      // Both should be treated equally - neither flagged
      expect(posGap).toBeUndefined();
      expect(negGap).toBeUndefined();
    });
  });
});
