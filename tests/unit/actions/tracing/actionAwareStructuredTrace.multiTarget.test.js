import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';

describe('ActionAwareStructuredTrace - Multi-Target Support', () => {
  let testBed;
  let trace;
  let mockFilter;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('isMultiTargetAction', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['test:action'],
        verbosity: 'detailed',
      });
    });

    it('should identify modern multi-target actions', () => {
      const action = {
        id: 'test:action',
        targets: {
          primary: { scope: 'actor', placeholder: 'target' },
          secondary: { scope: 'location', placeholder: 'location' },
        },
      };

      expect(trace.isMultiTargetAction(action)).toBe(true);
    });

    it('should identify scope-based actions as potentially multi-target', () => {
      const action = {
        id: 'test:action',
        scope: 'actor.followers[]',
      };

      expect(trace.isMultiTargetAction(action)).toBe(true);
    });

    it('should identify targetScope as multi-target', () => {
      const action = {
        id: 'test:action',
        targetScope: 'location.actors[]',
      };

      expect(trace.isMultiTargetAction(action)).toBe(true);
    });

    it('should identify dynamic targets', () => {
      const action = {
        id: 'test:action',
        targetQuery: { type: 'dynamic' },
      };

      expect(trace.isMultiTargetAction(action)).toBe(true);
    });

    it('should identify dynamicTargets', () => {
      const action = {
        id: 'test:action',
        dynamicTargets: true,
      };

      expect(trace.isMultiTargetAction(action)).toBe(true);
    });

    it('should identify legacy single-target actions', () => {
      const action = {
        id: 'test:action',
        targets: 'self',
      };

      expect(trace.isMultiTargetAction(action)).toBe(false);
    });

    it('should identify array targets as legacy', () => {
      const action = {
        id: 'test:action',
        targets: ['entity1', 'entity2'],
      };

      expect(trace.isMultiTargetAction(action)).toBe(false);
    });

    it('should handle actions without targets', () => {
      const action = {
        id: 'test:action',
      };

      expect(trace.isMultiTargetAction(action)).toBe(false);
    });
  });

  describe('captureMultiTargetResolution', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['test:action'],
        verbosity: 'detailed',
      });
    });

    it('should capture multi-target resolution data', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureMultiTargetResolution('test:action', {
        targetKeys: ['primary', 'secondary'],
        resolvedCounts: { primary: 3, secondary: 2 },
        totalTargets: 5,
        resolutionOrder: ['primary', 'secondary'],
        hasContextDependencies: false,
        resolutionTimeMs: 150,
      });

      expect(captureDataSpy).toHaveBeenCalledWith(
        'multi_target_resolution',
        'test:action',
        expect.objectContaining({
          stage: 'multi_target_resolution',
          targetKeys: ['primary', 'secondary'],
          totalTargets: 5,
          resolutionTimeMs: 150,
        })
      );
    });

    it('should handle missing data gracefully', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureMultiTargetResolution('test:action', {});

      expect(captureDataSpy).toHaveBeenCalledWith(
        'multi_target_resolution',
        'test:action',
        expect.objectContaining({
          stage: 'multi_target_resolution',
          targetKeys: [],
          resolvedCounts: {},
          totalTargets: 0,
          resolutionOrder: [],
          hasContextDependencies: false,
          resolutionTimeMs: 0,
        })
      );
    });

    it('should not capture data for non-traced actions', async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['other:action'],
        verbosity: 'detailed',
      });

      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureMultiTargetResolution('test:action', {
        targetKeys: ['primary'],
        totalTargets: 1,
      });

      expect(captureDataSpy).not.toHaveBeenCalled();
    });

    it('should capture with context dependencies', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureMultiTargetResolution('test:action', {
        targetKeys: ['primary', 'secondary'],
        resolvedCounts: { primary: 2, secondary: 4 },
        totalTargets: 6,
        resolutionOrder: ['primary', 'secondary'],
        hasContextDependencies: true,
        resolutionTimeMs: 200,
      });

      expect(captureDataSpy).toHaveBeenCalledWith(
        'multi_target_resolution',
        'test:action',
        expect.objectContaining({
          hasContextDependencies: true,
          resolutionOrder: ['primary', 'secondary'],
        })
      );
    });
  });

  describe('captureScopeEvaluation', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['test:action'],
        verbosity: 'detailed',
      });
    });

    it('should capture scope evaluation details', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureScopeEvaluation('test:action', 'primary', {
        scope: 'actor.followers[]',
        context: 'actor',
        resultCount: 3,
        evaluationTimeMs: 50,
        cacheHit: true,
      });

      expect(captureDataSpy).toHaveBeenCalledWith(
        'scope_evaluation',
        'test:action',
        expect.objectContaining({
          stage: 'scope_evaluation',
          targetKey: 'primary',
          scope: 'actor.followers[]',
          context: 'actor',
          resultCount: 3,
          evaluationTimeMs: 50,
          cacheHit: true,
        })
      );
    });

    it('should handle evaluation errors', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureScopeEvaluation('test:action', 'primary', {
        scope: 'invalid.scope',
        context: 'actor',
        resultCount: 0,
        evaluationTimeMs: 10,
        cacheHit: false,
        error: 'Invalid scope expression',
      });

      expect(captureDataSpy).toHaveBeenCalledWith(
        'scope_evaluation',
        'test:action',
        expect.objectContaining({
          error: 'Invalid scope expression',
        })
      );
    });

    it('should handle missing optional fields', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureScopeEvaluation('test:action', 'primary', {
        scope: 'actor',
        context: 'actor',
      });

      expect(captureDataSpy).toHaveBeenCalledWith(
        'scope_evaluation',
        'test:action',
        expect.objectContaining({
          resultCount: 0,
          evaluationTimeMs: 0,
          cacheHit: false,
        })
      );
    });

    it('should include enhanced scope evaluation data when provided', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      const enhancedData = {
        entityDiscovery: [{ componentId: 'component-1' }],
        filterEvaluations: [{ itemId: 'seat-1', filterPassed: true }],
        resolverDetails: { resolver: 'contextResolver' },
      };

      trace.captureScopeEvaluation(
        'test:action',
        'primary',
        {
          scope: 'actor.followers[]',
          context: 'actor',
        },
        enhancedData
      );

      expect(captureDataSpy).toHaveBeenCalledWith(
        'scope_evaluation',
        'test:action',
        expect.objectContaining({
          entityDiscovery: enhancedData.entityDiscovery,
          filterEvaluations: enhancedData.filterEvaluations,
          resolverDetails: enhancedData.resolverDetails,
        })
      );
    });

    it('should not capture for non-traced actions', async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['other:action'],
        verbosity: 'detailed',
      });

      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureScopeEvaluation('test:action', 'primary', {
        scope: 'actor',
        context: 'actor',
        resultCount: 1,
      });

      expect(captureDataSpy).not.toHaveBeenCalled();
    });
  });

  describe('captureTargetRelationships', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['test:action'],
        verbosity: 'detailed',
      });
    });

    it('should capture target relationship data', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureTargetRelationships('test:action', {
        totalTargets: 5,
        relationships: [
          { from: 'target1', to: 'target2', type: 'related' },
          { from: 'target2', to: 'target3', type: 'depends' },
        ],
        patterns: ['hierarchy', 'dependency'],
        analysisTimeMs: 25,
      });

      expect(captureDataSpy).toHaveBeenCalledWith(
        'target_relationships',
        'test:action',
        expect.objectContaining({
          stage: 'target_relationships',
          totalTargets: 5,
          relationships: expect.arrayContaining([
            expect.objectContaining({ from: 'target1', to: 'target2' }),
          ]),
          patterns: ['hierarchy', 'dependency'],
          analysisTimeMs: 25,
        })
      );
    });

    it('should handle empty relationships', () => {
      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureTargetRelationships('test:action', {});

      expect(captureDataSpy).toHaveBeenCalledWith(
        'target_relationships',
        'test:action',
        expect.objectContaining({
          totalTargets: 0,
          relationships: [],
          patterns: [],
          analysisTimeMs: 0,
        })
      );
    });

    it('should not capture for non-traced actions', async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['other:action'],
        verbosity: 'detailed',
      });

      const captureDataSpy = jest.spyOn(trace, 'captureActionData');

      trace.captureTargetRelationships('test:action', {
        totalTargets: 3,
        relationships: [],
      });

      expect(captureDataSpy).not.toHaveBeenCalled();
    });
  });

  describe('getMultiTargetSummary', () => {
    beforeEach(async () => {
      trace = await testBed.createActionAwareTrace({
        actorId: 'test-actor',
        tracedActions: ['test:action'],
        verbosity: 'detailed',
      });
    });

    it('should return multi-target summary for traced action', () => {
      // First capture some multi-target data
      trace.captureMultiTargetResolution('test:action', {
        targetKeys: ['primary', 'secondary'],
        resolvedCounts: { primary: 3, secondary: 2 },
        totalTargets: 5,
        resolutionOrder: ['primary', 'secondary'],
        hasContextDependencies: false,
        resolutionTimeMs: 150,
      });

      const summary = trace.getMultiTargetSummary('test:action');

      expect(summary).toEqual(
        expect.objectContaining({
          isMultiTarget: true,
          targetKeys: ['primary', 'secondary'],
          totalTargets: 5,
          resolutionTimeMs: 150,
          scopeEvaluations: [],
          hasRelationships: false,
        })
      );
    });

    it('should include scope evaluations in summary', () => {
      trace.captureScopeEvaluation('test:action', 'primary', {
        scope: 'actor.followers[]',
        context: 'actor',
        resultCount: 3,
        evaluationTimeMs: 50,
        cacheHit: true,
      });

      const summary = trace.getMultiTargetSummary('test:action');

      expect(summary.scopeEvaluations).toHaveLength(1);
      expect(summary.scopeEvaluations[0]).toEqual(
        expect.objectContaining({
          targetKey: 'primary',
          scope: 'actor.followers[]',
          resultCount: 3,
        })
      );
    });

    it('should include relationship data in summary', () => {
      trace.captureTargetRelationships('test:action', {
        totalTargets: 5,
        relationships: [
          { from: 'target1', to: 'target2', type: 'related' },
          { from: 'target2', to: 'target3', type: 'depends' },
        ],
        patterns: ['hierarchy'],
        analysisTimeMs: 25,
      });

      const summary = trace.getMultiTargetSummary('test:action');

      expect(summary.hasRelationships).toBe(true);
      expect(summary.relationshipCount).toBe(2);
    });

    it('should return null for non-traced action', () => {
      const summary = trace.getMultiTargetSummary('unknown:action');
      expect(summary).toBeNull();
    });

    it('should return empty summary for action without multi-target data', () => {
      // Capture some regular (non-multi-target) data
      trace.captureActionData('component_filtering', 'test:action', {
        passed: true,
      });

      const summary = trace.getMultiTargetSummary('test:action');

      expect(summary).toEqual({
        isMultiTarget: false,
        targetKeys: [],
        totalTargets: 0,
        resolutionTimeMs: 0,
        scopeEvaluations: [],
        hasRelationships: false,
      });
    });

    it('should provide complete summary with all data types', () => {
      // Capture all types of multi-target data
      trace.captureMultiTargetResolution('test:action', {
        targetKeys: ['primary', 'secondary', 'tertiary'],
        resolvedCounts: { primary: 2, secondary: 3, tertiary: 1 },
        totalTargets: 6,
        resolutionOrder: ['primary', 'secondary', 'tertiary'],
        hasContextDependencies: true,
        resolutionTimeMs: 200,
      });

      trace.captureScopeEvaluation('test:action', 'primary', {
        scope: 'actor',
        context: 'actor',
        resultCount: 2,
        evaluationTimeMs: 40,
        cacheHit: false,
      });

      trace.captureTargetRelationships('test:action', {
        totalTargets: 6,
        relationships: [{ from: 'primary', to: 'secondary', type: 'context' }],
        patterns: ['contextual'],
        analysisTimeMs: 15,
      });

      const summary = trace.getMultiTargetSummary('test:action');

      expect(summary).toEqual({
        isMultiTarget: true,
        targetKeys: ['primary', 'secondary', 'tertiary'],
        totalTargets: 6,
        resolutionTimeMs: 200,
        scopeEvaluations: [
          expect.objectContaining({
            targetKey: 'primary',
            scope: 'actor',
            resultCount: 2,
          }),
        ],
        hasRelationships: true,
        relationshipCount: 1,
      });
    });

    it('should include error information in scope evaluations when present', () => {
      // Capture scope evaluation with error
      trace.captureScopeEvaluation('test:action', 'errorTarget', {
        scope: 'invalid.scope[]',
        context: 'actor',
        resultCount: 0,
        evaluationTimeMs: 5,
        cacheHit: false,
        error: 'Scope evaluation failed',
      });

      const summary = trace.getMultiTargetSummary('test:action');

      expect(summary.scopeEvaluations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            targetKey: 'errorTarget',
            scope: 'invalid.scope[]',
            resultCount: 0,
            error: 'Scope evaluation failed',
          }),
        ])
      );
    });
  });
});
