/**
 * @file Integration tests for the seduction:squeeze_breasts_draw_attention rule.
 * @description Validates the seductive squeeze rule emits the correct messaging and respects prerequisites.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../../common/mods/ModEntityBuilder.js';
import '../../../../common/mods/domainMatchers.js';
import squeezeBreastsDrawAttentionAction from '../../../../../data/mods/seduction/actions/squeeze_breasts_draw_attention.action.json';

const ACTION_ID = 'seduction:squeeze_breasts_draw_attention';
const ROOM_ID = 'squeeze_suite';
const ACTOR_ID = 'performer';
const COVERING_ITEM_ID = 'stage_shawl';
const TARGET_ID = 'embraced_partner';
const SUCCESS_TEMPLATE =
  '{actorName} grabs her breasts and squeezes them sexily, drawing attention to them.';

/**
 * Builds entities that satisfy or challenge the squeeze breasts action prerequisites.
 *
 * @param {object} [options] - Scenario customisation flags.
 * @param {string} [options.actorName='Nadia'] - Actor display name for interpolation assertions.
 * @param {boolean} [options.coverBreasts=false] - Whether the actor's breasts are covered by clothing.
 * @param {boolean} [options.includeHugging=false] - Whether the actor is currently hugging another entity.
 * @returns {{ actorId: string, entities: Array<object> }} Prepared entity list and actor identifier.
 */
function buildScenario({
  actorName = 'Nadia',
  coverBreasts = false,
  includeHugging = false,
  actorSuffix = '',
} = {}) {
  const room = ModEntityScenarios.createRoom(ROOM_ID, 'Squeeze Suite');

  const actorId = actorSuffix ? `${ACTOR_ID}_${actorSuffix}` : ACTOR_ID;
  const torsoId = `${actorId}_torso`;
  const leftBreastId = `${actorId}_left_breast`;
  const rightBreastId = `${actorId}_right_breast`;
  const targetId = actorSuffix
    ? `${TARGET_ID}_${actorSuffix}`
    : TARGET_ID;

  const actorBuilder = new ModEntityBuilder(actorId)
    .withName(actorName)
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .withBody(torsoId);

  if (includeHugging) {
    actorBuilder.withComponent('positioning:hugging', {
      embraced_entity_id: targetId,
      initiated: true,
    });
  }

  if (coverBreasts) {
    actorBuilder
      .withComponent('clothing:equipment', {
        equipped: {
          torso_upper: {
            base: [COVERING_ITEM_ID],
          },
        },
      })
      .withComponent('clothing:slot_metadata', {
        slotMappings: {
          torso_upper: {
            coveredSockets: ['left_chest', 'right_chest'],
            allowedLayers: ['base', 'outer'],
          },
        },
      });
  }

  const actor = actorBuilder.build();

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({
      parent: null,
      children: [leftBreastId, rightBreastId],
      subType: 'torso',
    })
    .build();

  const leftBreast = new ModEntityBuilder(leftBreastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  const rightBreast = new ModEntityBuilder(rightBreastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  const entities = [room, actor, torso, leftBreast, rightBreast];

  if (coverBreasts) {
    entities.push(new ModEntityBuilder(COVERING_ITEM_ID).withName('Stage Shawl').build());
  }

  if (includeHugging) {
    entities.push(
      new ModEntityBuilder(targetId)
        .withName('Partner')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .build()
    );
  }

  return { actorId: actor.id, entities };
}

describe('Seduction Mod: squeeze_breasts_draw_attention rule', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('seduction', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  describe('Rule execution', () => {
    it('emits the correct success log and perceptible event', async () => {
      const { actorId, entities } = buildScenario({
        actorName: 'Selene',
        actorSuffix: 'success',
      });
      testFixture.reset(entities);

      await testFixture.executeAction(actorId, null);

      const expectedMessage = SUCCESS_TEMPLATE.replace('{actorName}', 'Selene');
      testFixture.assertActionSuccess(expectedMessage);
      testFixture.assertPerceptibleEvent({
        actorId,
        targetId: null,
        locationId: ROOM_ID,
        perceptionType: 'action_self_general',
        descriptionText: expectedMessage,
      });
    });

    it('interpolates the actor name inside the success template', async () => {
      const { actorId, entities } = buildScenario({
        actorName: 'Vivian',
        actorSuffix: 'template',
      });
      testFixture.reset(entities);

      await testFixture.executeAction(actorId, null);

      const expectedMessage = SUCCESS_TEMPLATE.replace('{actorName}', 'Vivian');
      testFixture.assertActionSuccess(expectedMessage);
    });

    it('ignores unrelated actions', async () => {
      const { actorId, entities } = buildScenario({ actorSuffix: 'wait' });
      testFixture.reset(entities);

      await testFixture.executeActionManual(actorId, 'core:wait', null, {
        originalInput: 'wait',
      });

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });

  describe('Rule guards', () => {
    it('fails prerequisite evaluation when breasts are covered', () => {
      const { actorId, entities } = buildScenario({
        coverBreasts: true,
        actorSuffix: 'covered',
      });
      testFixture.reset(entities);

      const actorInstance = testFixture.entityManager.getEntityInstance(actorId);
      const prerequisitesPassed = testFixture.testEnv.prerequisiteService.evaluate(
        squeezeBreastsDrawAttentionAction.prerequisites,
        squeezeBreastsDrawAttentionAction,
        actorInstance
      );

      expect(prerequisitesPassed).toBe(false);
    });

    it('rejects the action when the actor is hugging someone', async () => {
      const { actorId, entities } = buildScenario({
        includeHugging: true,
        actorSuffix: 'hugging',
      });
      testFixture.reset(entities);

      await expect(testFixture.executeAction(actorId, null)).rejects.toThrow(
        /forbidden component/i
      );
    });
  });
});
