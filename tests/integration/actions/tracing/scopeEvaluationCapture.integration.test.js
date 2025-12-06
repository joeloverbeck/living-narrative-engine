import { describe, it, expect } from '@jest/globals';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';

describe('Scope Evaluation Capture - Integration Tests', () => {
  describe('Real Scope Resolution with Tracing', () => {
    it('should capture successful scope resolution', () => {
      const trace = new TraceContext();

      // Simulate entity IDs
      const actorId = 'actor-1';
      const target1Id = 'target-1';
      const target2Id = 'target-2';

      // Simulate scope evaluation capture for nearby entities
      const scopeId = 'test:nearby_entities';
      trace.captureScopeEvaluation({
        scopeId: scopeId,
        actorId: actorId,
        candidateEntities: [target1Id, target2Id],
        resolvedEntities: [target1Id, target2Id],
        success: true,
        context: {
          actorId: actorId,
          hasFilters: false,
        },
      });

      // Verify scope evaluation was captured
      const scopeEvaluations = trace.getScopeEvaluations();

      expect(scopeEvaluations).toHaveLength(1);
      expect(scopeEvaluations[0]).toMatchObject({
        type: 'scope_evaluation',
        scopeId: scopeId,
        actorId: actorId,
        candidateEntities: [target1Id, target2Id],
        resolvedEntities: [target1Id, target2Id],
        success: true,
      });
      expect(scopeEvaluations[0].capturedAt).toBeGreaterThan(0);
    });

    it('should capture failed scope resolution', () => {
      const trace = new TraceContext();

      const actorId = 'actor-1';
      const scopeId = 'test:nonexistent_scope';

      // Simulate failed scope resolution
      trace.captureScopeEvaluation({
        scopeId: scopeId,
        actorId: actorId,
        candidateEntities: [],
        resolvedEntities: [],
        success: false,
        context: {
          actorId: actorId,
          hasFilters: true,
          error: 'Scope not found',
        },
      });

      const scopeEvaluations = trace.getScopeEvaluations();

      expect(scopeEvaluations).toHaveLength(1);
      expect(scopeEvaluations[0]).toMatchObject({
        type: 'scope_evaluation',
        scopeId: scopeId,
        actorId: actorId,
        candidateEntities: [],
        resolvedEntities: [],
        success: false,
      });
    });

    it('should capture multiple scope evaluations in same trace', () => {
      const trace = new TraceContext();

      const actorId = 'actor-1';
      const target1Id = 'target-1';
      const target2Id = 'target-2';

      // First scope evaluation
      trace.captureScopeEvaluation({
        scopeId: 'test:first_scope',
        actorId: actorId,
        candidateEntities: [target1Id, target2Id],
        resolvedEntities: [target1Id],
        success: true,
        context: { stage: 'first' },
      });

      // Second scope evaluation
      trace.captureScopeEvaluation({
        scopeId: 'test:second_scope',
        actorId: actorId,
        candidateEntities: [target2Id],
        resolvedEntities: [target2Id],
        success: true,
        context: { stage: 'second' },
      });

      // Third scope evaluation
      trace.captureScopeEvaluation({
        scopeId: 'test:third_scope',
        actorId: actorId,
        candidateEntities: [],
        resolvedEntities: [],
        success: false,
        context: { stage: 'third' },
      });

      const scopeEvaluations = trace.getScopeEvaluations();

      expect(scopeEvaluations).toHaveLength(3);
      expect(scopeEvaluations[0].scopeId).toBe('test:first_scope');
      expect(scopeEvaluations[1].scopeId).toBe('test:second_scope');
      expect(scopeEvaluations[2].scopeId).toBe('test:third_scope');

      // Verify ordering is preserved (use less-than-or-equal for timing tolerance)
      expect(scopeEvaluations[0].capturedAt).toBeLessThanOrEqual(
        scopeEvaluations[1].capturedAt
      );
      expect(scopeEvaluations[1].capturedAt).toBeLessThanOrEqual(
        scopeEvaluations[2].capturedAt
      );
    });

    it('should capture scope evaluation with filter results', () => {
      const trace = new TraceContext();

      const actorId = 'actor-1';
      const target1Id = 'target-1';
      const target2Id = 'target-2';
      const target3Id = 'target-3';

      // Capture scope evaluation with detailed filter results
      trace.captureScopeEvaluation({
        scopeId: 'affection:close_actors_facing_each_other',
        actorId: actorId,
        candidateEntities: [target1Id, target2Id, target3Id],
        resolvedEntities: [target1Id, target3Id],
        success: true,
        context: {
          actorId: actorId,
          hasFilters: true,
        },
        filterResults: [
          {
            filter: { '==': [{ var: 'facing.direction' }, 'toward'] },
            passed: [target1Id, target3Id],
            failed: [target2Id],
            reason: 'Facing direction filter',
          },
        ],
      });

      const scopeEvaluations = trace.getScopeEvaluations();

      expect(scopeEvaluations).toHaveLength(1);
      expect(scopeEvaluations[0].filterResults).toHaveLength(1);
      expect(scopeEvaluations[0].filterResults[0]).toMatchObject({
        passed: [target1Id, target3Id],
        failed: [target2Id],
        reason: 'Facing direction filter',
      });
    });
  });

  describe('Integration with Other Trace Methods', () => {
    it('should work alongside operator evaluations and other logs', () => {
      const trace = new TraceContext();

      const actorId = 'actor-1';
      const targetId = 'target-1';

      // Add various trace entries
      trace.info('Starting action discovery', 'ActionDiscovery');

      trace.captureOperatorEvaluation({
        operator: 'hasComponent',
        entityId: targetId,
        result: true,
        reason: 'Entity has required component',
      });

      trace.captureScopeEvaluation({
        scopeId: 'test:nearby_actors',
        actorId: actorId,
        candidateEntities: [targetId],
        resolvedEntities: [targetId],
        success: true,
      });

      trace.step('Validating targets', 'ActionValidator');

      // Verify all log types coexist
      expect(trace.logs).toHaveLength(4);

      // Verify specialized getters work independently
      expect(trace.getOperatorEvaluations()).toHaveLength(1);
      expect(trace.getScopeEvaluations()).toHaveLength(1);

      // Verify they don't interfere with each other
      const operatorEval = trace.getOperatorEvaluations()[0];
      const scopeEval = trace.getScopeEvaluations()[0];

      expect(operatorEval.operator).toBe('hasComponent');
      expect(scopeEval.scopeId).toBe('test:nearby_actors');
    });

    it('should preserve log ordering across different evaluation types', () => {
      const trace = new TraceContext();

      const actorId = 'actor-1';

      // Interleave different log types
      trace.captureScopeEvaluation({
        scopeId: 'first:scope',
        actorId: actorId,
        candidateEntities: [],
        resolvedEntities: [],
      });

      trace.captureOperatorEvaluation({
        operator: 'firstOp',
        entityId: actorId,
        result: true,
      });

      trace.captureScopeEvaluation({
        scopeId: 'second:scope',
        actorId: actorId,
        candidateEntities: [],
        resolvedEntities: [],
      });

      trace.captureOperatorEvaluation({
        operator: 'secondOp',
        entityId: actorId,
        result: false,
      });

      // Verify total logs
      expect(trace.logs).toHaveLength(4);

      // Verify filtered results maintain original order
      const scopeEvals = trace.getScopeEvaluations();
      const operatorEvals = trace.getOperatorEvaluations();

      expect(scopeEvals.map((e) => e.scopeId)).toEqual([
        'first:scope',
        'second:scope',
      ]);
      expect(operatorEvals.map((e) => e.operator)).toEqual([
        'firstOp',
        'secondOp',
      ]);
    });
  });
});
