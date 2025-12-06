/**
 * @file Integration test for positioning:sit_down lying_down forbidden component.
 * @description Verifies that sit_down action is not available when actor is lying down.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityScenarios,
  ModEntityBuilder,
} from '../../../common/mods/ModEntityBuilder.js';

describe('positioning:sit_down - lying_down forbidden component', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should NOT discover action when actor is lying down', () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    // Add lying_down component to actor
    scenario.actor.components['positioning:lying_down'] = {
      furniture_id: 'bed1',
    };

    const room = ModEntityScenarios.createRoom('room1', 'Test Room');
    const chair = new ModEntityBuilder('chair1')
      .withName('Chair')
      .atLocation(room.id)
      .withComponent('positioning:allows_sitting_on', {})
      .build();

    testFixture.reset([room, chair, scenario.actor]);

    const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
    const actionIds = actions.map((a) => a.id);

    expect(actionIds).not.toContain('positioning:sit_down');
  });
});
