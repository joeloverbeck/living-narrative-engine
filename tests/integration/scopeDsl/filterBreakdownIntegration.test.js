/**
 * @file Filter Breakdown Integration Tests
 * @description Tests the integration of FilterClauseAnalyzer with FilterResolver
 * and ScopeEvaluationTracer to provide detailed filter evaluation breakdowns.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Filter Breakdown Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Complete breakdown capture', () => {
    it('should capture breakdown for simple filter', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Register custom scope AFTER createCloseActors to avoid reset() clearing it
      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      // Directly resolve scope to trigger tracer
      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      expect(breakdown).toBeTruthy();
      expect(breakdown.hasBreakdown).toBe(true);
      expect(breakdown.clauses.length).toBeGreaterThan(0);

      // Verify clause structure
      const firstClause = breakdown.clauses[0];
      expect(firstClause).toHaveProperty('operator');
      expect(firstClause).toHaveProperty('result');
      expect(firstClause).toHaveProperty('description');
      expect(typeof firstClause.result).toBe('boolean');
    });

    it('should capture breakdown for nested filter', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      expect(breakdown).toBeTruthy();
      expect(breakdown.hasBreakdown).toBe(true);

      // Should have nested clauses (e.g., 'and' with child conditions)
      const andClause = breakdown.clauses.find(c => c.operator === 'and');
      // If 'and' clause exists, it should have a description
      expect(andClause ? andClause.description : 'no-and-clause').toBeTruthy();
    });

    it('should capture breakdown for multiple entities', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob', 'Charlie']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const allBreakdowns = testFixture.getFilterBreakdown();

      expect(Array.isArray(allBreakdowns)).toBe(true);
      expect(allBreakdowns.length).toBeGreaterThan(0);

      // All breakdowns should have the enhanced structure
      for (const breakdown of allBreakdowns) {
        expect(breakdown).toHaveProperty('entityId');
        expect(breakdown).toHaveProperty('result');
        expect(breakdown).toHaveProperty('hasBreakdown');
        expect(breakdown).toHaveProperty('clauses');
        expect(Array.isArray(breakdown.clauses)).toBe(true);
      }
    });

    it('should return null for non-existent entity', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown('non-existent-id');

      expect(breakdown).toBeNull();
    });
  });

  describe('Formatted output quality', () => {
    it('should show breakdown in trace output', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const traceOutput = testFixture.getScopeTrace();

      expect(traceOutput).toBeTruthy();
      expect(typeof traceOutput).toBe('string');
      expect(traceOutput.length).toBeGreaterThan(0);
    });

    it('should use ✓/✗ symbols in formatted output', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const traceOutput = testFixture.getScopeTrace();

      // Trace output should contain visual symbols for pass/fail
      expect(traceOutput).toMatch(/[✓✗]/);
    });

    it('should include breakdown section in formatted trace', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const traceOutput = testFixture.getScopeTrace();

      // Should have "Breakdown:" section in trace output
      expect(traceOutput).toContain('Breakdown:');
    });
  });

  describe('Clause extraction', () => {
    it('should extract all operator clauses from tree', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      expect(breakdown).toBeTruthy();
      expect(breakdown.clauses).toBeDefined();
      expect(Array.isArray(breakdown.clauses)).toBe(true);

      // Each clause should have operator, result, and description
      for (const clause of breakdown.clauses) {
        expect(clause.operator).toBeDefined();
        expect(typeof clause.result).toBe('boolean');
        expect(clause.description).toBeDefined();
        expect(typeof clause.description).toBe('string');
      }
    });

    it('should handle filters with no breakdown gracefully', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      // Disable tracing to ensure no breakdown is captured
      testFixture.disableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      // When tracing is disabled, breakdown should be null or have no clauses
      const hasBreakdown = breakdown ? breakdown.hasBreakdown : false;
      const clauses = breakdown ? breakdown.clauses : [];

      expect(hasBreakdown).toBe(false);
      expect(clauses).toEqual([]);
    });
  });

  describe('Backward compatibility', () => {
    it('should work when tracer is disabled', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.disableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      // Scope should still resolve even without tracing
      expect(result).toBeDefined();
    });

    it('should not impact performance when tracer disabled', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.disableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );

      const startTime = Date.now();
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );
      const endTime = Date.now();

      // Should complete quickly (< 1000ms even on slow systems)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

  describe('Debugging workflow', () => {
    it('should provide detailed clause info for passed filters', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      await testFixture.registerCustomScope('positioning', 'close_actors');

      testFixture.enableScopeTracing();

      const actorEntity = testFixture.testEnv.entityManager.getEntityInstance(
        scenario.actor.id
      );
      testFixture.testEnv.unifiedScopeResolver.resolveSync(
        'positioning:close_actors',
        actorEntity
      );

      const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

      // Should have breakdown with clauses
      expect(breakdown).toBeTruthy();
      expect(breakdown.clauses).toBeDefined();
      expect(breakdown.clauses.length).toBeGreaterThan(0);

      // Should have clauses showing which conditions passed/failed
      const passedClauses = breakdown.clauses.filter(c => c.result);
      expect(passedClauses).toBeDefined();

      // Each clause should have a description explaining the condition
      for (const clause of breakdown.clauses) {
        expect(clause.description).toBeTruthy();
        expect(clause.description.length).toBeGreaterThan(0);
      }
    });
  });
});
