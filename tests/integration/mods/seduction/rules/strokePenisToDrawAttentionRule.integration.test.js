/**
 * @file Integration tests for the seduction:handle_stroke_penis_to_draw_attention rule.
 * @description Verifies that the rule emits the correct storytelling beats and respects seduction self-targeting conventions.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../../common/mods/ModEntityBuilder.js';

const ACTION_ID = 'seduction:stroke_penis_to_draw_attention';
const ROOM_ID = 'room1';
const ACTOR_ID = 'actor_rule_1';
const ACTOR_TORSO_ID = `${ACTOR_ID}_torso`;
const ACTOR_GROIN_ID = `${ACTOR_ID}_groin`;
const ACTOR_PENIS_ID = `${ACTOR_GROIN_ID}_penis`;

/**
 *
 * @param actorName
 */
function buildRuleReadyEntities(actorName = 'Nikolai') {
  const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

  const actorBuilder = new ModEntityBuilder(ACTOR_ID)
    .withName(actorName)
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
          base: [],
          outer: [],
        },
      },
    });

  const torso = new ModEntityBuilder(ACTOR_TORSO_ID)
    .asBodyPart({ parent: null, children: [ACTOR_GROIN_ID], subType: 'torso' })
    .build();

  const groin = new ModEntityBuilder(ACTOR_GROIN_ID)
    .asBodyPart({
      parent: ACTOR_TORSO_ID,
      children: [ACTOR_PENIS_ID],
      subType: 'groin',
    })
    .withComponent('anatomy:sockets', {
      sockets: [
        {
          id: 'penis',
          attachedPart: ACTOR_PENIS_ID,
          partType: 'penis',
        },
      ],
    })
    .build();

  const penis = new ModEntityBuilder(ACTOR_PENIS_ID)
    .asBodyPart({ parent: ACTOR_GROIN_ID, children: [], subType: 'penis' })
    .build();

  return [room, actorBuilder.build(), torso, groin, penis];
}

describe('Seduction Mod: stroke_penis_to_draw_attention rule', () => {
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
    it('logs success with the specified seductive message', async () => {
      const entities = buildRuleReadyEntities('Mateo');
      testFixture.reset(entities);

      await testFixture.executeAction(ACTOR_ID, null);

      testFixture.assertActionSuccess(
        'Mateo strokes their bare penis seductively, drawing attention to it.'
      );
    });

    it('emits a perceptible event that omits a target', async () => {
      const entities = buildRuleReadyEntities('Elias');
      testFixture.reset(entities);

      await testFixture.executeAction(ACTOR_ID, null);

      testFixture.assertPerceptibleEvent({
        descriptionText:
          'Elias strokes their bare penis seductively, drawing attention to it.',
        locationId: ROOM_ID,
        actorId: ACTOR_ID,
        targetId: null,
        perceptionType: 'action_self_general',
      });
    });
  });

  describe('Rule structure', () => {
    it('references the correct action condition', () => {
      expect(testFixture.ruleFile.rule_id).toBe(
        'handle_stroke_penis_to_draw_attention'
      );
      expect(testFixture.ruleFile.condition.condition_ref).toBe(
        'seduction:event-is-action-stroke-penis-to-draw-attention'
      );
    });

    it('configures the perceptible message and termination macro', () => {
      const [
        nameAction,
        positionAction,
        logMessageAction,
        perceptionTypeAction,
        locationAction,
        targetAction,
        macroAction,
      ] = testFixture.ruleFile.actions;

      expect(nameAction.type).toBe('GET_NAME');
      expect(positionAction.type).toBe('QUERY_COMPONENT');
      expect(logMessageAction.parameters.value).toBe(
        '{context.actorName} strokes their bare penis seductively, drawing attention to it.'
      );
      expect(perceptionTypeAction.parameters.value).toBe('action_self_general');
      expect(locationAction.parameters.value).toBe(
        '{context.actorPosition.locationId}'
      );
      expect(targetAction.parameters.value).toBeNull();
      expect(macroAction.macro).toBe('core:logSuccessAndEndTurn');
    });
  });

  describe('Condition logic', () => {
    it('matches only the stroke penis action id', () => {
      expect(testFixture.conditionFile.logic['==']).toEqual([
        { var: 'event.payload.actionId' },
        ACTION_ID,
      ]);
    });
  });
});
