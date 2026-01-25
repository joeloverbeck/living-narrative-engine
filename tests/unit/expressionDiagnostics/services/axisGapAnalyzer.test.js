/**
 * @file Unit tests for AxisGapAnalyzer orchestrator.
 * @description Tests the slim orchestrator that coordinates sub-services.
 *
 * Note: The heavy lifting tests have been migrated to sub-service test files:
 * - PCAAnalysisService.test.js
 * - HubPrototypeDetector.test.js
 * - CoverageGapDetector.test.js
 * - MultiAxisConflictDetector.test.js
 * - AxisGapRecommendationBuilder.test.js
 * - AxisGapReportSynthesizer.test.js
 */

import { describe, expect, it, jest, beforeEach } from '@jest/globals';
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

const createPCAAnalysisService = (result = null) => ({
  analyze: jest.fn().mockReturnValue(
    result ?? {
      residualVarianceRatio: 0.1,
      additionalSignificantComponents: 0,
      topLoadingPrototypes: [],
      cumulativeVariance: [],
      componentsFor80Pct: 0,
      componentsFor90Pct: 0,
      reconstructionErrors: [],
    }
  ),
});

const createHubPrototypeDetector = (result = null) => ({
  detect: jest.fn().mockReturnValue({ hubs: result ?? [], diagnostics: null }),
});

const createCoverageGapDetector = (result = null) => ({
  detect: jest.fn().mockReturnValue(result ?? []),
});

const createMultiAxisConflictDetector = (result = null) => ({
  detect: jest.fn().mockReturnValue(
    result ?? {
      conflicts: [],
      highAxisLoadings: [],
      signTensions: [],
    }
  ),
});

const createReportSynthesizer = (result = null) => ({
  synthesize: jest.fn().mockReturnValue(
    result ?? {
      summary: {
        totalPrototypesAnalyzed: 0,
        recommendationCount: 0,
        signalBreakdown: {},
        confidence: 'low',
        potentialGapsDetected: 0,
      },
      pcaAnalysis: {},
      hubPrototypes: [],
      coverageGaps: [],
      multiAxisConflicts: [],
      highAxisLoadings: [],
      signTensions: [],
      recommendations: [],
      prototypeWeightSummaries: [],
    }
  ),
  buildEmptyReport: jest.fn().mockReturnValue({
    summary: {
      totalPrototypesAnalyzed: 0,
      recommendationCount: 0,
      signalBreakdown: {},
      confidence: 'low',
      potentialGapsDetected: 0,
    },
    pcaAnalysis: {},
    hubPrototypes: [],
    coverageGaps: [],
    multiAxisConflicts: [],
    highAxisLoadings: [],
    signTensions: [],
    recommendations: [],
    prototypeWeightSummaries: [],
  }),
});

const createConfig = (overrides = {}) => ({
  enableAxisGapDetection: true,
  activeAxisEpsilon: 0.05,
  pcaResidualVarianceThreshold: 0.15,
  pcaKaiserThreshold: 1.0,
  hubMinDegree: 4,
  hubMaxEdgeWeight: 0.9,
  hubMinNeighborhoodDiversity: 2,
  coverageGapAxisDistanceThreshold: 0.6,
  coverageGapMinClusterSize: 3,
  multiAxisUsageThreshold: 1.5,
  multiAxisSignBalanceThreshold: 0.4,
  highAxisLoadingThreshold: 1.5,
  signTensionMinMagnitude: 0.2,
  signTensionMinHighAxes: 2,
  ...overrides,
});

const createValidDeps = (overrides = {}) => ({
  prototypeProfileCalculator: createPrototypeProfileCalculator(),
  pcaAnalysisService: createPCAAnalysisService(),
  hubPrototypeDetector: createHubPrototypeDetector(),
  coverageGapDetector: createCoverageGapDetector(),
  multiAxisConflictDetector: createMultiAxisConflictDetector(),
  reportSynthesizer: createReportSynthesizer(),
  config: createConfig(),
  logger: createLogger(),
  ...overrides,
});

describe('AxisGapAnalyzer', () => {
  describe('constructor', () => {
    it('should accept valid dependencies', () => {
      const analyzer = new AxisGapAnalyzer(createValidDeps());
      expect(analyzer).toBeInstanceOf(AxisGapAnalyzer);
    });

    it('should throw when logger is missing', () => {
      expect(() => new AxisGapAnalyzer(createValidDeps({ logger: null }))).toThrow();
    });

    it('should throw when logger lacks required methods', () => {
      expect(
        () => new AxisGapAnalyzer(createValidDeps({ logger: { debug: jest.fn() } }))
      ).toThrow();
    });

    it('should throw when prototypeProfileCalculator is missing', () => {
      expect(
        () => new AxisGapAnalyzer(createValidDeps({ prototypeProfileCalculator: null }))
      ).toThrow();
    });

    it('should throw when prototypeProfileCalculator lacks calculateAll', () => {
      expect(
        () => new AxisGapAnalyzer(createValidDeps({ prototypeProfileCalculator: {} }))
      ).toThrow();
    });

    it('should throw when pcaAnalysisService is missing', () => {
      expect(
        () => new AxisGapAnalyzer(createValidDeps({ pcaAnalysisService: null }))
      ).toThrow();
    });

    it('should throw when hubPrototypeDetector is missing', () => {
      expect(
        () => new AxisGapAnalyzer(createValidDeps({ hubPrototypeDetector: null }))
      ).toThrow();
    });

    it('should throw when coverageGapDetector is missing', () => {
      expect(
        () => new AxisGapAnalyzer(createValidDeps({ coverageGapDetector: null }))
      ).toThrow();
    });

    it('should throw when multiAxisConflictDetector is missing', () => {
      expect(
        () => new AxisGapAnalyzer(createValidDeps({ multiAxisConflictDetector: null }))
      ).toThrow();
    });

    it('should throw when reportSynthesizer is missing', () => {
      expect(
        () => new AxisGapAnalyzer(createValidDeps({ reportSynthesizer: null }))
      ).toThrow();
    });

    it('should throw when config is missing', () => {
      expect(() => new AxisGapAnalyzer(createValidDeps({ config: null }))).toThrow(
        'AxisGapAnalyzer requires config object'
      );
    });
  });

  describe('analyze', () => {
    let analyzer;
    let deps;

    beforeEach(() => {
      deps = createValidDeps();
      analyzer = new AxisGapAnalyzer(deps);
    });

    describe('feature flag', () => {
      it('should return empty report when axis gap detection is disabled', () => {
        deps = createValidDeps({ config: createConfig({ enableAxisGapDetection: false }) });
        analyzer = new AxisGapAnalyzer(deps);

        const result = analyzer.analyze([], null, null, null);

        expect(deps.reportSynthesizer.buildEmptyReport).toHaveBeenCalledWith(0);
        expect(result).toBeDefined();
      });

      it('should proceed with analysis when axis gap detection is enabled', () => {
        const prototypes = [{ id: 'p1', weights: { axis1: 0.5 } }];

        analyzer.analyze(prototypes, null, null, null);

        expect(deps.pcaAnalysisService.analyze).toHaveBeenCalled();
      });
    });

    describe('input handling', () => {
      it('should handle null prototypes by returning empty report', () => {
        analyzer.analyze(null, null, null, null);

        expect(deps.reportSynthesizer.buildEmptyReport).toHaveBeenCalledWith(0);
      });

      it('should handle empty prototypes by returning empty report', () => {
        analyzer.analyze([], null, null, null);

        expect(deps.reportSynthesizer.buildEmptyReport).toHaveBeenCalledWith(0);
      });

      it('should coerce profiles from object to Map', () => {
        const prototypes = [{ id: 'p1', weights: { axis1: 0.5 } }];
        const profiles = { p1: { nearestClusterId: 'c1' } };

        analyzer.analyze(prototypes, null, profiles, null);

        expect(deps.hubPrototypeDetector.detect).toHaveBeenCalledWith(
          expect.anything(),
          expect.any(Map),
          expect.anything()
        );
      });

      it('should coerce pairResults from null to empty array', () => {
        const prototypes = [{ id: 'p1', weights: { axis1: 0.5 } }];

        analyzer.analyze(prototypes, null, null, null);

        expect(deps.hubPrototypeDetector.detect).toHaveBeenCalledWith(
          [],
          expect.anything(),
          expect.anything()
        );
      });
    });

    describe('sub-service delegation', () => {
      const prototypes = [
        { id: 'p1', weights: { axis1: 0.5 } },
        { id: 'p2', weights: { axis1: 0.3 } },
      ];
      const profiles = new Map([
        ['p1', { nearestClusterId: 'c1' }],
        ['p2', { nearestClusterId: 'c2' }],
      ]);
      const pairResults = [{ prototypeAId: 'p1', prototypeBId: 'p2' }];

      it('should delegate PCA analysis to pcaAnalysisService', () => {
        analyzer.analyze(prototypes, null, profiles, pairResults);

        expect(deps.pcaAnalysisService.analyze).toHaveBeenCalledWith(prototypes);
      });

      it('should delegate hub detection to hubPrototypeDetector', () => {
        analyzer.analyze(prototypes, null, profiles, pairResults);

        expect(deps.hubPrototypeDetector.detect).toHaveBeenCalledWith(
          pairResults,
          profiles,
          prototypes
        );
      });

      it('should delegate coverage gap detection to coverageGapDetector', () => {
        analyzer.analyze(prototypes, null, profiles, pairResults);

        expect(deps.coverageGapDetector.detect).toHaveBeenCalledWith(
          profiles,
          prototypes
        );
      });

      it('should delegate conflict detection to multiAxisConflictDetector', () => {
        analyzer.analyze(prototypes, null, profiles, pairResults);

        expect(deps.multiAxisConflictDetector.detect).toHaveBeenCalledWith(prototypes);
      });

      it('should delegate report synthesis to reportSynthesizer', () => {
        const pcaResult = {
          residualVarianceRatio: 0.2,
          additionalSignificantComponents: 1,
          topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.8 }],
        };
        const hubs = [{ prototypeId: 'p1', hubScore: 5 }];
        const gaps = [{ clusterId: 'c1', centroidPrototypes: ['p2'] }];
        const conflicts = [{ prototypeId: 'p1', activeAxisCount: 5 }];
        const highAxisLoadings = [{ prototypeId: 'p1' }];
        const signTensions = [{ prototypeId: 'p2' }];

        deps = createValidDeps({
          pcaAnalysisService: createPCAAnalysisService(pcaResult),
          hubPrototypeDetector: createHubPrototypeDetector(hubs),
          coverageGapDetector: createCoverageGapDetector(gaps),
          multiAxisConflictDetector: createMultiAxisConflictDetector({
            conflicts,
            highAxisLoadings,
            signTensions,
          }),
        });
        analyzer = new AxisGapAnalyzer(deps);

        analyzer.analyze(prototypes, null, profiles, pairResults);

        expect(deps.reportSynthesizer.synthesize).toHaveBeenCalledWith(
          pcaResult,
          hubs,
          gaps,
          conflicts,
          prototypes.length,
          prototypes,
          { highAxisLoadings, signTensions, hubDiagnostics: null, polarityAnalysis: null, complexityAnalysis: null },
          null // candidateAxisValidation is null when validation services not provided
        );
      });
    });

    describe('progress callback', () => {
      it('should call progress callback for each phase', () => {
        const prototypes = [{ id: 'p1', weights: { axis1: 0.5 } }];
        const onProgress = jest.fn();

        analyzer.analyze(prototypes, null, null, null, onProgress);

        expect(onProgress).toHaveBeenCalledWith('pca_analysis', { phase: 1, total: 4 });
        expect(onProgress).toHaveBeenCalledWith('hub_detection', { phase: 2, total: 4 });
        expect(onProgress).toHaveBeenCalledWith('coverage_gap_detection', {
          phase: 3,
          total: 4,
        });
        expect(onProgress).toHaveBeenCalledWith('multi_axis_conflict_detection', {
          phase: 4,
          total: 4,
        });
        expect(onProgress).toHaveBeenCalledWith('synthesizing_report', {
          phase: 'complete',
        });
      });

      it('should handle null progress callback gracefully', () => {
        const prototypes = [{ id: 'p1', weights: { axis1: 0.5 } }];

        expect(() => analyzer.analyze(prototypes, null, null, null, null)).not.toThrow();
      });

      it('should handle undefined progress callback gracefully', () => {
        const prototypes = [{ id: 'p1', weights: { axis1: 0.5 } }];

        expect(() =>
          analyzer.analyze(prototypes, null, null, null, undefined)
        ).not.toThrow();
      });
    });

    describe('logging', () => {
      it('should log debug messages for each phase', () => {
        const prototypes = [{ id: 'p1', weights: { axis1: 0.5 } }];

        analyzer.analyze(prototypes, null, null, null);

        expect(deps.logger.debug).toHaveBeenCalledWith(
          'AxisGapAnalyzer: PCA analysis complete',
          expect.any(Object)
        );
        expect(deps.logger.debug).toHaveBeenCalledWith(
          'AxisGapAnalyzer: Hub detection complete',
          expect.any(Object)
        );
        expect(deps.logger.debug).toHaveBeenCalledWith(
          'AxisGapAnalyzer: Coverage gap detection complete',
          expect.any(Object)
        );
        expect(deps.logger.debug).toHaveBeenCalledWith(
          'AxisGapAnalyzer: Multi-axis conflict detection complete',
          expect.any(Object)
        );
      });

      it('should log when axis gap detection is disabled', () => {
        deps = createValidDeps({ config: createConfig({ enableAxisGapDetection: false }) });
        analyzer = new AxisGapAnalyzer(deps);

        analyzer.analyze([], null, null, null);

        expect(deps.logger.debug).toHaveBeenCalledWith(
          'AxisGapAnalyzer: Axis gap detection disabled'
        );
      });

      it('should log when no prototypes provided', () => {
        analyzer.analyze([], null, null, null);

        expect(deps.logger.debug).toHaveBeenCalledWith(
          'AxisGapAnalyzer: No prototypes provided'
        );
      });
    });
  });
});
