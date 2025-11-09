/**
 * @file Integration test for physical-control:turn_around lying_down forbidden component.
 * @description Verifies that turn_around action is not available when actor is lying down.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('physical-control:turn_around - lying_down forbidden component', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      'physical-control:turn_around'
    );
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
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

    testFixture.reset([scenario.actor, scenario.target]);

    const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
    const actionIds = actions.map((a) => a.id);

    expect(actionIds).not.toContain('physical-control:turn_around');
  });
});
