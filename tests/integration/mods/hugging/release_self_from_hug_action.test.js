/**
 * @file Integration tests for the hugging:release_self_from_hug action and rule.
 * @description Verifies self-release state management, messaging, and discovery recovery for hugged actors.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/mods/domainMatchers.js';
import releaseSelfRule from '../../../../data/mods/hugging/rules/handle_release_self_from_hug.rule.json';
import releaseSelfCondition from '../../../../data/mods/hugging/conditions/event-is-action-release-self-from-hug.condition.json';
import releaseSelfAction from '../../../../data/mods/hugging/actions/release_self_from_hug.action.json';
import releaseHugAction from '../../../../data/mods/hugging/actions/release_hug.action.json';
import hugTightAction from '../../../../data/mods/hugging/actions/hug_tight.action.json';

const RELEASE_SELF_ACTION_ID = 'hugging:release_self_from_hug';
const HUG_TIGHT_ACTION_ID = 'hugging:hug_tight';

describe('hugging:release_self_from_hug action integration', () => {
  let testFixture;
  let configureHuggingDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'hugging',
      RELEASE_SELF_ACTION_ID,
      releaseSelfRule,
      releaseSelfCondition
    );

    configureHuggingDiscovery = () => {
      const { testEnv } = testFixture;
      if (!testEnv) {
        return;
      }

      testEnv.actionIndex.buildIndex([
        hugTightAction,
        releaseHugAction,
        releaseSelfAction,
      ]);

      const scopeResolver = testEnv.unifiedScopeResolver;
      const originalResolve =
        scopeResolver.__huggingReleaseSelfOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__huggingReleaseSelfOriginalResolve = originalResolve;

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
          actorEntity.components?.['personal-space-states:closeness']?.partners || [];
        if (!Array.isArray(closeness) || closeness.length === 0) {
          return new Set();
        }

        const actorFacingAway =
          actorEntity.components?.['positioning:facing_away']
            ?.facing_away_from || [];

        return closeness.reduce((acc, partnerId) => {
          const partner = entityManager.getEntityInstance(partnerId);
          if (!partner) {
            return acc;
          }

          const partnerFacingAway =
            partner.components?.['positioning:facing_away']?.facing_away_from ||
            [];
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
          'personal-space:close_actors_facing_each_other_or_behind_target'
        ) {
          const actorId = context?.actor?.id;
          return { success: true, value: resolveClosePartners(actorId) };
        }

        if (scopeName === 'hugging:hugging_actor') {
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

          const beingHugged =
            actorEntity.components?.['positioning:being_hugged'] || null;
          if (!beingHugged) {
            return { success: true, value: new Set() };
          }

          const validTargets = new Set();
          closePartners.forEach((partnerId) => {
            const partner = entityManager.getEntityInstance(partnerId);
            if (!partner) {
              return;
            }

            const hugging = partner.components?.['positioning:hugging'] || null;
            if (
              hugging?.embraced_entity_id === actorId &&
              beingHugged.hugging_entity_id === partnerId
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

  const primeBeingHuggedScenario = (
    names = ['Aster', 'Briar'],
    options = {}
  ) => {
    const scenario = testFixture.createCloseActors(names, options);
    scenario.actor.components['positioning:being_hugged'] = {
      hugging_entity_id: scenario.target.id,
      consented: true,
    };
    scenario.target.components['positioning:hugging'] = {
      embraced_entity_id: scenario.actor.id,
      initiated: true,
    };
    return scenario;
  };

  it('clears hugging state and emits matching release messaging', async () => {
    const scenario = primeBeingHuggedScenario(['Aster', 'Briar'], {
      location: 'orchard',
    });
    const room = ModEntityScenarios.createRoom('orchard', 'Orchard');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const expectedMessage =
      "Aster releases themselves gently from Briar's hug.";

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(expectedMessage);

    testFixture.assertPerceptibleEvent({
      descriptionText: expectedMessage,
      locationId: 'orchard',
      perceptionType: 'physical.target_action',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance).not.toHaveComponent('positioning:being_hugged');
    expect(actorInstance).not.toHaveComponent('positioning:hugging');
    expect(targetInstance).not.toHaveComponent('positioning:hugging');
    expect(targetInstance).not.toHaveComponent('positioning:being_hugged');
  });

  it('preserves other hugging relationships while freeing the actor', async () => {
    const scenario = primeBeingHuggedScenario(['Cleo', 'Dorian'], {
      location: 'studio',
    });
    const otherPair = ModEntityScenarios.createActorTargetPair({
      names: ['Elena', 'Felix'],
      location: 'studio',
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

    const room = ModEntityScenarios.createRoom('studio', 'Studio');
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

  it('restores hug_tight availability and hides the self-release after clearing the embrace', async () => {
    const scenario = primeBeingHuggedScenario(['Gale', 'Harper']);
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    configureHuggingDiscovery();

    let availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    let actionIds = availableActions.map((action) => action.id);
    expect(actionIds).toContain(RELEASE_SELF_ACTION_ID);
    expect(actionIds).not.toContain(HUG_TIGHT_ACTION_ID);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    configureHuggingDiscovery();

    availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    actionIds = availableActions.map((action) => action.id);
    expect(actionIds).toContain(HUG_TIGHT_ACTION_ID);
    expect(actionIds).not.toContain(RELEASE_SELF_ACTION_ID);
  });

  it('leaves unrelated embrace data untouched when the target references a different partner', async () => {
    const scenario = testFixture.createCloseActors(['Indra', 'Jules']);
    scenario.actor.components['positioning:being_hugged'] = {
      hugging_entity_id: 'hugging:different_actor',
      consented: true,
    };
    scenario.target.components['positioning:hugging'] = {
      embraced_entity_id: 'hugging:someone_else',
      initiated: true,
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

    expect(actorInstance).toHaveComponentData('positioning:being_hugged', {
      hugging_entity_id: 'hugging:different_actor',
      consented: true,
    });
    expect(targetInstance).toHaveComponentData('positioning:hugging', {
      embraced_entity_id: 'hugging:someone_else',
      initiated: true,
    });
  });
});
