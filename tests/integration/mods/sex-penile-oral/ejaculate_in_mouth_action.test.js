/**
 * @file Integration tests for sex-penile-oral:ejaculate_in_mouth action and rule.
 * @description Verifies climax action narration with perceptible event wiring, and component preservation (stateless action).
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import ejaculateInMouthAction from '../../../../data/mods/sex-penile-oral/actions/ejaculate_in_mouth.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:ejaculate_in_mouth';
const EXPECTED_MESSAGE =
  "Nolan groans and shudders with pleasure as they shoot a load of cum inside Ava's mouth.";

/**
 * Builds the action index with the ejaculate in mouth action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([ejaculateInMouthAction]);
}

/**
 * Builds a scenario where the ACTOR is receiving a blowjob from PRIMARY.
 *
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string}} Scenario data.
 */
function buildEjaculateInMouthScenario() {
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

      const givingEntity =
        fixture.entityManager.getEntityInstance(givingEntityId);
      if (!givingEntity) {
        return { success: true, value: new Set() };
      }

      const givingBlowjob =
        givingEntity.components?.['positioning:giving_blowjob'];
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

describe('sex-penile-oral:ejaculate_in_mouth action integration', () => {
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
      buildEjaculateInMouthScenario();
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

  it('maintains blowjob components (does NOT remove them)', async () => {
    const { entities, actorId, primaryId } = buildEjaculateInMouthScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist before action
    const actorBefore = testFixture.entityManager.getEntityInstance(actorId);
    const primaryBefore =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorBefore.components['positioning:receiving_blowjob']
    ).toBeDefined();
    expect(
      primaryBefore.components['positioning:giving_blowjob']
    ).toBeDefined();

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify components still present after action (stateless action - critical differentiator)
    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorAfter.components['positioning:receiving_blowjob']
    ).toBeDefined();
    expect(primaryAfter.components['positioning:giving_blowjob']).toBeDefined();

    // Verify component data is preserved
    expect(
      actorAfter.components['positioning:receiving_blowjob'].giving_entity_id
    ).toBe(primaryId);
    expect(
      primaryAfter.components['positioning:giving_blowjob'].receiving_entity_id
    ).toBe(actorId);
  });

  it('does not affect other entities when ejaculating', async () => {
    const {
      entities: scenario1Entities,
      actorId: actor1Id,
      primaryId: primary1Id,
    } = buildEjaculateInMouthScenario();

    // Create second pair with different IDs
    const ACTOR_ID_2 = 'marcus';
    const PRIMARY_ID_2 = 'bella';
    const ROOM_ID = 'bedroom1';

    const actor2 = new ModEntityBuilder(ACTOR_ID_2)
      .withName('Marcus')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .closeToEntity(PRIMARY_ID_2)
      .withComponent('positioning:receiving_blowjob', {
        giving_entity_id: PRIMARY_ID_2,
        consented: true,
      })
      .build();

    const primary2 = new ModEntityBuilder(PRIMARY_ID_2)
      .withName('Bella')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .closeToEntity(ACTOR_ID_2)
      .withComponent('positioning:giving_blowjob', {
        receiving_entity_id: ACTOR_ID_2,
        initiated: true,
      })
      .build();

    const allEntities = [...scenario1Entities, actor2, primary2];
    testFixture.reset(allEntities);
    configureActionDiscovery(testFixture);

    // Execute action for first pair only
    await testFixture.executeAction(actor1Id, primary1Id, {
      additionalPayload: { primaryId: primary1Id },
    });

    // Verify second pair's components unchanged
    const actor2After = testFixture.entityManager.getEntityInstance(ACTOR_ID_2);
    const primary2After =
      testFixture.entityManager.getEntityInstance(PRIMARY_ID_2);

    expect(
      actor2After.components['positioning:receiving_blowjob']
    ).toBeDefined();
    expect(
      primary2After.components['positioning:giving_blowjob']
    ).toBeDefined();
    expect(
      actor2After.components['positioning:receiving_blowjob'].giving_entity_id
    ).toBe(PRIMARY_ID_2);
    expect(
      primary2After.components['positioning:giving_blowjob'].receiving_entity_id
    ).toBe(ACTOR_ID_2);
  });

  it('does not fire rule for different action', async () => {
    const { entities, actorId, primaryId } = buildEjaculateInMouthScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Dispatch a different action event manually (won't match our condition)
    testFixture.testEnv.eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actorId,
        primaryId,
        actionId: 'sex-penile-oral:different_action',
      },
    });

    // Verify no success event was dispatched
    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents).toHaveLength(0);

    // Verify components unchanged
    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorAfter.components['positioning:receiving_blowjob']
    ).toBeDefined();
    expect(primaryAfter.components['positioning:giving_blowjob']).toBeDefined();
  });

  it('maintains ongoing blowjob state through multiple ejaculation actions', async () => {
    const { entities, actorId, primaryId } = buildEjaculateInMouthScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Execute action first time
    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const firstExecutionEvents = [...testFixture.events];
    expect(
      firstExecutionEvents.filter(
        (e) => e.eventType === 'core:display_successful_action_result'
      )
    ).toHaveLength(1);

    // Verify components still present
    const actorAfterFirst =
      testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfterFirst =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorAfterFirst.components['positioning:receiving_blowjob']
    ).toBeDefined();
    expect(
      primaryAfterFirst.components['positioning:giving_blowjob']
    ).toBeDefined();

    // Clear events and execute action second time
    testFixture.clearEvents();

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const secondExecutionEvents = [...testFixture.events];
    expect(
      secondExecutionEvents.filter(
        (e) => e.eventType === 'core:display_successful_action_result'
      )
    ).toHaveLength(1);

    // Verify components STILL present after second execution
    const actorAfterSecond =
      testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfterSecond =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(
      actorAfterSecond.components['positioning:receiving_blowjob']
    ).toBeDefined();
    expect(
      primaryAfterSecond.components['positioning:giving_blowjob']
    ).toBeDefined();
  });
});
