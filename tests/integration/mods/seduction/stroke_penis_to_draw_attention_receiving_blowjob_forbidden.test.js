/**
 * @file Integration tests verifying that stroke_penis_to_draw_attention is correctly forbidden when actor is receiving a blowjob.
 * @description Ensures that the stroke penis action is not available when the acting actor
 * has the positioning:receiving_blowjob component.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';

// Import action definition
import strokePenisDrawAttentionAction from '../../../../data/mods/seduction/actions/stroke_penis_to_draw_attention.action.json';

const ACTION_ID = 'seduction:stroke_penis_to_draw_attention';

/**
 * Builds and loads a scenario containing an actor with configurable anatomy and clothing.
 *
 * @param {ModTestFixture} fixture - Active mod test fixture.
 * @param {object} options - Scenario options.
 * @param {boolean} [options.includePenis] - Whether the actor should include a penis anatomy part.
 * @param {boolean} [options.penisCovered] - Whether the penis is covered by clothing.
 * @param {boolean} [options.includeReceivingBlowjob] - Whether the actor is receiving a blowjob.
 * @returns {{ actorId: string }} Actor identifiers for discovery checks.
 */
function loadScenario(
  fixture,
  {
    includePenis = true,
    penisCovered = false,
    includeReceivingBlowjob = false,
  } = {}
) {
  const room = ModEntityScenarios.createRoom('room1', 'Test Room');

  const actorBuilder = new ModEntityBuilder('actor1')
    .withName('Bob')
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor()
    .withBody('actorPelvis');

  if (includeReceivingBlowjob) {
    actorBuilder.withComponent('positioning:receiving_blowjob', {
      giving_entity_id: 'partner1',
      consented: true,
    });
  }

  if (penisCovered) {
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

  if (penisCovered) {
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
  fixture.testEnv.actionIndex.buildIndex([strokePenisDrawAttentionAction]);

  return { actorId: actor.id };
}

/**
 * Test suite for verifying forbidden component behavior for stroke_penis_to_draw_attention
 * when actor is receiving a blowjob.
 */
describe('stroke_penis_to_draw_attention forbidden when receiving blowjob', () => {
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
    it('stroke_penis_to_draw_attention should have positioning:receiving_blowjob as forbidden component', () => {
      expect(
        strokePenisDrawAttentionAction.forbidden_components.actor
      ).toContain('positioning:receiving_blowjob');
    });
  });

  describe('Action discovery when NOT receiving blowjob', () => {
    it('stroke_penis_to_draw_attention is available when actor has uncovered penis', () => {
      const { actorId } = loadScenario(testFixture, {
        includePenis: true,
        penisCovered: false,
      });

      const availableActions = testFixture.discoverActions(actorId);

      expect(availableActions).toContainEqual(
        expect.objectContaining({ id: ACTION_ID })
      );
    });
  });

  describe('Action discovery when receiving blowjob', () => {
    it('stroke_penis_to_draw_attention is NOT available when actor is receiving blowjob', () => {
      const { actorId } = loadScenario(testFixture, {
        includePenis: true,
        penisCovered: false,
        includeReceivingBlowjob: true,
      });

      const availableActions = testFixture.discoverActions(actorId);

      expect(availableActions).not.toContainEqual(
        expect.objectContaining({ id: ACTION_ID })
      );
    });
  });
});
