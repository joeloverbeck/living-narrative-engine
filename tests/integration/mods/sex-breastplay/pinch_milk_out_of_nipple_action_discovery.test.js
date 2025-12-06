/**
 * @file Integration tests for the sex-breastplay:pinch_milk_out_of_nipple action discovery.
 * @description Ensures the lactation tease appears only when anatomy, exposure, and lactation requirements are satisfied.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import pinchMilkOutOfNippleAction from '../../../../data/mods/sex-breastplay/actions/pinch_milk_out_of_nipple.action.json';

const ACTION_ID = 'sex-breastplay:pinch_milk_out_of_nipple';
const ROOM_ID = 'lactation_lounge';
const ACTOR_ID = 'mira';
const TORSO_ID = `${ACTOR_ID}_torso`;
const LEFT_BREAST_ID = `${ACTOR_ID}_left_breast`;
const RIGHT_BREAST_ID = `${ACTOR_ID}_right_breast`;
const COVERING_ITEM_ID = 'silk_wrap';

describe('sex-breastplay:pinch_milk_out_of_nipple action discovery', () => {
  let testFixture;
  let configureActionDiscovery;
  let restoreValidateAction;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('sex-breastplay', ACTION_ID);

    testFixture.suppressHints();

    const originalValidateAction = testFixture.testEnv.validateAction;
    // The default validateAction helper expects target assignments. Because this
    // card is self-targeting with prerequisites, manually bridge to the
    // prerequisite service so discovery mirrors engine behavior.
    testFixture.testEnv.validateAction = (actorId, actionId) => {
      if (actionId === ACTION_ID) {
        const actorInstance =
          testFixture.entityManager.getEntityInstance(actorId);

        if (!actorInstance) {
          return false;
        }

        return testFixture.testEnv.prerequisiteService.evaluate(
          pinchMilkOutOfNippleAction.prerequisites,
          pinchMilkOutOfNippleAction,
          actorInstance
        );
      }

      return originalValidateAction(actorId, actionId);
    };

    restoreValidateAction = () => {
      testFixture.testEnv.validateAction = originalValidateAction;
    };

    const { testEnv } = testFixture;
    configureActionDiscovery = () => {
      testEnv.actionIndex.buildIndex([pinchMilkOutOfNippleAction]);
    };
  });

  afterEach(() => {
    if (restoreValidateAction) {
      restoreValidateAction();
      restoreValidateAction = null;
    }

    if (testFixture) {
      testFixture.cleanup();
      testFixture = null;
    }
  });

  /**
   * @description Builds scenario entities for lactation tease discovery tests.
   * @param {object} [options] - Scenario customization options.
   * @param {boolean} [options.includeBreasts] - Whether the actor should possess breast anatomy.
   * @param {boolean} [options.coverBreasts] - Whether the actor's chest should be covered by clothing.
   * @param {boolean} [options.includeLactation] - Whether the actor includes the lactation marker component.
   * @returns {{ entities: Array<object>, actorId: string }} Entities ready to load into the test environment and the actor id.
   */
  function buildScenario(options = {}) {
    const {
      includeBreasts = true,
      coverBreasts = false,
      includeLactation = true,
    } = options;

    const room = new ModEntityBuilder(ROOM_ID)
      .asRoom('Lactation Lounge')
      .build();

    const actorBuilder = new ModEntityBuilder(ACTOR_ID)
      .withName('Mira')
      .atLocation(ROOM_ID)
      .withLocationComponent(ROOM_ID)
      .asActor()
      .withBody(TORSO_ID);

    if (includeLactation) {
      actorBuilder.withComponent('sex-breastplay:is_lactating', {});
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

    const torso = new ModEntityBuilder(TORSO_ID)
      .asBodyPart({
        parent: null,
        children: includeBreasts ? [LEFT_BREAST_ID, RIGHT_BREAST_ID] : [],
        subType: 'torso',
      })
      .build();

    const entities = [room, actor, torso];

    if (includeBreasts) {
      const leftBreast = new ModEntityBuilder(LEFT_BREAST_ID)
        .asBodyPart({ parent: TORSO_ID, children: [], subType: 'breast' })
        .build();
      const rightBreast = new ModEntityBuilder(RIGHT_BREAST_ID)
        .asBodyPart({ parent: TORSO_ID, children: [], subType: 'breast' })
        .build();
      entities.push(leftBreast, rightBreast);
    }

    if (coverBreasts) {
      entities.push(
        new ModEntityBuilder(COVERING_ITEM_ID).withName('Silk Wrap').build()
      );
    }

    return { entities, actorId: ACTOR_ID };
  }

  it('appears for a lactating actor with bare breasts', async () => {
    const { entities, actorId } = buildScenario();
    testFixture.reset(entities);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeDefined();
    expect(discovered.targets).toBe('none');
  });

  it('does not appear when the actor lacks breast anatomy', async () => {
    const { entities, actorId } = buildScenario({ includeBreasts: false });
    testFixture.reset(entities);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it("does not appear when the actor's breasts are covered", async () => {
    const { entities, actorId } = buildScenario({ coverBreasts: true });
    testFixture.reset(entities);
    configureActionDiscovery();

    const breastsCovered = testFixture.testEnv.jsonLogic.evaluate(
      {
        or: [
          { isSocketCovered: ['actor', 'left_chest'] },
          { isSocketCovered: ['actor', 'right_chest'] },
        ],
      },
      { actor: { id: actorId } }
    );
    expect(breastsCovered).toBe(true);

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });

  it('does not appear when the actor is not lactating', async () => {
    const { entities, actorId } = buildScenario({ includeLactation: false });
    testFixture.reset(entities);
    configureActionDiscovery();

    const actions = await testFixture.discoverActions(actorId);
    const discovered = actions.find((action) => action.id === ACTION_ID);

    expect(discovered).toBeUndefined();
  });
});
