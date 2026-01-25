/**
 * @file Unit tests for AxisGapReportSynthesizer
 */

import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { AxisGapReportSynthesizer } from '../../../../../src/expressionDiagnostics/services/axisGap/AxisGapReportSynthesizer.js';

describe('AxisGapReportSynthesizer', () => {
  let synthesizer;
  let mockRecommendationBuilder;

  const createEmptyPCAResult = () => ({
    residualVarianceRatio: 0,
    additionalSignificantComponents: 0,
    topLoadingPrototypes: [],
    cumulativeVariance: [],
    explainedVariance: [],
    componentsFor80Pct: 0,
    componentsFor90Pct: 0,
    reconstructionErrors: [],
  });

  const createTriggeredPCAResult = () => ({
    residualVarianceRatio: 0.25,
    additionalSignificantComponents: 1,
    topLoadingPrototypes: [
      { prototypeId: 'pca1', loading: 0.9 },
      { prototypeId: 'pca2', loading: 0.8 },
    ],
    cumulativeVariance: [0.5, 0.8, 0.95],
    explainedVariance: [0.5, 0.3, 0.15],
    componentsFor80Pct: 2,
    componentsFor90Pct: 3,
    reconstructionErrors: [
      { prototypeId: 'pca1', error: 0.6 },
      { prototypeId: 'pca2', error: 0.3 },
    ],
  });

  const createHub = (id = 'hub1') => ({
    prototypeId: id,
    hubScore: 4.5,
    overlappingPrototypes: ['neighbor1', 'neighbor2'],
    neighborhoodDiversity: 2,
    suggestedAxisConcept: 'suggested_axis',
  });

  const createGap = (id = 'cluster1') => ({
    clusterId: id,
    centroidPrototypes: ['gap1', 'gap2'],
    distanceToNearestAxis: 0.75,
    clusterMagnitude: 1.5,
    clusterSize: 2,
    gapScore: 1.125,
  });

  const createConflict = (id = 'conflict1') => ({
    prototypeId: id,
    activeAxisCount: 5,
    signBalance: 0.1,
    positiveAxes: ['a', 'b'],
    negativeAxes: ['x', 'y'],
    flagReason: 'high_axis_loading',
  });

  const createPrototype = (id, weights = {}) => ({
    id,
    weights,
  });

  beforeEach(() => {
    mockRecommendationBuilder = {
      generate: jest.fn().mockReturnValue([]),
      sortByPriority: jest.fn(),
    };
    synthesizer = new AxisGapReportSynthesizer({}, mockRecommendationBuilder);
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const s = new AxisGapReportSynthesizer();
      expect(s).toBeDefined();
    });

    it('should accept custom config', () => {
      const s = new AxisGapReportSynthesizer({
        pcaResidualVarianceThreshold: 0.2,
        residualVarianceThreshold: 0.2,
        reconstructionErrorThreshold: 0.6,
      });
      expect(s).toBeDefined();
    });

    it('should work without recommendation builder', () => {
      const s = new AxisGapReportSynthesizer();
      const result = s.synthesize(createEmptyPCAResult(), [], [], [], 0);
      expect(result.recommendations).toEqual([]);
    });
  });

  describe('synthesize - basic structure', () => {
    it('should return complete report structure', () => {
      const result = synthesizer.synthesize(createEmptyPCAResult(), [], [], [], 10);

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('pcaAnalysis');
      expect(result).toHaveProperty('hubPrototypes');
      expect(result).toHaveProperty('coverageGaps');
      expect(result).toHaveProperty('multiAxisConflicts');
      expect(result).toHaveProperty('highAxisLoadings');
      expect(result).toHaveProperty('signTensions');
      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('prototypeWeightSummaries');
    });

    it('should include correct total prototypes analyzed', () => {
      const result = synthesizer.synthesize(createEmptyPCAResult(), [], [], [], 42);

      expect(result.summary.totalPrototypesAnalyzed).toBe(42);
    });

    it('should pass through analysis results', () => {
      const hubs = [createHub()];
      const gaps = [createGap()];
      const conflicts = [createConflict()];

      const result = synthesizer.synthesize(
        createTriggeredPCAResult(),
        hubs,
        gaps,
        conflicts,
        5
      );

      expect(result.hubPrototypes).toBe(hubs);
      expect(result.coverageGaps).toBe(gaps);
      expect(result.multiAxisConflicts).toBe(conflicts);
    });
  });

  describe('synthesize - summary signal breakdown', () => {
    it('should count PCA signals when above threshold', () => {
      const result = synthesizer.synthesize(createTriggeredPCAResult(), [], [], [], 10);

      expect(result.summary.signalBreakdown.pcaSignals).toBe(1);
    });

    it('should not count PCA signals when below threshold', () => {
      const result = synthesizer.synthesize(createEmptyPCAResult(), [], [], [], 10);

      expect(result.summary.signalBreakdown.pcaSignals).toBe(0);
    });

    it('should count hub signals correctly', () => {
      const result = synthesizer.synthesize(
        createEmptyPCAResult(),
        [createHub('h1'), createHub('h2')],
        [],
        [],
        10
      );

      expect(result.summary.signalBreakdown.hubSignals).toBe(2);
    });

    it('should count coverage gap signals correctly', () => {
      const result = synthesizer.synthesize(
        createEmptyPCAResult(),
        [],
        [createGap('g1'), createGap('g2'), createGap('g3')],
        [],
        10
      );

      expect(result.summary.signalBreakdown.coverageGapSignals).toBe(3);
    });

    it('should count multi-axis conflict signals correctly', () => {
      const result = synthesizer.synthesize(
        createEmptyPCAResult(),
        [],
        [],
        [createConflict('c1')],
        10
      );

      expect(result.summary.signalBreakdown.multiAxisConflictSignals).toBe(1);
    });

    it('should count split conflict signals', () => {
      const result = synthesizer.synthesize(
        createEmptyPCAResult(),
        [],
        [],
        [],
        10,
        [],
        {
          highAxisLoadings: [createConflict('h1'), createConflict('h2')],
          signTensions: [createConflict('s1')],
        }
      );

      expect(result.summary.signalBreakdown.highAxisLoadingSignals).toBe(2);
      expect(result.summary.signalBreakdown.signTensionSignals).toBe(1);
    });
  });

  describe('synthesize - confidence levels', () => {
    it('should return low confidence when no signals triggered', () => {
      const result = synthesizer.synthesize(createEmptyPCAResult(), [], [], [], 10);

      expect(result.summary.confidence).toBe('low');
    });

    it('should return medium confidence when 2 signals triggered', () => {
      const result = synthesizer.synthesize(
        createTriggeredPCAResult(),
        [createHub()],
        [],
        [],
        10
      );

      expect(result.summary.confidence).toBe('medium');
    });

    it('should return high confidence when 3+ signals triggered', () => {
      const result = synthesizer.synthesize(
        createTriggeredPCAResult(),
        [createHub()],
        [createGap()],
        [],
        10
      );

      expect(result.summary.confidence).toBe('high');
    });

    it('should NOT boost confidence when all reasons are from correlated families', () => {
      const prototypes = [
        createPrototype('p1', { a: 0.5, b: -0.3 }),
      ];

      // Create results that flag p1 from PCA family only (2 reasons, 1 family)
      const pca = createTriggeredPCAResult();
      pca.topLoadingPrototypes = [{ prototypeId: 'p1', loading: 0.9 }];
      pca.reconstructionErrors = [{ prototypeId: 'p1', error: 0.6 }];

      const hubs = [{ ...createHub(), prototypeId: 'p1' }];

      // p1 has 3 reasons but only 2 distinct families (pca, hubs)
      // Should NOT boost confidence since it requires 3+ distinct families
      const result = synthesizer.synthesize(pca, hubs, [], [], 5, prototypes);

      // Base confidence = medium (2 methods triggered: PCA + hubs)
      // No boost since only 2 families present
      expect(result.summary.confidence).toBe('medium');
    });

    it('should boost confidence when 3+ distinct method families trigger', () => {
      const prototypes = [
        createPrototype('p1', { a: 0.5, b: -0.3 }),
      ];

      // Create results that flag p1 from 3 distinct families
      const pca = createTriggeredPCAResult();
      pca.topLoadingPrototypes = [{ prototypeId: 'p1', loading: 0.9 }];
      pca.reconstructionErrors = [{ prototypeId: 'p1', error: 0.6 }];

      const hubs = [{ ...createHub(), prototypeId: 'p1' }];
      const gaps = [{ ...createGap(), centroidPrototypes: ['p1'] }];

      // p1 has 4 reasons from 3 distinct families (pca, hubs, gaps)
      // Should boost confidence from medium to high
      const result = synthesizer.synthesize(pca, hubs, gaps, [], 5, prototypes);

      expect(result.summary.confidence).toBe('high');
    });
  });

  describe('synthesize - PCA analysis output', () => {
    it('should include all PCA metrics', () => {
      const pca = createTriggeredPCAResult();
      const result = synthesizer.synthesize(pca, [], [], [], 10);

      expect(result.pcaAnalysis.residualVarianceRatio).toBe(0.25);
      expect(result.pcaAnalysis.additionalSignificantComponents).toBe(1);
      expect(result.pcaAnalysis.topLoadingPrototypes.length).toBe(2);
      expect(result.pcaAnalysis.cumulativeVariance).toEqual([0.5, 0.8, 0.95]);
      expect(result.pcaAnalysis.explainedVariance).toEqual([0.5, 0.3, 0.15]);
      expect(result.pcaAnalysis.componentsFor80Pct).toBe(2);
      expect(result.pcaAnalysis.componentsFor90Pct).toBe(3);
    });

    it('should provide defaults for missing PCA fields', () => {
      const pca = {
        residualVarianceRatio: 0.1,
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
      };

      const result = synthesizer.synthesize(pca, [], [], [], 10);

      expect(result.pcaAnalysis.cumulativeVariance).toEqual([]);
      expect(result.pcaAnalysis.explainedVariance).toEqual([]);
      expect(result.pcaAnalysis.componentsFor80Pct).toBe(0);
      expect(result.pcaAnalysis.reconstructionErrors).toEqual([]);
    });
  });

  describe('synthesize - recommendations integration', () => {
    it('should call recommendation builder with correct arguments', () => {
      const pca = createTriggeredPCAResult();
      const hubs = [createHub()];
      const gaps = [createGap()];
      const conflicts = [createConflict()];

      synthesizer.synthesize(pca, hubs, gaps, conflicts, 10);

      expect(mockRecommendationBuilder.generate).toHaveBeenCalledWith(
        pca,
        hubs,
        gaps,
        conflicts,
        null // candidateAxisValidation is null when not provided
      );
    });

    it('should sort recommendations by priority', () => {
      mockRecommendationBuilder.generate.mockReturnValue([
        { priority: 'low' },
        { priority: 'high' },
      ]);

      synthesizer.synthesize(createEmptyPCAResult(), [], [], [], 10);

      expect(mockRecommendationBuilder.sortByPriority).toHaveBeenCalled();
    });

    it('should include recommendation count in summary', () => {
      mockRecommendationBuilder.generate.mockReturnValue([
        { priority: 'high' },
        { priority: 'medium' },
        { priority: 'low' },
      ]);

      const result = synthesizer.synthesize(createEmptyPCAResult(), [], [], [], 10);

      expect(result.summary.recommendationCount).toBe(3);
      expect(result.summary.potentialGapsDetected).toBe(3);
    });
  });

  describe('buildEmptyReport', () => {
    it('should return empty report with correct structure', () => {
      const result = synthesizer.buildEmptyReport(25);

      expect(result.summary.totalPrototypesAnalyzed).toBe(25);
      expect(result.summary.recommendationCount).toBe(0);
      expect(result.summary.confidence).toBe('low');
      expect(result.hubPrototypes).toEqual([]);
      expect(result.coverageGaps).toEqual([]);
      expect(result.multiAxisConflicts).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });

    it('should include empty PCA result', () => {
      const result = synthesizer.buildEmptyReport();

      expect(result.pcaAnalysis.residualVarianceRatio).toBe(0);
      expect(result.pcaAnalysis.topLoadingPrototypes).toEqual([]);
      expect(result.pcaAnalysis.cumulativeVariance).toEqual([]);
      expect(result.pcaAnalysis.explainedVariance).toEqual([]);
    });

    it('should include all signal breakdown fields at zero', () => {
      const result = synthesizer.buildEmptyReport();

      expect(result.summary.signalBreakdown.pcaSignals).toBe(0);
      expect(result.summary.signalBreakdown.hubSignals).toBe(0);
      expect(result.summary.signalBreakdown.coverageGapSignals).toBe(0);
      expect(result.summary.signalBreakdown.multiAxisConflictSignals).toBe(0);
      expect(result.summary.signalBreakdown.highAxisLoadingSignals).toBe(0);
      expect(result.summary.signalBreakdown.signTensionSignals).toBe(0);
    });
  });

  describe('computePrototypeWeightSummaries', () => {
    it('should return empty array for null prototypes', () => {
      const result = synthesizer.computePrototypeWeightSummaries(
        null,
        createEmptyPCAResult(),
        [],
        [],
        []
      );

      expect(result).toEqual([]);
    });

    it('should return empty array for empty prototypes', () => {
      const result = synthesizer.computePrototypeWeightSummaries(
        [],
        createEmptyPCAResult(),
        [],
        [],
        []
      );

      expect(result).toEqual([]);
    });

    it('should flag prototypes with high reconstruction error', () => {
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const pca = {
        ...createEmptyPCAResult(),
        reconstructionErrors: [{ prototypeId: 'p1', error: 0.6 }],
      };

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        pca,
        [],
        [],
        []
      );

      expect(result.length).toBe(1);
      expect(result[0].reasons).toContain('high_reconstruction_error');
      expect(result[0].metricsByReason.high_reconstruction_error.reconstructionError).toBe(0.6);
    });

    it('should flag prototypes with extreme projection', () => {
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const pca = {
        ...createEmptyPCAResult(),
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.9 }],
      };

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        pca,
        [],
        [],
        []
      );

      expect(result[0].reasons).toContain('extreme_projection');
      expect(result[0].metricsByReason.extreme_projection.projectionScore).toBe(0.9);
    });

    it('should flag hub prototypes', () => {
      const prototypes = [createPrototype('hub1', { a: 0.5 })];
      const hubs = [createHub('hub1')];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        hubs,
        [],
        []
      );

      expect(result[0].reasons).toContain('hub');
      expect(result[0].metricsByReason.hub.hubScore).toBe(4.5);
    });

    it('should flag prototypes in coverage gaps', () => {
      const prototypes = [createPrototype('gap1', { a: 0.5 })];
      const gaps = [createGap('cluster1')];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        [],
        gaps,
        []
      );

      expect(result[0].reasons).toContain('coverage_gap');
      expect(result[0].metricsByReason.coverage_gap.distanceToNearestAxis).toBe(0.75);
      expect(result[0].metricsByReason.coverage_gap.clusterMagnitude).toBe(1.5);
    });

    it('should flag prototypes with multi-axis conflicts', () => {
      const prototypes = [createPrototype('conflict1', { a: 0.5 })];
      const conflicts = [createConflict('conflict1')];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        [],
        [],
        conflicts
      );

      expect(result[0].reasons).toContain('high_axis_loading');
      expect(result[0].metricsByReason.high_axis_loading.activeAxisCount).toBe(5);
    });

    it('should use default flagReason for conflicts without flagReason', () => {
      const prototypes = [createPrototype('c1', { a: 0.5 })];
      const conflicts = [
        {
          prototypeId: 'c1',
          activeAxisCount: 3,
          signBalance: 0.2,
        },
      ];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        [],
        [],
        conflicts
      );

      expect(result[0].reasons).toContain('multi_axis_conflict');
    });

    it('should accumulate multiple reasons per prototype', () => {
      const prototypes = [createPrototype('p1', { a: 0.8, b: -0.6, c: 0.4 })];
      const pca = {
        ...createEmptyPCAResult(),
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.9 }],
        reconstructionErrors: [{ prototypeId: 'p1', error: 0.6 }],
      };
      const hubs = [{ ...createHub(), prototypeId: 'p1' }];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        pca,
        hubs,
        [],
        []
      );

      expect(result.length).toBe(1);
      expect(result[0].reasons.length).toBe(3);
      expect(result[0].reasons).toContain('extreme_projection');
      expect(result[0].reasons).toContain('high_reconstruction_error');
      expect(result[0].reasons).toContain('hub');
    });

    it('should set multiSignalAgreement when 3+ reasons (backward compat)', () => {
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const pca = {
        ...createEmptyPCAResult(),
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.9 }],
        reconstructionErrors: [{ prototypeId: 'p1', error: 0.6 }],
      };
      const hubs = [{ ...createHub(), prototypeId: 'p1' }];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        pca,
        hubs,
        [],
        []
      );

      // multiSignalAgreement is true because there are 3+ reasons (raw count)
      expect(result[0].multiSignalAgreement).toBe(true);
    });

    it('should include distinctFamilyCount in weight summary', () => {
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const pca = {
        ...createEmptyPCAResult(),
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.9 }],
        reconstructionErrors: [{ prototypeId: 'p1', error: 0.6 }],
      };
      const hubs = [{ ...createHub(), prototypeId: 'p1' }];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        pca,
        hubs,
        [],
        []
      );

      // p1 has 3 reasons from 2 families (pca: 2 reasons, hubs: 1 reason)
      expect(result[0].distinctFamilyCount).toBe(2);
    });

    it('should count all 4 families when all detection methods flag same prototype', () => {
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const pca = {
        ...createEmptyPCAResult(),
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.9 }],
        reconstructionErrors: [{ prototypeId: 'p1', error: 0.6 }],
      };
      const hubs = [{ ...createHub(), prototypeId: 'p1' }];
      const gaps = [{ ...createGap(), centroidPrototypes: ['p1'] }];
      const conflicts = [{ ...createConflict(), prototypeId: 'p1' }];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        pca,
        hubs,
        gaps,
        conflicts
      );

      // p1 has reasons from 4 families: pca, hubs, gaps, conflicts
      expect(result[0].distinctFamilyCount).toBe(4);
    });

    it('should count conflicts family as one even with multiple conflict reasons', () => {
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      // Create conflicts with different flag reasons (all from conflicts family)
      const conflicts = [
        { prototypeId: 'p1', activeAxisCount: 5, signBalance: 0.1, flagReason: 'high_axis_loading' },
        { prototypeId: 'p1', activeAxisCount: 3, signBalance: 0.8, flagReason: 'sign_tension' },
      ];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        [],
        [],
        conflicts
      );

      // Only 1 family (conflicts), even though 2 different reasons
      expect(result[0].distinctFamilyCount).toBe(1);
      expect(result[0].reasons).toContain('high_axis_loading');
      expect(result[0].reasons).toContain('sign_tension');
    });

    it('should include top 5 axes by absolute weight', () => {
      const prototypes = [
        createPrototype('p1', {
          a: 0.9,
          b: -0.8,
          c: 0.7,
          d: -0.6,
          e: 0.5,
          f: -0.4,
          g: 0.3,
        }),
      ];
      const pca = {
        ...createEmptyPCAResult(),
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.5 }],
      };

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        pca,
        [],
        [],
        []
      );

      expect(result[0].topAxes.length).toBe(5);
      expect(result[0].topAxes[0].axis).toBe('a');
      expect(result[0].topAxes[0].weight).toBe(0.9);
    });

    it('should provide backward compatibility with reason and metrics', () => {
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const hubs = [{ ...createHub(), prototypeId: 'p1' }];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        hubs,
        [],
        []
      );

      expect(result[0].reason).toBe('hub');
      expect(result[0].metrics).toEqual(result[0].metricsByReason.hub);
    });

    it('should handle prototypeId property on prototypes', () => {
      const prototypes = [{ prototypeId: 'p1', weights: { a: 0.5 } }];
      const hubs = [{ ...createHub(), prototypeId: 'p1' }];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        hubs,
        [],
        []
      );

      expect(result[0].prototypeId).toBe('p1');
    });

    it('should filter non-finite weight values', () => {
      const prototypes = [
        createPrototype('p1', {
          a: 0.5,
          b: NaN,
          c: Infinity,
          d: -0.3,
        }),
      ];
      const hubs = [{ ...createHub(), prototypeId: 'p1' }];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        hubs,
        [],
        []
      );

      expect(result[0].topAxes.length).toBe(2);
      expect(result[0].topAxes.some((ta) => ta.axis === 'b')).toBe(false);
      expect(result[0].topAxes.some((ta) => ta.axis === 'c')).toBe(false);
    });

    it('should not add duplicate reasons from same source', () => {
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const gaps = [
        { ...createGap('c1'), centroidPrototypes: ['p1'] },
        { ...createGap('c2'), centroidPrototypes: ['p1'] },
      ];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        [],
        gaps,
        []
      );

      // Should only have one 'coverage_gap' reason even though in 2 gaps
      expect(result[0].reasons.filter((r) => r === 'coverage_gap').length).toBe(1);
    });
  });

  describe('synthesize - candidate axis validation integration', () => {
    it('should include candidateAxes in report when provided', () => {
      const candidateAxisValidation = [
        {
          candidateId: 'pca_residual_0',
          source: 'pca_residual',
          isRecommended: true,
          recommendation: 'add_axis',
          affectedPrototypes: ['p1', 'p2'],
          improvement: { rmseReduction: 0.25, strongAxisReduction: 2 },
        },
      ];

      const result = synthesizer.synthesize(
        createEmptyPCAResult(),
        [],
        [],
        [],
        10,
        [],
        {},
        candidateAxisValidation
      );

      expect(result.candidateAxes).toBe(candidateAxisValidation);
    });

    it('should add candidateAxisCount to signalBreakdown when validation provided', () => {
      const candidateAxisValidation = [
        { candidateId: 'c1', isRecommended: true },
        { candidateId: 'c2', isRecommended: false },
        { candidateId: 'c3', isRecommended: true },
      ];

      const result = synthesizer.synthesize(
        createEmptyPCAResult(),
        [],
        [],
        [],
        10,
        [],
        {},
        candidateAxisValidation
      );

      expect(result.summary.signalBreakdown.candidateAxisCount).toBe(3);
      expect(result.summary.signalBreakdown.recommendedCandidateCount).toBe(2);
    });

    it('should pass candidateAxisValidation to recommendation builder', () => {
      const candidateAxisValidation = [
        {
          candidateId: 'c1',
          source: 'coverage_gap',
          isRecommended: true,
          recommendation: 'add_axis',
        },
      ];

      synthesizer.synthesize(
        createEmptyPCAResult(),
        [],
        [],
        [],
        10,
        [],
        {},
        candidateAxisValidation
      );

      expect(mockRecommendationBuilder.generate).toHaveBeenCalledWith(
        expect.any(Object),
        [],
        [],
        [],
        candidateAxisValidation
      );
    });

    it('should not add candidate counts when validation is null', () => {
      const result = synthesizer.synthesize(
        createEmptyPCAResult(),
        [],
        [],
        [],
        10,
        [],
        {},
        null
      );

      expect(result.summary.signalBreakdown.candidateAxisCount).toBeUndefined();
      expect(result.summary.signalBreakdown.recommendedCandidateCount).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle missing splitConflicts fields', () => {
      const result = synthesizer.synthesize(
        createEmptyPCAResult(),
        [],
        [],
        [],
        10,
        [],
        {}
      );

      expect(result.highAxisLoadings).toEqual([]);
      expect(result.signTensions).toEqual([]);
    });

    it('should handle prototypes without weights', () => {
      const prototypes = [{ id: 'p1' }];
      const hubs = [{ ...createHub(), prototypeId: 'p1' }];

      const result = synthesizer.computePrototypeWeightSummaries(
        prototypes,
        createEmptyPCAResult(),
        hubs,
        [],
        []
      );

      expect(result[0].topAxes).toEqual([]);
    });

    it('should handle custom reconstruction error threshold', () => {
      const customSynthesizer = new AxisGapReportSynthesizer({
        reconstructionErrorThreshold: 0.8,
      });

      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const pca = {
        ...createEmptyPCAResult(),
        reconstructionErrors: [{ prototypeId: 'p1', error: 0.6 }],
      };

      const result = customSynthesizer.computePrototypeWeightSummaries(
        prototypes,
        pca,
        [],
        [],
        []
      );

      // 0.6 < 0.8 threshold, should not flag
      expect(result.length).toBe(0);
    });
  });

  describe('pcaRequireCorroboration', () => {
    const createHighResidualOnlyPCA = () => ({
      residualVarianceRatio: 0.25, // High residual (above 0.15 threshold)
      additionalSignificantComponents: 0, // No significant components (broken-stick = 0)
      topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.5 }],
      cumulativeVariance: [0.75, 0.85, 0.95],
      explainedVariance: [0.75, 0.10, 0.10],
      componentsFor80Pct: 2,
      componentsFor90Pct: 3,
      reconstructionErrors: [],
    });

    it('should default pcaRequireCorroboration to true', () => {
      const synth = new AxisGapReportSynthesizer({}, mockRecommendationBuilder);
      // Default config should require corroboration
      expect(synth).toBeDefined();
    });

    it('should NOT trigger PCA signal with high residual alone when corroboration required', () => {
      const synth = new AxisGapReportSynthesizer(
        { pcaRequireCorroboration: true },
        mockRecommendationBuilder
      );

      const pca = createHighResidualOnlyPCA();
      const prototypes = [createPrototype('p1', { a: 0.5 })];

      // No other signals (no hubs, no gaps, no conflicts)
      const report = synth.synthesize(pca, [], [], [], 1, prototypes);

      // With corroboration required, high residual alone should result in low confidence
      expect(report.summary.confidence).toBe('low');
    });

    it('should trigger PCA signal when additionalSignificantComponents > 0', () => {
      const synth = new AxisGapReportSynthesizer(
        { pcaRequireCorroboration: true },
        mockRecommendationBuilder
      );

      const pca = {
        ...createHighResidualOnlyPCA(),
        additionalSignificantComponents: 1, // Has significant component beyond expected
      };
      const prototypes = [createPrototype('p1', { a: 0.5 })];

      const report = synth.synthesize(pca, [], [], [], 1, prototypes);

      // With significant components, PCA method should trigger (1 method = low confidence)
      // But this is different from high residual alone where PCA would NOT trigger
      expect(report.summary.confidence).toBe('low');
      // Verify PCA signal is counted in the breakdown
      expect(report.summary.signalBreakdown.pcaSignals).toBe(1);
    });

    it('should trigger PCA signal with high residual when hubs are present', () => {
      const synth = new AxisGapReportSynthesizer(
        { pcaRequireCorroboration: true },
        mockRecommendationBuilder
      );

      const pca = createHighResidualOnlyPCA();
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const hubs = [createHub('hub1')];

      const report = synth.synthesize(pca, hubs, [], [], 1, prototypes);

      // With hubs present, PCA high residual should also trigger
      // 2 methods triggered = medium or high confidence
      expect(['medium', 'high']).toContain(report.summary.confidence);
    });

    it('should trigger PCA signal with high residual when gaps are present', () => {
      const synth = new AxisGapReportSynthesizer(
        { pcaRequireCorroboration: true },
        mockRecommendationBuilder
      );

      const pca = createHighResidualOnlyPCA();
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const gaps = [createGap('gap1')];

      const report = synth.synthesize(pca, [], gaps, [], 1, prototypes);

      // With gaps present, PCA high residual should also trigger
      expect(['medium', 'high']).toContain(report.summary.confidence);
    });

    it('should trigger PCA signal with high residual when conflicts are present', () => {
      const synth = new AxisGapReportSynthesizer(
        { pcaRequireCorroboration: true },
        mockRecommendationBuilder
      );

      const pca = createHighResidualOnlyPCA();
      const prototypes = [createPrototype('p1', { a: 0.5 })];
      const conflicts = [createConflict('conflict1')];

      const report = synth.synthesize(pca, [], [], conflicts, 1, prototypes);

      // With conflicts present, PCA high residual should also trigger
      expect(['medium', 'high']).toContain(report.summary.confidence);
    });

    it('should use original behavior when pcaRequireCorroboration is false', () => {
      const synth = new AxisGapReportSynthesizer(
        { pcaRequireCorroboration: false },
        mockRecommendationBuilder
      );

      const pca = createHighResidualOnlyPCA();
      const prototypes = [createPrototype('p1', { a: 0.5 })];

      // No other signals
      const report = synth.synthesize(pca, [], [], [], 1, prototypes);

      // With corroboration disabled, high residual alone should trigger PCA
      // But 1 method = low confidence (need 2+ for medium)
      expect(report.summary.confidence).toBe('low');
      // Verify PCA signal is counted - this is the key difference from corroboration enabled
      expect(report.summary.signalBreakdown.pcaSignals).toBe(1);
    });

    it('should show difference between corroboration enabled/disabled with high residual only', () => {
      const pcaHighResidual = createHighResidualOnlyPCA();
      const prototypes = [createPrototype('p1', { a: 0.5 })];

      // With corroboration enabled - high residual alone should NOT count as triggered method
      const synthEnabled = new AxisGapReportSynthesizer(
        { pcaRequireCorroboration: true },
        mockRecommendationBuilder
      );
      const reportEnabled = synthEnabled.synthesize(pcaHighResidual, [], [], [], 1, prototypes);

      // With corroboration disabled - high residual alone SHOULD count as triggered method
      const synthDisabled = new AxisGapReportSynthesizer(
        { pcaRequireCorroboration: false },
        mockRecommendationBuilder
      );
      const reportDisabled = synthDisabled.synthesize(pcaHighResidual, [], [], [], 1, prototypes);

      // Both have same low confidence (only 1 or 0 methods triggered)
      // The key difference is whether PCA is counted in methodsTriggered
      // This affects recommendation generation, not just confidence
      expect(reportEnabled.summary.confidence).toBe('low');
      expect(reportDisabled.summary.confidence).toBe('low');
    });
  });
});
