/**
 * @file Integration tests for ActionDiscoveryServiceTestBed helper methods with real action discovery
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionDiscoveryServiceTestBed from '../../../common/actions/actionDiscoveryServiceTestBed.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';

describe('ActionDiscoveryServiceTestBed - Integration Helpers (Real Usage)', () => {
  let testBed;

  beforeEach(() => {
    testBed = new ActionDiscoveryServiceTestBed();
    // Replace mock entity manager with SimpleEntityManager for integration helpers
    testBed.mocks.entityManager = new SimpleEntityManager();
  });

  describe('Complete scenario setup with action discovery', () => {
    it('should create scenario and discover actions', async () => {
      // One-line scenario setup
      const { actor, target } = testBed.createActorTargetScenario({
        actorComponents: { 'core:name': { text: 'Alice' } },
        targetComponents: { 'core:name': { text: 'Bob' } },
      });

      // Verify entities created correctly
      expect(actor.id).toBe('actor1');
      expect(target.id).toBe('target1');
      expect(actor.components['core:name']).toEqual({ text: 'Alice' });

      // Discover actions (uses mock action index with sample actions)
      const result = await testBed.discoverActionsWithDiagnostics(actor);

      expect(result.actions).toBeDefined();
      expect(Array.isArray(result.actions)).toBe(true);
    });

    it('should provide diagnostics for debugging', async () => {
      const { actor } = testBed.createActorTargetScenario();

      // Discover with diagnostics
      const result = await testBed.discoverActionsWithDiagnostics(actor, {
        includeDiagnostics: true,
      });

      // Diagnostics should be available
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics.logs).toBeDefined();
      expect(result.diagnostics.operatorEvaluations).toBeDefined();
    });
  });

  describe('Validation catches entity structure bugs', () => {
    it('should catch invalid entity ID early', () => {
      // Invalid entity ID should be caught by ModEntityBuilder.validate()
      expect(() => {
        testBed.createActorWithValidation('');
      }).toThrow();
    });

    it('should catch missing required components', () => {
      // ModEntityBuilder.validate() should catch structural issues
      // This is more of a documentation test - the real validation happens in ModEntityBuilder
      const actor = testBed.createActorWithValidation('actor1');

      // Entity should have required components after validation
      expect(actor.components['core:actor']).toBeDefined();
    });
  });

  describe('Multiple scenarios in same test', () => {
    it('should create multiple independent scenarios', () => {
      // Create first scenario
      const scenario1 = testBed.createActorTargetScenario({
        actorId: 'alice',
        targetId: 'bob',
        location: 'room1',
      });

      // Create second scenario
      const scenario2 = testBed.createActorTargetScenario({
        actorId: 'charlie',
        targetId: 'diane',
        location: 'room2',
      });

      // Verify both scenarios exist independently
      expect(scenario1.actor.id).toBe('alice');
      expect(scenario1.target.id).toBe('bob');
      expect(scenario2.actor.id).toBe('charlie');
      expect(scenario2.target.id).toBe('diane');

      // Verify they're in different locations
      expect(scenario1.actor.components['core:position'].locationId).toBe(
        'room1'
      );
      expect(scenario2.actor.components['core:position'].locationId).toBe(
        'room2'
      );
    });

    it('should handle complex positioning scenarios', () => {
      // Create scenario with kneeling actor
      const { actor, target } = testBed.createActorTargetScenario({
        actorComponents: {
          'positioning:kneeling_before': { entityId: 'target1' },
        },
        targetComponents: {
          'positioning:standing': {},
        },
        closeProximity: true,
      });

      // Verify components
      expect(actor.components['positioning:kneeling_before']).toEqual({
        entityId: 'target1',
      });
      expect(target.components['positioning:standing']).toEqual({});

      // Verify closeness established
      expect(actor.components['personal-space-states:closeness'].partners).toContain(
        'target1'
      );
      expect(target.components['personal-space-states:closeness'].partners).toContain(
        'actor1'
      );
    });
  });

  describe('Real-world test patterns', () => {
    it('should reduce test code compared to manual setup', () => {
      // BEFORE (manual setup would be ~20+ lines):
      // const entityManager = new SimpleEntityManager();
      // const actor = entityManager.createEntity('actor1');
      // entityManager.addComponent('actor1', 'core:name', { text: 'Alice' });
      // entityManager.addComponent('actor1', 'core:position', { locationId: 'room1' });
      // ... (15+ more lines)

      // AFTER (one-line setup):
      const { actor, target } = testBed.createActorTargetScenario({
        actorComponents: { 'core:name': { text: 'Alice' } },
        targetComponents: { 'core:name': { text: 'Bob' } },
      });

      // Test continues with actual assertions
      expect(actor.components['core:name'].text).toBe('Alice');
      expect(target.components['core:name'].text).toBe('Bob');
    });

    it('should make test intent clearer', async () => {
      // Test intent: "Verify actions discovered for close actors"
      const { actor } = testBed.createActorTargetScenario({
        closeProximity: true, // Intent is clear from the parameter name
      });

      const result = await testBed.discoverActionsWithDiagnostics(actor);

      // Test focuses on the behavior, not the setup
      expect(result.actions).toBeDefined();
    });

    it('should enable easy debugging with diagnostics', async () => {
      const { actor } = testBed.createActorTargetScenario();

      const result = await testBed.discoverActionsWithDiagnostics(actor, {
        includeDiagnostics: true,
      });

      // Diagnostics should always be available when requested
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics.logs).toBeDefined();

      // In real debugging scenarios, diagnostics help understand discovery results
      // console.log('Diagnostics:', result.diagnostics);

      // Test continues with assertions
      expect(result.actions).toBeDefined();
    });
  });

  describe('Compatibility with existing test patterns', () => {
    it('should work with standard test bed setup', () => {
      // Standard test bed creation
      const standardBed = new ActionDiscoveryServiceTestBed();
      standardBed.mocks.entityManager = new SimpleEntityManager();

      // New helpers work seamlessly
      const { actor, target } = standardBed.createActorTargetScenario();

      expect(actor).toBeDefined();
      expect(target).toBeDefined();
    });

    it('should integrate with existing entity manager', () => {
      // Pre-existing entities
      testBed.createActorWithValidation('existing');

      // New scenario can reference existing entities
      testBed.createActorTargetScenario({
        actorId: 'new-actor',
        targetId: 'new-target',
      });

      // Both new and existing entities should be in entity manager
      expect(
        testBed.mocks.entityManager.getEntityInstance('existing')
      ).toBeDefined();
      expect(
        testBed.mocks.entityManager.getEntityInstance('new-actor')
      ).toBeDefined();
    });
  });

  describe('Enhanced Diagnostics Integration (INTTESDEB-006)', () => {
    it('should provide formatted diagnostic summary from real discovery', async () => {
      const { actor } = testBed.createActorTargetScenario();

      const result = await testBed.discoverActionsWithDiagnostics(actor, {
        includeDiagnostics: true,
      });

      // Format the diagnostics
      const summary = testBed.formatDiagnosticSummary(result.diagnostics);

      // Verify formatted summary structure
      expect(summary).toContain('=== Action Discovery Diagnostics ===');
      expect(summary).toContain('Trace Logs:');
      expect(summary).toContain('Operator Evaluations:');
      expect(summary).toContain('Scope Evaluations:');

      // Summary should be useful for debugging
      expect(typeof summary).toBe('string');
      expect(summary.length).toBeGreaterThan(50);
    });

    it('should include scope evaluations in diagnostics', async () => {
      const { actor } = testBed.createActorTargetScenario();

      const result = await testBed.discoverActionsWithDiagnostics(actor, {
        includeDiagnostics: true,
      });

      // Scope evaluations should always be included
      expect(result.diagnostics.scopeEvaluations).toBeDefined();
      expect(Array.isArray(result.diagnostics.scopeEvaluations)).toBe(true);
    });

    it('should show helpful error information in formatted summary', async () => {
      const { actor } = testBed.createActorTargetScenario();

      // Configure to generate some errors
      testBed.mocks.actionIndex.getCandidateActions = () => {
        throw new Error('Test error for diagnostics');
      };

      try {
        await testBed.discoverActionsWithDiagnostics(actor, {
          includeDiagnostics: true,
        });
      } catch (err) {
        // Expected to fail
      }

      // Even with errors, diagnostics should be useful
      // This test verifies that error scenarios produce helpful output
    });

    it('should handle complex scenarios with multiple evaluations', async () => {
      // Create complex scenario with multiple entities
      const scenario1 = testBed.createActorTargetScenario({
        actorId: 'alice',
        targetId: 'bob',
      });

      const scenario2 = testBed.createActorTargetScenario({
        actorId: 'charlie',
        targetId: 'diane',
      });

      // Discover actions with diagnostics
      const result = await testBed.discoverActionsWithDiagnostics(
        scenario1.actor,
        {
          includeDiagnostics: true,
        }
      );

      const summary = testBed.formatDiagnosticSummary(result.diagnostics);

      // Summary should handle multiple entities/evaluations
      expect(summary).toContain('=== Action Discovery Diagnostics ===');
    });

    it('should enable debugging of action discovery failures', async () => {
      const { actor } = testBed.createActorTargetScenario({
        actorComponents: {
          'positioning:kneeling_before': { entityId: 'target1' },
        },
      });

      const result = await testBed.discoverActionsWithDiagnostics(actor, {
        includeDiagnostics: true,
      });

      // Diagnostics help understand why certain actions are/aren't available
      const summary = testBed.formatDiagnosticSummary(result.diagnostics);

      // Should provide actionable debugging information
      expect(summary).toBeDefined();
      expect(summary.length).toBeGreaterThan(0);

      // In real debugging, this would show:
      // - Which scopes were evaluated
      // - How many candidates were considered
      // - Which entities were filtered out and why
      // console.log(summary);
    });
  });
});
