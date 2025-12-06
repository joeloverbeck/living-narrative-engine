/**
 * @file Integration tests for the vampirism:bare_fangs action using mod test infrastructure.
 * @description Tests the action execution and rule integration patterns.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import bareFangsRule from '../../../../data/mods/vampirism/rules/handle_bare_fangs.rule.json';
import eventIsActionBareFangs from '../../../../data/mods/vampirism/conditions/event-is-action-bare-fangs.condition.json';

describe('Vampirism Mod: Bare Fangs Action Integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'vampirism',
      'vampirism:bare_fangs',
      bareFangsRule,
      eventIsActionBareFangs
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  describe('Action Execution', () => {
    it('performs bare fangs action successfully', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Dracula',
        'Jonathan',
      ]);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        'Dracula bares their fangs menacingly at Jonathan.'
      );
    });

    it('rejects the action when actor is not a vampire', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Human',
        'Another Human',
      ]);

      await expect(
        testFixture.executeAction(scenario.actor.id, scenario.target.id)
      ).rejects.toThrow(/required component/i);
    });

    it('rejects the action when actor has positioning:giving_blowjob', async () => {
      const scenario = testFixture.createStandardActorTarget(
        ['Vampire', 'Mortal'],
        { includeRoom: false }
      );

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      scenario.actor.components['positioning:giving_blowjob'] = {
        target_id: scenario.target.id,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Crypt');
      testFixture.reset([room, scenario.actor, scenario.target]);

      await expect(
        testFixture.executeAction(scenario.actor.id, scenario.target.id)
      ).rejects.toThrow(/forbidden component/i);
    });

    it('handles missing target gracefully', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Nosferatu',
        'Hutter',
      ]);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await expect(async () => {
        await testFixture.executeAction(scenario.actor.id, 'nonexistent', {
          skipValidation: true,
        });
      }).not.toThrow();

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });

    it('works with different actor and target names', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Count Orlok',
        'Ellen Hutter',
      ]);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        'Count Orlok bares their fangs menacingly at Ellen Hutter.'
      );
    });
  });

  describe('Event Generation', () => {
    it('generates correct perceptible event message', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Victim',
      ]);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: 'Vampire bares their fangs menacingly at Victim.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('includes correct location ID', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Dracula',
        'Mina',
      ]);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: 'Dracula bares their fangs menacingly at Mina.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('includes correct target ID', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Nosferatu',
        'Thomas',
      ]);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: 'Nosferatu bares their fangs menacingly at Thomas.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });

    it('sets correct perception type', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Human',
      ]);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertPerceptibleEvent({
        descriptionText: 'Vampire bares their fangs menacingly at Human.',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'action_target_general',
      });
    });
  });

  describe('Message Validation', () => {
    it('perceptible log message matches template', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Alucard',
        'Integra',
      ]);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      testFixture.assertActionSuccess(
        'Alucard bares their fangs menacingly at Integra.'
      );
    });

    it('generates consistent perceptible and success messages', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Nosferatu',
        'Hutter',
      ]);

      // Add vampire marker to actor
      scenario.actor.components['vampirism:is_vampire'] = {};
      testFixture.reset([scenario.room, scenario.actor, scenario.target]);

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage =
        'Nosferatu bares their fangs menacingly at Hutter.';

      testFixture.assertActionSuccess(expectedMessage);
      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        perceptionType: 'action_target_general',
        locationId: 'room1',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
      });
    });
  });

  describe('Rule Isolation', () => {
    it('does not fire for different actions', async () => {
      const scenario = testFixture.createStandardActorTarget([
        'Vampire',
        'Mortal',
      ]);

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
});
