/**
 * @file Integration tests for sex-physical-control:pull_head_to_bare_penis action execution and rule.
 * @description Verifies narration, perceptible events, component state management, and prerequisite validation.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import pullHeadToBarePenisAction from '../../../../data/mods/sex-physical-control/actions/pull_head_to_bare_penis.action.json';
import '../../../common/mods/domainMatchers.js';
import '../../../common/actionMatchers.js';

const ACTION_ID = 'sex-physical-control:pull_head_to_bare_penis';
const EXPECTED_MESSAGE =
  "Dante pulls Mira's head down onto Dante's bare penis, inserting the sexual organ into Mira's mouth.";

/**
 * Installs a scope resolver override for actors_sitting_close.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @returns {() => void} Cleanup function restoring the original resolver.
 */
function installActorsSittingCloseScopeOverride(fixture) {
  const resolver = fixture.testEnv.unifiedScopeResolver;
  const originalResolveSync = resolver.resolveSync.bind(resolver);

  resolver.resolveSync = (scopeName, context) => {
    if (scopeName === 'sitting:actors_sitting_close') {
      const actorId = context?.actor?.id;
      if (!actorId) {
        return { success: true, value: new Set() };
      }

      const actor = fixture.entityManager.getEntityInstance(actorId);
      const closenessPartners =
        actor?.components?.['positioning:closeness']?.partners;

      if (!Array.isArray(closenessPartners) || closenessPartners.length === 0) {
        return { success: true, value: new Set() };
      }

      const validPartners = closenessPartners.filter((partnerId) => {
        const partner = fixture.entityManager.getEntityInstance(partnerId);
        if (!partner) {
          return false;
        }

        // Both must be sitting
        return Boolean(partner.components?.['positioning:sitting_on']);
      });

      return { success: true, value: new Set(validPartners) };
    }

    return originalResolveSync(scopeName, context);
  };

  return () => {
    resolver.resolveSync = originalResolveSync;
  };
}

/**
 * Builds a scenario where the ACTOR has an uncovered penis and both are sitting close.
 *
 * @param {object} options - Configuration options.
 * @param {boolean} options.coverActorPenis - Whether to cover actor's penis.
 * @returns {{entities: Array, actorId: string, primaryId: string, roomId: string, actorPenisId: string}} Scenario data.
 */
function buildPullHeadToBarePenisScenario(options = {}) {
  const { coverActorPenis = false } = options;

  const ACTOR_ID = 'dante';
  const PRIMARY_ID = 'mira';
  const ROOM_ID = 'parlor1';
  const FURNITURE_ID = 'couch1';

  const actorTorsoId = `${ACTOR_ID}_torso`;
  const actorGroinId = `${ACTOR_ID}_groin`;
  const actorPenisId = `${actorGroinId}_penis`;
  const actorClothingId = `${ACTOR_ID}_pants`;

  const room = new ModEntityBuilder(ROOM_ID)
    .withName('Private Parlor')
    .asRoom('Private Parlor')
    .build();

  const furniture = new ModEntityBuilder(FURNITURE_ID)
    .withName('Velvet Couch')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .withComponent('sitting:allows_sitting', {
      spots: [ACTOR_ID, PRIMARY_ID],
    })
    .build();

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Dante')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .withBody(actorTorsoId)
    .withComponent('positioning:sitting_on', {
      furniture_id: FURNITURE_ID,
      spot_index: 0,
    })
    .closeToEntity(PRIMARY_ID);

  if (coverActorPenis) {
    actorBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_lower: {
            base: [actorClothingId],
          },
        },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_lower: {
            coveredSockets: ['penis'],
            allowedLayers: ['base', 'outer'],
          },
        },
      });
  }

  const primary = new ModEntityBuilder(PRIMARY_ID)
    .withName('Mira')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .withComponent('positioning:sitting_on', {
      furniture_id: FURNITURE_ID,
      spot_index: 1,
    })
    .closeToEntity(ACTOR_ID)
    .build();

  const actorTorso = new ModEntityBuilder(actorTorsoId)
    .asBodyPart({
      parent: null,
      children: [actorGroinId],
      subType: 'torso',
    })
    .build();

  const actorGroin = new ModEntityBuilder(actorGroinId)
    .asBodyPart({
      parent: actorTorsoId,
      children: [actorPenisId],
      subType: 'groin',
      sockets: {
        penis: { coveredBy: null, attachedPart: actorPenisId },
      },
    })
    .build();

  const actorPenis = new ModEntityBuilder(actorPenisId)
    .asBodyPart({ parent: actorGroinId, children: [], subType: 'penis' })
    .build();

  const actor = actorBuilder.build();
  const entities = [
    room,
    furniture,
    actor,
    primary,
    actorTorso,
    actorGroin,
    actorPenis,
  ];

  if (coverActorPenis) {
    const actorClothing = new ModEntityBuilder(actorClothingId)
      .withName('dark trousers')
      .build();
    entities.push(actorClothing);
  }

  return {
    entities,
    actorId: ACTOR_ID,
    primaryId: PRIMARY_ID,
    roomId: ROOM_ID,
    furnitureId: FURNITURE_ID,
    actorPenisId,
  };
}

/**
 * Builds the action index with the pull head to bare penis action definition.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 */
function configureActionDiscovery(fixture) {
  fixture.testEnv.actionIndex.buildIndex([pullHeadToBarePenisAction]);
}

describe('sex-physical-control:pull_head_to_bare_penis action integration', () => {
  let testFixture;
  let restoreScopeResolver;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forActionAutoLoad(
      'sex-physical-control',
      ACTION_ID
    );
    restoreScopeResolver = installActorsSittingCloseScopeOverride(testFixture);
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
  it('dispatches correct narration and perceptible event', async () => {
    const { entities, actorId, primaryId, roomId } =
      buildPullHeadToBarePenisScenario();
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

  it('establishes reciprocal blowjob components with correct directions', async () => {
    const { entities, actorId, primaryId } = buildPullHeadToBarePenisScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    await testFixture.executeAction(actorId, primaryId, {
      additionalPayload: { primaryId },
    });

    // Verify PRIMARY has giving_blowjob component (they are giving oral sex)
    const primary = testFixture.entityManager.getEntityInstance(primaryId);
    expect(primary).toHaveComponent('sex-states:giving_blowjob');
    expect(primary).toHaveComponentData('sex-states:giving_blowjob', {
      receiving_entity_id: actorId,
      initiated: false, // Actor initiated, not primary
    });

    // Verify ACTOR has receiving_blowjob component (they are receiving oral sex)
    const actor = testFixture.entityManager.getEntityInstance(actorId);
    expect(actor).toHaveComponent('sex-states:receiving_blowjob');
    expect(actor).toHaveComponentData('sex-states:receiving_blowjob', {
      giving_entity_id: primaryId,
      consented: true,
    });
  });

  it('does not fire rule for different action', async () => {
    const { entities, actorId, primaryId } = buildPullHeadToBarePenisScenario();
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    // Dispatch a different action event
    await testFixture.testEnv.eventBus.dispatch({
      type: 'core:attempt_action',
      payload: {
        actionId: 'sex-penile-oral:lick_glans_sitting_close',
        actorId,
        primaryId,
      },
    });

    // Verify no blowjob components were added
    const actor = testFixture.entityManager.getEntityInstance(actorId);
    expect(actor).not.toHaveComponent('sex-states:receiving_blowjob');

    const primary = testFixture.entityManager.getEntityInstance(primaryId);
    expect(primary).not.toHaveComponent('sex-states:giving_blowjob');

    // Verify no success events dispatched
    expect(testFixture.events).not.toHaveActionSuccess();
  });

  it('fails prerequisite when penis is covered', async () => {
    const { entities, actorId } = buildPullHeadToBarePenisScenario({
      coverActorPenis: true,
    });
    testFixture.reset(entities);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    // Action should not be discovered when penis is covered
    expect(discovered).toBeUndefined();
  });

  it('fails prerequisite when actor lacks penis', async () => {
    const { roomId, furnitureId } = buildPullHeadToBarePenisScenario();

    // Build scenario without penis anatomy
    const room = new ModEntityBuilder(roomId)
      .withName('Private Parlor')
      .asRoom('Private Parlor')
      .build();

    const furniture = new ModEntityBuilder(furnitureId)
      .withName('Velvet Couch')
      .atLocation(roomId)
      .withLocationComponent(roomId)
      .withComponent('sitting:allows_sitting', {
        spots: ['dante', 'mira'],
      })
      .build();

    const actor = new ModEntityBuilder('dante')
      .withName('Dante')
      .atLocation(roomId)
      .withLocationComponent(roomId)
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 0,
      })
      .closeToEntity('mira')
      .build();

    const primary = new ModEntityBuilder('mira')
      .withName('Mira')
      .atLocation(roomId)
      .withLocationComponent(roomId)
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: furnitureId,
        spot_index: 1,
      })
      .closeToEntity('dante')
      .build();

    testFixture.reset([room, furniture, actor, primary]);
    configureActionDiscovery(testFixture);

    const actions = await testFixture.discoverActions('dante');
    const discovered = actions.find((action) => action.id === ACTION_ID);

    // Action should not be discovered when actor lacks penis
    expect(discovered).toBeUndefined();
  });
});
