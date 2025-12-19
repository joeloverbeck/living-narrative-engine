/**
 * @file Integration tests for the kissing:kiss_forehead_gently action and rule.
 * @description Validates discovery requirements and narrative flow for the gentle forehead kiss action.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import kissForeheadAction from '../../../../data/mods/kissing/actions/kiss_forehead_gently.action.json';
import kissForeheadRule from '../../../../data/mods/kissing/rules/kiss_forehead_gently.rule.json';
import eventIsActionKissForeheadGently from '../../../../data/mods/kissing/conditions/event-is-action-kiss-forehead-gently.condition.json';

const ACTION_ID = 'kissing:kiss_forehead_gently';

describe('kissing:kiss_forehead_gently action integration', () => {
  let testFixture;
  let configureActionDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'kissing',
      ACTION_ID,
      kissForeheadRule,
      eventIsActionKissForeheadGently
    );

    configureActionDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([kissForeheadAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      if (!scopeResolver || typeof scopeResolver.resolveSync !== 'function') {
        return;
      }

      const originalResolve =
        scopeResolver.__kissForeheadOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__kissForeheadOriginalResolve = originalResolve;

      scopeResolver.resolveSync = (scopeName, context) => {
        if (scopeName === 'kissing:close_actors_facing_each_other') {
          const actorId = context?.actor?.id;
          if (!actorId) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const partners =
            actorEntity.components?.['personal-space-states:closeness']?.partners;
          if (!Array.isArray(partners) || partners.length === 0) {
            return { success: true, value: new Set() };
          }

          const actorFacingAway =
            actorEntity.components?.['positioning:facing_away']
              ?.facing_away_from || [];

          const validTargets = partners.reduce((acc, partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return acc;
            }

            const partnerFacingAway =
              partner.components?.['positioning:facing_away']
                ?.facing_away_from || [];
            const facingEachOther =
              !actorFacingAway.includes(partnerId) &&
              !partnerFacingAway.includes(actorId);

            if (facingEachOther) {
              acc.add(partnerId);
            }

            return acc;
          }, new Set());

          return { success: true, value: validTargets };
        }

        return originalResolve(scopeName, context);
      };
    };
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('action discovery', () => {
    it('is available for close actors facing each other who are not already kissing', () => {
      const scenario = testFixture.createCloseActors(['Lena', 'Mari'], {
        location: 'observatory',
      });

      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).toContain(ACTION_ID);
    });

    it('is not available when the actor lacks the required closeness component', () => {
      const scenario = testFixture.createCloseActors(['Theo', 'Imani']);

      delete scenario.actor.components['personal-space-states:closeness'];
      delete scenario.target.components['personal-space-states:closeness'];

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });

    it('is not available when the actor already has the kissing component', () => {
      const scenario = testFixture.createCloseActors(['Avery', 'Blair']);

      scenario.actor.components['kissing:kissing'] = {
        partner: scenario.target.id,
        initiator: true,
      };

      const room = ModEntityScenarios.createRoom('room1', 'Test Room');
      testFixture.reset([room, scenario.actor, scenario.target]);

      configureActionDiscovery();

      const availableActions = testFixture.testEnv.getAvailableActions(
        scenario.actor.id
      );
      const ids = availableActions.map((action) => action.id);

      expect(ids).not.toContain(ACTION_ID);
    });
  });

  describe('rule behavior', () => {
    it('successfully executes the gentle forehead kiss between close actors', async () => {
      const scenario = testFixture.createCloseActors(['Alice', 'Noah'], {
        location: 'balcony',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = "Alice kisses Noah's forehead gently.";
      testFixture.assertActionSuccess(expectedMessage);

      const turnEndedEvent = testFixture.events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    });

    it('emits a perceptible event with matching message and metadata', async () => {
      const scenario = testFixture.createCloseActors(['Elena', 'Marcus'], {
        location: 'garden',
      });

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const expectedMessage = "Elena kisses Marcus's forehead gently.";
      testFixture.assertPerceptibleEvent({
        descriptionText: expectedMessage,
        locationId: 'garden',
        actorId: scenario.actor.id,
        targetId: scenario.target.id,
        perceptionType: 'physical.target_action',
      });
    });

    it('handles multiple close partners by focusing on the selected target', async () => {
      const scenario = testFixture.createMultiActorScenario(
        ['Zara', 'Kai', 'Lior'],
        {
          closeToMain: 2,
          location: 'suite',
        }
      );

      await testFixture.executeAction(scenario.actor.id, scenario.target.id);

      const firstMessage = "Zara kisses Kai's forehead gently.";
      testFixture.assertActionSuccess(firstMessage);

      testFixture.clearEvents();

      await testFixture.executeAction(
        scenario.actor.id,
        scenario.observers[0].id
      );

      const secondMessage = "Zara kisses Lior's forehead gently.";
      testFixture.assertActionSuccess(secondMessage);
    });

    it('only triggers when the matching action ID is attempted', async () => {
      const scenario = testFixture.createCloseActors(['Nina', 'Owen']);

      await testFixture.eventBus.dispatch('core:attempt_action', {
        eventName: 'core:attempt_action',
        actorId: scenario.actor.id,
        actionId: 'kissing:kiss_cheek',
        targetId: scenario.target.id,
        originalInput: 'kiss_cheek target',
      });

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });
});
