/**
 * @file Integration tests for hugging:release_hug action discovery.
 * @description Ensures the release hug action is discoverable only when the actor is hugging the target.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import releaseHugRule from '../../../../data/mods/hugging/rules/handle_release_hug.rule.json';
import releaseHugCondition from '../../../../data/mods/hugging/conditions/event-is-action-release-hug.condition.json';
import releaseHugAction from '../../../../data/mods/hugging/actions/release_hug.action.json';
import hugTightAction from '../../../../data/mods/hugging/actions/hug_tight.action.json';

const ACTION_ID = 'hugging:release_hug';

describe('hugging:release_hug action discovery', () => {
  let testFixture;
  let configureHuggingDiscovery;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'hugging',
      ACTION_ID,
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
        scopeResolver.__huggingDiscoveryOriginalResolve ||
        scopeResolver.resolveSync.bind(scopeResolver);

      scopeResolver.__huggingDiscoveryOriginalResolve = originalResolve;

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

  const primeHugScenario = (names = ['Avery', 'Blake'], options = {}) => {
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

  it('is available when the actor is hugging their close partner', () => {
    const scenario = primeHugScenario();
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    configureHuggingDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const actionIds = availableActions.map((action) => action.id);

    expect(actionIds).toContain(ACTION_ID);
  });

  it('only appears for targets whose hugging_entity_id matches the actor', () => {
    const scenario = primeHugScenario(['Casey', 'Devon']);
    scenario.target.components['positioning:being_hugged'] = {
      hugging_entity_id: 'hugging:someone_else',
      consented: true,
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

  it('disappears from discovery after the release action resolves', async () => {
    const scenario = primeHugScenario(['Ember', 'Flynn']);
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

  it('is unavailable once the actor loses positioning:hugging', () => {
    const scenario = primeHugScenario(['Greta', 'Hayden']);
    delete scenario.actor.components['positioning:hugging'];

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    configureHuggingDiscovery();

    const availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    const actionIds = availableActions.map((action) => action.id);
    expect(actionIds).not.toContain(ACTION_ID);
  });

  it('is blocked for actors currently being hugged themselves', () => {
    const scenario = primeHugScenario(['Indira', 'Jules']);
    scenario.actor.components['positioning:being_hugged'] = {
      hugging_entity_id: 'hugging:someone_else',
      consented: true,
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
