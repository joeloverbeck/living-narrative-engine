/**
 * @file Integration tests for the hugging:release_hug action and rule.
 * @description Verifies hugging release state management, messaging, and discovery recovery.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import releaseHugRule from '../../../../data/mods/hugging/rules/handle_release_hug.rule.json';
import releaseHugCondition from '../../../../data/mods/hugging/conditions/event-is-action-release-hug.condition.json';
import releaseHugAction from '../../../../data/mods/hugging/actions/release_hug.action.json';
import hugTightAction from '../../../../data/mods/hugging/actions/hug_tight.action.json';

const RELEASE_ACTION_ID = 'hugging:release_hug';
const HUG_TIGHT_ACTION_ID = 'hugging:hug_tight';

describe('hugging:release_hug action integration', () => {
  let testFixture;
  let configureHuggingDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'hugging',
      RELEASE_ACTION_ID,
      releaseHugRule,
      releaseHugCondition
    );

    configureHuggingDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([hugTightAction, releaseHugAction]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__huggingOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__huggingOriginalResolve = originalResolve;

      const resolveClosePartners = (actorId) => {
        if (!actorId) {
          return new Set();
        }

        const { entityManager } = testEnv;
        const actorEntity = entityManager.getEntityInstance(actorId);
        if (!actorEntity) {
          return new Set();
        }

        const closeness =
          actorEntity.components?.['positioning:closeness']?.partners || [];
        if (!Array.isArray(closeness) || closeness.length === 0) {
          return new Set();
        }

        const actorFacingAway =
          actorEntity.components?.['positioning:facing_away']?.facing_away_from ||
          [];

        return closeness.reduce((acc, partnerId) => {
          const partner = entityManager.getEntityInstance(partnerId);
          if (!partner) {
            return acc;
          }

          const partnerFacingAway =
            partner.components?.['positioning:facing_away']?.facing_away_from || [];
          const facingEachOther =
            !actorFacingAway.includes(partnerId) &&
            !partnerFacingAway.includes(actorId);
          const actorBehind =
            partnerFacingAway.includes(actorId) &&
            !actorFacingAway.includes(partnerId);

          if (facingEachOther || actorBehind) {
            acc.add(partnerId);
          }

          return acc;
        }, new Set());
      };

      scopeResolver.resolveSync = (scopeName, context) => {
        if (
          scopeName ===
          'positioning:close_actors_facing_each_other_or_behind_target'
        ) {
          const actorId = context?.actor?.id;
          return { success: true, value: resolveClosePartners(actorId) };
        }

        if (scopeName === 'hugging:hugged_by_actor') {
          const actorId = context?.actor?.id;
          const closePartners = resolveClosePartners(actorId);
          if (!actorId || closePartners.size === 0) {
            return { success: true, value: new Set() };
          }

          const { entityManager } = testEnv;
          const actorEntity = entityManager.getEntityInstance(actorId);
          if (!actorEntity) {
            return { success: true, value: new Set() };
          }

          const huggingComponent =
            actorEntity.components?.['positioning:hugging'] || null;
          if (!huggingComponent) {
            return { success: true, value: new Set() };
          }

          const validTargets = new Set();
          closePartners.forEach((partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return;
            }

            const beingHugged =
              partner.components?.['positioning:being_hugged'] || null;
            if (
              beingHugged?.hugging_entity_id === actorId &&
              huggingComponent.embraced_entity_id === partnerId
            ) {
              validTargets.add(partnerId);
            }
          });

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

  const primeHugScenario = (names = ['Lena', 'Miles'], options = {}) => {
    const scenario = testFixture.createCloseActors(names, options);
    scenario.actor.components['positioning:hugging'] = {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    };
    scenario.target.components['positioning:being_hugged'] = {
      hugging_entity_id: scenario.actor.id,
      consented: true,
    };
    return scenario;
  };

  it('clears hugging state and emits matching release messaging', async () => {
    const scenario = primeHugScenario(['Lena', 'Miles'], { location: 'solarium' });
    const room = ModEntityScenarios.createRoom('solarium', 'Solarium');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const expectedMessage = 'Lena releases Miles from the hug.';

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(expectedMessage);

    testFixture.assertPerceptibleEvent({
      descriptionText: expectedMessage,
      locationId: 'solarium',
      perceptionType: 'action_target_general',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance).not.toHaveComponent('positioning:hugging');
    expect(actorInstance).not.toHaveComponent('positioning:being_hugged');
    expect(targetInstance).not.toHaveComponent('positioning:hugging');
    expect(targetInstance).not.toHaveComponent('positioning:being_hugged');
  });

  it('preserves other hugging relationships while releasing the target', async () => {
    const scenario = primeHugScenario(['Aria', 'Bennett'], { location: 'atrium' });
    const otherPair = ModEntityScenarios.createActorTargetPair({
      names: ['Chloe', 'Darius'],
      location: 'atrium',
      closeProximity: true,
      idPrefix: 'secondary_',
    });
    otherPair.actor.components['positioning:hugging'] = {
      embraced_entity_id: otherPair.target.id,
      initiated: true,
    };
    otherPair.target.components['positioning:being_hugged'] = {
      hugging_entity_id: otherPair.actor.id,
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('atrium', 'Atrium');
    testFixture.reset([
      room,
      scenario.actor,
      scenario.target,
      otherPair.actor,
      otherPair.target,
    ]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const preservedActor = testFixture.entityManager.getEntityInstance(
      otherPair.actor.id
    );
    const preservedTarget = testFixture.entityManager.getEntityInstance(
      otherPair.target.id
    );

    expect(preservedActor).toHaveComponentData('positioning:hugging', {
      embraced_entity_id: otherPair.target.id,
      initiated: true,
    });
    expect(preservedTarget).toHaveComponentData('positioning:being_hugged', {
      hugging_entity_id: otherPair.actor.id,
      consented: true,
    });
  });

  it('restores hug_tight availability and hides release after clearing the embrace', async () => {
    const scenario = primeHugScenario(['Eli', 'Noor']);
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    configureHuggingDiscovery();

    let availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    let actionIds = availableActions.map((action) => action.id);
    expect(actionIds).toContain(RELEASE_ACTION_ID);
    expect(actionIds).not.toContain(HUG_TIGHT_ACTION_ID);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    configureHuggingDiscovery();

    availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    actionIds = availableActions.map((action) => action.id);
    expect(actionIds).toContain(HUG_TIGHT_ACTION_ID);
    expect(actionIds).not.toContain(RELEASE_ACTION_ID);
  });

  it('leaves unrelated embrace data untouched when the actor references a different partner', async () => {
    const scenario = testFixture.createCloseActors(['Galen', 'Rhea']);
    scenario.actor.components['positioning:hugging'] = {
      embraced_entity_id: 'hugging:someone_else',
      initiated: true,
    };
    scenario.target.components['positioning:being_hugged'] = {
      hugging_entity_id: 'hugging:different_actor',
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id, {
      skipDiscovery: true,
      skipValidation: true,
    });

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance).toHaveComponentData('positioning:hugging', {
      embraced_entity_id: 'hugging:someone_else',
      initiated: true,
    });
    expect(targetInstance).toHaveComponentData('positioning:being_hugged', {
      hugging_entity_id: 'hugging:different_actor',
      consented: true,
    });
  });
});
