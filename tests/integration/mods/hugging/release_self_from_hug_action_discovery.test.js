/**
 * @file Integration tests for hugging:release_self_from_hug action discovery.
 * @description Ensures the self-release action is discoverable only when the actor is being hugged by the target.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import releaseSelfRule from '../../../../data/mods/hugging/rules/handle_release_self_from_hug.rule.json';
import releaseSelfCondition from '../../../../data/mods/hugging/conditions/event-is-action-release-self-from-hug.condition.json';
import releaseSelfAction from '../../../../data/mods/hugging/actions/release_self_from_hug.action.json';
import releaseHugAction from '../../../../data/mods/hugging/actions/release_hug.action.json';
import hugTightAction from '../../../../data/mods/hugging/actions/hug_tight.action.json';

const ACTION_ID = 'hugging:release_self_from_hug';

describe('hugging:release_self_from_hug action discovery', () => {
  let testFixture;
  let configureHuggingDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'hugging',
      ACTION_ID,
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

  const primeBeingHuggedScenario = (names = ['Quinn', 'Rowan'], options = {}) => {
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

  it('is available when the actor is being hugged by their close partner', () => {
    const scenario = primeBeingHuggedScenario();
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    configureHuggingDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const actionIds = availableActions.map((action) => action.id);

    expect(actionIds).toContain(ACTION_ID);
  });

  it('only appears for targets whose hugging component references the actor', () => {
    const scenario = primeBeingHuggedScenario(['Sasha', 'Theo']);
    scenario.target.components['positioning:hugging'] = {
      embraced_entity_id: 'hugging:someone_else',
      initiated: true,
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    configureHuggingDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const actionIds = availableActions.map((action) => action.id);

    expect(actionIds).not.toContain(ACTION_ID);
  });

  it('disappears from discovery after the self-release action resolves', async () => {
    const scenario = primeBeingHuggedScenario(['Uma', 'Vale']);
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    configureHuggingDiscovery();

    let availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    let actionIds = availableActions.map((action) => action.id);
    expect(actionIds).toContain(ACTION_ID);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    configureHuggingDiscovery();

    availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    actionIds = availableActions.map((action) => action.id);
    expect(actionIds).not.toContain(ACTION_ID);
  });

  it('is hidden when the actor is also hugging the target', () => {
    const scenario = primeBeingHuggedScenario(['Willow', 'Xavier']);
    scenario.actor.components['positioning:hugging'] = {
      embraced_entity_id: scenario.target.id,
      initiated: true,
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    configureHuggingDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const actionIds = availableActions.map((action) => action.id);

    expect(actionIds).not.toContain(ACTION_ID);
  });
});
