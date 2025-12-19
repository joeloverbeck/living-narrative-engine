/**
 * @file Integration tests for the hand-holding:withdraw_hand_from_grasp action and rule.
 * @description Verifies the held partner can break the hand-holding loop and restores follow-up availability.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import withdrawRule from '../../../../data/mods/hand-holding/rules/handle_withdraw_hand_from_grasp.rule.json';
import withdrawCondition from '../../../../data/mods/hand-holding/conditions/event-is-action-withdraw-hand-from-grasp.condition.json';
import withdrawAction from '../../../../data/mods/hand-holding/actions/withdraw_hand_from_grasp.action.json';
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

describe('hand-holding:withdraw_hand_from_grasp action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'hand-holding',
      'hand-holding:withdraw_hand_from_grasp',
      withdrawRule,
      withdrawCondition
    );
    // Ensure actors have hand anatomy for hold_hand action discovery
    testFixture.defaultEntityOptions = { withHands: true };
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  const configureActionDiscovery = () => {
    const { testEnv } = testFixture;
    if (!testEnv) {
      return;
    }

    testEnv.actionIndex.buildIndex([withdrawAction, holdHandAction]);

    const scopeResolver = testEnv.unifiedScopeResolver;
    const originalResolve =
      scopeResolver.__withdrawHandOriginalResolve ||
      scopeResolver.resolveSync.bind(scopeResolver);

    scopeResolver.__withdrawHandOriginalResolve = originalResolve;
    scopeResolver.resolveSync = (scopeName, context) => {
      // Handle both the base scope and the with_hands variant
      if (
        scopeName ===
          'personal-space:close_actors_facing_each_other_or_behind_target' ||
        scopeName ===
          'personal-space:close_actors_facing_each_other_or_behind_target_with_hands'
      ) {
        const requireHands =
          scopeName ===
          'personal-space:close_actors_facing_each_other_or_behind_target_with_hands';

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

      if (scopeName === 'hand-holding:actor_whose_hand_target_is_holding') {
        const actorId = context?.actor?.id;
        if (!actorId) {
          return { success: true, value: new Set() };
        }

        const { entityManager } = testEnv;
        const actorEntity = entityManager.getEntityInstance(actorId);
        if (!actorEntity) {
          return { success: true, value: new Set() };
        }

        const handHeldComponent =
          actorEntity.components?.['hand-holding:hand_held'];
        const holderId = handHeldComponent?.holding_entity_id;
        const closeness =
          actorEntity.components?.['personal-space-states:closeness']?.partners || [];

        if (!holderId || !closeness.includes(holderId)) {
          return { success: true, value: new Set() };
        }

        const holderEntity = entityManager.getEntityInstance(holderId);
        if (!holderEntity) {
          return { success: true, value: new Set() };
        }

        const holderComponent =
          holderEntity.components?.['hand-holding:holding_hand'];
        if (holderComponent?.held_entity_id !== actorId) {
          return { success: true, value: new Set() };
        }

        const actorFacingAway =
          actorEntity.components?.['positioning:facing_away']
            ?.facing_away_from || [];
        const holderFacingAway =
          holderEntity.components?.['positioning:facing_away']
            ?.facing_away_from || [];

        const facingEachOther =
          !actorFacingAway.includes(holderId) &&
          !holderFacingAway.includes(actorId);
        const actorBehind = holderFacingAway.includes(actorId);

        if (!facingEachOther && !actorBehind) {
          return { success: true, value: new Set() };
        }

        return { success: true, value: new Set([holderId]) };
      }

      return originalResolve(scopeName, context);
    };
  };

  const seedLinkedHandHoldingPair = (names, options = {}) => {
    const scenario = testFixture.createCloseActors(names, options);
    scenario.actor.components['hand-holding:hand_held'] = {
      holding_entity_id: scenario.target.id,
      consented: true,
    };
    scenario.target.components['hand-holding:holding_hand'] = {
      held_entity_id: scenario.actor.id,
      initiated: true,
    };
    return scenario;
  };

  it('successfully withdraws a held hand and emits matching narration', async () => {
    const scenario = seedLinkedHandHoldingPair(['Lena', 'Milo'], {
      location: 'balcony',
    });

    const room = ModEntityScenarios.createRoom('balcony', 'Balcony');
    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    const successEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(
      "Lena withdraws their hand from Milo's grasp."
    );

    testFixture.assertPerceptibleEvent({
      descriptionText: "Lena withdraws their hand from Milo's grasp.",
      locationId: 'balcony',
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

    expect(actorInstance.components['hand-holding:hand_held']).toBeUndefined();
    expect(
      targetInstance.components['hand-holding:holding_hand']
    ).toBeUndefined();
  });

  it('leaves other hand-holding relationships untouched', async () => {
    const scenario = seedLinkedHandHoldingPair(['Nora', 'Owen'], {
      location: 'plaza',
    });
    const otherPair = ModEntityScenarios.createActorTargetPair({
      names: ['Pia', 'Rene'],
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

    const untouchedHolder = testFixture.entityManager.getEntityInstance(
      otherPair.actor.id
    );
    const untouchedHeld = testFixture.entityManager.getEntityInstance(
      otherPair.target.id
    );

    expect(untouchedHolder.components['hand-holding:holding_hand']).toEqual({
      held_entity_id: otherPair.target.id,
      initiated: true,
    });
    expect(untouchedHeld.components['hand-holding:hand_held']).toEqual({
      holding_entity_id: otherPair.actor.id,
      consented: true,
    });
  });

  it('restores hold hand availability while hiding the withdraw action afterward', async () => {
    const scenario = seedLinkedHandHoldingPair(['Sami', 'Tori']);
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    // Include extraEntities (hand anatomy parts) for hold_hand action discovery
    testFixture.reset([
      room,
      scenario.actor,
      scenario.target,
      ...(scenario.extraEntities || []),
    ]);

    configureActionDiscovery();

    let availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    let actionIds = availableActions.map((action) => action.id);
    expect(actionIds).toContain('hand-holding:withdraw_hand_from_grasp');
    expect(actionIds).not.toContain('hand-holding:hold_hand');

    await testFixture.executeAction(scenario.actor.id, scenario.target.id);

    configureActionDiscovery();

    availableActions = testFixture.testEnv.getAvailableActions(
      scenario.actor.id
    );
    actionIds = availableActions.map((action) => action.id);
    expect(actionIds).toContain('hand-holding:hold_hand');
    expect(actionIds).not.toContain('hand-holding:withdraw_hand_from_grasp');
  });

  it('aborts gracefully when the linkage was broken before execution', async () => {
    const scenario = seedLinkedHandHoldingPair(['Uma', 'Vik']);
    const room = ModEntityScenarios.createRoom('room1', 'Test Room');

    // Break linkage from the target side before execution
    delete scenario.target.components['hand-holding:holding_hand'];

    testFixture.reset([room, scenario.actor, scenario.target]);

    await testFixture.executeAction(scenario.actor.id, scenario.target.id, {
      skipDiscovery: true,
      skipValidation: true,
    });

    const failureEvent = testFixture.events.find(
      (event) => event.eventType === 'core:display_failed_action_result'
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload.message).toBe(
      'You pull back, but no one is holding your hand anymore.'
    );

    const turnEndedEvent = testFixture.events.find(
      (event) => event.eventType === 'core:turn_ended'
    );
    expect(turnEndedEvent).toBeDefined();
    expect(turnEndedEvent.payload.success).toBe(false);

    const actorInstance = testFixture.entityManager.getEntityInstance(
      scenario.actor.id
    );
    expect(actorInstance.components['hand-holding:hand_held']).toEqual({
      holding_entity_id: scenario.target.id,
      consented: true,
    });
  });
});
