/**
 * @file Integration tests for the seduction:grab_crotch_draw_attention rule.
 * @description Validates that the rule logs the correct messaging and only responds to the matching action.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ModTestFixture } from '../../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../../common/mods/ModEntityBuilder.js';
import '../../../../common/mods/domainMatchers.js';

const ACTION_ID = 'seduction:grab_crotch_draw_attention';
const SUCCESS_TEMPLATE =
  '{actorName} grabs their crotch through the clothes, drawing attention to its bulge.';

/**
 * Prepares the fixture with an actor that satisfies the action prerequisites.
 *
 * @param {ModTestFixture} fixture - Active test fixture instance.
 * @param {string} actorName - Name applied to the actor for interpolation checks.
 * @returns {{ actorId: string }} Actor identifier for execution.
 */
function primeFixtureWithActor(fixture, actorName) {
  const room = ModEntityScenarios.createRoom('room1', 'Test Room');

  const actorBuilder = new ModEntityBuilder('actor1')
    .withName(actorName)
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor()
    .withBody('actorPelvis')
    .withComponent('clothing:equipment', {
      equipped: {
        torso_lower: {
          base: ['pants_basic'],
        },
      },
    });

  const actor = actorBuilder.build();

  const pelvis = new ModEntityBuilder('actorPelvis')
    .asBodyPart({ parent: null, children: ['actorPenis'], subType: 'pelvis' })
    .build();

  const penis = new ModEntityBuilder('actorPenis')
    .asBodyPart({ parent: 'actorPelvis', children: [], subType: 'penis' })
    .build();

  const target = new ModEntityBuilder('target1')
    .withName('Jordan')
    .atLocation('room1')
    .withLocationComponent('room1')
    .asActor()
    .build();

  const clothingEntity = new ModEntityBuilder('pants_basic')
    .withName('Pants')
    .build();

  fixture.reset([room, actor, target, pelvis, penis, clothingEntity]);

  return { actorId: actor.id };
}

describe('Seduction Mod: Grab Crotch to Draw Attention Rule', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('seduction', ACTION_ID);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  describe('Rule execution', () => {
    it('emits the correct success log and perceptible event', async () => {
      const { actorId } = primeFixtureWithActor(testFixture, 'Morgan');

      await testFixture.executeAction(actorId, null);

      const expectedMessage = SUCCESS_TEMPLATE.replace('{actorName}', 'Morgan');

      testFixture.assertActionSuccess(expectedMessage);
      testFixture.assertPerceptibleEvent({
        actorId,
        targetId: null,
        locationId: 'room1',
        perceptionType: 'physical.self_action',
        descriptionText: expectedMessage,
      });
    });

    it('injects the dynamic actor name into the message template', async () => {
      const { actorId } = primeFixtureWithActor(testFixture, 'Taylor');

      await testFixture.executeAction(actorId, null);

      const expectedMessage = SUCCESS_TEMPLATE.replace('{actorName}', 'Taylor');

      testFixture.assertActionSuccess(expectedMessage);
    });

    it('ignores unrelated actions', async () => {
      const { actorId } = primeFixtureWithActor(testFixture, 'Alex');

      await testFixture.executeActionManual(actorId, 'core:wait', null, {
        originalInput: 'wait',
      });

      testFixture.assertOnlyExpectedEvents(['core:attempt_action']);
    });
  });
});
