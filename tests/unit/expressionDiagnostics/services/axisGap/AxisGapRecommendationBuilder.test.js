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
});
