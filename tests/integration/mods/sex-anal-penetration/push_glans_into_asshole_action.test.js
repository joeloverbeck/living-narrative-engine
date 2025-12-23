/**
 * @file Integration tests for sex-anal-penetration:push_glans_into_asshole action and rule.
 * @description Verifies anal sex initiation narration, perceptible event wiring, component state management, and state cleanup.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-anal-penetration:push_glans_into_asshole';
const EXPECTED_MESSAGE =
  "Alice pushes their glans against Bob's asshole until the sphincter opens up and the glans pops inside.";

/**
 * Creates a standard scenario for anal penetration testing.
 * Actor (Alice) is close to target (Bob) who is facing away with exposed asshole.
 * Alice has an uncovered penis.
 *
 * @returns {object} Scenario with entities, actorId, primaryId, and roomId.
 */
function buildAnalPenetrationScenario() {
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .asActor()
    .withComponent('personal-space-states:closeness', { closeActorIds: ['bob'] })
    .withComponent('anatomy:body_part_types', { types: ['penis'] })
    .withComponent('clothing:socket_coverage', { sockets: {} })
    .build();

  const target = new ModEntityBuilder('bob')
    .withName('Bob')
    .atLocation('room1')
    .asActor()
    .withComponent('personal-space-states:closeness', { closeActorIds: ['alice'] })
    .withComponent('facing-states:facing_away', { facing_away_from: ['alice'] })
    .withComponent('anatomy:body_part_types', { types: ['asshole'] })
    .withComponent('clothing:socket_coverage', { sockets: {} })
    .build();

  return {
    entities: [room, actor, target],
    actorId: 'alice',
    primaryId: 'bob',
    roomId: 'room1',
  };
}

describe('sex-anal-penetration:push_glans_into_asshole action integration', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-anal-penetration',
      ACTION_ID
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  it('dispatches the anal penetration initiation narration and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } =
      buildAnalPenetrationScenario();
    testFixture.reset(entities);

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

  it('establishes reciprocal anal sex components on both participants', async () => {
    const { entities, actorId, primaryId } = buildAnalPenetrationScenario();
    testFixture.reset(entities);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify actor has fucking_anally component with correct entity reference
    const actor = testFixture.entityManager.getEntityInstance(actorId);
    expect(actor).toHaveComponent('sex-states:fucking_anally');
    expect(actor).toHaveComponentData('sex-states:fucking_anally', {
      being_fucked_entity_id: primaryId,
      initiated: true,
    });

    // Verify primary has being_fucked_anally component with correct entity reference
    const primary = testFixture.entityManager.getEntityInstance(primaryId);
    expect(primary).toHaveComponent('sex-states:being_fucked_anally');
    expect(primary).toHaveComponentData('sex-states:being_fucked_anally', {
      fucking_entity_id: actorId,
      consented: true,
    });
  });

  it('cleans up existing anal sex state when initiating with a new partner', async () => {
    const { entities, actorId, primaryId } = buildAnalPenetrationScenario();

    // Add entity that is currently fucking actor (actor is being fucked by old_fucker)
    const oldFuckingActor = new ModEntityBuilder('old_fucker')
      .withName('Old Fucker')
      .atLocation('room1')
      .asActor()
      .withComponent('sex-states:fucking_anally', {
        being_fucked_entity_id: actorId,
        initiated: true,
      })
      .build();

    // Add entity that primary is currently fucking (primary is fucking old_target)
    const oldTargetOfPrimary = new ModEntityBuilder('old_target')
      .withName('Old Target')
      .atLocation('room1')
      .asActor()
      .withComponent('sex-states:being_fucked_anally', {
        fucking_entity_id: primaryId,
        consented: true,
      })
      .build();

    entities.push(oldFuckingActor, oldTargetOfPrimary);

    // Actor has being_fucked_anally (actor is being fucked by old_fucker)
    const actorEntity = entities.find((e) => e.id === actorId);
    if (!actorEntity.components) actorEntity.components = {};
    actorEntity.components['sex-states:being_fucked_anally'] = {
      fucking_entity_id: 'old_fucker',
      consented: true,
    };

    // Primary has fucking_anally (primary is fucking old_target)
    const primaryEntity = entities.find((e) => e.id === primaryId);
    if (!primaryEntity.components) primaryEntity.components = {};
    primaryEntity.components['sex-states:fucking_anally'] = {
      being_fucked_entity_id: 'old_target',
      initiated: true,
    };

    testFixture.reset(entities);

    // Execute action - actor pushes glans into primary's asshole
    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify old_fucker no longer has fucking_anally component
    const oldFucker = testFixture.entityManager.getEntityInstance('old_fucker');
    expect(oldFucker).not.toHaveComponent('sex-states:fucking_anally');

    // Verify old_target no longer has being_fucked_anally component
    const oldTarget = testFixture.entityManager.getEntityInstance('old_target');
    expect(oldTarget).not.toHaveComponent('sex-states:being_fucked_anally');

    // Verify actor no longer has being_fucked_anally, but now has fucking_anally with primary
    const updatedActor = testFixture.entityManager.getEntityInstance(actorId);
    expect(updatedActor).not.toHaveComponent('sex-states:being_fucked_anally');
    expect(updatedActor).toHaveComponent('sex-states:fucking_anally');
    expect(updatedActor).toHaveComponentData('sex-states:fucking_anally', {
      being_fucked_entity_id: primaryId,
      initiated: true,
    });

    // Verify primary no longer has fucking_anally with old_target, but now has being_fucked_anally with actor
    const updatedPrimary =
      testFixture.entityManager.getEntityInstance(primaryId);
    expect(updatedPrimary).not.toHaveComponent('sex-states:fucking_anally');
    expect(updatedPrimary).toHaveComponent('sex-states:being_fucked_anally');
    expect(updatedPrimary).toHaveComponentData(
      'sex-states:being_fucked_anally',
      {
        fucking_entity_id: actorId,
        consented: true,
      }
    );
  });

  it('does not fire rule for a different action', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder('alice')
        .withName('Alice')
        .atLocation('room1')
        .asActor()
        .build(),
      new ModEntityBuilder('bob')
        .withName('Bob')
        .atLocation('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(entities);

    // Execute a different action
    testFixture.testEnv.eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actionId: 'sex-anal-penetration:tease_asshole_with_glans',
        actorId: 'alice',
        primaryId: 'bob',
      },
    });

    // Rule should not have fired - no anal sex components should be added
    const alice = testFixture.entityManager.getEntityInstance('alice');
    const bob = testFixture.entityManager.getEntityInstance('bob');

    expect(alice).not.toHaveComponent('sex-states:fucking_anally');
    expect(bob).not.toHaveComponent('sex-states:being_fucked_anally');
  });

  it('maintains ongoing anal sex state for correct pair', async () => {
    const { entities, actorId, primaryId } = buildAnalPenetrationScenario();

    testFixture.reset(entities);

    // Execute action
    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify both entities have the correct components
    const actor = testFixture.entityManager.getEntityInstance(actorId);
    const primary = testFixture.entityManager.getEntityInstance(primaryId);

    expect(actor).toHaveComponent('sex-states:fucking_anally');
    expect(actor).toHaveComponentData('sex-states:fucking_anally', {
      being_fucked_entity_id: primaryId,
      initiated: true,
    });

    expect(primary).toHaveComponent('sex-states:being_fucked_anally');
    expect(primary).toHaveComponentData('sex-states:being_fucked_anally', {
      fucking_entity_id: actorId,
      consented: true,
    });
  });
});
