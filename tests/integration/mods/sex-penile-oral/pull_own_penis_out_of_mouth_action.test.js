/**
 * @file Integration tests for sex-penile-oral:pull_own_penis_out_of_mouth action and rule.
 * @description Verifies blowjob completion narration, perceptible event wiring, component removal, and state isolation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import pullOwnPenisOutOfMouthAction from '../../../../data/mods/sex-penile-oral/actions/pull_own_penis_out_of_mouth.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:pull_own_penis_out_of_mouth';
const EXPECTED_MESSAGE =
  "Nolan pulls out their cock out of Ava's mouth, a thread of saliva linking the cockhead to Ava's lips.";

/**
 * Builds the action index with the pull own penis out of mouth action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullOwnPenisOutOfMouthAction]);
}

/**
 * Builds a scenario where the ACTOR is receiving a blowjob from PRIMARY.
 *
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string}} Scenario data.
 */
function buildPullOwnPenisOutOfMouthScenario() {
  const ACTOR_ID = 'nolan';
  const PRIMARY_ID = 'ava';
  const ROOM_ID = 'bedroom1';

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actor = new ModEntityBuilder(ACTOR_ID)
    .withName('Nolan')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(PRIMARY_ID)
    .withComponent('positioning:receiving_blowjob', {
      giving_entity_id: PRIMARY_ID,
      consented: true,
    })
    .build();

  const primary = new ModEntityBuilder(PRIMARY_ID)
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(ACTOR_ID)
    .withComponent('positioning:giving_blowjob', {
      receiving_entity_id: ACTOR_ID,
      initiated: true,
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
 * Installs a scope resolver override for actor_giving_blowjob_to_me.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installActorGivingBlowjobToMeScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-penile-oral:actor_giving_blowjob_to_me') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const receivingBlowjob =
        actor?.components?.['positioning:receiving_blowjob'];
      const closenessPartners =
        actor?.components?.['positioning:closeness']?.partners;

      if (!receivingBlowjob || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const givingEntityId = receivingBlowjob.giving_entity_id;
      if (!givingEntityId) {
        return { success: true, value: new Set() };
      }

      const target = fixture.entityManager.getEntityInstance(givingEntityId);
      const targetGivingBlowjob =
        target?.components?.['positioning:giving_blowjob'];

      const referencesMatch =
        targetGivingBlowjob?.receiving_entity_id === actorId &&
        receivingBlowjob.giving_entity_id === givingEntityId;

      const isClose = closenessPartners.includes(givingEntityId);

      if (referencesMatch && isClose) {
        return { success: true, value: new Set([givingEntityId]) };
      }

      return { success: true, value: new Set() };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

describe('sex-penile-oral:pull_own_penis_out_of_mouth - Rule Execution', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-penile-oral', ACTION_ID);
    restoreScopeResolver =
      installActorGivingBlowjobToMeScopeOverride(testFixture);
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
  it('should dispatch correct narrative message and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } =
      buildPullOwnPenisOutOfMouthScenario();
    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    await testFixture.executeAction(actorId, primaryId);

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

  it('should remove receiving_blowjob from actor and giving_blowjob from primary (terminates interaction)', async () => {
    const { entities, actorId, primaryId } =
      buildPullOwnPenisOutOfMouthScenario();
    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    const primaryBefore =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorBefore.components['positioning:receiving_blowjob']
    ).toBeDefined();
    expect(
      primaryBefore.components['positioning:giving_blowjob']
    ).toBeDefined();

    await testFixture.executeAction(actorId, primaryId);

    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorAfter.components['positioning:receiving_blowjob']
    ).toBeUndefined();
    expect(
      primaryAfter.components['positioning:giving_blowjob']
    ).toBeUndefined();
  });

  it('should not affect other entities when ending blowjob', async () => {
    const SECONDARY_ACTOR_ID = 'marcus';
    const SECONDARY_PRIMARY_ID = 'sophia';
    const { entities, actorId, primaryId, roomId } =
      buildPullOwnPenisOutOfMouthScenario();

    const secondaryActor = new ModEntityBuilder(SECONDARY_ACTOR_ID)
      .withName('Marcus')
      .atLocation(roomId)
      .withLocationComponent(roomId)
      .asActor()
      .closeToEntity(SECONDARY_PRIMARY_ID)
      .withComponent('positioning:receiving_blowjob', {
        giving_entity_id: SECONDARY_PRIMARY_ID,
        consented: true,
      })
      .build();

    const secondaryPrimary = new ModEntityBuilder(SECONDARY_PRIMARY_ID)
      .withName('Sophia')
      .atLocation(roomId)
      .withLocationComponent(roomId)
      .asActor()
      .closeToEntity(SECONDARY_ACTOR_ID)
      .withComponent('positioning:giving_blowjob', {
        receiving_entity_id: SECONDARY_ACTOR_ID,
        initiated: true,
      })
      .build();

    configureActionDiscovery(testFixture);
    testFixture.reset([...entities, secondaryActor, secondaryPrimary]);

    await testFixture.executeAction(actorId, primaryId);

    const secondaryActorAfter =
      testFixture.entityManager.getEntityInstance(SECONDARY_ACTOR_ID);
    const secondaryPrimaryAfter =
      testFixture.entityManager.getEntityInstance(SECONDARY_PRIMARY_ID);
    expect(
      secondaryActorAfter.components['positioning:receiving_blowjob']
    ).toBeDefined();
    expect(
      secondaryPrimaryAfter.components['positioning:giving_blowjob']
    ).toBeDefined();
  });

  it('should not fire rule for different action', async () => {
    const { entities, actorId, primaryId } =
      buildPullOwnPenisOutOfMouthScenario();
    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    testFixture.testEnv.eventBus.dispatch({
      type: 'core:attempt_action',
      payload: { actorId, primaryId, actionId: 'some:other_action' },
    });

    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    expect(
      actorAfter.components['positioning:receiving_blowjob']
    ).toBeDefined();

    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(0);
  });

  it('should prevent action re-execution after blowjob ends', async () => {
    const { entities, actorId, primaryId } =
      buildPullOwnPenisOutOfMouthScenario();
    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    await testFixture.executeAction(actorId, primaryId);

    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    expect(
      actorAfter.components['positioning:receiving_blowjob']
    ).toBeUndefined();

    testFixture.clearEvents();

    const actions = await testFixture.discoverActions(actorId);
    const rediscovered = actions.find((action) => action.id === ACTION_ID);
    expect(rediscovered).toBeUndefined();
  });

  it('should handle kneeling target correctly (kneeling component preserved)', async () => {
    const { entities, actorId, primaryId } =
      buildPullOwnPenisOutOfMouthScenario();

    const primaryEntity = entities.find((e) => e.id === primaryId);
    primaryEntity.components['positioning:kneeling_before'] = {
      target_id: actorId,
    };

    configureActionDiscovery(testFixture);
    testFixture.reset(entities);

    await testFixture.executeAction(actorId, primaryId);

    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      primaryAfter.components['positioning:giving_blowjob']
    ).toBeUndefined();
    expect(
      primaryAfter.components['positioning:kneeling_before']
    ).toBeDefined();
    expect(
      primaryAfter.components['positioning:kneeling_before'].target_id
    ).toBe(actorId);
  });
});
