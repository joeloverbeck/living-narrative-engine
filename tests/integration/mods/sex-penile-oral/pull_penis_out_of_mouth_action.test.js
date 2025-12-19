/**
 * @file Integration tests for sex-penile-oral:pull_penis_out_of_mouth action and rule.
 * @description Verifies blowjob completion narration, perceptible event wiring, component removal, and state isolation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import pullPenisOutOfMouthAction from '../../../../data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:pull_penis_out_of_mouth';
const EXPECTED_MESSAGE =
  "Ava slowly pulls Nolan's cock out of Ava's mouth, a thread of saliva linking the glans to Nolan's lips.";

/**
 * Builds the action index with the pull penis out of mouth action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullPenisOutOfMouthAction]);
}

/**
 * Builds a scenario where the ACTOR is giving a blowjob to PRIMARY.
 *
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string}} Scenario data.
 */
function buildPullPenisOutOfMouthScenario() {
  const ACTOR_ID = 'ava';
  const PRIMARY_ID = 'nolan';
  const ROOM_ID = 'bedroom1';

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actor = new ModEntityBuilder(ACTOR_ID)
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(PRIMARY_ID)
    .withComponent('sex-states:giving_blowjob', {
      receiving_entity_id: PRIMARY_ID,
      initiated: true,
    })
    .build();

  const primary = new ModEntityBuilder(PRIMARY_ID)
    .withName('Nolan')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(ACTOR_ID)
    .withComponent('sex-states:receiving_blowjob', {
      giving_entity_id: ACTOR_ID,
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
 * Installs a scope resolver override for receiving_blowjob_from_actor.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installReceivingBlowjobFromActorScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-penile-oral:receiving_blowjob_from_actor') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const givingBlowjob = actor?.components?.['sex-states:giving_blowjob'];
      const closenessPartners =
        actor?.components?.['personal-space-states:closeness']?.partners;

      if (!givingBlowjob || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const receivingEntityId = givingBlowjob.receiving_entity_id;
      if (!receivingEntityId) {
        return { success: true, value: new Set() };
      }

      const receivingEntity =
        fixture.entityManager.getEntityInstance(receivingEntityId);
      if (!receivingEntity) {
        return { success: true, value: new Set() };
      }

      const receivingBlowjob =
        receivingEntity.components?.['sex-states:receiving_blowjob'];
      if (!receivingBlowjob) {
        return { success: true, value: new Set() };
      }

      if (
        receivingBlowjob.giving_entity_id === actorId &&
        closenessPartners.includes(receivingEntityId)
      ) {
        return { success: true, value: new Set([receivingEntityId]) };
      }

      return { success: true, value: new Set() };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

describe('sex-penile-oral:pull_penis_out_of_mouth action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      ACTION_ID
    );
    restoreScopeResolver =
      installReceivingBlowjobFromActorScopeOverride(testFixture);
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
      buildPullPenisOutOfMouthScenario();
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

  it('removes blowjob components from both actor and primary', async () => {
    const { entities, actorId, primaryId } = buildPullPenisOutOfMouthScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist before action
    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    const primaryBefore =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorBefore.components['sex-states:giving_blowjob']).toBeDefined();
    expect(
      primaryBefore.components['sex-states:receiving_blowjob']
    ).toBeDefined();

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify components removed after action
    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorAfter.components['sex-states:giving_blowjob']).toBeUndefined();
    expect(
      primaryAfter.components['sex-states:receiving_blowjob']
    ).toBeUndefined();
  });

  it('does not affect other entities when removing blowjob state', async () => {
    const { entities, actorId, primaryId } = buildPullPenisOutOfMouthScenario();

    // Add another pair engaged in blowjob
    const SECONDARY_ACTOR_ID = 'other_actor';
    const SECONDARY_PRIMARY_ID = 'other_primary';

    const secondaryActor = new ModEntityBuilder(SECONDARY_ACTOR_ID)
      .withName('Other Actor')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('sex-states:giving_blowjob', {
        receiving_entity_id: SECONDARY_PRIMARY_ID,
        initiated: true,
      })
      .build();

    const secondaryPrimary = new ModEntityBuilder(SECONDARY_PRIMARY_ID)
      .withName('Other Primary')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('sex-states:receiving_blowjob', {
        giving_entity_id: SECONDARY_ACTOR_ID,
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
      secondaryActorAfter.components['sex-states:giving_blowjob']
    ).toBeDefined();
    expect(
      secondaryPrimaryAfter.components['sex-states:receiving_blowjob']
    ).toBeDefined();
  });

  it('does not fire rule for different action', async () => {
    const { entities, actorId, primaryId } = buildPullPenisOutOfMouthScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist before action
    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    expect(actorBefore.components['sex-states:giving_blowjob']).toBeDefined();

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
    expect(actorAfter.components['sex-states:giving_blowjob']).toBeDefined();

    // Verify no success event was dispatched
    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(0);
  });

  it('completes full workflow from initiation to completion', async () => {
    const { entities, actorId, primaryId } = buildPullPenisOutOfMouthScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist (simulating post-initiation state)
    const actorMid = testFixture.entityManager.getEntityInstance(actorId);
    const primaryMid = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorMid.components['sex-states:giving_blowjob']).toBeDefined();
    expect(
      primaryMid.components['sex-states:receiving_blowjob']
    ).toBeDefined();

    // Execute pull out action
    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify components removed (workflow complete)
    const actorFinal = testFixture.entityManager.getEntityInstance(actorId);
    const primaryFinal = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorFinal.components['sex-states:giving_blowjob']).toBeUndefined();
    expect(
      primaryFinal.components['sex-states:receiving_blowjob']
    ).toBeUndefined();

    // Verify success event
    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(1);
    expect(successEvents[0].payload.message).toBe(EXPECTED_MESSAGE);
  });
});
