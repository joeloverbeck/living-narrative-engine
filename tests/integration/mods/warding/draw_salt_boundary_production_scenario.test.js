/**
 * @file Production scenario test for warding:draw_salt_boundary action.
 * @description Tests the action discovery using actual scope resolution (no mocking).
 * This test validates that the corrupted_actors.scope correctly filters entities
 * at the same location as the actor.
 *
 * Related fix: corrupted_actors.scope was updated to compare actor.components.core:position.locationId
 * instead of using condition_ref: core:entity-at-location (which compared to game world location).
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';
import drawSaltBoundaryAction from '../../../../data/mods/warding/actions/draw_salt_boundary.action.json';

const ACTION_ID = 'warding:draw_salt_boundary';

describe('warding:draw_salt_boundary production scenario', () => {
  let testFixture;

  beforeEach(async () => {
    testFixture = await ModTestFixture.forAction('warding', ACTION_ID);
    clearEntityCache();

    // Register the warding scope with all its condition dependencies
    // This ensures condition_ref values in the scope are properly resolved
    // Using ScopeResolverHelpers which has improved context handling
    await ScopeResolverHelpers.registerCustomScope(
      testFixture.testEnv,
      'warding',
      'corrupted_actors',
      { loadConditions: true }
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  /**
   * Creates a test scenario with actor and corrupted target at the same location.
   * Does NOT mock scope resolution - uses actual scope definition.
   *
   * @returns {{actor: object, corruptedTarget: object, room: object}} Test entities
   */
  const setupProductionScenario = () => {
    const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

    const actor = new ModEntityBuilder('test:ward_caster')
      .withName('Ward Caster')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('skills:warding_skill', { value: 85 })
      .build();

    const corruptedTarget = new ModEntityBuilder('test:corrupted_entity')
      .withName('Corrupted Entity')
      .atLocation('room1')
      .withLocationComponent('room1')
      .asActor()
      .withComponent('warding:corrupted', {})
      .build();

    testFixture.reset([room, actor, corruptedTarget]);

    // Build action index with the action
    testFixture.testEnv.actionIndex.buildIndex([drawSaltBoundaryAction]);

    return { actor, corruptedTarget, room };
  };

  describe('Action discovery with real scope resolution', () => {
    it('should discover action when actor has warding skill and corrupted target is at same location', () => {
      const { actor } = setupProductionScenario();

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).toContain(ACTION_ID);
    });

    it('should NOT discover action when corrupted target is at different location', () => {
      const room1 = ModEntityScenarios.createRoom('room1', 'Sanctum');
      const room2 = ModEntityScenarios.createRoom('room2', 'Other Room');

      const actor = new ModEntityBuilder('test:ward_caster')
        .withName('Ward Caster')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('skills:warding_skill', { value: 85 })
        .build();

      // Corrupted target in DIFFERENT location
      const corruptedTarget = new ModEntityBuilder('test:corrupted_entity')
        .withName('Corrupted Entity')
        .atLocation('room2')
        .withLocationComponent('room2')
        .asActor()
        .withComponent('warding:corrupted', {})
        .build();

      testFixture.reset([room1, room2, actor, corruptedTarget]);
      testFixture.testEnv.actionIndex.buildIndex([drawSaltBoundaryAction]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const actionIds = availableActions.map((action) => action.id);

      // Should NOT be available - target is in different location
      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should NOT discover action when actor lacks warding skill', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

      // Actor WITHOUT warding skill
      const actor = new ModEntityBuilder('test:ward_caster')
        .withName('Unskilled Person')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();

      const corruptedTarget = new ModEntityBuilder('test:corrupted_entity')
        .withName('Corrupted Entity')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('warding:corrupted', {})
        .build();

      testFixture.reset([room, actor, corruptedTarget]);
      testFixture.testEnv.actionIndex.buildIndex([drawSaltBoundaryAction]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should NOT discover action when target is not corrupted', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

      const actor = new ModEntityBuilder('test:ward_caster')
        .withName('Ward Caster')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('skills:warding_skill', { value: 85 })
        .build();

      // Target WITHOUT warding:corrupted component
      const normalTarget = new ModEntityBuilder('test:normal_entity')
        .withName('Normal Entity')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .build();

      testFixture.reset([room, actor, normalTarget]);
      testFixture.testEnv.actionIndex.buildIndex([drawSaltBoundaryAction]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should NOT target the actor themselves even if corrupted', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

      // Actor is BOTH the caster AND corrupted
      const corruptedCaster = new ModEntityBuilder('test:corrupted_caster')
        .withName('Corrupted Ward Caster')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('skills:warding_skill', { value: 85 })
        .withComponent('warding:corrupted', {})
        .build();

      testFixture.reset([room, corruptedCaster]);
      testFixture.testEnv.actionIndex.buildIndex([drawSaltBoundaryAction]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        corruptedCaster.id
      );
      const actionIds = availableActions.map((action) => action.id);

      // Should NOT be available - no valid targets (can't target self)
      expect(actionIds).not.toContain(ACTION_ID);
    });

    it('should discover action with multiple corrupted targets at same location', () => {
      const room = ModEntityScenarios.createRoom('room1', 'Sanctum');

      const actor = new ModEntityBuilder('test:ward_caster')
        .withName('Ward Caster')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('skills:warding_skill', { value: 85 })
        .build();

      const corruptedTarget1 = new ModEntityBuilder('test:corrupted_entity_1')
        .withName('First Corrupted Entity')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('warding:corrupted', {})
        .build();

      const corruptedTarget2 = new ModEntityBuilder('test:corrupted_entity_2')
        .withName('Second Corrupted Entity')
        .atLocation('room1')
        .withLocationComponent('room1')
        .asActor()
        .withComponent('warding:corrupted', {})
        .build();

      testFixture.reset([room, actor, corruptedTarget1, corruptedTarget2]);
      testFixture.testEnv.actionIndex.buildIndex([drawSaltBoundaryAction]);

      const availableActions = testFixture.testEnv.getAvailableActions(
        actor.id
      );
      const actionIds = availableActions.map((action) => action.id);

      expect(actionIds).toContain(ACTION_ID);
    });
  });
});
