/**
 * @file Integration tests for the seduction:stroke_penis_to_draw_attention action discovery.
 * @description Ensures the self-targeting penis stroking action respects prerequisites, forbidden components, and UI metadata.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import '../../../common/actionMatchers.js';
import strokePenisToDrawAttentionAction from '../../../../data/mods/seduction/actions/stroke_penis_to_draw_attention.action.json';
import strokePenisToDrawAttentionRule from '../../../../data/mods/seduction/rules/stroke_penis_to_draw_attention.rule.json';
import eventIsActionStrokePenisToDrawAttention from '../../../../data/mods/seduction/conditions/event-is-action-stroke-penis-to-draw-attention.condition.json';

const ACTION_ID = 'seduction:stroke_penis_to_draw_attention';
const ROOM_ID = 'room1';
const ACTOR_ID = 'actor1';
const TARGET_ID = 'target1';
const ACTOR_TORSO_ID = `${ACTOR_ID}_torso`;
const ACTOR_GROIN_ID = `${ACTOR_ID}_groin`;
const ACTOR_PENIS_ID = `${ACTOR_GROIN_ID}_penis`;
const ACTOR_CLOTHING_ID = `${ACTOR_ID}_slacks`;

function loadScenario(
  fixture,
  { hasPenis = true, penisCovered = false, includeHugging = false } = {}
) {
  const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName('Cassian')
    .atLocation(ROOM_ID)
    .withLocationComponent(ROOM_ID)
    .asActor()
    .withBody(ACTOR_TORSO_ID)
    .withComponent('clothing:slot_metadata', {
      slotMappings: {
        torso_lower: {
          coveredSockets: ['penis'],
          allowedLayers: ['underwear', 'base', 'outer'],
        },
      },
    })
    .withComponent('clothing:equipment', {
      equipped: {
        torso_lower: {
          underwear: [],
          base: penisCovered ? [ACTOR_CLOTHING_ID] : [],
          outer: [],
        },
      },
    });

  if (includeHugging) {
    actorBuilder.withComponent('positioning:hugging', {
      embraced_entity_id: TARGET_ID,
      initiated: true,
    });
  }

  const actor = actorBuilder.build();

  const torso = new ModEntityBuilder(ACTOR_TORSO_ID)
    .asBodyPart({
      parent: null,
      children: hasPenis ? [ACTOR_GROIN_ID] : [],
      subType: 'torso',
    })
    .build();

  const groin = new ModEntityBuilder(ACTOR_GROIN_ID)
    .asBodyPart({
      parent: ACTOR_TORSO_ID,
      children: hasPenis ? [ACTOR_PENIS_ID] : [],
      subType: 'groin',
    })
    .withComponent('anatomy:sockets', {
      sockets: [
        {
          id: 'penis',
          attachedPart: hasPenis ? ACTOR_PENIS_ID : null,
          partType: 'penis',
        },
      ],
    })
    .build();

  const entities = [room, actor, torso, groin];

  if (hasPenis) {
    entities.push(
      new ModEntityBuilder(ACTOR_PENIS_ID)
        .asBodyPart({ parent: ACTOR_GROIN_ID, children: [], subType: 'penis' })
        .build()
    );
  }

  if (penisCovered) {
    entities.push(
      new ModEntityBuilder(ACTOR_CLOTHING_ID)
        .withName('Tailored Slacks')
        .build()
    );
  }

  if (includeHugging) {
    entities.push(
      new ModEntityBuilder(TARGET_ID)
        .withName('Observer')
        .atLocation(ROOM_ID)
        .withLocationComponent(ROOM_ID)
        .asActor()
        .build()
    );
  }

  fixture.reset(entities);
  fixture.testEnv.actionIndex.buildIndex([strokePenisToDrawAttentionAction]);

  return { actorId: ACTOR_ID };
}

describe('seduction:stroke_penis_to_draw_attention action discovery', () => {
  let testFixture;
  let originalValidateAction;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'seduction',
      ACTION_ID,
      strokePenisToDrawAttentionRule,
      eventIsActionStrokePenisToDrawAttention
    );

    originalValidateAction = testFixture.testEnv.validateAction;
    testFixture.testEnv.validateAction = (actorId, actionId) => {
      if (actionId === ACTION_ID) {
        const actorEntity =
          testFixture.entityManager.getEntityInstance(actorId);
        return testFixture.testEnv.prerequisiteService.evaluate(
          strokePenisToDrawAttentionAction.prerequisites,
          strokePenisToDrawAttentionAction,
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

  describe('Action metadata', () => {
    it('exposes the correct template and visual styling', () => {
      expect(strokePenisToDrawAttentionAction.template).toBe(
        'stroke your penis to draw attention'
      );
      expect(strokePenisToDrawAttentionAction.visual).toEqual({
        backgroundColor: '#f57f17',
        textColor: '#000000',
        hoverBackgroundColor: '#f9a825',
        hoverTextColor: '#212121',
      });
    });

    it('keeps seduction self-targeting defaults', () => {
      expect(strokePenisToDrawAttentionAction.targets).toBe('none');
      expect(strokePenisToDrawAttentionAction.forbidden_components).toEqual({
        actor: ['positioning:hugging', 'positioning:giving_blowjob'],
      });
    });
  });

  describe('Prerequisite enforcement', () => {
    it('discovers the action when the actor has an uncovered penis', () => {
      const { actorId } = loadScenario(testFixture);

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          strokePenisToDrawAttentionAction.prerequisites,
          strokePenisToDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(true);

      const actions = testFixture.discoverActions(actorId);

      expect(actions).toHaveAction(ACTION_ID);
    });

    it('omits the action when the actor lacks a penis', () => {
      const { actorId } = loadScenario(testFixture, { hasPenis: false });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          strokePenisToDrawAttentionAction.prerequisites,
          strokePenisToDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(false);

      const actions = testFixture.discoverActions(actorId);

      expect(actions).not.toHaveAction(ACTION_ID);
    });

    it("omits the action when the actor's penis is covered", () => {
      const { actorId } = loadScenario(testFixture, { penisCovered: true });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          strokePenisToDrawAttentionAction.prerequisites,
          strokePenisToDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(false);

      const actions = testFixture.discoverActions(actorId);

      expect(actions).not.toHaveAction(ACTION_ID);
    });
  });

  describe('Forbidden component handling', () => {
    it('suppresses discovery while the actor is hugging someone', () => {
      const { actorId } = loadScenario(testFixture, { includeHugging: true });

      const prerequisitesPassed =
        testFixture.testEnv.prerequisiteService.evaluate(
          strokePenisToDrawAttentionAction.prerequisites,
          strokePenisToDrawAttentionAction,
          testFixture.entityManager.getEntityInstance(actorId)
        );
      expect(prerequisitesPassed).toBe(true);

      const actions = testFixture.discoverActions(actorId);

      expect(actions).not.toHaveAction(ACTION_ID);
    });
  });
});
