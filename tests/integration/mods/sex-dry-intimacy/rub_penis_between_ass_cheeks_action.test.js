/**
 * @file Integration tests for the sex-dry-intimacy:rub_penis_between_ass_cheeks action and rule.
 * @description Tests the rule execution after the rub_penis_between_ass_cheeks action is performed.
 * Note: This test does not test action discovery or scope resolution - it assumes
 * the action is valid and dispatches it directly. For action discovery tests,
 * see rubPenisBetweenAssCheeksActionDiscovery.integration.test.js.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

/**
 * Creates standardized anatomy setup for rub penis between ass cheeks scenarios.
 *
 * @returns {object} Object with actor, target, and all anatomy entities
 */
function setupAnatomyComponents() {
  // Create main room
  const room = new ModEntityBuilder('room1').asRoom('Test Room').build();

  // Create actor entity with body reference and anatomy
  const actor = new ModEntityBuilder('alice')
    .withName('Alice')
    .atLocation('room1')
    .closeToEntity('bob')
    .withBody('groin1')
    .asActor()
    .build();

  // Create target entity with body reference and anatomy
  const target = new ModEntityBuilder('bob')
    .withName('Bob')
    .atLocation('room1')
    .closeToEntity('alice')
    .withBody('torso1')
    .asActor()
    .build();

  // Add facing_away component manually
  target.components['positioning:facing_away'] = {
    facing_away_from: ['alice'],
  };

  // Create anatomy entities for actor
  const groin = new ModEntityBuilder('groin1')
    .asBodyPart({
      parent: null,
      children: ['penis1'],
      subType: 'groin',
    })
    .build();

  const penis = new ModEntityBuilder('penis1')
    .asBodyPart({
      parent: 'groin1',
      children: [],
      subType: 'penis',
    })
    .build();

  // Create anatomy entities for target
  const torso = new ModEntityBuilder('torso1')
    .asBodyPart({
      parent: null,
      children: ['leftAss1', 'rightAss1'],
      subType: 'torso',
      sockets: {
        left_ass: { coveredBy: null, attachedPart: 'leftAss1' },
        right_ass: { coveredBy: null, attachedPart: 'rightAss1' },
      },
    })
    .build();

  const leftAss = new ModEntityBuilder('leftAss1')
    .asBodyPart({
      parent: 'torso1',
      children: [],
      subType: 'ass_cheek',
    })
    .build();

  const rightAss = new ModEntityBuilder('rightAss1')
    .asBodyPart({
      parent: 'torso1',
      children: [],
      subType: 'ass_cheek',
    })
    .build();

  return {
    room,
    actor,
    target,
    groin,
    penis,
    torso,
    leftAss,
    rightAss,
  };
}

describe('sex-dry-intimacy:rub_penis_between_ass_cheeks action integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Create test fixture with auto-loaded files
    testFixture = await ModTestFixture.forAction(
      'sex-dry-intimacy',
      'sex-dry-intimacy:rub_penis_between_ass_cheeks'
    );

    // Setup anatomy entities
    const entities = setupAnatomyComponents();

    // Load all entities into the test environment
    testFixture.reset(Object.values(entities));
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  // eslint-disable-next-line jest/expect-expect
  it('performs rub penis between ass cheeks action successfully', async () => {
    // Execute the rub_penis_between_ass_cheeks action
    await testFixture.executeAction('alice', 'bob');

    // Assert action executed successfully with proper events
    ModAssertionHelpers.assertActionSuccess(
      testFixture.events,
      "Alice rubs their erect penis sensually between Bob's bare ass cheeks.",
      {
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      }
    );
  });
});
