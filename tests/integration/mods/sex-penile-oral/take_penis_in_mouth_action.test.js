/**
 * @file Integration tests for sex-penile-oral:take_penis_in_mouth action and rule.
 * @description Verifies blowjob initiation narration, perceptible event wiring, component state management, and state cleanup.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import {
  buildBreatheTeasinglyOnPenisSittingCloseScenario,
  installSittingCloseUncoveredPenisScopeOverride,
} from '../../../common/mods/sex/breatheTeasinglyOnPenisSittingCloseFixtures.js';
import takePenisInMouthAction from '../../../../data/mods/sex-penile-oral/actions/take_penis_in_mouth.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:take_penis_in_mouth';
const EXPECTED_MESSAGE =
  "Ava leans down to Nolan's lap and takes Nolan's cock in the mouth, wrapping the sex organ in that velvety warmth.";

/**
 * Builds the action index with the take penis in mouth action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([takePenisInMouthAction]);
}

describe('sex-penile-oral:take_penis_in_mouth action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad('sex-penile-oral', ACTION_ID);
    restoreScopeResolver = installSittingCloseUncoveredPenisScopeOverride(testFixture);
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

  it('dispatches the blowjob initiation narration and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } =
      buildBreatheTeasinglyOnPenisSittingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    ModAssertionHelpers.assertActionSuccess(testFixture.events, EXPECTED_MESSAGE, {
      shouldEndTurn: true,
      shouldHavePerceptibleEvent: true,
    });

    ModAssertionHelpers.assertPerceptibleEvent(testFixture.events, {
      descriptionText: EXPECTED_MESSAGE,
      locationId: roomId,
      actorId,
      targetId: primaryId,
      perceptionType: 'action_target_general',
    });
  });

  it('establishes reciprocal blowjob components on both participants', async () => {
    const { entities, actorId, primaryId } =
      buildBreatheTeasinglyOnPenisSittingCloseScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify actor has giving_blowjob component with correct entity reference
    const actor = testFixture.entityManager.getEntityInstance(actorId);
    expect(actor).toHaveComponent('positioning:giving_blowjob');
    expect(actor).toHaveComponentData('positioning:giving_blowjob', {
      receiving_entity_id: primaryId,
      initiated: true,
    });

    // Verify primary has receiving_blowjob component with correct entity reference
    const primary = testFixture.entityManager.getEntityInstance(primaryId);
    expect(primary).toHaveComponent('positioning:receiving_blowjob');
    expect(primary).toHaveComponentData('positioning:receiving_blowjob', {
      giving_entity_id: actorId,
      consented: true,
    });
  });

  it('cleans up existing blowjob state when initiating with a new partner', async () => {
    const { entities, actorId, primaryId } =
      buildBreatheTeasinglyOnPenisSittingCloseScenario();

    // Add a third entity that primary is initially giving a blowjob to
    const oldReceivingEntity = new ModEntityBuilder('old_receiver')
      .withName('Old Receiver')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', { furnitureId: 'furniture1' })
      .withComponent('positioning:receiving_blowjob', {
        giving_entity_id: primaryId,
        consented: true,
      })
      .build();

    // Add an entity that actor is being given a blowjob by
    const oldGivingEntity = new ModEntityBuilder('old_giver')
      .withName('Old Giver')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', { furnitureId: 'furniture1' })
      .withComponent('positioning:giving_blowjob', {
        receiving_entity_id: actorId,
        initiated: true,
      })
      .build();

    entities.push(oldReceivingEntity, oldGivingEntity);

    // Find actor entity and add receiving_blowjob component (actor is receiving from old_giver)
    const actorEntity = entities.find((e) => e.id === actorId);
    if (!actorEntity.components) actorEntity.components = {};
    actorEntity.components['positioning:receiving_blowjob'] = {
      giving_entity_id: 'old_giver',
      consented: true,
    };

    // Find primary entity and add giving_blowjob component (primary is giving to old_receiver)
    const primaryEntity = entities.find((e) => e.id === primaryId);
    if (!primaryEntity.components) primaryEntity.components = {};
    primaryEntity.components['positioning:giving_blowjob'] = {
      receiving_entity_id: 'old_receiver',
      initiated: true,
    };

    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Execute action - actor takes primary's penis in mouth
    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify old receiving entity no longer has receiving_blowjob component
    const oldReceiver = testFixture.entityManager.getEntityInstance('old_receiver');
    expect(oldReceiver).not.toHaveComponent('positioning:receiving_blowjob');

    // Verify old giving entity no longer has giving_blowjob component
    const oldGiver = testFixture.entityManager.getEntityInstance('old_giver');
    expect(oldGiver).not.toHaveComponent('positioning:giving_blowjob');

    // Verify actor no longer has receiving_blowjob, but now has giving_blowjob
    const updatedActor = testFixture.entityManager.getEntityInstance(actorId);
    expect(updatedActor).not.toHaveComponent('positioning:receiving_blowjob');
    expect(updatedActor).toHaveComponent('positioning:giving_blowjob');
    expect(updatedActor).toHaveComponentData('positioning:giving_blowjob', {
      receiving_entity_id: primaryId,
      initiated: true,
    });

    // Verify primary no longer has giving_blowjob, but now has receiving_blowjob
    const updatedPrimary = testFixture.entityManager.getEntityInstance(primaryId);
    expect(updatedPrimary).not.toHaveComponent('positioning:giving_blowjob');
    expect(updatedPrimary).toHaveComponent('positioning:receiving_blowjob');
    expect(updatedPrimary).toHaveComponentData('positioning:receiving_blowjob', {
      giving_entity_id: actorId,
      consented: true,
    });
  });

  it('does not fire rule for a different action', async () => {
    const entities = [
      new ModEntityBuilder('room1').asRoom('Room').build(),
      new ModEntityBuilder('ava')
        .withName('Ava')
        .atLocation('room1')
        .asActor()
        .build(),
      new ModEntityBuilder('nolan')
        .withName('Nolan')
        .atLocation('room1')
        .asActor()
        .build(),
    ];

    testFixture.reset(entities);

    // Execute a different action
    testFixture.testEnv.eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actionId: 'sex-penile-oral:lick_glans_sitting_close',
        actorId: 'ava',
        primaryId: 'nolan',
      },
    });

    // Rule should not have fired - no blowjob components should be added
    const ava = testFixture.entityManager.getEntityInstance('ava');
    const nolan = testFixture.entityManager.getEntityInstance('nolan');

    expect(ava).not.toHaveComponent('positioning:giving_blowjob');
    expect(nolan).not.toHaveComponent('positioning:receiving_blowjob');
  });
});
