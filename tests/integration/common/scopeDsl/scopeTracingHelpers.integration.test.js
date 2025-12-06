/**
 * @file Integration tests for scope tracing helpers with real scope resolver
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createTracedScopeResolver,
  formatScopeEvaluationSummary,
  traceScopeEvaluation,
} from '../../../common/scopeDsl/scopeTracingHelpers.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

describe('scopeTracingHelpers - Integration with Real Resolver', () => {
  let scopeResolver;
  let entityManager;
  let actor;

  beforeEach(() => {
    // Create entity manager
    entityManager = new SimpleEntityManager();

    // Create a simple mock scope resolver with jest
    scopeResolver = {
      resolve: jest.fn(),
    };

    // Create actor entity
    actor = {
      id: 'actor1',
      components: {
        'core:name': { text: 'Alice' },
      },
    };
    entityManager.addEntity(actor);
  });

  describe('Trace successful scope resolution', () => {
    it('should trace scope with multiple candidates', () => {
      // Setup: Add entities that will be candidates
      const target1 = {
        id: 'target1',
        components: { 'core:name': { text: 'Bob' } },
      };
      const target2 = {
        id: 'target2',
        components: { 'core:name': { text: 'Carol' } },
      };
      entityManager.addEntity(target1);
      entityManager.addEntity(target2);

      // Configure mock resolver to return both targets
      scopeResolver.resolve.mockReturnValue(['target1', 'target2']);

      const traceContext = new TraceContext();
      const tracedResolver = createTracedScopeResolver(
        scopeResolver,
        traceContext
      );

      // Act: Resolve scope
      const result = tracedResolver.resolve('test:close_actors', {
        actor,
        candidates: ['target1', 'target2'],
      });

      // Assert: Results are correct
      expect(result).toEqual(['target1', 'target2']);

      // Assert: Trace captured evaluation
      const scopeEvals = traceContext.getScopeEvaluations();
      expect(scopeEvals).toHaveLength(1);
      expect(scopeEvals[0]).toMatchObject({
        scopeId: 'test:close_actors',
        actorId: 'actor1',
        candidateEntities: ['target1', 'target2'],
        resolvedEntities: ['target1', 'target2'],
        success: true,
      });

      // Assert: Trace has logs
      expect(traceContext.logs.length).toBeGreaterThan(0);
    });

    it('should trace scope with filters', () => {
      // Setup: Configure resolver with filtering logic
      scopeResolver.resolve.mockImplementation(() => {
        // Simulate filtering: only return target1
        return ['target1'];
      });

      const traceContext = new TraceContext();
      const tracedResolver = createTracedScopeResolver(
        scopeResolver,
        traceContext
      );

      // Act: Resolve scope with filters
      const result = tracedResolver.resolve('test:filtered_scope', {
        actor,
        candidates: ['target1', 'target2', 'target3'],
        filters: [{ component: 'core:visible' }],
      });

      // Assert: Only filtered results returned
      expect(result).toEqual(['target1']);

      // Assert: Trace shows filtering occurred
      const scopeEvals = traceContext.getScopeEvaluations();
      expect(scopeEvals[0].candidateEntities).toHaveLength(3);
      expect(scopeEvals[0].resolvedEntities).toHaveLength(1);
    });
  });

  describe('Trace scope with no candidates', () => {
    it('should handle empty scope resolution', () => {
      // Setup: Resolver returns empty
      scopeResolver.resolve.mockReturnValue([]);

      const traceContext = new TraceContext();
      const tracedResolver = createTracedScopeResolver(
        scopeResolver,
        traceContext
      );

      // Act: Resolve scope
      const result = tracedResolver.resolve('test:empty_scope', {
        actor,
        candidates: [],
      });

      // Assert: Empty result
      expect(result).toEqual([]);

      // Assert: Trace captured empty evaluation
      const scopeEvals = traceContext.getScopeEvaluations();
      expect(scopeEvals[0]).toMatchObject({
        scopeId: 'test:empty_scope',
        candidateEntities: [],
        resolvedEntities: [],
        success: true,
      });
    });
  });

  describe('Trace scope resolution failure', () => {
    it('should capture error when scope resolution fails', () => {
      // Setup: Resolver throws error
      scopeResolver.resolve.mockImplementation(() => {
        throw new Error('Scope definition not found');
      });

      const traceContext = new TraceContext();
      const tracedResolver = createTracedScopeResolver(
        scopeResolver,
        traceContext
      );

      // Act & Assert: Error is thrown
      expect(() => {
        tracedResolver.resolve('test:invalid_scope', { actor });
      }).toThrow('Scope definition not found');

      // Assert: Trace captured failure
      const scopeEvals = traceContext.getScopeEvaluations();
      expect(scopeEvals[0]).toMatchObject({
        scopeId: 'test:invalid_scope',
        actorId: 'actor1',
        success: false,
        error: 'Scope definition not found',
      });

      // Assert: Error logged
      expect(traceContext.logs.some((log) => log.type === 'error')).toBe(true);
    });
  });

  describe('Format summary for debugging', () => {
    it('should produce readable formatted output', () => {
      // Setup: Add multiple scope evaluations
      scopeResolver.resolve
        .mockReturnValueOnce(['target1'])
        .mockReturnValueOnce([])
        .mockImplementationOnce(() => {
          throw new Error('Scope not found');
        });

      const traceContext = new TraceContext();
      const tracedResolver = createTracedScopeResolver(
        scopeResolver,
        traceContext
      );

      // Act: Perform multiple resolutions
      tracedResolver.resolve('test:scope1', {
        actor,
        candidates: ['target1', 'target2'],
      });

      tracedResolver.resolve('test:scope2', {
        actor,
        candidates: [],
      });

      try {
        tracedResolver.resolve('test:scope3', { actor });
      } catch {
        // Expected error
      }

      // Act: Format summary
      const summary = formatScopeEvaluationSummary(traceContext);

      // Assert: Summary is readable
      expect(summary).toContain('=== Scope Evaluation Summary ===');
      expect(summary).toContain('Scope: test:scope1');
      expect(summary).toContain('Candidates: 2');
      expect(summary).toContain('Resolved: 1');
      expect(summary).toContain('Filtered out: 1');

      expect(summary).toContain('Scope: test:scope2');
      expect(summary).toContain('Candidates: 0');
      expect(summary).toContain('Resolved: 0');

      expect(summary).toContain('Scope: test:scope3');
      expect(summary).toContain('❌ Failed: Scope not found');

      // Log summary for manual inspection (visible in test output with --verbose)
      console.log('Formatted Summary:\n', summary);
    });
  });

  describe('traceScopeEvaluation convenience function', () => {
    it('should provide complete tracing in one call', () => {
      // Setup: Configure resolver
      scopeResolver.resolve.mockReturnValue(['target1', 'target2']);

      // Act: One-line trace evaluation
      const result = traceScopeEvaluation({
        scopeId: 'test:convenience_scope',
        actor,
        scopeResolver,
        context: {
          candidates: ['target1', 'target2', 'target3'],
        },
      });

      // Assert: Complete result structure
      expect(result).toMatchObject({
        success: true,
        resolvedEntities: ['target1', 'target2'],
      });

      // Assert: Trace and summary included
      expect(result.trace).toBeInstanceOf(TraceContext);
      expect(result.summary).toContain('=== Scope Evaluation Summary ===');
      expect(result.summary).toContain('Scope: test:convenience_scope');
      expect(result.summary).toContain('Candidates: 3');
      expect(result.summary).toContain('Resolved: 2');
    });

    it('should handle failure in convenience function', () => {
      // Setup: Resolver fails
      scopeResolver.resolve.mockImplementation(() => {
        throw new Error('Invalid scope definition');
      });

      // Act: Trace evaluation
      const result = traceScopeEvaluation({
        scopeId: 'test:failing_scope',
        actor,
        scopeResolver,
      });

      // Assert: Failure result structure
      expect(result).toMatchObject({
        success: false,
        error: 'Invalid scope definition',
      });

      // Assert: Trace and summary still available
      expect(result.trace).toBeInstanceOf(TraceContext);
      expect(result.summary).toContain('❌ Failed: Invalid scope definition');
    });

    it('should work with minimal context', () => {
      // Setup: Resolver returns result
      scopeResolver.resolve.mockReturnValue(['target1']);

      // Act: Minimal call
      const result = traceScopeEvaluation({
        scopeId: 'test:minimal',
        actor,
        scopeResolver,
      });

      // Assert: Works without extra context
      expect(result.success).toBe(true);
      expect(result.resolvedEntities).toEqual(['target1']);
    });
  });

  describe('Real-world debugging scenario', () => {
    it('should help debug why action was not discovered', () => {
      // Scenario: Action requires close actors, but none are close
      scopeResolver.resolve.mockReturnValue([]); // No close actors found

      const result = traceScopeEvaluation({
        scopeId: 'affection:close_actors_facing_each_other',
        actor,
        scopeResolver,
        context: {
          candidates: ['target1', 'target2', 'target3'],
        },
      });

      // Developer can inspect summary to understand why
      expect(result.summary).toContain('Candidates: 3');
      expect(result.summary).toContain('Resolved: 0');
      expect(result.summary).toContain('Filtered out: 3');

      // This tells developer: "3 candidates but all filtered out"
      // Next step: inspect filters or component requirements
    });
  });
});
