/**
 * @file Integration tests verifying that grab_crotch_draw_attention is correctly forbidden when actor is receiving a blowjob.
 * @description Ensures that the grab crotch action is not available when the acting actor
 * has the sex-states:receiving_blowjob component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

// Import action definition
import grabCrotchDrawAttentionAction from '../../../../data/mods/seduction/actions/grab_crotch_draw_attention.action.json';

const ACTION_ID = 'seduction:grab_crotch_draw_attention';

/**
 * Builds and loads a scenario containing an actor with configurable anatomy and clothing.
 *
 * @param {ModTestFixture} fixture - Active mod test fixture.
 * @param {object} options - Scenario options.
 * @param {boolean} [options.includePenis] - Whether the actor should include a penis anatomy part.
 * @param {boolean} [options.includeTorsoLowerClothing] - Whether the actor should wear clothing in the torso_lower slot.
 * @param {boolean} [options.includeReceivingBlowjob] - Whether the actor is receiving a blowjob.
 * @returns {{ actorId: string }} Actor identifiers for discovery checks.
 */
function loadScenario(
  fixture,
  {
    includePenis = true,
    includeTorsoLowerClothing = true,
    includeReceivingBlowjob = false,
  } = {}
) {
  const room = ModEntityScenarios.createRoom('room1', 'Test Room');

  const actorBuilder = new ModEntityBuilder('actor1')
    .withName('Alex')
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor()
    .withBody('actorPelvis');

  if (includeReceivingBlowjob) {
    actorBuilder.withComponent('sex-states:receiving_blowjob', {
      giving_entity_id: 'partner1',
      consented: true,
    });
  }

  if (includeTorsoLowerClothing) {
    actorBuilder.withComponent('clothing:equipment', {
      equipped: {
        torso_lower: {
          base: ['pants_basic'],
        },
      },
    });
  }

  const actor = actorBuilder.build();

  const pelvis = new ModEntityBuilder('actorPelvis')
    .asBodyPart({
      parent: null,
      children: includePenis ? ['actorPenis'] : [],
      subType: 'pelvis',
    })
    .build();

  const penis = includePenis
    ? new ModEntityBuilder('actorPenis')
        .asBodyPart({ parent: 'actorPelvis', children: [], subType: 'penis' })
        .build()
    : null;

  const entities = [room, actor, pelvis];

  if (penis) {
    entities.push(penis);
  }

  if (includeTorsoLowerClothing) {
    entities.push(
      new ModEntityBuilder('pants_basic').withName('Pants').build()
    );
  }

  // Always create a target actor at the same location (required for hasOtherActorsAtLocation prerequisite)
  entities.push(
    new ModEntityBuilder('target1')
      .withName('Observer')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .build()
  );

  fixture.reset(entities);
  fixture.testEnv.actionIndex.buildIndex([grabCrotchDrawAttentionAction]);

  return { actorId: actor.id };
}

/**
 * Test suite for verifying forbidden component behavior for grab_crotch_draw_attention
 * when actor is receiving a blowjob.
 */
describe('grab_crotch_draw_attention forbidden when receiving blowjob', () => {
  let testFixture;
  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('seduction', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Action structure validation', () => {
    it('grab_crotch_draw_attention should have sex-states:receiving_blowjob as forbidden component', () => {
      expect(
        grabCrotchDrawAttentionAction.forbidden_components.actor
      ).toContain('sex-states:receiving_blowjob');
    });
  });

  describe('Action discovery when NOT receiving blowjob', () => {
    it('grab_crotch_draw_attention is available when actor has penis and clothing', () => {
      const { actorId } = loadScenario(testFixture, {
        includePenis: true,
        includeTorsoLowerClothing: true,
      });

      const availableActions = testFixture.discoverActions(actorId);

      expect(availableActions).toContainEqual(
        expect.objectContaining({ id: ACTION_ID })
      );
    });
  });

  describe('Action discovery when receiving blowjob', () => {
    it('grab_crotch_draw_attention is NOT available when actor is receiving blowjob', () => {
      const { actorId } = loadScenario(testFixture, {
        includePenis: true,
        includeTorsoLowerClothing: true,
        includeReceivingBlowjob: true,
      });

      const availableActions = testFixture.discoverActions(actorId);

      expect(availableActions).not.toContainEqual(
        expect.objectContaining({ id: ACTION_ID })
      );
    });
  });
});
