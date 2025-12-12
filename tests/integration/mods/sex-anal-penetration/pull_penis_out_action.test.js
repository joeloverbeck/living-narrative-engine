/**
 * @file Integration tests for sex-anal-penetration:pull_penis_out action and rule.
 * @description Verifies anal penetration completion narration, perceptible event wiring, component removal, and state isolation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import pullPenisOutAction from '../../../../data/mods/sex-anal-penetration/actions/pull_penis_out.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-anal-penetration:pull_penis_out';
const EXPECTED_MESSAGE =
  "Marcus slowly pulls out of Lena's ass, withdrawing completely.";

/**
 * Builds the action index with the pull penis out action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullPenisOutAction]);
}

/**
 * Builds a scenario where the ACTOR is anally penetrating PRIMARY.
 *
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string}} Scenario data.
 */
function buildPullPenisOutScenario() {
  const ACTOR_ID = 'marcus';
  const PRIMARY_ID = 'lena';
  const ROOM_ID = 'bedroom1';

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actor = new ModEntityBuilder(ACTOR_ID)
    .withName('Marcus')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(PRIMARY_ID)
    .withComponent('positioning:fucking_anally', {
      being_fucked_entity_id: PRIMARY_ID,
      initiated: true,
    })
    .build();

  const primary = new ModEntityBuilder(PRIMARY_ID)
    .withName('Lena')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(ACTOR_ID)
    .withComponent('positioning:being_fucked_anally', {
      fucking_entity_id: ACTOR_ID,
      consented: true,
    })
    .build();

  return {
    entities: [room, actor, primary],
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
    roomId: ROOM_ID,
  };
}

/**
 * Installs a scope resolver override for actor_being_fucked_anally_by_me.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installActorBeingFuckedAnallyByMeScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-anal-penetration:actor_being_fucked_anally_by_me') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const fuckingAnally = actor?.components?.['positioning:fucking_anally'];
      const closenessPartners =
        actor?.components?.['positioning:closeness']?.partners;

      if (!fuckingAnally || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const beingFuckedEntityId = fuckingAnally.being_fucked_entity_id;
      if (!beingFuckedEntityId) {
        return { success: true, value: new Set() };
      }

      const receivingEntity =
        fixture.entityManager.getEntityInstance(beingFuckedEntityId);
      if (!receivingEntity) {
        return { success: true, value: new Set() };
      }

      const beingFuckedAnally =
        receivingEntity.components?.['positioning:being_fucked_anally'];
      if (!beingFuckedAnally) {
        return { success: true, value: new Set() };
      }

      if (
        beingFuckedAnally.fucking_entity_id === actorId &&
        closenessPartners.includes(beingFuckedEntityId)
      ) {
        return { success: true, value: new Set([beingFuckedEntityId]) };
      }

      return { success: true, value: new Set() };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

describe('sex-anal-penetration:pull_penis_out action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-anal-penetration',
      ACTION_ID
    );
    restoreScopeResolver =
      installActorBeingFuckedAnallyByMeScopeOverride(testFixture);
  });

  afterEach(() => {
    if (restoreScopeResolver) {
      restoreScopeResolver();
      restoreScopeResolver = null;
    }

    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  // eslint-disable-next-line jest/expect-expect -- Uses ModAssertionHelpers which internally uses expect
  it('dispatches correct narrative message and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } =
      buildPullPenisOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      EXPECTED_MESSAGE,
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: roomId,
      actorId,
      targetId: primaryId,
      perceptionType: 'physical.target_action',
    });
  });

  it('removes anal penetration components from both actor and primary', async () => {
    const { entities, actorId, primaryId } = buildPullPenisOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist before action
    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    const primaryBefore =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorBefore.components['positioning:fucking_anally']).toBeDefined();
    expect(
      primaryBefore.components['positioning:being_fucked_anally']
    ).toBeDefined();

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify components removed after action
    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorAfter.components['positioning:fucking_anally']).toBeUndefined();
    expect(
      primaryAfter.components['positioning:being_fucked_anally']
    ).toBeUndefined();
  });

  it('does not affect other entities when removing anal penetration state', async () => {
    const { entities, actorId, primaryId } = buildPullPenisOutScenario();

    // Add another pair engaged in anal penetration
    const SECONDARY_ACTOR_ID = 'other_actor';
    const SECONDARY_PRIMARY_ID = 'other_primary';

    const secondaryActor = new ModEntityBuilder(SECONDARY_ACTOR_ID)
      .withName('Other Actor')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('positioning:fucking_anally', {
        being_fucked_entity_id: SECONDARY_PRIMARY_ID,
        initiated: true,
      })
      .build();

    const secondaryPrimary = new ModEntityBuilder(SECONDARY_PRIMARY_ID)
      .withName('Other Primary')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('positioning:being_fucked_anally', {
        fucking_entity_id: SECONDARY_ACTOR_ID,
        consented: true,
      })
      .build();

    entities.push(secondaryActor, secondaryPrimary);

    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify other pair's components unchanged
    const secondaryActorAfter =
      testFixture.entityManager.getEntityInstance(SECONDARY_ACTOR_ID);
    const secondaryPrimaryAfter =
      testFixture.entityManager.getEntityInstance(SECONDARY_PRIMARY_ID);
    expect(
      secondaryActorAfter.components['positioning:fucking_anally']
    ).toBeDefined();
    expect(
      secondaryPrimaryAfter.components['positioning:being_fucked_anally']
    ).toBeDefined();
  });

  it('does not fire rule for different action', async () => {
    const { entities, actorId, primaryId } = buildPullPenisOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist before action
    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    expect(actorBefore.components['positioning:fucking_anally']).toBeDefined();

    // Dispatch a different action event manually (won't match our condition)
    testFixture.testEnv.eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId,
        primaryId,
        actionId: 'some:other_action',
      },
    });

    // Verify components still exist (rule didn't fire)
    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    expect(actorAfter.components['positioning:fucking_anally']).toBeDefined();

    // Verify no success event was dispatched
    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(0);
  });

  it('completes full workflow from initiation to completion', async () => {
    const { entities, actorId, primaryId } = buildPullPenisOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist (simulating post-initiation state)
    const actorMid = testFixture.entityManager.getEntityInstance(actorId);
    const primaryMid = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorMid.components['positioning:fucking_anally']).toBeDefined();
    expect(
      primaryMid.components['positioning:being_fucked_anally']
    ).toBeDefined();

    // Execute pull out action
    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify components removed (workflow complete)
    const actorFinal = testFixture.entityManager.getEntityInstance(actorId);
    const primaryFinal = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorFinal.components['positioning:fucking_anally']).toBeUndefined();
    expect(
      primaryFinal.components['positioning:being_fucked_anally']
    ).toBeUndefined();

    // Verify success event
    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(1);
    expect(successEvents[0].payload.message).toBe(EXPECTED_MESSAGE);
  });
});
