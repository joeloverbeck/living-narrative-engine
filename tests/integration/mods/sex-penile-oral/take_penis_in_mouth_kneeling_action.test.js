/**
 * @file Integration tests for sex-penile-oral:take_penis_in_mouth_kneeling action and rule.
 * @description Verifies blowjob initiation narration, perceptible event wiring, component state management, and state cleanup.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import takePenisInMouthKneelingAction from '../../../../data/mods/sex-penile-oral/actions/take_penis_in_mouth_kneeling.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-penile-oral:take_penis_in_mouth_kneeling';
const EXPECTED_MESSAGE =
  "Ava leans in toward Nolan's crotch and takes Nolan's cock in the mouth, wrapping the sex organ in that velvety warmth.";

/**
 * Builds the action index with the take penis in mouth kneeling action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([takePenisInMouthKneelingAction]);
}

/**
 * Builds a scenario where the ACTOR is kneeling before PRIMARY who has an uncovered penis.
 *
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string, primaryPenisId: string}} Scenario data.
 */
function buildTakePenisInMouthKneelingScenario() {
  const ACTOR_ID = 'ava';
  const PRIMARY_ID = 'nolan';
  const ROOM_ID = 'bedroom1';

  const primaryTorsoId = `${PRIMARY_ID}_torso`;
  const primaryGroinId = `${PRIMARY_ID}_groin`;
  const primaryPenisId = `${primaryGroinId}_penis`;

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Bedroom')
    .asRoom('Private Bedroom')
    .build();

  const actor = new ModEntityBuilder(ACTOR_ID)
    .withName('Ava')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .kneelingBefore(PRIMARY_ID)
    .closeToEntity(PRIMARY_ID)
    .build();

  const primary = new ModEntityBuilder(PRIMARY_ID)
    .withName('Nolan')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .withBody(primaryTorsoId)
    .closeToEntity(ACTOR_ID)
    .build();

  const primaryTorso = new ModEntityBuilder(primaryTorsoId)
    .asBodyPart({
      parent: null,
      children: [primaryGroinId],
      subType: 'torso',
    })
    .build();

  const primaryGroin = new ModEntityBuilder(primaryGroinId)
    .asBodyPart({
      parent: primaryTorsoId,
      children: [primaryPenisId],
      subType: 'groin',
      sockets: {
        penis: { coveredBy: null, attachedPart: primaryPenisId },
      },
    })
    .build();

  const primaryPenis = new ModEntityBuilder(primaryPenisId)
    .asBodyPart({ parent: primaryGroinId, children: [], subType: 'penis' })
    .build();

  return {
    entities: [room, actor, primary, primaryTorso, primaryGroin, primaryPenis],
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
    roomId: ROOM_ID,
    primaryPenisId,
  };
}

/**
 * Installs a scope resolver override for actor_kneeling_before_target_with_penis.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installKneelingBeforeTargetWithPenisScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sex-core:actor_kneeling_before_target_with_penis') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const closenessPartners =
        actor?.components?.['positioning:closeness']?.partners;
      const kneelingBefore =
        actor?.components?.['positioning:kneeling_before']?.entityId;

      if (!Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

      if (!kneelingBefore) {
        return { success: true, value: new Set() };
      }

      const validPartners = closenessPartners.filter((partnerId) => {
        if (partnerId !== kneelingBefore) {
          return false;
        }

        const partner = fixture.entityManager.getEntityInstance(partnerId);
        if (!partner) {
          return false;
        }

        // Check if partner has uncovered penis
        const bodyId = partner.components?.['anatomy:body']?.body_id;
        if (!bodyId) {
          return false;
        }

        const bodyPart = fixture.entityManager.getEntityInstance(bodyId);
        if (!bodyPart) {
          return false;
        }

        // Simple check for penis in groin socket
        /**
         * Recursively checks if a body part or its children has an uncovered penis socket.
         *
         * @param {object} part - Body part entity to check.
         * @returns {boolean} True if uncovered penis socket found.
         */
        function hasPenisSocket(part) {
          const sockets = part.components?.['anatomy:body_part']?.sockets;
          if (sockets?.penis?.attachedPart) {
            return sockets.penis.coveredBy === null;
          }

          // Check children
          const children =
            part.components?.['anatomy:body_part']?.children || [];
          for (const childId of children) {
            const child = fixture.entityManager.getEntityInstance(childId);
            if (child && hasPenisSocket(child)) {
              return true;
            }
          }
          return false;
        }

        return hasPenisSocket(bodyPart);
      });

      return { success: true, value: new Set(validPartners) };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

describe('sex-penile-oral:take_penis_in_mouth_kneeling action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-penile-oral',
      ACTION_ID
    );
    restoreScopeResolver =
      installKneelingBeforeTargetWithPenisScopeOverride(testFixture);
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
  it('dispatches the blowjob initiation narration and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } =
      buildTakePenisInMouthKneelingScenario();
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

  it('establishes reciprocal blowjob components on both participants', async () => {
    const { entities, actorId, primaryId } =
      buildTakePenisInMouthKneelingScenario();
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
      buildTakePenisInMouthKneelingScenario();

    // Add a third entity that primary is initially giving a blowjob to
    const oldReceivingEntity = new ModEntityBuilder('old_receiver')
      .withName('Old Receiver')
      .atLocation('bedroom1')
      .asActor()
      .withComponent('positioning:receiving_blowjob', {
        giving_entity_id: primaryId,
        consented: true,
      })
      .build();

    // Add an entity that actor is being given a blowjob by
    const oldGivingEntity = new ModEntityBuilder('old_giver')
      .withName('Old Giver')
      .atLocation('bedroom1')
      .asActor()
      .withComponent('positioning:giving_blowjob', {
        receiving_entity_id: actorId,
        initiated: true,
      })
      .build();

    // Update primary to be giving blowjob to oldReceivingEntity
    const primaryEntity = entities.find((e) => e.id === primaryId);
    primaryEntity.components['positioning:giving_blowjob'] = {
      receiving_entity_id: 'old_receiver',
      initiated: true,
    };

    // Update actor to be receiving blowjob from oldGivingEntity
    const actorEntity = entities.find((e) => e.id === actorId);
    actorEntity.components['positioning:receiving_blowjob'] = {
      giving_entity_id: 'old_giver',
      consented: true,
    };

    entities.push(oldReceivingEntity, oldGivingEntity);
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify cleanup happened
    const oldReceiver =
      testFixture.entityManager.getEntityInstance('old_receiver');
    expect(oldReceiver).not.toHaveComponent('positioning:receiving_blowjob');

    const oldGiver = testFixture.entityManager.getEntityInstance('old_giver');
    expect(oldGiver).not.toHaveComponent('positioning:giving_blowjob');

    // Verify new relationship established
    const actor = testFixture.entityManager.getEntityInstance(actorId);
    expect(actor).not.toHaveComponent('positioning:receiving_blowjob');
    expect(actor).toHaveComponent('positioning:giving_blowjob');
    expect(actor).toHaveComponentData('positioning:giving_blowjob', {
      receiving_entity_id: primaryId,
      initiated: true,
    });

    const primary = testFixture.entityManager.getEntityInstance(primaryId);
    expect(primary).not.toHaveComponent('positioning:giving_blowjob');
    expect(primary).toHaveComponent('positioning:receiving_blowjob');
    expect(primary).toHaveComponentData('positioning:receiving_blowjob', {
      giving_entity_id: actorId,
      consented: true,
    });
  });

  it('does not fire rule for a different action', async () => {
    const { entities, actorId, primaryId } =
      buildTakePenisInMouthKneelingScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Dispatch a different action event
    testFixture.testEnv.eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actionId: 'sex-penile-oral:breathe_teasingly_on_penis',
        actorId,
        primaryId,
      },
    });

    // Verify no blowjob components added
    const actor = testFixture.entityManager.getEntityInstance(actorId);
    expect(actor).not.toHaveComponent('positioning:giving_blowjob');

    const primary = testFixture.entityManager.getEntityInstance(primaryId);
    expect(primary).not.toHaveComponent('positioning:receiving_blowjob');
  });
});
