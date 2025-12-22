/**
 * @file Integration tests for distress:throw_self_to_ground.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import fallenComponent from '../../../../data/mods/positioning/components/fallen.component.json';

const ACTION_ID = 'distress:throw_self_to_ground';

describe('distress:throw_self_to_ground', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('distress', ACTION_ID);

    // Mock component definition for positioning:fallen so ADD_COMPONENT works
    if (
      testFixture.testEnv.dataRegistry.getComponentDefinition &&
      testFixture.testEnv.dataRegistry.getComponentDefinition.mockImplementation
    ) {
      testFixture.testEnv.dataRegistry.getComponentDefinition.mockImplementation(
        (id) => {
          if (id === 'positioning:fallen') return fallenComponent;
          return null;
        }
      );
    }
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action Discoverability', () => {
    it('should be executable when actor is standing', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ava', 'Marcus']);
      // By default, actor doesn't have positioning components, implying standing/neutral.

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertActionSuccess(
        'Ava throws themselves to the ground in grief.'
      );
    });

    it('should be forbidden when actor has positioning:fallen', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ava', 'Marcus']);
      scenario.actor.components['positioning:fallen'] = {};

      // Reset fixture with modified actor
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, null)
      ).rejects.toThrow('forbidden component');
    });

    it('should be forbidden when actor has lying-states:lying_on', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ava', 'Marcus']);
      scenario.actor.components['lying-states:lying_on'] = {
        furniture_id: 'some_bed',
      };

      // Reset fixture with modified actor
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, null)
      ).rejects.toThrow('forbidden component');
    });

    it('should be forbidden when actor has sitting-states:sitting_on', async () => {
      const scenario = testFixture.createStandardActorTarget(['Ava', 'Marcus']);
      scenario.actor.components['sitting-states:sitting_on'] = {
        furniture_id: 'test:couch',
        spot_index: 0,
      };

      // Reset fixture with modified actor
      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, null)
      ).rejects.toThrow('forbidden component');
    });
  });

  describe('Rule Execution', () => {
    it('should add positioning:fallen component and log message', async () => {
      const scenario = testFixture.createStandardActorTarget(['Bob', 'Alice']);

      await testFixture.executeAction(scenario.actor.id, null);

      // Verify message
      testFixture.assertActionSuccess(
        'Bob throws themselves to the ground in grief.'
      );

      // Verify component added
      const actorInstance = testFixture.entityManager.getEntityInstance(
        scenario.actor.id
      );
      expect(actorInstance.components['positioning:fallen']).toBeDefined();
      expect(actorInstance.components['positioning:fallen']).toEqual({
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: '{actor} has fallen to the ground',
          priority: 78,
        },
      });
    });

    it('emits sense-aware perceptible event with actor description and fallbacks', async () => {
      const scenario = testFixture.createStandardActorTarget(['Clara', 'Dan']);

      await testFixture.executeAction(scenario.actor.id, null);

      testFixture.assertPerceptibleEvent({
        descriptionText: 'Clara throws themselves to the ground in grief.',
        actorDescription: 'I throw myself to the ground, overcome with grief.',
        perceptionType: 'physical.self_action',
        actorId: scenario.actor.id,
        targetId: null,
        alternateDescriptions: {
          auditory: 'I hear the thud of someone falling to the ground nearby.',
          tactile: 'I feel vibrations as someone hits the ground nearby.',
        },
      });
    });
  });
});
