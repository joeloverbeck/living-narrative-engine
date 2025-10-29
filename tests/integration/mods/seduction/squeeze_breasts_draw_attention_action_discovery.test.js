/**
 * @file Integration tests for the seduction:squeeze_breasts_draw_attention action discovery.
 * @description Ensures the bust squeezing seduction beat appears only when anatomy, exposure, and posture requirements are met.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/actionMatchers.js';
import squeezeBreastsDrawAttentionAction from '../../../../data/mods/seduction/actions/squeeze_breasts_draw_attention.action.json';

const ACTION_ID = 'seduction:squeeze_breasts_draw_attention';
const ROOM_ID = 'seduction_stage';
const ACTOR_ID = 'selene';
const TORSO_ID = `${ACTOR_ID}_torso`;
const LEFT_BREAST_ID = `${ACTOR_ID}_left_breast`;
const RIGHT_BREAST_ID = `${ACTOR_ID}_right_breast`;
const COVERING_ITEM_ID = 'teal_shawl';
const TARGET_ID = 'audience_member';

/**
 * Builds the entity graph required for squeeze breast discovery tests.
 *
 * @param {ModTestFixture} fixture - Active test fixture.
 * @param {object} [options] - Scenario customization.
 * @param {boolean} [options.includeLeftBreast=true] - Whether the actor includes a left breast part.
 * @param {boolean} [options.includeRightBreast=true] - Whether the actor includes a right breast part.
 * @param {boolean} [options.coverLeftBreast=false] - Whether clothing covers the left breast socket.
 * @param {boolean} [options.coverRightBreast=false] - Whether clothing covers the right breast socket.
 * @param {boolean} [options.includeHugging=false] - Whether the actor is currently hugging another entity.
 * @returns {{ actorId: string }} Actor identifier for discovery checks.
 */
function loadScenario(
  fixture,
  {
    includeLeftBreast = true,
    includeRightBreast = true,
    coverLeftBreast = false,
    coverRightBreast = false,
    includeHugging = false,
  } = {}
) {
  const room = ModEntityScenarios.createRoom(ROOM_ID, 'Seduction Stage');

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Selene')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .withBody(TORSO_ID);

  if (includeHugging) {
    actorBuilder.withComponent('positioning:hugging', {
      embraced_entity_id: TARGET_ID,
      initiated: true,
    });
  }

  const coveringSockets = [];

  if (coverLeftBreast) {
    coveringSockets.push('left_chest');
  }

  if (coverRightBreast) {
    coveringSockets.push('right_chest');
  }

  if (coveringSockets.length > 0) {
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
            coveredSockets: coveringSockets,
            allowedLayers: ['base', 'outer'],
          },
        },
      });
  }

  const actor = actorBuilder.build();

  const torsoChildren = [];
  if (includeLeftBreast) {
    torsoChildren.push(LEFT_BREAST_ID);
  }
  if (includeRightBreast) {
    torsoChildren.push(RIGHT_BREAST_ID);
  }

  const torso = new ModEntityBuilder(TORSO_ID)
    .asBodyPart({ parent: null, children: torsoChildren, subType: 'torso' })
    .build();

  const entities = [room, actor, torso];

  if (includeLeftBreast) {
    entities.push(
      new ModEntityBuilder(LEFT_BREAST_ID)
        .asBodyPart({ parent: TORSO_ID, children: [], subType: 'breast' })
        .build()
    );
  }

  if (includeRightBreast) {
    entities.push(
      new ModEntityBuilder(RIGHT_BREAST_ID)
        .asBodyPart({ parent: TORSO_ID, children: [], subType: 'breast' })
        .build()
    );
  }

  if (coveringSockets.length > 0) {
    entities.push(
      new ModEntityBuilder(COVERING_ITEM_ID)
        .withName('Teal Shawl')
        .build()
    );
  }

  if (includeHugging) {
    entities.push(
      new ModEntityBuilder(TARGET_ID)
        .withName('Audience Member')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .build()
    );
  }

  fixture.reset(entities);
  fixture.testEnv.actionIndex.buildIndex([squeezeBreastsDrawAttentionAction]);

  return { actorId: actor.id };
}

describe('seduction:squeeze_breasts_draw_attention action discovery', () => {
  let testFixture;
  let originalValidateAction;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('seduction', ACTION_ID);
    testFixture.suppressHints();

    originalValidateAction = testFixture.testEnv.validateAction;
    testFixture.testEnv.validateAction = (actorId, actionId) => {
      if (actionId === ACTION_ID) {
        const actorEntity =
          testFixture.entityManager.getEntityInstance(actorId);
        return testFixture.testEnv.prerequisiteService.evaluate(
          squeezeBreastsDrawAttentionAction.prerequisites,
          squeezeBreastsDrawAttentionAction,
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
      testFixture = null;
    }
  });

  describe('Prerequisite driven discovery', () => {
    it('appears when at least one breast is bare', () => {
      const { actorId } = loadScenario(testFixture, {
        coverLeftBreast: false,
        coverRightBreast: true,
      });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          squeezeBreastsDrawAttentionAction.prerequisites,
          squeezeBreastsDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(true);

      const availableActions = testFixture.discoverActions(actorId);
      expect(availableActions).toHaveAction(ACTION_ID);
    });

    it('does not appear when the actor lacks breast anatomy', () => {
      const { actorId } = loadScenario(testFixture, {
        includeLeftBreast: false,
        includeRightBreast: false,
      });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          squeezeBreastsDrawAttentionAction.prerequisites,
          squeezeBreastsDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(false);

      const availableActions = testFixture.discoverActions(actorId);
      expect(availableActions).not.toHaveAction(ACTION_ID);
    });

    it('does not appear when both breasts are covered', () => {
      const { actorId } = loadScenario(testFixture, {
        coverLeftBreast: true,
        coverRightBreast: true,
      });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          squeezeBreastsDrawAttentionAction.prerequisites,
          squeezeBreastsDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(false);

      const availableActions = testFixture.discoverActions(actorId);
      expect(availableActions).not.toHaveAction(ACTION_ID);
    });
  });

  describe('Forbidden component restrictions', () => {
    it('omits the action when the actor is hugging someone', () => {
      const { actorId } = loadScenario(testFixture, {
        includeHugging: true,
      });

      const availableActions = testFixture.discoverActions(actorId);
      expect(availableActions).not.toHaveAction(ACTION_ID);
    });
  });
});
