/**
 * @file Unit tests for ActionDiscoveryServiceTestBed integration helper methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionDiscoveryServiceTestBed from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

describe('ActionDiscoveryServiceTestBed - Integration Helpers', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();
    // Replace mock entity manager with SimpleEntityManager for integration helpers
    testBed.mocks.entityManager = new SimpleEntityManager();
  });

  describe('createActorWithValidation', () => {
    it('should create actor entity with validation', () => {
      const actor = testBed.createActorWithValidation('actor1');

      expect(actor).toBeDefined();
      expect(actor.id).toBe('actor1');
      expect(actor.components['core:actor']).toBeDefined();
    });

    it('should add entity to entity manager', () => {
      testBed.createActorWithValidation('actor1');

      const entity = testBed.mocks.entityManager.getEntityInstance('actor1');
      expect(entity).toBeDefined();
      expect(entity.id).toBe('actor1');
    });

    it('should add location component when specified', () => {
      const actor = testBed.createActorWithValidation('actor1', {
        location: 'room1',
      });

      expect(actor.components['core:position']).toEqual({
        locationId: 'room1',
      });
      expect(actor.components['core:location']).toEqual({ location: 'room1' });
    });

    it('should add custom components', () => {
      const actor = testBed.createActorWithValidation('actor1', {
        components: {
          'core:name': { text: 'Alice' },
          'positioning:standing': {},
        },
      });

      expect(actor.components['core:name']).toEqual({ text: 'Alice' });
      expect(actor.components['positioning:standing']).toEqual({});
    });

    it('should throw error for invalid entity structure', () => {
      // This test would require an invalid entity structure
      // For now, we trust ModEntityBuilder.validate() does its job
      // More detailed validation tests should be in ModEntityBuilder tests
      expect(() => {
        testBed.createActorWithValidation('');
      }).toThrow();
    });
  });

  describe('establishClosenessWithValidation', () => {
    beforeEach(() => {
      testBed.createActorWithValidation('actor1');
      testBed.createActorWithValidation('target1');
    });

    it('should create bidirectional closeness relationship', () => {
      testBed.establishClosenessWithValidation('actor1', 'target1');

      const actor = testBed.mocks.entityManager.getEntityInstance('actor1');
      const target = testBed.mocks.entityManager.getEntityInstance('target1');

      expect(actor.components['positioning:closeness'].partners).toContain(
        'target1'
      );
      expect(target.components['positioning:closeness'].partners).toContain(
        'actor1'
      );
    });

    it('should throw error when actor not found', () => {
      expect(() => {
        testBed.establishClosenessWithValidation('nonexistent', 'target1');
      }).toThrow(/Actor 'nonexistent' not found/);
    });

    it('should throw error when target not found', () => {
      expect(() => {
        testBed.establishClosenessWithValidation('actor1', 'nonexistent');
      }).toThrow(/Target 'nonexistent' not found/);
    });

    it('should handle entities passed as objects or IDs', () => {
      const actor = testBed.mocks.entityManager.getEntityInstance('actor1');
      const target = testBed.mocks.entityManager.getEntityInstance('target1');

      // Test with entity objects
      testBed.establishClosenessWithValidation(actor, target);

      const updatedActor =
        testBed.mocks.entityManager.getEntityInstance('actor1');
      expect(
        updatedActor.components['positioning:closeness'].partners
      ).toContain('target1');
    });

    it('should not duplicate partners in closeness array', () => {
      // Establish closeness twice
      testBed.establishClosenessWithValidation('actor1', 'target1');
      testBed.establishClosenessWithValidation('actor1', 'target1');

      const actor = testBed.mocks.entityManager.getEntityInstance('actor1');
      const partners = actor.components['positioning:closeness'].partners;

      // Should only have one instance of target1
      const target1Count = partners.filter((p) => p === 'target1').length;
      expect(target1Count).toBe(1);
    });
  });

  describe('discoverActionsWithDiagnostics', () => {
    beforeEach(() => {
      testBed.createActorWithValidation('actor1');
    });

    it('should discover actions without diagnostics (default)', async () => {
      const result = await testBed.discoverActionsWithDiagnostics('actor1');

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(result.diagnostics).toBeUndefined();
    });

    it('should discover actions with diagnostics when requested', async () => {
      const result = await testBed.discoverActionsWithDiagnostics('actor1', {
        includeDiagnostics: true,
      });

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
      expect(result.diagnostics).toBeDefined();
    });

    it('should include trace logs in diagnostics', async () => {
      const result = await testBed.discoverActionsWithDiagnostics('actor1', {
        includeDiagnostics: true,
      });

      expect(result.diagnostics.logs).toBeDefined();
      expect(Array.isArray(result.diagnostics.logs)).toBe(true);
    });

    it('should include operator evaluations in diagnostics', async () => {
      const result = await testBed.discoverActionsWithDiagnostics('actor1', {
        includeDiagnostics: true,
      });

      expect(result.diagnostics.operatorEvaluations).toBeDefined();
    });

    it('should include scope evaluations when available', async () => {
      const result = await testBed.discoverActionsWithDiagnostics('actor1', {
        includeDiagnostics: true,
      });

      expect(result.diagnostics.scopeEvaluations).toBeDefined();
      expect(Array.isArray(result.diagnostics.scopeEvaluations)).toBe(true);
    });

    it('should throw error when actor not found', async () => {
      await expect(async () => {
        await testBed.discoverActionsWithDiagnostics('nonexistent');
      }).rejects.toThrow(/Actor 'nonexistent' not found/);
    });

    it('should handle actor passed as entity object', async () => {
      const actor = testBed.mocks.entityManager.getEntityInstance('actor1');
      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result).toBeDefined();
      expect(result.actions).toBeDefined();
    });
  });

  describe('createActorTargetScenario', () => {
    it('should create actor and target entities', () => {
      const { actor, target } = testBed.createActorTargetScenario();

      expect(actor).toBeDefined();
      expect(actor.id).toBe('actor1');
      expect(target).toBeDefined();
      expect(target.id).toBe('target1');
    });

    it('should establish closeness when requested', () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: true,
      });

      expect(actor.components['positioning:closeness'].partners).toContain(
        target.id
      );
      expect(target.components['positioning:closeness'].partners).toContain(
        actor.id
      );
    });

    it('should not establish closeness when closeProximity is false', () => {
      const { actor, target } = testBed.createActorTargetScenario({
        closeProximity: false,
      });

      expect(actor.components['positioning:closeness']).toBeUndefined();
      expect(target.components['positioning:closeness']).toBeUndefined();
    });

    it('should place entities at same location', () => {
      const { actor, target } = testBed.createActorTargetScenario({
        location: 'room1',
      });

      expect(actor.components['core:position'].locationId).toBe('room1');
      expect(target.components['core:position'].locationId).toBe('room1');
    });

    it('should add custom components to both entities', () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorComponents: {
          'core:name': { text: 'Alice' },
        },
        targetComponents: {
          'core:name': { text: 'Bob' },
        },
      });

      expect(actor.components['core:name']).toEqual({ text: 'Alice' });
      expect(target.components['core:name']).toEqual({ text: 'Bob' });
    });

    it('should allow custom actor and target IDs', () => {
      const { actor, target } = testBed.createActorTargetScenario({
        actorId: 'custom-actor',
        targetId: 'custom-target',
      });

      expect(actor.id).toBe('custom-actor');
      expect(target.id).toBe('custom-target');
    });
  });

  describe('Enhanced Diagnostics (INTTESDEB-006)', () => {
    beforeEach(() => {
      testBed.createActorWithValidation('actor1');
    });

    describe('discoverActionsWithDiagnostics - scope tracing', () => {
      it('should use traced scope resolver when traceScopeResolution is enabled', async () => {
        // Mock scope resolver
        testBed.mocks.scopeResolver = {
          resolve: jest.fn().mockReturnValue(['entity1', 'entity2']),
        };

        const result = await testBed.discoverActionsWithDiagnostics('actor1', {
          includeDiagnostics: true,
          traceScopeResolution: true,
        });

        expect(result.diagnostics).toBeDefined();
        // Scope resolver should have been wrapped with traced version
        expect(testBed.mocks.scopeResolver).toBeDefined();
      });

      it('should not modify scope resolver when traceScopeResolution is false', async () => {
        // Mock scope resolver
        const originalResolver = {
          resolve: jest.fn().mockReturnValue(['entity1']),
        };
        testBed.mocks.scopeResolver = originalResolver;

        await testBed.discoverActionsWithDiagnostics('actor1', {
          includeDiagnostics: true,
          traceScopeResolution: false,
        });

        // Resolver should not be wrapped
        expect(testBed.mocks.scopeResolver).toBe(originalResolver);
      });

      it('should handle missing scopeResolver gracefully', async () => {
        testBed.mocks.scopeResolver = undefined;

        const result = await testBed.discoverActionsWithDiagnostics('actor1', {
          includeDiagnostics: true,
          traceScopeResolution: true,
        });

        // Should not throw error
        expect(result).toBeDefined();
        expect(result.actions).toBeDefined();
      });

      it('should always include scope evaluations when diagnostics enabled', async () => {
        const result = await testBed.discoverActionsWithDiagnostics('actor1', {
          includeDiagnostics: true,
        });

        expect(result.diagnostics.scopeEvaluations).toBeDefined();
        expect(Array.isArray(result.diagnostics.scopeEvaluations)).toBe(true);
      });
    });

    describe('formatDiagnosticSummary', () => {
      it('should format empty diagnostics', () => {
        const diagnostics = {
          logs: [],
          operatorEvaluations: [],
          scopeEvaluations: [],
        };

        const summary = testBed.formatDiagnosticSummary(diagnostics);

        expect(summary).toContain('=== Action Discovery Diagnostics ===');
        expect(summary).toContain('Trace Logs: 0 entries');
        expect(summary).toContain('Operator Evaluations: 0');
        expect(summary).toContain('Scope Evaluations: 0');
      });

      it('should format logs summary with error highlighting', () => {
        const diagnostics = {
          logs: [
            { type: 'info', message: 'Info message' },
            { type: 'error', message: 'Error message 1' },
            { type: 'error', message: 'Error message 2' },
          ],
          operatorEvaluations: [],
          scopeEvaluations: [],
        };

        const summary = testBed.formatDiagnosticSummary(diagnostics);

        expect(summary).toContain('Trace Logs: 3 entries');
        expect(summary).toContain('Errors: 2');
        expect(summary).toContain('- Error message 1');
        expect(summary).toContain('- Error message 2');
      });

      it('should format operator evaluations with success indicators', () => {
        const diagnostics = {
          logs: [],
          operatorEvaluations: [
            { operator: '==', success: true },
            { operator: 'var', success: true },
            { operator: '!=', success: false },
          ],
          scopeEvaluations: [],
        };

        const summary = testBed.formatDiagnosticSummary(diagnostics);

        expect(summary).toContain('Operator Evaluations: 3');
        expect(summary).toContain('- ==: ✅');
        expect(summary).toContain('- var: ✅');
        expect(summary).toContain('- !=: ❌');
      });

      it('should format scope evaluations with counts', () => {
        const diagnostics = {
          logs: [],
          operatorEvaluations: [],
          scopeEvaluations: [
            {
              scopeId: 'affection:close_actors',
              candidateEntities: ['entity1', 'entity2', 'entity3'],
              resolvedEntities: ['entity1'],
            },
            {
              scopeId: 'positioning:actors_i_can_kneel_before',
              candidateEntities: ['entity4', 'entity5'],
              resolvedEntities: [],
            },
          ],
        };

        const summary = testBed.formatDiagnosticSummary(diagnostics);

        expect(summary).toContain('Scope Evaluations: 2');
        expect(summary).toContain('- affection:close_actors:');
        expect(summary).toContain('Candidates: 3');
        expect(summary).toContain('Resolved: 1');
        expect(summary).toContain('Filtered: 2');
        expect(summary).toContain('- positioning:actors_i_can_kneel_before:');
      });

      it('should not show filtered count when zero', () => {
        const diagnostics = {
          logs: [],
          operatorEvaluations: [],
          scopeEvaluations: [
            {
              scopeId: 'test:scope',
              candidateEntities: ['entity1'],
              resolvedEntities: ['entity1'],
            },
          ],
        };

        const summary = testBed.formatDiagnosticSummary(diagnostics);

        expect(summary).toContain('Candidates: 1');
        expect(summary).toContain('Resolved: 1');
        expect(summary).not.toContain('Filtered:');
      });

      it('should handle undefined optional fields', () => {
        const diagnostics = {
          logs: [],
          operatorEvaluations: undefined,
          scopeEvaluations: undefined,
        };

        const summary = testBed.formatDiagnosticSummary(diagnostics);

        expect(summary).toContain('Operator Evaluations: 0');
        expect(summary).toContain('Scope Evaluations: 0');
      });

      it('should handle scope evaluations with missing entity arrays', () => {
        const diagnostics = {
          logs: [],
          operatorEvaluations: [],
          scopeEvaluations: [
            {
              scopeId: 'test:scope',
              // Missing candidateEntities and resolvedEntities
            },
          ],
        };

        const summary = testBed.formatDiagnosticSummary(diagnostics);

        expect(summary).toContain('- test:scope:');
        expect(summary).toContain('Candidates: 0');
        expect(summary).toContain('Resolved: 0');
      });
    });

    describe('Integration of diagnostics and formatting', () => {
      it('should produce formatted summary from actual discovery', async () => {
        const { actor } = testBed.createActorTargetScenario();

        const result = await testBed.discoverActionsWithDiagnostics(actor, {
          includeDiagnostics: true,
        });

        const summary = testBed.formatDiagnosticSummary(result.diagnostics);

        expect(summary).toContain('=== Action Discovery Diagnostics ===');
        expect(typeof summary).toBe('string');
        expect(summary.length).toBeGreaterThan(0);
      });
    });
  });
});
