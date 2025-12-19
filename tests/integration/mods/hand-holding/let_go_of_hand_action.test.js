/**
 * @file Integration tests for the hand-holding:let_go_of_hand action and rule.
 * @description Verifies rule execution clears hand-holding state and preserves other relationships.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';
import letGoRule from '../../../../data/mods/hand-holding/rules/handle_let_go_of_hand.rule.json';
import letGoCondition from '../../../../data/mods/hand-holding/conditions/event-is-action-let-go-of-hand.condition.json';
import letGoAction from '../../../../data/mods/hand-holding/actions/let_go_of_hand.action.json';
import holdHandAction from '../../../../data/mods/hand-holding/actions/hold_hand.action.json';

/**
 * Helper function to check if an entity has hand anatomy parts.
 * @param {object} entity - The entity to check
 * @param {object} entityManager - The entity manager instance
 * @returns {boolean} True if the entity has hand body parts
 */
function entityHasHands(entity, entityManager) {
  if (!entity || !entity.components) {
    return false;
  }

  const bodyRoot =
    entity.components['anatomy:body']?.body?.root ||
    entity.components['anatomy:body']?.root;

  if (!bodyRoot) {
    return false;
  }

  const queue = [bodyRoot];
  const visited = new Set(queue);

  while (queue.length > 0) {
    const partId = queue.shift();
    const partEntity = entityManager.getEntityInstance(partId);
    const part = partEntity?.components?.['anatomy:part'];
    const subType = part?.subType;

    if (typeof subType === 'string' && subType.toLowerCase().includes('hand')) {
      return true;
    }

    const children = Array.isArray(part?.children) ? part.children : [];
    for (const childId of children) {
      if (!visited.has(childId)) {
        visited.add(childId);
        queue.push(childId);
      }
    }
  }

  return false;
}

describe('hand-holding:let_go_of_hand action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'hand-holding',
      'hand-holding:let_go_of_hand',
      letGoRule,
      letGoCondition
    );
    // Ensure actors have hand anatomy for hold_hand action discovery
    testFixture.defaultEntityOptions = { withHands: true };
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  const configureHoldAndLetGoDiscovery = () => {
    const { testEnv } = testFixture;
    if (!testEnv) {
      return;
    }

    testEnv.actionIndex.buildIndex([holdHandAction, letGoAction]);

    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve =
      scopeResolver.__holdAndLetGoOriginalResolve ||
      scopeResolver.resolveSync.bind(scopeResolver);

    scopeResolver.__holdAndLetGoOriginalResolve = originalResolve;
    scopeResolver.resolveSync = (scopeName, context) => {
      // Handle both the base scope and the with_hands variant
      if (
        scopeName ===
          'positioning:close_actors_facing_each_other_or_behind_target' ||
        scopeName ===
          'positioning:close_actors_facing_each_other_or_behind_target_with_hands'
      ) {
        const requireHands =
          scopeName ===
          'positioning:close_actors_facing_each_other_or_behind_target_with_hands';

        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const { entityManager } = testEnv;
        const actorEntity = entityManager.getEntityInstance(actorId);
        if (!actorEntity) {
          return { success: true, value: new Set() };
        }

        // For with_hands scope, actor must have hands
        if (requireHands && !entityHasHands(actorEntity, entityManager)) {
          return { success: true, value: new Set() };
        }

        const closeness =
          actorEntity.components?.['personal-space-states:closeness']?.partners;
        if (!Array.isArray(closeness) || closeness.length === 0) {
          return { success: true, value: new Set() };
        }

        const actorFacingAway =
          actorEntity.components?.['positioning:facing_away']
            ?.facing_away_from || [];

        const validTargets = closeness.reduce((acc, partnerId) => {
          const partner = entityManager.getEntityInstance(partnerId);
          if (!partner) {
            return acc;
          }

          // For with_hands scope (hold_hand), check if target has their hand already held
          // Don't apply this check for base scope (let_go_of_hand needs target to have hand_held)
          if (requireHands && partner.components?.['hand-holding:hand_held']) {
            return acc;
          }

          const partnerFacingAway =
            partner.components?.['positioning:facing_away']?.facing_away_from ||
            [];
          const facingEachOther =
            !actorFacingAway.includes(partnerId) &&
            !partnerFacingAway.includes(actorId);
          const actorBehind = partnerFacingAway.includes(actorId);

          // For with_hands scope, target must have hands
          if (requireHands && !entityHasHands(partner, entityManager)) {
            return acc;
          }

          if (facingEachOther || actorBehind) {
            acc.add(partnerId);
          }

          return acc;
        }, new Set());

        return { success: true, value: validTargets };
      }

      return originalResolve(scopeName, context);
    };
  };

  it('successfully releases a held hand and emits matching feedback', async () => {
    const scenario = testFixture.createCloseActors(['Harper', 'Indigo'], {
      location: 'garden',
    });
    scenario.actor.components['hand-holding:holding_hand'] = {
      held_entity_id: scenario.target.id,
      initiated: true,
    };
    scenario.target.components['hand-holding:hand_held'] = {
      holding_entity_id: scenario.actor.id,
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('garden', 'Garden');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Harper lets go of Indigo's hand."
    );

    testFixture.assertPerceptibleEvent({
      descriptionText: "Harper lets go of Indigo's hand.",
      locationId: 'garden',
      perceptionType: 'physical.target_action',
      actorId: scenario.actor.id,
      targetId: scenario.target.id,
    });

    const turnEndedEvent = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.entityId).toBe(scenario.actor.id);
    expect(turnEndedEvent.payload.success).toBe(true);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(
      actorInstance.components['hand-holding:holding_hand']
    ).toBeUndefined();
    expect(targetInstance.components['hand-holding:hand_held']).toBeUndefined();
  });

  it('does not disturb other hand-holding relationships', async () => {
    const scenario = testFixture.createCloseActors(['Jordan', 'Kai'], {
      location: 'plaza',
    });
    scenario.actor.components['hand-holding:holding_hand'] = {
      held_entity_id: scenario.target.id,
      initiated: true,
    };
    scenario.target.components['hand-holding:hand_held'] = {
      holding_entity_id: scenario.actor.id,
      consented: true,
    };

    const otherPair = ModEntityScenarios.createActorTargetPair({
      names: ['Luca', 'Mira'],
      location: 'plaza',
      closeProximity: true,
      idPrefix: 'extra_',
    });
    otherPair.actor.components['hand-holding:holding_hand'] = {
      held_entity_id: otherPair.target.id,
      initiated: true,
    };
    otherPair.target.components['hand-holding:hand_held'] = {
      holding_entity_id: otherPair.actor.id,
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('plaza', 'City Plaza');
    testFixture.reset([
      room,
      scenario.actor,
      scenario.target,
      otherPair.actor,
      otherPair.target,
    ]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const otherActorInstance = testFixture.entityManager.getEntityInstance(
      otherPair.actor.id
    );
    const otherTargetInstance = testFixture.entityManager.getEntityInstance(
      otherPair.target.id
    );

    expect(otherActorInstance.components['hand-holding:holding_hand']).toEqual({
      held_entity_id: otherPair.target.id,
      initiated: true,
    });
    expect(otherTargetInstance.components['hand-holding:hand_held']).toEqual({
      holding_entity_id: otherPair.actor.id,
      consented: true,
    });
  });

  it('restores hold hand availability and hides let go after release', async () => {
    const scenario = testFixture.createCloseActors(['Noa', 'Parker']);
    scenario.actor.components['hand-holding:holding_hand'] = {
      held_entity_id: scenario.target.id,
      initiated: true,
    };
    scenario.target.components['hand-holding:hand_held'] = {
      holding_entity_id: scenario.actor.id,
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    // Include extraEntities (hand anatomy parts) for hold_hand action discovery
    testFixture.reset([
      room,
      scenario.actor,
      scenario.target,
      ...(scenario.extraEntities || []),
    ]);
    configureHoldAndLetGoDiscovery();

    let availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    let actionIds = availableActions.map((action) => action.id);
    expect(actionIds).toContain('hand-holding:let_go_of_hand');
    expect(actionIds).not.toContain('hand-holding:hold_hand');

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);
    configureHoldAndLetGoDiscovery();

    availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    actionIds = availableActions.map((action) => action.id);
    expect(actionIds).toContain('hand-holding:hold_hand');
    expect(actionIds).not.toContain('hand-holding:let_go_of_hand');
  });

  it('ignores attempt_action events for other hand-holding actions', async () => {
    const scenario = testFixture.createCloseActors(['Quinn', 'Rhea']);
    scenario.actor.components['hand-holding:holding_hand'] = {
      held_entity_id: scenario.target.id,
      initiated: true,
    };
    scenario.target.components['hand-holding:hand_held'] = {
      holding_entity_id: scenario.actor.id,
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.eventBus.dispatch('core:attempt_action', {
      eventName: 'core:attempt_action',
      actorId: scenario.actor.id,
      actionId: 'hand-holding:hold_hand',
      targetId: scenario.target.id,
      originalInput: 'hold_hand target',
    });

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    const targetInstance = testFixture.entityManager.getEntityInstance(
      scenario.target.id
    );

    expect(actorInstance.components['hand-holding:holding_hand']).toEqual({
      held_entity_id: scenario.target.id,
      initiated: true,
    });
    expect(targetInstance.components['hand-holding:hand_held']).toEqual({
      holding_entity_id: scenario.actor.id,
      consented: true,
    });

    const letGoEvents = testFixture.events.filter((event) =>
      event.payload?.descriptionText?.includes('lets go of')
    );
    expect(letGoEvents).toHaveLength(0);
  });

  it('does not clear components when entity references do not match', async () => {
    const scenario = testFixture.createCloseActors(['Sage', 'Tatum']);
    scenario.actor.components['hand-holding:holding_hand'] = {
      held_entity_id: 'hand-holding:someone_else',
      initiated: true,
    };
    scenario.target.components['hand-holding:hand_held'] = {
      holding_entity_id: 'hand-holding:different_actor',
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

    expect(actorInstance.components['hand-holding:holding_hand']).toEqual({
      held_entity_id: 'hand-holding:someone_else',
      initiated: true,
    });
    expect(targetInstance.components['hand-holding:hand_held']).toEqual({
      holding_entity_id: 'hand-holding:different_actor',
      consented: true,
    });
  });

  it('cannot be executed twice in a row without re-establishing the hold', async () => {
    const scenario = testFixture.createCloseActors(['Uma', 'Vince']);
    scenario.actor.components['hand-holding:holding_hand'] = {
      held_entity_id: scenario.target.id,
      initiated: true,
    };
    scenario.target.components['hand-holding:hand_held'] = {
      holding_entity_id: scenario.actor.id,
      consented: true,
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    await expect(
      testFixture.executeAction(scenario.actor.id, scenario.target.id)
    ).rejects.toThrow(ActionValidationError);
  });
});
