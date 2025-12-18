/**
 * @file Integration tests for sex-penile-oral:guide_blowjob_with_hand action and rule.
 * @description Verifies blowjob guidance narration, perceptible event wiring, component preservation (not removal), and state isolation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import guideBlowjobWithHandAction from '../../../../data/mods/sex-penile-oral/actions/guide_blowjob_with_hand.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:guide_blowjob_with_hand';
const EXPECTED_MESSAGE =
  "Nolan guides Ava's blowjob with a hand on the back of Ava's head.";

/**
 * Builds the action index with the guide blowjob with hand action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([guideBlowjobWithHandAction]);
}

/**
 * Builds a scenario where the ACTOR is receiving a blowjob from PRIMARY.
 *
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string}} Scenario data.
 */
function buildGuideBlowjobScenario() {
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
    .withComponent('sex-states:receiving_blowjob', {
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
    .withComponent('sex-states:giving_blowjob', {
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
        actor?.components?.['sex-states:receiving_blowjob'];
      const closenessPartners =
        actor?.components?.['positioning:closeness']?.partners;

      if (!receivingBlowjob || !Array.isArray(closenessPartners)) {
        return { success: true, value: new Set() };
      }

      const givingEntityId = receivingBlowjob.giving_entity_id;
      if (!givingEntityId) {
        return { success: true, value: new Set() };
      }

      const givingEntity =
        fixture.entityManager.getEntityInstance(givingEntityId);
      if (!givingEntity) {
        return { success: true, value: new Set() };
      }

      const givingBlowjob =
        givingEntity.components?.['sex-states:giving_blowjob'];
      if (!givingBlowjob) {
        return { success: true, value: new Set() };
      }

      if (
        givingBlowjob.receiving_entity_id === actorId &&
        closenessPartners.includes(givingEntityId)
      ) {
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

describe('sex-penile-oral:guide_blowjob_with_hand action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      ACTION_ID
    );
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
  it('dispatches correct narrative message and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } =
      buildGuideBlowjobScenario();
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

  it('maintains blowjob components (does NOT remove them)', async () => {
    const { entities, actorId, primaryId } = buildGuideBlowjobScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist before action
    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    const primaryBefore =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorBefore.components['sex-states:receiving_blowjob']
    ).toBeDefined();
    expect(
      primaryBefore.components['sex-states:giving_blowjob']
    ).toBeDefined();

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // CRITICAL: Verify components STILL EXIST after action (unlike pull_penis_out_of_mouth)
    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorAfter.components['sex-states:receiving_blowjob']
    ).toBeDefined();
    expect(primaryAfter.components['sex-states:giving_blowjob']).toBeDefined();

    // Verify the state is preserved correctly
    expect(
      actorAfter.components['sex-states:receiving_blowjob'].giving_entity_id
    ).toBe(primaryId);
    expect(
      primaryAfter.components['sex-states:giving_blowjob'].receiving_entity_id
    ).toBe(actorId);
  });

  it('does not affect other entities when guiding blowjob', async () => {
    const { entities, actorId, primaryId } = buildGuideBlowjobScenario();

    // Add another pair engaged in blowjob
    const SECONDARY_ACTOR_ID = 'other_actor';
    const SECONDARY_PRIMARY_ID = 'other_primary';

    const secondaryActor = new ModEntityBuilder(SECONDARY_ACTOR_ID)
      .withName('Other Actor')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('sex-states:receiving_blowjob', {
        giving_entity_id: SECONDARY_PRIMARY_ID,
        consented: true,
      })
      .build();

    const secondaryPrimary = new ModEntityBuilder(SECONDARY_PRIMARY_ID)
      .withName('Other Primary')
      .atLocation('bedroom1')
      .withLocationComponent('bedroom1')
      .asActor()
      .withComponent('sex-states:giving_blowjob', {
        receiving_entity_id: SECONDARY_ACTOR_ID,
        initiated: true,
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
      secondaryActorAfter.components['sex-states:receiving_blowjob']
    ).toBeDefined();
    expect(
      secondaryPrimaryAfter.components['sex-states:giving_blowjob']
    ).toBeDefined();
  });

  it('does not fire rule for different action', async () => {
    const { entities, actorId, primaryId } = buildGuideBlowjobScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist before action
    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    expect(
      actorBefore.components['sex-states:receiving_blowjob']
    ).toBeDefined();

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
    expect(
      actorAfter.components['sex-states:receiving_blowjob']
    ).toBeDefined();

    // Verify no success event was dispatched
    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(0);
  });

  it('maintains ongoing blowjob state through multiple guidance actions', async () => {
    const { entities, actorId, primaryId } = buildGuideBlowjobScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist (simulating ongoing blowjob state)
    const actorInitial = testFixture.entityManager.getEntityInstance(actorId);
    const primaryInitial =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorInitial.components['sex-states:receiving_blowjob']
    ).toBeDefined();
    expect(
      primaryInitial.components['sex-states:giving_blowjob']
    ).toBeDefined();

    // Execute guidance action first time
    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify components maintained after first guidance
    const actorAfterFirst =
      testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfterFirst =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorAfterFirst.components['sex-states:receiving_blowjob']
    ).toBeDefined();
    expect(
      primaryAfterFirst.components['sex-states:giving_blowjob']
    ).toBeDefined();

    // Clear events for next execution
    testFixture.clearEvents();

    // Execute guidance action second time (should work because state maintained)
    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify components STILL maintained after second guidance
    const actorFinal = testFixture.entityManager.getEntityInstance(actorId);
    const primaryFinal = testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorFinal.components['sex-states:receiving_blowjob']
    ).toBeDefined();
    expect(primaryFinal.components['sex-states:giving_blowjob']).toBeDefined();

    // Verify success event for second execution
    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents.length).toBe(1);
    expect(successEvents[0].payload.message).toBe(EXPECTED_MESSAGE);
  });
});
