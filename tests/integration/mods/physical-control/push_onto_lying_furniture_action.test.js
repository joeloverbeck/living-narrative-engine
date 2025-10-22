/**
 * @file Integration tests for physical-control:push_onto_lying_furniture action execution.
 * @description Verifies that the rule pins the primary target onto furniture, locks movement, and logs the correct narration.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

const ACTION_ID = 'physical-control:push_onto_lying_furniture';
const ACTOR_ID = 'test:actor';
const TARGET_ID = 'test:target';
const FURNITURE_ID = 'test:furniture';
const ROOM_ID = 'room1';

/**
 * Builds a multi-target payload that mirrors the production event builder.
 *
 * @param {string} primaryId - Primary target entity ID.
 * @param {string} secondaryId - Secondary target entity ID.
 * @returns {object} Multi-target payload structure.
 */
function createMultiTargetPayload(primaryId = TARGET_ID, secondaryId = FURNITURE_ID) {
  return {
    targets: {
      primary: { entityId: primaryId },
      secondary: { entityId: secondaryId },
    },
    hasTargets: true,
    hasMultipleTargets: true,
    resolvedTargetCount: 2,
    primaryId,
    secondaryId,
    tertiaryId: null,
    targetId: primaryId,
  };
}

/**
 * Creates the default entities used by the action tests.
 *
 * @returns {object[]} Array of entities ready for fixture.reset.
 */
function createEntities() {
  const room = ModEntityScenarios.createRoom(ROOM_ID, 'Training Room');

  const actor = new ModEntityBuilder(ACTOR_ID)
    .withName('Rhea')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(TARGET_ID)
    .build();

  const target = new ModEntityBuilder(TARGET_ID)
    .withName('Noah')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .closeToEntity(ACTOR_ID)
    .build();

  const furniture = new ModEntityBuilder(FURNITURE_ID)
    .withName('Steel Table')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .withComponent('positioning:allows_lying_on', {})
    .build();

  return [room, actor, target, furniture];
}

describe('Physical Control Mod: push_onto_lying_furniture action', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('physical-control', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('pins the target onto the chosen furniture and breaks closeness', async () => {
    const entities = createEntities();
    testFixture.reset(entities);

    const actorBefore = testFixture.entityManager.getEntityInstance(ACTOR_ID);
    const targetBefore = testFixture.entityManager.getEntityInstance(TARGET_ID);

    expect(actorBefore.components['positioning:closeness'].partners).toContain(
      TARGET_ID
    );
    expect(targetBefore.components['positioning:closeness'].partners).toContain(
      ACTOR_ID
    );

    await testFixture.executeAction(ACTOR_ID, TARGET_ID, {
      secondaryTargetId: FURNITURE_ID,
      additionalPayload: createMultiTargetPayload(),
    });

    const actorAfter = testFixture.entityManager.getEntityInstance(ACTOR_ID);
    const targetAfter = testFixture.entityManager.getEntityInstance(TARGET_ID);

    expect(actorAfter.components['positioning:closeness']).toBeUndefined();
    expect(targetAfter.components['positioning:closeness']).toBeUndefined();

    const lyingState = targetAfter.components['positioning:lying_down'];
    expect(lyingState).toBeDefined();
    expect(lyingState.furniture_id).toBe(FURNITURE_ID);

    const movementState = targetAfter.components['core:movement'];
    expect(movementState).toBeDefined();
    expect(movementState.locked).toBe(true);
  });

  it('emits the expected narration and perception event', async () => {
    testFixture.reset(createEntities());

    await testFixture.executeAction(ACTOR_ID, TARGET_ID, {
      secondaryTargetId: FURNITURE_ID,
      additionalPayload: createMultiTargetPayload(),
    });

    const expectedMessage = 'Rhea pushes Noah down roughly onto Steel Table.';

    testFixture.assertActionSuccess(expectedMessage);
    testFixture.assertPerceptibleEvent({
      descriptionText: expectedMessage,
      perceptionType: 'action_target_general',
      locationId: ROOM_ID,
      actorId: ACTOR_ID,
      targetId: TARGET_ID,
    });
  });
});
