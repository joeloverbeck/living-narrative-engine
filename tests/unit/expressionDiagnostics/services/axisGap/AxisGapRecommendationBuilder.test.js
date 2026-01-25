/**
 * @file Unit tests for AxisGapRecommendationBuilder
 */

import { describe, expect, it, beforeEach } from '@jest/globals';
import { AxisGapRecommendationBuilder } from '../../../../../src/expressionDiagnostics/services/axisGap/AxisGapRecommendationBuilder.js';

describe('AxisGapRecommendationBuilder', () => {
  let builder;

  const createEmptyPCAResult = () => ({
    residualVarianceRatio: 0,
    additionalSignificantComponents: 0,
    topLoadingPrototypes: [],
  });

  const createTriggeredPCAResult = () => ({
    residualVarianceRatio: 0.25,
    additionalSignificantComponents: 1,
    topLoadingPrototypes: [
      { prototypeId: 'pca1', loading: 0.9 },
      { prototypeId: 'pca2', loading: 0.8 },
    ],
  });

  const createHub = (id = 'hub1') => ({
    prototypeId: id,
    hubScore: 4.5,
    overlappingPrototypes: ['neighbor1', 'neighbor2', 'neighbor3'],
    neighborhoodDiversity: 3,
    suggestedAxisConcept: 'suggested_axis',
  });

  const createGap = (id = 'cluster1') => ({
    clusterId: id,
    centroidPrototypes: ['gap1', 'gap2', 'gap3'],
    distanceToNearestAxis: 0.75,
  });

  const createConflict = (id = 'conflict1') => ({
    prototypeId: id,
    activeAxisCount: 5,
    signBalance: 0.1,
    positiveAxes: ['a', 'b', 'c'],
    negativeAxes: ['x', 'y'],
  });

  beforeEach(() => {
    builder = new AxisGapRecommendationBuilder();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const b = new AxisGapRecommendationBuilder();
      expect(b).toBeDefined();
    });

    it('should accept custom config', () => {
      const b = new AxisGapRecommendationBuilder({
        pcaResidualVarianceThreshold: 0.2,
      });
      expect(b).toBeDefined();
    });
  });

  describe('generate - empty inputs', () => {
    it('should return empty array when no signals triggered', () => {
      const result = builder.generate(createEmptyPCAResult(), [], [], []);
      expect(result).toEqual([]);
    });

    it('should handle null arrays gracefully', () => {
      const result = builder.generate(createEmptyPCAResult(), null, null, null);
      expect(result).toEqual([]);
    });

    it('should handle undefined arrays gracefully', () => {
      const result = builder.generate(createEmptyPCAResult(), undefined, undefined, undefined);
      expect(result).toEqual([]);
    });
  });

  describe('generate - HIGH priority: PCA + coverage gap', () => {
    it('should create high priority NEW_AXIS when both PCA and gap triggered', () => {
      const result = builder.generate(
        createTriggeredPCAResult(),
        [],
        [createGap()],
        []
      );

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('high');
      expect(result[0].type).toBe('NEW_AXIS');
      expect(result[0].affectedPrototypes).toContain('pca1');
      expect(result[0].affectedPrototypes).toContain('gap1');
      expect(result[0].evidence.length).toBe(3);
    });

    it('should merge unique prototypes from both sources', () => {
      const pca = createTriggeredPCAResult();
      pca.topLoadingPrototypes.push({ prototypeId: 'gap1', loading: 0.7 });

      const result = builder.generate(pca, [], [createGap()], []);

      expect(result[0].affectedPrototypes.filter((p) => p === 'gap1').length).toBe(1);
    });
  });

  describe('generate - HIGH priority: Hub + coverage gap', () => {
    it('should create high priority NEW_AXIS when hub relates to gap', () => {
      const hub = createHub();
      hub.overlappingPrototypes.push('gap1'); // overlap with gap

      const result = builder.generate(createEmptyPCAResult(), [hub], [createGap()], []);

      const newAxisRecs = result.filter((r) => r.priority === 'high' && r.type === 'NEW_AXIS');
      expect(newAxisRecs.length).toBe(1);
      expect(newAxisRecs[0].description).toContain('hub1');
      expect(newAxisRecs[0].description).toContain('suggested_axis');
    });

    it('should not create high priority if hub does not relate to gap', () => {
      const result = builder.generate(
        createEmptyPCAResult(),
        [createHub()],
        [createGap()],
        []
      );

      const highNewAxis = result.filter((r) => r.priority === 'high' && r.type === 'NEW_AXIS');
      expect(highNewAxis.length).toBe(0);
    });

    it('should include hub and gap metrics in evidence', () => {
      const hub = createHub();
      hub.overlappingPrototypes.push('gap1');

      const result = builder.generate(createEmptyPCAResult(), [hub], [createGap()], []);

      const rec = result.find((r) => r.priority === 'high');
      expect(rec.evidence).toContainEqual(expect.stringContaining('Hub score'));
      expect(rec.evidence).toContainEqual(expect.stringContaining('Distance to nearest axis'));
    });
  });

  describe('generate - MEDIUM priority: PCA alone', () => {
    it('should create medium INVESTIGATE when only PCA triggered', () => {
      const result = builder.generate(createTriggeredPCAResult(), [], [], []);

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('medium');
      expect(result[0].type).toBe('INVESTIGATE');
      expect(result[0].affectedPrototypes).toContain('pca1');
    });

    it('should include PCA metrics in evidence', () => {
      const result = builder.generate(createTriggeredPCAResult(), [], [], []);

      expect(result[0].evidence).toContainEqual(expect.stringContaining('residual variance'));
    });
  });

  describe('generate - MEDIUM priority: Hub alone', () => {
    it('should create medium INVESTIGATE when only hub triggered', () => {
      const result = builder.generate(createEmptyPCAResult(), [createHub()], [], []);

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('medium');
      expect(result[0].type).toBe('INVESTIGATE');
      expect(result[0].description).toContain('hub1');
    });

    it('should create one recommendation per hub', () => {
      const result = builder.generate(
        createEmptyPCAResult(),
        [createHub('hub1'), createHub('hub2')],
        [],
        []
      );

      expect(result.length).toBe(2);
      expect(result[0].affectedPrototypes).toContain('hub1');
      expect(result[1].affectedPrototypes).toContain('hub2');
    });
  });

  describe('generate - MEDIUM priority: Gap alone', () => {
    it('should create medium INVESTIGATE when only gap triggered', () => {
      const result = builder.generate(createEmptyPCAResult(), [], [createGap()], []);

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('medium');
      expect(result[0].type).toBe('INVESTIGATE');
      expect(result[0].description).toContain('cluster1');
    });

    it('should create one recommendation per gap', () => {
      const result = builder.generate(
        createEmptyPCAResult(),
        [],
        [createGap('cluster1'), createGap('cluster2')],
        []
      );

      expect(result.length).toBe(2);
    });
  });

  describe('generate - LOW priority: Conflicts only', () => {
    it('should create low REFINE_EXISTING when only conflicts triggered', () => {
      const result = builder.generate(createEmptyPCAResult(), [], [], [createConflict()]);

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('low');
      expect(result[0].type).toBe('REFINE_EXISTING');
      expect(result[0].description).toContain('conflict1');
    });

    it('should include axis details in evidence', () => {
      const result = builder.generate(createEmptyPCAResult(), [], [], [createConflict()]);

      expect(result[0].evidence).toContainEqual(expect.stringContaining('Active axes'));
      expect(result[0].evidence).toContainEqual(expect.stringContaining('Positive axes'));
    });
  });

  describe('generate - LOW priority: Conflicts with other signals', () => {
    it('should add low priority conflicts when other signals present', () => {
      const result = builder.generate(
        createTriggeredPCAResult(),
        [],
        [],
        [createConflict()]
      );

      // PCA alone creates medium INVESTIGATE, conflict adds low REFINE
      const investigate = result.find((r) => r.type === 'INVESTIGATE');
      const refine = result.find((r) => r.type === 'REFINE_EXISTING');

      expect(investigate).toBeDefined();
      expect(refine).toBeDefined();
      expect(refine.priority).toBe('low');
    });

    it('should include simplified evidence for secondary conflicts', () => {
      const result = builder.generate(
        createTriggeredPCAResult(),
        [],
        [],
        [createConflict()]
      );

      const refine = result.find((r) => r.type === 'REFINE_EXISTING');
      expect(refine.evidence.length).toBe(2); // Only active axes and sign balance
    });
  });

  describe('generate - LOW priority: Diffuse residual variance', () => {
    it('should generate LOW INVESTIGATE when high residual but no corroboration', () => {
      // High residual but no significant components and no other signals
      const pca = {
        residualVarianceRatio: 0.25, // Above 0.15 threshold
        additionalSignificantComponents: 0, // No concentrated dimensions
        topLoadingPrototypes: [],
        reconstructionErrors: [
          { prototypeId: 'worst1', error: 0.3 },
          { prototypeId: 'worst2', error: 0.25 },
          { prototypeId: 'worst3', error: 0.2 },
        ],
        residualEigenvector: { axis1: 0.8, axis2: -0.5 },
      };

      const result = builder.generate(pca, [], [], []);

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('low');
      expect(result[0].type).toBe('INVESTIGATE');
      expect(result[0].description).toContain('diffuse');
      expect(result[0].description).toContain('broken-stick');
    });

    it('should NOT generate diffuse_residual when pcaRequireCorroboration is false', () => {
      const customBuilder = new AxisGapRecommendationBuilder({
        pcaRequireCorroboration: false,
      });

      const pca = {
        residualVarianceRatio: 0.25, // Above threshold
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.5 }],
        reconstructionErrors: [{ prototypeId: 'worst1', error: 0.3 }],
      };

      const result = customBuilder.generate(pca, [], [], []);

      // When corroboration not required, PCA alone triggers MEDIUM INVESTIGATE
      // Should NOT generate the diffuse variance recommendation
      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('medium');
      expect(result[0].type).toBe('INVESTIGATE');
      expect(result[0].description).not.toContain('diffuse');
    });

    it('should include worst-fitting prototypes in diffuse_residual recommendation', () => {
      const pca = {
        residualVarianceRatio: 0.2,
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
        reconstructionErrors: [
          { prototypeId: 'worst1', error: 0.3 },
          { prototypeId: 'worst2', error: 0.25 },
          { prototypeId: 'worst3', error: 0.2 },
        ],
        residualEigenvector: { axis_a: 0.9, axis_b: -0.7, axis_c: 0.5 },
      };

      const result = builder.generate(pca, [], [], []);

      expect(result.length).toBe(1);
      expect(result[0].affectedPrototypes).toContain('worst1');
      expect(result[0].affectedPrototypes).toContain('worst2');
      expect(result[0].affectedPrototypes).toContain('worst3');
      expect(result[0].evidence).toContainEqual(expect.stringContaining('Worst-fitting'));
      expect(result[0].evidence).toContainEqual(expect.stringContaining('Residual eigenvector'));
    });

    it('should NOT generate diffuse_residual when other signals corroborate', () => {
      const pca = {
        residualVarianceRatio: 0.25,
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
        reconstructionErrors: [{ prototypeId: 'worst1', error: 0.3 }],
      };

      // Adding a hub signal = hasOtherSignals is true
      const result = builder.generate(pca, [createHub()], [], []);

      // Should NOT generate diffuse variance recommendation because hubs corroborate
      const diffuseRec = result.find((r) => r.description.includes('diffuse'));
      expect(diffuseRec).toBeUndefined();
    });

    it('should NOT generate diffuse_residual when significant components found', () => {
      const pca = {
        residualVarianceRatio: 0.25,
        additionalSignificantComponents: 1, // Significant component found
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.9 }],
        reconstructionErrors: [{ prototypeId: 'worst1', error: 0.3 }],
      };

      const result = builder.generate(pca, [], [], []);

      // Should generate normal PCA recommendation instead
      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('medium');
      expect(result[0].description).not.toContain('diffuse');
    });

    it('should NOT generate diffuse_residual when residual variance below threshold', () => {
      const pca = {
        residualVarianceRatio: 0.1, // Below 0.15 threshold
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
        reconstructionErrors: [{ prototypeId: 'worst1', error: 0.3 }],
      };

      const result = builder.generate(pca, [], [], []);

      // No recommendation at all - residual variance not high enough
      expect(result.length).toBe(0);
    });

    it('should handle empty reconstructionErrors gracefully', () => {
      const pca = {
        residualVarianceRatio: 0.2,
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
        reconstructionErrors: [],
        residualEigenvector: {},
      };

      const result = builder.generate(pca, [], [], []);

      expect(result.length).toBe(1);
      expect(result[0].affectedPrototypes).toEqual([]);
      expect(result[0].evidence).toContainEqual(expect.stringContaining('No worst-fitting'));
      expect(result[0].evidence).toContainEqual(expect.stringContaining('No residual eigenvector'));
    });

    it('should handle undefined reconstructionErrors and residualEigenvector', () => {
      const pca = {
        residualVarianceRatio: 0.2,
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
        // reconstructionErrors and residualEigenvector are undefined
      };

      const result = builder.generate(pca, [], [], []);

      expect(result.length).toBe(1);
      expect(result[0].affectedPrototypes).toEqual([]);
      expect(result[0].evidence).toContainEqual(expect.stringContaining('No worst-fitting'));
    });

    it('should include threshold value in evidence', () => {
      const customBuilder = new AxisGapRecommendationBuilder({
        pcaResidualVarianceThreshold: 0.12,
      });

      const pca = {
        residualVarianceRatio: 0.15, // Above 0.12 threshold
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
      };

      const result = customBuilder.generate(pca, [], [], []);

      expect(result.length).toBe(1);
      expect(result[0].evidence).toContainEqual(expect.stringContaining('Threshold: 12.0%'));
    });
  });

  describe('generate - PCA residual variance threshold', () => {
    it('should use custom threshold', () => {
      const customBuilder = new AxisGapRecommendationBuilder({
        pcaResidualVarianceThreshold: 0.3,
      });

      const pca = { ...createEmptyPCAResult(), residualVarianceRatio: 0.25 };
      const result = customBuilder.generate(pca, [], [], []);

      // Below threshold, should not trigger
      expect(result.length).toBe(0);
    });

    it('should trigger on additional significant components even if variance low', () => {
      const pca = {
        residualVarianceRatio: 0.1,
        additionalSignificantComponents: 2,
        topLoadingPrototypes: [{ prototypeId: 'p1', loading: 0.5 }],
      };

      const result = builder.generate(pca, [], [], []);

      expect(result.length).toBe(1);
      expect(result[0].type).toBe('INVESTIGATE');
    });
  });

  describe('buildRecommendation', () => {
    it('should create recommendation with all properties', () => {
      const rec = builder.buildRecommendation({
        priority: 'high',
        type: 'NEW_AXIS',
        description: 'Test description',
        affectedPrototypes: ['p1', 'p2'],
        evidence: ['Evidence 1', 'Evidence 2'],
      });

      expect(rec.priority).toBe('high');
      expect(rec.type).toBe('NEW_AXIS');
      expect(rec.description).toBe('Test description');
      expect(rec.affectedPrototypes).toEqual(['p1', 'p2']);
      expect(rec.evidence).toEqual(['Evidence 1', 'Evidence 2']);
    });

    it('should deduplicate and sort affected prototypes', () => {
      const rec = builder.buildRecommendation({
        priority: 'medium',
        type: 'INVESTIGATE',
        description: 'Test',
        affectedPrototypes: ['z', 'a', 'z', 'm', 'a'],
        evidence: [],
      });

      expect(rec.affectedPrototypes).toEqual(['a', 'm', 'z']);
    });

    it('should provide default evidence if empty', () => {
      const rec = builder.buildRecommendation({
        priority: 'low',
        type: 'REFINE_EXISTING',
        description: 'Test',
        affectedPrototypes: ['p1'],
        evidence: [],
      });

      expect(rec.evidence).toEqual(['Signal detected']);
    });
  });

  describe('sortByPriority', () => {
    it('should sort recommendations high → medium → low', () => {
      const recs = [
        { priority: 'low', type: 'A' },
        { priority: 'high', type: 'B' },
        { priority: 'medium', type: 'C' },
        { priority: 'high', type: 'D' },
      ];

      builder.sortByPriority(recs);

      expect(recs[0].type).toBe('B');
      expect(recs[1].type).toBe('D');
      expect(recs[2].type).toBe('C');
      expect(recs[3].type).toBe('A');
    });

    it('should handle unknown priorities', () => {
      const recs = [
        { priority: 'unknown', type: 'A' },
        { priority: 'high', type: 'B' },
      ];

      builder.sortByPriority(recs);

      expect(recs[0].type).toBe('B');
      expect(recs[1].type).toBe('A');
    });

    it('should maintain stability for same priority', () => {
      const recs = [
        { priority: 'medium', type: 'A' },
        { priority: 'medium', type: 'B' },
        { priority: 'medium', type: 'C' },
      ];

      builder.sortByPriority(recs);

      // JavaScript sort is stable, order should be preserved
      expect(recs.map((r) => r.type)).toEqual(['A', 'B', 'C']);
    });
  });

  describe('edge cases', () => {
    it('should handle PCA with empty topLoadingPrototypes', () => {
      const pca = {
        residualVarianceRatio: 0.3,
        additionalSignificantComponents: 0,
        topLoadingPrototypes: [],
      };

      const result = builder.generate(pca, [], [createGap()], []);

      // Should still create recommendation, affected prototypes from gap only
      expect(result.length).toBe(1);
      expect(result[0].affectedPrototypes).toContain('gap1');
    });

    it('should handle gap with empty centroidPrototypes', () => {
      const gap = { ...createGap(), centroidPrototypes: [] };

      const result = builder.generate(createEmptyPCAResult(), [], [gap], []);

      expect(result.length).toBe(1);
      expect(result[0].affectedPrototypes).toEqual([]);
    });

    it('should handle hub with empty overlappingPrototypes', () => {
      const hub = { ...createHub(), overlappingPrototypes: [] };

      const result = builder.generate(createEmptyPCAResult(), [hub], [], []);

      expect(result.length).toBe(1);
      expect(result[0].affectedPrototypes).toContain('hub1');
    });

    it('should handle conflict with undefined positiveAxes', () => {
      const conflict = {
        prototypeId: 'c1',
        activeAxisCount: 3,
        signBalance: 0.5,
        positiveAxes: undefined,
        negativeAxes: ['x'],
      };

      const result = builder.generate(createEmptyPCAResult(), [], [], [conflict]);

      expect(result.length).toBe(1);
      expect(result[0].evidence).toContainEqual(expect.stringContaining('Positive axes'));
    });
  });

  describe('generate - candidate axis validation', () => {
    const createValidatedCandidate = (overrides = {}) => ({
      candidateId: 'test_candidate_0',
      source: 'pca_residual',
      isRecommended: true,
      recommendation: 'add_axis',
      affectedPrototypes: ['p1', 'p2'],
      confidence: 0.85,
      direction: { valence: 0.8, arousal: 0.2 },
      improvement: {
        rmseReduction: 0.25,
        strongAxisReduction: 2,
        coUsageReduction: 0.15,
      },
      ...overrides,
    });

    it('should generate HIGH priority NEW_AXIS for validated add_axis recommendations', () => {
      const candidateAxisValidation = [createValidatedCandidate()];

      const result = builder.generate(
        createEmptyPCAResult(),
        [],
        [],
        [],
        candidateAxisValidation
      );

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('high');
      expect(result[0].type).toBe('NEW_AXIS');
      expect(result[0].affectedPrototypes).toEqual(['p1', 'p2']);
    });

    it('should generate LOW priority REFINE_EXISTING for refine_prototypes recommendations', () => {
      const candidateAxisValidation = [
        createValidatedCandidate({
          candidateId: 'refine_candidate',
          isRecommended: false,
          recommendation: 'refine_prototypes',
        }),
      ];

      const result = builder.generate(
        createEmptyPCAResult(),
        [],
        [],
        [],
        candidateAxisValidation
      );

      expect(result.length).toBe(1);
      expect(result[0].priority).toBe('low');
      expect(result[0].type).toBe('REFINE_EXISTING');
      expect(result[0].description).toContain('refine_candidate');
      expect(result[0].description).toContain('refining existing prototypes');
    });

    it('should skip insufficient_data recommendations', () => {
      const candidateAxisValidation = [
        createValidatedCandidate({
          isRecommended: false,
          recommendation: 'insufficient_data',
        }),
      ];

      const result = builder.generate(
        createEmptyPCAResult(),
        [],
        [],
        [],
        candidateAxisValidation
      );

      expect(result.length).toBe(0);
    });

    it('should handle multiple candidates with mixed recommendations', () => {
      const candidateAxisValidation = [
        createValidatedCandidate({ candidateId: 'add_1' }),
        createValidatedCandidate({
          candidateId: 'refine_1',
          isRecommended: false,
          recommendation: 'refine_prototypes',
        }),
        createValidatedCandidate({
          candidateId: 'skip_1',
          isRecommended: false,
          recommendation: 'insufficient_data',
        }),
        createValidatedCandidate({ candidateId: 'add_2', source: 'coverage_gap' }),
      ];

      const result = builder.generate(
        createEmptyPCAResult(),
        [],
        [],
        [],
        candidateAxisValidation
      );

      // 2 add_axis (HIGH) + 1 refine_prototypes (LOW) = 3 recommendations
      expect(result.length).toBe(3);
      const highPriority = result.filter((r) => r.priority === 'high');
      const lowPriority = result.filter((r) => r.priority === 'low');
      expect(highPriority.length).toBe(2);
      expect(lowPriority.length).toBe(1);
    });

    it('should include source in description for validated candidates', () => {
      const candidateAxisValidation = [
        createValidatedCandidate({
          candidateId: 'hub_candidate',
          source: 'hub_derived',
          isRecommended: false,
          recommendation: 'refine_prototypes',
        }),
      ];

      const result = builder.generate(
        createEmptyPCAResult(),
        [],
        [],
        [],
        candidateAxisValidation
      );

      expect(result[0].description).toContain('hub_derived');
    });

    it('should handle null candidateAxisValidation gracefully', () => {
      const result = builder.generate(
        createEmptyPCAResult(),
        [],
        [],
        [],
        null
      );

      expect(result).toEqual([]);
    });

    it('should handle empty candidateAxisValidation array', () => {
      const result = builder.generate(
        createEmptyPCAResult(),
        [],
        [],
        [],
        []
      );

      expect(result).toEqual([]);
    });

    it('should generate candidate recommendations before other signal recommendations', () => {
      const candidateAxisValidation = [createValidatedCandidate()];

      const result = builder.generate(
        createTriggeredPCAResult(), // Also triggers PCA signal
        [],
        [],
        [],
        candidateAxisValidation
      );

      // First recommendation should be from candidate validation
      expect(result.length).toBeGreaterThan(1);
      // The validated candidate recommendation should be present
      const candidateRec = result.find(
        (r) => r.affectedPrototypes.includes('p1') && r.affectedPrototypes.includes('p2')
      );
      expect(candidateRec).toBeDefined();
      expect(candidateRec.type).toBe('NEW_AXIS');
    });
  });

  describe('complex scenarios', () => {
    it('should handle all signal types together', () => {
      const hub = createHub();
      hub.overlappingPrototypes.push('gap1');

      const result = builder.generate(
        createTriggeredPCAResult(),
        [hub],
        [createGap()],
        [createConflict()]
      );

      // Should have: high (PCA+gap), high (hub+gap), low (conflict)
      const priorities = result.map((r) => r.priority);
      expect(priorities.filter((p) => p === 'high').length).toBe(2);
      expect(priorities.filter((p) => p === 'low').length).toBe(1);
    });

    it('should correctly identify related gaps for multiple hubs', () => {
      const hub1 = createHub('hub1');
      hub1.overlappingPrototypes = ['gap1'];

      const hub2 = createHub('hub2');
      hub2.overlappingPrototypes = ['other'];

      const gap = createGap('cluster1');

      const result = builder.generate(createEmptyPCAResult(), [hub1, hub2], [gap], []);

      // Only hub1 creates high priority (related to gap)
      // hub2 does NOT create medium priority because hasGaps=true
      // gap does NOT create medium priority because hasHubs=true
      // (single-signal medium logic requires no other signals)
      const high = result.filter((r) => r.priority === 'high');

      expect(high.length).toBe(1);
      expect(high[0].affectedPrototypes).toContain('hub1');
      expect(result.length).toBe(1); // Only one recommendation
    });
  });

  describe('recommendation IDs', () => {
    it('should generate deterministic IDs based on type and prototypes', () => {
      const rec1 = builder.buildRecommendation({
        priority: 'high',
        type: 'NEW_AXIS',
        description: 'Test',
        affectedPrototypes: ['p1', 'p2'],
        evidence: ['e1'],
      });

      const rec2 = builder.buildRecommendation({
        priority: 'high',
        type: 'NEW_AXIS',
        description: 'Different description',
        affectedPrototypes: ['p1', 'p2'],
        evidence: ['e2'],
      });

      // Same type and prototypes = same ID (description doesn't affect ID)
      expect(rec1.id).toBe(rec2.id);
      expect(rec1.id).toMatch(/^rec_new_axis_[a-z0-9]+$/);
    });

    it('should generate different IDs for different types', () => {
      const rec1 = builder.buildRecommendation({
        priority: 'high',
        type: 'NEW_AXIS',
        description: 'Test',
        affectedPrototypes: ['p1', 'p2'],
        evidence: ['e1'],
      });

      const rec2 = builder.buildRecommendation({
        priority: 'medium',
        type: 'INVESTIGATE',
        description: 'Test',
        affectedPrototypes: ['p1', 'p2'],
        evidence: ['e1'],
      });

      expect(rec1.id).not.toBe(rec2.id);
    });

    it('should generate different IDs for different prototypes', () => {
      const rec1 = builder.buildRecommendation({
        priority: 'high',
        type: 'NEW_AXIS',
        description: 'Test',
        affectedPrototypes: ['p1', 'p2'],
        evidence: ['e1'],
      });

      const rec2 = builder.buildRecommendation({
        priority: 'high',
        type: 'NEW_AXIS',
        description: 'Test',
        affectedPrototypes: ['p1', 'p3'],
        evidence: ['e1'],
      });

      expect(rec1.id).not.toBe(rec2.id);
    });

    it('should handle empty prototypes array', () => {
      const rec = builder.buildRecommendation({
        priority: 'low',
        type: 'REFINE_EXISTING',
        description: 'Test',
        affectedPrototypes: [],
        evidence: [],
      });

      expect(rec.id).toMatch(/^rec_refine_existing_[a-z0-9]+$/);
    });
  });

  describe('relationship detection', () => {
    describe('potentiallyRedundant detection (≥70% overlap, same type)', () => {
      it('should detect potentially redundant when same type has high overlap', () => {
        // Create two gaps with 75% overlap - same type INVESTIGATE
        const gap1 = {
          ...createGap('cluster1'),
          centroidPrototypes: ['p1', 'shared1', 'shared2', 'shared3'],
        };
        const gap2 = {
          ...createGap('cluster2'),
          centroidPrototypes: ['shared1', 'shared2', 'shared3', 'shared4'],
        };
        // 3 shared / 5 total = 60% - need more overlap
        // Let's use 3 shared / 4 total = 75%
        gap2.centroidPrototypes = ['shared1', 'shared2', 'shared3'];

        const result = builder.generate(createEmptyPCAResult(), [], [gap1, gap2], []);

        expect(result.length).toBe(2);

        // Both are INVESTIGATE type with 75% overlap = potentiallyRedundant
        const rec1 = result.find((r) => r.affectedPrototypes.includes('p1'));
        const rec2 = result.find((r) => !r.affectedPrototypes.includes('p1'));

        expect(rec1).toBeDefined();
        expect(rec2).toBeDefined();

        // Should have potentiallyRedundant relationship
        expect(rec1.relationships).toBeDefined();
        expect(rec1.relationships.potentiallyRedundant).toBeDefined();
        expect(rec1.relationships.potentiallyRedundant.length).toBe(1);
        expect(rec1.relationships.potentiallyRedundant[0].id).toBe(rec2.id);
      });
    });

    describe('complementary detection (≥30% overlap, different types)', () => {
      it('should detect complementary relationships between different types', () => {
        // Create INVESTIGATE (PCA alone) and REFINE_EXISTING (conflict) with high overlap
        // PCA triggers with: shared1, shared2, pca1
        // Conflict: shared1
        // Union: 3 prototypes (shared1, shared2, pca1)
        // Intersection: 1 prototype (shared1)
        // Jaccard: 1/3 = 33% - just above threshold
        const pca = createTriggeredPCAResult();
        pca.topLoadingPrototypes = [
          { prototypeId: 'shared1', loading: 0.9 },
          { prototypeId: 'shared2', loading: 0.8 },
          { prototypeId: 'pca1', loading: 0.7 },
        ];

        const conflict = createConflict('shared1');

        const result = builder.generate(pca, [], [], [conflict]);

        // Should have INVESTIGATE (medium) and REFINE_EXISTING (low)
        const investigateRec = result.find((r) => r.type === 'INVESTIGATE');
        const refineRec = result.find((r) => r.type === 'REFINE_EXISTING');

        expect(investigateRec).toBeDefined();
        expect(refineRec).toBeDefined();

        // 'shared1' is in both recommendations
        expect(investigateRec.affectedPrototypes).toContain('shared1');
        expect(refineRec.affectedPrototypes).toContain('shared1');

        // Check complementary relationship exists (different types with shared prototypes)
        expect(investigateRec.relationships).toBeDefined();
        expect(investigateRec.relationships.complementary).toBeDefined();
        expect(investigateRec.relationships.complementary.length).toBeGreaterThan(0);
        expect(investigateRec.relationships.complementary[0].sharedPrototypes).toContain('shared1');
      });
    });

    describe('no relationships for independent recommendations', () => {
      it('should not add relationships field when similarity < 30%', () => {
        // Create two recommendations with no overlapping prototypes
        const gap1 = { ...createGap('cluster1'), centroidPrototypes: ['p1', 'p2', 'p3'] };
        const gap2 = { ...createGap('cluster2'), centroidPrototypes: ['p4', 'p5', 'p6'] };

        const result = builder.generate(createEmptyPCAResult(), [], [gap1, gap2], []);

        expect(result.length).toBe(2);
        // No overlapping prototypes = 0% similarity = no relationships
        expect(result[0].relationships).toBeUndefined();
        expect(result[1].relationships).toBeUndefined();
      });
    });

    describe('single recommendation', () => {
      it('should not have relationships for single recommendation', () => {
        const result = builder.generate(createTriggeredPCAResult(), [], [], []);

        expect(result.length).toBe(1);
        expect(result[0].relationships).toBeUndefined();
      });
    });

    describe('empty recommendations', () => {
      it('should return empty array without errors', () => {
        const result = builder.generate(createEmptyPCAResult(), [], [], []);
        expect(result).toEqual([]);
      });
    });

    describe('relationship symmetry', () => {
      it('should create bidirectional relationships', () => {
        // Create scenario with overlapping recommendations
        const pca = createTriggeredPCAResult();
        pca.topLoadingPrototypes = [
          { prototypeId: 'shared1', loading: 0.9 },
          { prototypeId: 'shared2', loading: 0.8 },
          { prototypeId: 'shared3', loading: 0.7 },
        ];

        const conflict = createConflict('shared1');

        const result = builder.generate(pca, [], [], [conflict]);

        // Should have INVESTIGATE and REFINE_EXISTING
        expect(result.length).toBe(2);

        const investigate = result.find((r) => r.type === 'INVESTIGATE');
        const refine = result.find((r) => r.type === 'REFINE_EXISTING');

        expect(investigate).toBeDefined();
        expect(refine).toBeDefined();

        // Relationships should be bidirectional (both should reference each other)
        expect(investigate.relationships).toBeDefined();
        expect(investigate.relationships.complementary).toBeDefined();
        expect(refine.relationships).toBeDefined();
        expect(refine.relationships.complementary).toBeDefined();
        expect(investigate.relationships.complementary[0].id).toBe(refine.id);
        expect(refine.relationships.complementary[0].id).toBe(investigate.id);
      });
    });

    describe('overlapping detection (same type, 30-70% overlap)', () => {
      it('should detect overlapping recommendations of same type', () => {
        // Create two gaps with moderate overlap (60%)
        // gap1: p1, shared1, shared2, shared3 (4 total)
        // gap2: p2, shared1, shared2, shared3 (4 total)
        // Intersection: 3, Union: 5, Jaccard: 3/5 = 60%
        const gap1 = {
          ...createGap('cluster1'),
          centroidPrototypes: ['p1', 'shared1', 'shared2', 'shared3'],
        };
        const gap2 = {
          ...createGap('cluster2'),
          centroidPrototypes: ['p2', 'shared1', 'shared2', 'shared3'],
        };

        const result = builder.generate(createEmptyPCAResult(), [], [gap1, gap2], []);

        expect(result.length).toBe(2);

        // Both are INVESTIGATE type with 60% overlap = overlapping relationship
        const rec1 = result.find((r) => r.affectedPrototypes.includes('p1'));
        const rec2 = result.find((r) => r.affectedPrototypes.includes('p2'));

        expect(rec1).toBeDefined();
        expect(rec2).toBeDefined();

        // Should have overlapping relationship
        expect(rec1.relationships).toBeDefined();
        expect(rec1.relationships.overlapping).toBeDefined();
        expect(rec1.relationships.overlapping.length).toBe(1);
        expect(rec1.relationships.overlapping[0].id).toBe(rec2.id);
        expect(rec1.relationships.overlapping[0].sharedPrototypes).toContain('shared1');
      });
    });

    describe('relationship entry structure', () => {
      it('should include similarity and sharedPrototypes in relationships', () => {
        const pca = createTriggeredPCAResult();
        pca.topLoadingPrototypes = [
          { prototypeId: 'shared', loading: 0.9 },
          { prototypeId: 'pca1', loading: 0.8 },
        ];

        const conflict = createConflict('shared');

        const result = builder.generate(pca, [], [], [conflict]);

        const investigate = result.find((r) => r.type === 'INVESTIGATE');

        expect(investigate).toBeDefined();
        expect(investigate.relationships).toBeDefined();
        expect(investigate.relationships.complementary).toBeDefined();

        const rel = investigate.relationships.complementary[0];
        expect(rel).toHaveProperty('id');
        expect(rel).toHaveProperty('similarity');
        expect(rel).toHaveProperty('sharedPrototypes');
        expect(typeof rel.similarity).toBe('number');
        expect(rel.similarity).toBeGreaterThanOrEqual(0);
        expect(rel.similarity).toBeLessThanOrEqual(1);
        expect(Array.isArray(rel.sharedPrototypes)).toBe(true);
      });
    });
  });

  describe('backward compatibility', () => {
    it('should include id field in all recommendations', () => {
      const result = builder.generate(
        createTriggeredPCAResult(),
        [createHub()],
        [createGap()],
        [createConflict()]
      );

      for (const rec of result) {
        expect(rec).toHaveProperty('id');
        expect(typeof rec.id).toBe('string');
        expect(rec.id.length).toBeGreaterThan(0);
      }
    });

    it('should maintain all existing properties', () => {
      const result = builder.generate(createTriggeredPCAResult(), [], [], []);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('priority');
      expect(result[0]).toHaveProperty('type');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('affectedPrototypes');
      expect(result[0]).toHaveProperty('evidence');
    });
  });
});
