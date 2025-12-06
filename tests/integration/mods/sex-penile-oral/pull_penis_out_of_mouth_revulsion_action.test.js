/**
 * @file Integration tests for sex-penile-oral:pull_penis_out_of_mouth_revulsion action and rule.
 * @description Verifies blowjob termination with revulsion narrative, perceptible event wiring, component removal, and state isolation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import pullPenisOutRevulsionAction from '../../../../data/mods/sex-penile-oral/actions/pull_penis_out_of_mouth_revulsion.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:pull_penis_out_of_mouth_revulsion';
const EXPECTED_MESSAGE =
  "Ava pulls out Nolan's cock out of their mouth, face twisted in revulsion.";

/**
 * Builds the action index with the pull penis out of mouth revulsion action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullPenisOutRevulsionAction]);
}

/**
 * Builds a scenario where the ACTOR is giving a blowjob to PRIMARY.
 *
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string}} Scenario data.
 */
function buildRevulsionPullOutScenario() {
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
    .withComponent('positioning:giving_blowjob', {
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
    .withComponent('positioning:receiving_blowjob', {
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
 * @returns {Function} Cleanup function to restore original resolver.
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
      const givingBlowjob = actor?.components?.['positioning:giving_blowjob'];
      const closenessPartners =
        actor?.components?.['positioning:closeness']?.partners;

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
        receivingEntity.components?.['positioning:receiving_blowjob'];
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

describe('sex-penile-oral:pull_penis_out_of_mouth_revulsion action integration', () => {
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
      buildRevulsionPullOutScenario();
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
      perceptionType: 'action_target_general',
    });
  });

  it('removes blowjob components from both actor and primary', async () => {
    const { entities, actorId, primaryId } = buildRevulsionPullOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    const primaryBefore =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorBefore.components['positioning:giving_blowjob']).toBeDefined();
    expect(
      primaryBefore.components['positioning:receiving_blowjob']
    ).toBeDefined();

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorAfter.components['positioning:giving_blowjob']).toBeUndefined();
    expect(
      primaryAfter.components['positioning:receiving_blowjob']
    ).toBeUndefined();
  });

  it('does not affect other entities when removing blowjob state', async () => {
    const { entities, actorId, primaryId } = buildRevulsionPullOutScenario();

    const SECONDARY_ACTOR_ID = 'other_actor';
    const SECONDARY_PRIMARY_ID = 'other_primary';

    const secondaryActor = new ModEntityBuilder(SECONDARY_ACTOR_ID)
      .withName('Other Actor')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('positioning:giving_blowjob', {
        receiving_entity_id: SECONDARY_PRIMARY_ID,
        initiated: true,
      })
      .build();

    const secondaryPrimary = new ModEntityBuilder(SECONDARY_PRIMARY_ID)
      .withName('Other Primary')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('positioning:receiving_blowjob', {
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

    const secondaryActorAfter =
      testFixture.entityManager.getEntityInstance(SECONDARY_ACTOR_ID);
    const secondaryPrimaryAfter =
      testFixture.entityManager.getEntityInstance(SECONDARY_PRIMARY_ID);
    expect(
      secondaryActorAfter.components['positioning:giving_blowjob']
    ).toBeDefined();
    expect(
      secondaryPrimaryAfter.components['positioning:receiving_blowjob']
    ).toBeDefined();
  });

  it('does not fire rule for different action', async () => {
    const { entities, actorId, primaryId } = buildRevulsionPullOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    expect(actorBefore.components['positioning:giving_blowjob']).toBeDefined();

    testFixture.testEnv.eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId,
        primaryId,
        actionId: 'some:other_action',
      },
    });

    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    expect(actorAfter.components['positioning:giving_blowjob']).toBeDefined();

    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(0);
  });

  it('completes full workflow from initiation to completion', async () => {
    const { entities, actorId, primaryId } = buildRevulsionPullOutScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actorMid = testFixture.entityManager.getEntityInstance(actorId);
    const primaryMid = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorMid.components['positioning:giving_blowjob']).toBeDefined();
    expect(
      primaryMid.components['positioning:receiving_blowjob']
    ).toBeDefined();

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const actorFinal = testFixture.entityManager.getEntityInstance(actorId);
    const primaryFinal = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorFinal.components['positioning:giving_blowjob']).toBeUndefined();
    expect(
      primaryFinal.components['positioning:receiving_blowjob']
    ).toBeUndefined();

    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(1);
    expect(successEvents[0].payload.message).toBe(EXPECTED_MESSAGE);
  });
});
