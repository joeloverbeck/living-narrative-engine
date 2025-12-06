/**
 * @file Integration tests for sex-penile-oral:suck_penis_hard action and rule.
 * @description Verifies hard blowjob continuation narration with climax intent, perceptible event wiring, and component preservation (stateless action).
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import suckPenisHardAction from '../../../../data/mods/sex-penile-oral/actions/suck_penis_hard.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:suck_penis_hard';
const EXPECTED_MESSAGE =
  "Ava sucks Nolan's cock hard, intending to draw out Nolan's cum.";

/**
 * Builds the action index with the suck penis hard action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([suckPenisHardAction]);
}

/**
 * Builds a scenario where the ACTOR is giving a blowjob to PRIMARY with hard intensity.
 *
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string}} Scenario data.
 */
function buildSuckPenisHardScenario() {
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

describe('sex-penile-oral:suck_penis_hard action integration', () => {
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
  it('successfully executes suck penis hard action with correct perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } =
      buildSuckPenisHardScenario();
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

  it('produces narrative message matching specification format', async () => {
    const { entities, actorId, primaryId } = buildSuckPenisHardScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    const successEvents = testFixture.events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvents).toHaveLength(1);
    expect(successEvents[0].payload.message).toBe(EXPECTED_MESSAGE);

    const message = successEvents[0].payload.message;
    expect(message).toContain('sucks');
    expect(message).toContain('cock hard');
    expect(message).toContain('intending to draw out');
    expect(message).toContain("'s cum");
  });

  it('does not modify blowjob components during action execution', async () => {
    const { entities, actorId, primaryId } = buildSuckPenisHardScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Verify components exist before action
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

    // Verify components still present after action (stateless action)
    const actorAfter = testFixture.entityManager.getEntityInstance(actorId);
    const primaryAfter = testFixture.entityManager.getEntityInstance(primaryId);
    expect(actorAfter.components['positioning:giving_blowjob']).toBeDefined();
    expect(
      primaryAfter.components['positioning:receiving_blowjob']
    ).toBeDefined();
  });

  it('does not trigger rule for different action IDs', async () => {
    const { entities, actorId, primaryId } = buildSuckPenisHardScenario();
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

    // Verify no perceptible event was dispatched
    const perceptibleEvents = testFixture.events.filter(
      (e) => e.eventType === 'PERCEPTIBLE_EVENT'
    );
    expect(perceptibleEvents).toHaveLength(0);
  });
});
