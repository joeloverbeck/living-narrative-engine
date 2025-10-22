/**
 * @file Integration tests for seduction:grab_crotch_draw_attention action discovery.
 * @description Ensures the grab crotch action is surfaced only when anatomy and clothing prerequisites are met.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/actionMatchers.js';
import grabCrotchDrawAttentionAction from '../../../../data/mods/seduction/actions/grab_crotch_draw_attention.action.json';

const ACTION_ID = 'seduction:grab_crotch_draw_attention';

/**
 * Builds and loads a scenario containing an actor with configurable anatomy and clothing.
 *
 * @param {ModTestFixture} fixture - Active mod test fixture.
 * @param {object} options - Scenario options.
 * @param {boolean} [options.includePenis=true] - Whether the actor should include a penis anatomy part.
 * @param {boolean} [options.includeTorsoLowerClothing=true] - Whether the actor should wear clothing in the torso_lower slot.
 * @returns {{ actorId: string }} Actor identifiers for discovery checks.
 */
function loadScenario(
  fixture,
  { includePenis = true, includeTorsoLowerClothing = true } = {}
) {
  const room = ModEntityScenarios.createRoom('room1', 'Test Room');

  const actorBuilder = new ModEntityBuilder('actor1')
    .withName('Alex')
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor()
    .withBody('actorPelvis');

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

  const target = new ModEntityBuilder('target1')
    .withName('Jordan')
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor()
    .build();

  const entities = [room, actor, target, pelvis];

  if (penis) {
    entities.push(penis);
  }

  if (includeTorsoLowerClothing) {
    entities.push(
      new ModEntityBuilder('pants_basic').withName('Pants').build()
    );
  }

  fixture.reset(entities);
  fixture.testEnv.actionIndex.buildIndex([grabCrotchDrawAttentionAction]);

  return { actorId: actor.id };
}

describe('seduction:grab_crotch_draw_attention action discovery', () => {
  let testFixture;
  let originalValidateAction;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('seduction', ACTION_ID);
    originalValidateAction = testFixture.testEnv.validateAction;
    testFixture.testEnv.validateAction = (actorId, actionId) => {
      if (actionId === ACTION_ID) {
        const actorEntity =
          testFixture.entityManager.getEntityInstance(actorId);
        return testFixture.testEnv.prerequisiteService.evaluate(
          grabCrotchDrawAttentionAction.prerequisites,
          grabCrotchDrawAttentionAction,
          actorEntity
        );
      }

      return originalValidateAction(actorId, actionId);
    };
  });

  afterEach(() => {
    if (testFixture) {
      if (originalValidateAction) {
        testFixture.testEnv.validateAction = originalValidateAction;
        originalValidateAction = null;
      }
      testFixture.cleanup();
    }
  });

  describe('Prerequisite driven discovery', () => {
    it('discovers the action when the actor has a penis and clothed crotch', () => {
      const { actorId } = loadScenario(testFixture, {
        includePenis: true,
        includeTorsoLowerClothing: true,
      });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          grabCrotchDrawAttentionAction.prerequisites,
          grabCrotchDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(true);

      const availableActions = testFixture.discoverActions(actorId);

      expect(availableActions).toHaveAction(ACTION_ID);
    });

    it('does not surface the action when the actor lacks a penis', () => {
      const { actorId } = loadScenario(testFixture, {
        includePenis: false,
        includeTorsoLowerClothing: true,
      });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          grabCrotchDrawAttentionAction.prerequisites,
          grabCrotchDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(false);

      const availableActions = testFixture.discoverActions(actorId);

      expect(availableActions).not.toHaveAction(ACTION_ID);
    });

    it('does not surface the action when the actor lacks lower-body clothing', () => {
      const { actorId } = loadScenario(testFixture, {
        includePenis: true,
        includeTorsoLowerClothing: false,
      });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          grabCrotchDrawAttentionAction.prerequisites,
          grabCrotchDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(false);

      const availableActions = testFixture.discoverActions(actorId);

      expect(availableActions).not.toHaveAction(ACTION_ID);
    });

    it('omits the action when both prerequisites are missing', () => {
      const { actorId } = loadScenario(testFixture, {
        includePenis: false,
        includeTorsoLowerClothing: false,
      });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          grabCrotchDrawAttentionAction.prerequisites,
          grabCrotchDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(false);

      const availableActions = testFixture.discoverActions(actorId);

      expect(availableActions).not.toHaveAction(ACTION_ID);
    });
  });
});
