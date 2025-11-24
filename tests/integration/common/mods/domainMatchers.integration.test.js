import { describe, it, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { registerDomainMatchers } from '../../../common/mods/domainMatchers.js';

describe('Domain Matchers - Integration Tests', () => {
  let testFixture;
  let sharedFixture;

  beforeAll(async () => {
    registerDomainMatchers();
    // Create fixture once for all tests - heavy I/O operation
    sharedFixture = await ModTestFixture.forAction('positioning', 'positioning:kneel_before');
  });

  beforeEach(() => {
    // Reuse shared fixture (no I/O, fast)
    testFixture = sharedFixture;
  });

  afterAll(() => {
    if (sharedFixture) {
      sharedFixture.cleanup();
    }
  });

  afterEach(() => {
    // Clear events between tests without destroying fixture
    if (testFixture && testFixture.events) {
      testFixture.events.length = 0;
    }
  });

  describe('Real Action Execution with Domain Matchers', () => {
    it('should test kneel_before action with clear assertions', async () => {
      // Setup: Two actors close to each other
      const room = new ModEntityBuilder('room1').asRoom('Test Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      // Execute
      await testFixture.executeAction('test:actor1', 'test:target1');

      // Assert with domain matchers - much clearer!
      expect(testFixture.events).toHaveActionSuccess('Alice kneels before Bob.');
      expect(testFixture.events).toDispatchEvent('core:perceptible_event');

      // Verify entity state
      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor).toHaveComponent('positioning:kneeling_before');
      expect(updatedActor).toHaveComponentData('positioning:kneeling_before', {
        entityId: 'test:target1',
      });
    });

    it('should test component data after action execution', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Carol')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Queen')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      expect(testFixture.events).toHaveActionSuccess('Carol kneels before Queen.');

      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor).toHaveComponent('positioning:kneeling_before');
      expect(updatedActor).toHaveComponentData('positioning:kneeling_before', {
        entityId: 'test:target1',
      });
    });

    it('should test event dispatching with multiple events', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Dave')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Lord')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      expect(testFixture.events).toHaveActionSuccess('Dave kneels before Lord.');
      expect(testFixture.events).toDispatchEvent('core:perceptible_event');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');
      expect(testFixture.events).toDispatchEvent('core:attempt_action');
    });

    it('should test component data validation', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Eve')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Queen')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');

      // Check component exists and has correct data
      expect(updatedActor).toHaveComponent('positioning:kneeling_before');
      expect(updatedActor).toHaveComponentData('positioning:kneeling_before', {
        entityId: 'test:target1',
      });
    });

    it('should verify entity location with toBeAt', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Living Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Bob')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('King')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      expect(testFixture.events).toHaveActionSuccess('Bob kneels before King.');

      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor).toBeAt('room1');
      expect(updatedActor).not.toBeAt('room2');
    });
  });

  describe('Comparison: Before and After', () => {
    it('demonstrates improvement in readability', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Lord')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      // OLD WAY - verbose event checking (commented out for comparison)
      // const successEvent = testFixture.events.find(e => e.eventType === 'core:display_successful_action_result');
      // expect(successEvent).toBeDefined();
      // expect(successEvent.payload.message).toBe('Alice kneels before Lord.');
      // const actor = testFixture.entityManager.getEntityInstance('test:actor1');
      // expect(actor.components['positioning:kneeling_before']).toBeDefined();
      // expect(actor.components['positioning:standing']).toBeUndefined();

      // NEW WAY - clear domain language
      expect(testFixture.events).toHaveActionSuccess('Alice kneels before Lord.');
      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor).toHaveComponent('positioning:kneeling_before');
      expect(updatedActor).toNotHaveComponent('positioning:standing');
    });

    it('demonstrates error message improvement', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        // NOTE: Actor already kneeling - cannot kneel before another target
        .withComponent('positioning:kneeling_before', { entityId: 'test:other' })
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Lord')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      // Action should throw validation error because actor is already kneeling
      await expect(testFixture.executeAction('test:actor1', 'test:target1')).rejects.toThrow(
        'ACTION EXECUTION VALIDATION FAILED'
      );

      // Verify component wasn't changed
      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor).toHaveComponentData('positioning:kneeling_before', {
        entityId: 'test:other',
      });
    });
  });

  describe('Multi-Entity Scenarios', () => {
    it('should handle multiple actors in same location', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Courtyard').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Knight')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const witness = new ModEntityBuilder('test:witness1')
        .withName('Peasant')
        .atLocation('room1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Lord')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, witness, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      expect(testFixture.events).toHaveActionSuccess('Knight kneels before Lord.');

      // Verify perceptible event was dispatched (witness should see it)
      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.locationId).toBe('room1');
    });

    it('should verify component state after action', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Queen')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      // Execute kneel before action
      await testFixture.executeAction('test:actor1', 'test:target1');

      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor).toHaveComponent('positioning:kneeling_before');
      expect(updatedActor).toNotHaveComponent('positioning:standing');
      expect(updatedActor).toHaveComponentData('positioning:kneeling_before', {
        entityId: 'test:target1',
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle action failure gracefully', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        // Actor already kneeling - cannot kneel again
        .withComponent('positioning:kneeling_before', { entityId: 'test:other' })
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Lord')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      // Should throw validation error because actor is already kneeling
      await expect(testFixture.executeAction('test:actor1', 'test:target1')).rejects.toThrow(
        'ACTION EXECUTION VALIDATION FAILED'
      );
    });

    it('should verify component data for empty values', async () => {
      const entity = {
        id: 'test1',
        components: {
          'core:position': { locationId: '' },
        },
      };

      // Should handle empty string values
      expect(entity).toHaveComponentData('core:position', { locationId: '' });
    });

    it('should verify complex nested component data', async () => {
      const entity = {
        id: 'test1',
        components: {
          'positioning:sitting_on': {
            furniture_id: 'chair1',
            spot_index: 0,
            metadata: {
              comfort_level: 5,
            },
          },
        },
      };

      // Partial match should work (only checks specified keys)
      expect(entity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: 'chair1',
      });

      // Multiple keys should work
      expect(entity).toHaveComponentData('positioning:sitting_on', {
        furniture_id: 'chair1',
        spot_index: 0,
      });
    });
  });

  describe('Negative Assertions in Integration Context', () => {
    it('should use .not with toHaveComponent', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Queen')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');

      // Both forms should work
      expect(updatedActor).not.toHaveComponent('positioning:standing');
      expect(updatedActor).toNotHaveComponent('positioning:standing');
    });

    it('should use .not with toDispatchEvent', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        // Actor already kneeling - action will fail
        .withComponent('positioning:kneeling_before', { entityId: 'test:other' })
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('Lord')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      // Should throw validation error because actor is already kneeling
      await expect(testFixture.executeAction('test:actor1', 'test:target1')).rejects.toThrow(
        'ACTION EXECUTION VALIDATION FAILED'
      );
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should validate complete action workflow', async () => {
      const room = new ModEntityBuilder('room1').asRoom('Living Room').build();
      const actor = new ModEntityBuilder('test:actor1')
        .withName('Alice')
        .atLocation('room1')
        .closeToEntity('test:target1')
        .asActor()
        .build();
      const target = new ModEntityBuilder('test:target1')
        .withName('King')
        .atLocation('room1')
        .closeToEntity('test:actor1')
        .asActor()
        .build();

      testFixture.reset([room, actor, target]);

      await testFixture.executeAction('test:actor1', 'test:target1');

      // Complete workflow validation
      expect(testFixture.events).toHaveActionSuccess('Alice kneels before King.');
      expect(testFixture.events).toDispatchEvent('core:perceptible_event');
      expect(testFixture.events).toDispatchEvent('core:turn_ended');

      const updatedActor = testFixture.entityManager.getEntityInstance('test:actor1');
      expect(updatedActor).toBeAt('room1');
      expect(updatedActor).toHaveComponent('positioning:kneeling_before');
      expect(updatedActor).toNotHaveComponent('positioning:standing');
      expect(updatedActor).toHaveComponentData('positioning:kneeling_before', {
        entityId: 'test:target1',
      });
    });
  });
});
