/**
 * @file Integration tests for the violence:tear_out_throat action using mod test infrastructure.
 * @description Tests the action execution, component removal, and event generation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios, ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';
import tearOutThroatRule from '../../../../data/mods/violence/rules/handle_tear_out_throat.rule.json';
import eventIsActionTearOutThroat from '../../../../data/mods/violence/conditions/event-is-action-tear-out-throat.condition.json';

describe('Violence Mod: Tear Out Throat Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with explicit rule and condition files
    testFixture = await ModTestFixture.forAction(
      'violence',
      'violence:tear_out_throat',
      tearOutThroatRule,
      eventIsActionTearOutThroat
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Execution', () => {
    it('performs tear out throat action successfully', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // Setup biting relationship
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        "Alice tears out Beth's throat savagely, and arterial blood shoots out from the wound."
      );
    });

    it('removes positioning:biting_neck component from actor', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(
        actorInstance.components['positioning:biting_neck']
      ).toBeUndefined();
    });

    it('removes positioning:being_bitten_in_neck component from target', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );
      expect(
        targetInstance.components['positioning:being_bitten_in_neck']
      ).toBeUndefined();
    });

    it('removes both positioning components', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Verify both components removed
      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      expect(
        actorInstance.components['positioning:biting_neck']
      ).toBeUndefined();
      expect(
        targetInstance.components['positioning:being_bitten_in_neck']
      ).toBeUndefined();
    });
  });

  describe('Component Removal Validation', () => {
    it('only removes actor component when IDs match', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(
        actorInstance.components['positioning:biting_neck']
      ).toBeUndefined();
    });

    it('does not remove actor component when bitten_entity_id does not match', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      // Actor's component references different entity
      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: 'different_entity_id',
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      // This should still execute but not remove the mismatched component
      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      // Component should remain because ID doesn't match
      expect(actorInstance.components['positioning:biting_neck']).toEqual({
        bitten_entity_id: 'different_entity_id',
        initiated: true,
        consented: false,
      });
    });

    it('does not remove target component when biting_entity_id does not match', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      // Target's component references different entity
      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: 'different_actor_id',
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );
      // Component should remain because ID doesn't match
      expect(
        targetInstance.components['positioning:being_bitten_in_neck']
      ).toEqual({
        biting_entity_id: 'different_actor_id',
        consented: false,
      });
    });

    it('does not affect other components', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      // Add other components that should not be affected
      scenario.actor.components['core:actor'] = { name: 'Vampire' };
      scenario.target.components['core:actor'] = { name: 'Victim' };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      const targetInstance = testFixture.entityManager.getEntityInstance(
        scenario.target.id
      );

      // Other components should remain intact
      expect(actorInstance.components['core:actor']).toEqual({
        name: 'Vampire',
      });
      expect(targetInstance.components['core:actor']).toEqual({
        name: 'Victim',
      });
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText:
          "Alice tears out Beth's throat savagely, and arterial blood shoots out from the wound.",
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('uses correct actor and target names in message', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Dracula',
        'Jonathan',
      ]);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Castle');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        "Dracula tears out Jonathan's throat savagely, and arterial blood shoots out from the wound."
      );
    });
  });

  describe('Error Handling', () => {
    it('handles missing target gracefully', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Beth']);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: 'nonexistent',
        initiated: true,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      // Pre-flight validation should catch missing entities
      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, 'nonexistent');
      }).rejects.toThrow(ActionValidationError);
    });

    it('does not fire rule for different action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'core:wait',
        originalInput: 'wait',
      };

      await testFixture.eventBus.dispatch('core:attempt_action', payload);

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });

  describe('Rule Isolation', () => {
    it('only responds to violence:tear_out_throat action', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      const payload = {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'violence:grab_neck',
        targetId: scenario.target.id,
        originalInput: 'grab neck',
      };

      await testFixture.eventBus.dispatch('core:attempt_action', payload);

      // Rule should not fire for grab_neck action
      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });

    it('does not affect unrelated entities', async () => {
      const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

      // Create unrelated entity using ModEntityBuilder
      const unrelatedEntity = new ModEntityBuilder('charlie')
        .withName('Charlie')
        .atLocation('room1')
        .asActor()
        .build();

      unrelatedEntity.components['positioning:closeness'] = { partners: [] };
      unrelatedEntity.components['positioning:biting_neck'] = {
        bitten_entity_id: 'someone_else',
        initiated: true,
        consented: false,
      };

      scenario.actor.components['positioning:biting_neck'] = {
        bitten_entity_id: scenario.target.id,
        initiated: true,
        consented: false,
      };

      scenario.target.components['positioning:being_bitten_in_neck'] = {
        biting_entity_id: scenario.actor.id,
        consented: false,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([
        room,
        scenario.actor,
        scenario.target,
        unrelatedEntity,
      ]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      // Unrelated entity should still have its component
      const charlie = testFixture.entityManager.getEntityInstance('charlie');
      expect(charlie.getComponentData('positioning:biting_neck')).toEqual({
        bitten_entity_id: 'someone_else',
        initiated: true,
        consented: false,
      });
    });
  });
});
