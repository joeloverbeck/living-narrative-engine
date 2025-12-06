/**
 * @file Integration test for positioning:bend_over lying_down forbidden component.
 * @description Verifies that bend_over action is not available when actor is lying down.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';

describe('positioning:bend_over - lying_down forbidden component', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:bend_over'
    );
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should NOT discover action when actor is lying down', () => {
    const scenario = testFixture.createStandardActorTarget([
      'Alice',
      'Surface',
    ]);

    // Add lying_down component to actor
    scenario.actor.components['positioning:lying_down'] = {
      furniture_id: 'bed1',
    };

    testFixture.reset([scenario.actor, scenario.target]);

    const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);
    const actionIds = actions.map((a) => a.id);

    expect(actionIds).not.toContain('positioning:bend_over');
  });
});
