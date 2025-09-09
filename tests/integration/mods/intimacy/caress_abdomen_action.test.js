/**
 * @file Integration tests for the intimacy:caress_abdomen multi-target action
 * @description Tests the complete flow of the caress_abdomen action from
 * discovery through rule execution, verifying enhanced event payload with
 * resolved target IDs and proper message formatting
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import caressAbdomenRule from '../../../../data/mods/intimacy/rules/caress_abdomen.rule.json';
import eventIsActionCaressAbdomen from '../../../../data/mods/intimacy/conditions/event-is-action-caress-abdomen.condition.json';

describe('intimacy:caress_abdomen action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Note: caress_abdomen is a multi-target action that uses primaryId/secondaryId
    // The primary target must be facing away from the actor
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:caress_abdomen',
      caressAbdomenRule,
      eventIsActionCaressAbdomen
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Prerequisites', () => {
    it('action can be triggered when prerequisites are met', async () => {
      const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob']);
      
      // Create clothing entity
      const clothingEntity = {
        id: 'shirt1',
        components: {
          'core:name': { text: 'silk shirt' },
          'core:position': { locationId: 'room1' }
        }
      };
      
      testFixture.reset([...scenario.allEntities, clothingEntity]);
      
      // If prerequisites are met, the action should execute successfully
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:caress_abdomen',
        primaryId: scenario.target.id,
        secondaryId: 'shirt1',
        originalInput: 'caress abdomen'
      });

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      
      // Action executed successfully
      expect(perceptibleEvent).toBeDefined();
    });

    it('verifies closeness requirement through successful execution', async () => {
      const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob']);
      
      // Actors have closeness by default in createMultiActorScenario
      const clothingEntity = {
        id: 'shirt1',
        components: {
          'core:name': { text: 'shirt' },
          'core:position': { locationId: 'room1' }
        }
      };
      
      testFixture.reset([...scenario.allEntities, clothingEntity]);
      
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:caress_abdomen',
        primaryId: scenario.target.id,
        secondaryId: 'shirt1',
        originalInput: 'caress abdomen'
      });

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      
      // Success indicates closeness requirement was met
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toContain('caresses');
    });

    it('works with target facing away from actor', async () => {
      const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob']);
      
      // The default scenario has Bob facing away from Alice
      // This is the expected configuration for this action
      const clothingEntity = {
        id: 'shirt1',
        components: {
          'core:name': { text: 'shirt' },
          'core:position': { locationId: 'room1' }
        }
      };
      
      testFixture.reset([...scenario.allEntities, clothingEntity]);
      
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:caress_abdomen',
        primaryId: scenario.target.id,
        secondaryId: 'shirt1',
        originalInput: 'caress abdomen'
      });

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      
      // Action works when target is facing away
      expect(perceptibleEvent).toBeDefined();
    });
  });

  describe('Rule Execution', () => {
    it('executes with correct message format', async () => {
      const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob']);
      
      // Create clothing entity
      const clothingEntity = {
        id: 'shirt1',
        components: {
          'core:name': { text: 'silk shirt' },
          'core:position': { locationId: 'room1' }
        }
      };
      
      testFixture.reset([...scenario.allEntities, clothingEntity]);
      
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:caress_abdomen',
        primaryId: scenario.target.id,
        secondaryId: 'shirt1',
        originalInput: 'caress abdomen'
      });

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(
        "Alice wraps their arms around Bob, and sensually caresses Bob's abdomen over the silk shirt."
      );
      expect(perceptibleEvent.payload.targetId).toBe(scenario.target.id);
      expect(perceptibleEvent.payload.actorId).toBe(scenario.actor.id);
      expect(perceptibleEvent.payload.perceptionType).toBe('action_target_general');
    });

    it('handles multiple targets correctly', async () => {
      const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob', 'Charlie']);
      
      // Create multiple clothing entities
      const shirt = {
        id: 'shirt1',
        components: {
          'core:name': { text: 'cotton shirt' },
          'core:position': { locationId: 'room1' }
        }
      };
      
      const jacket = {
        id: 'jacket1',
        components: {
          'core:name': { text: 'leather jacket' },
          'core:position': { locationId: 'room1' }
        }
      };
      
      testFixture.reset([...scenario.allEntities, shirt, jacket]);
      
      // Test with different secondary target
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:caress_abdomen',
        primaryId: scenario.target.id,
        secondaryId: 'jacket1',
        originalInput: 'caress abdomen'
      });

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toContain('leather jacket');
    });

    it('works with different entity names and locations', async () => {
      const scenario = testFixture.createCloseActors(['Sarah', 'James'], {
        location: 'garden'
      });
      
      // Ensure James is facing away from Sarah
      scenario.target.components['positioning:facing'] = { facing: 'away' };
      
      const garmentEntity = {
        id: 'garment1',
        components: {
          'core:name': { text: 'sweater' },
          'core:position': { locationId: 'garden' }
        }
      };
      
      testFixture.reset([scenario.actor, scenario.target, garmentEntity]);
      
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:caress_abdomen',
        primaryId: scenario.target.id,
        secondaryId: 'garment1',
        originalInput: 'caress abdomen'
      });

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toContain("Sarah");
      expect(perceptibleEvent.payload.descriptionText).toContain("James");
      expect(perceptibleEvent.payload.descriptionText).toContain("sweater");
      expect(perceptibleEvent.payload.locationId).toBe('garden');
    });

    it('ends turn after successful action', async () => {
      const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob']);
      
      const clothingEntity = {
        id: 'shirt1',
        components: {
          'core:name': { text: 'shirt' },
          'core:position': { locationId: 'room1' }
        }
      };
      
      testFixture.reset([...scenario.allEntities, clothingEntity]);
      
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:caress_abdomen',
        primaryId: scenario.target.id,
        secondaryId: 'shirt1',
        originalInput: 'caress abdomen'
      });

      const turnEndEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      
      expect(turnEndEvent).toBeDefined();
      expect(turnEndEvent.payload.entityId).toBe(scenario.actor.id);
      expect(turnEndEvent.payload.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('rule only fires for correct action ID', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Bob']);

      // Try with a different action
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:kiss_cheek',
        targetId: scenario.target.id,
        originalInput: 'kiss cheek'
      });

      const perceptibleEvent = testFixture.events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      
      // Should not have the caress abdomen message
      expect(perceptibleEvent?.payload?.descriptionText || '').not.toContain('caresses');
      expect(perceptibleEvent?.payload?.descriptionText || '').not.toContain('abdomen');
    });

    it('handles invalid targets gracefully', async () => {
      const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob']);
      
      testFixture.reset(scenario.allEntities);
      
      // Try with invalid secondary target
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:caress_abdomen',
        primaryId: scenario.target.id,
        secondaryId: 'nonexistent',
        originalInput: 'caress abdomen'
      });

      // The action should handle this gracefully (not crash)
      // Check that no unexpected errors were thrown
      const errorEvents = testFixture.events.filter(
        (e) => e.eventType === 'core:error'
      );
      
      // No critical errors should occur
      expect(errorEvents.length).toBe(0);
    });

    it('displays success message to actor', async () => {
      const scenario = testFixture.createMultiActorScenario(['Alice', 'Bob']);
      
      const clothingEntity = {
        id: 'shirt1',
        components: {
          'core:name': { text: 'shirt' },
          'core:position': { locationId: 'room1' }
        }
      };
      
      testFixture.reset([...scenario.allEntities, clothingEntity]);
      
      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'intimacy:caress_abdomen',
        primaryId: scenario.target.id,
        secondaryId: 'shirt1',
        originalInput: 'caress abdomen'
      });

      const successEvent = testFixture.events.find(
        (e) => e.eventType === 'core:display_successful_action_result'
      );
      
      expect(successEvent).toBeDefined();
      expect(successEvent.payload.message).toContain('wraps their arms around');
      expect(successEvent.payload.message).toContain('sensually caresses');
    });
  });
});