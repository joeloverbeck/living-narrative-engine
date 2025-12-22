/**
 * @file Integration test for physical-control:force_bend_over lying_down forbidden component.
 * @description Verifies that force_bend_over action is not available when actor is lying down.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('physical-control:force_bend_over - lying_down forbidden component', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'physical-control',
      'physical-control:force_bend_over'
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
    scenario.actor.components['lying-states:lying_on'] = {
      furniture_id: 'bed1',
    };

    testFixture.reset([scenario.actor, scenario.target]);

    const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
    const actionIds = actions.map((a) => a.id);

    expect(actionIds).not.toContain('physical-control:force_bend_over');
  });
});
