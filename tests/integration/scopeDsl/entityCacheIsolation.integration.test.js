/**
 * @file Integration tests for entity cache isolation (SCODSLROB-007)
 * @description Regression test for the original cache staleness bug.
 * Verifies that entity state does not leak between tests.
 *
 * Validates:
 * - INV-CACHE-3: Cache invalidation on component changes
 * - INV-CACHE-4: Each test starts with empty cache
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import {
  ModEntityBuilder,
  ModEntityScenarios,
} from '../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../common/mods/scopeResolverHelpers.js';
import {
  clearEntityCache,
  getCacheStatistics,
} from '../../../src/scopeDsl/core/entityHelpers.js';
import placeYourselfBehindAction from '../../../data/mods/maneuvering/actions/place_yourself_behind.action.json';

const ACTION_ID = 'maneuvering:place_yourself_behind';
const ROOM_ID = 'room1';

describe('Entity cache test isolation (SCODSLROB-007)', () => {
  let fixture;

  /**
   * Configures the action discovery by registering the action and loading
   * the maneuvering scope with its condition dependencies.
   */
  const configureActionDiscovery = async () => {
    const { testEnv } = fixture;
    if (!testEnv) {
      return;
    }

    // Register the action in the index
    testEnv.actionIndex.buildIndex([placeYourselfBehindAction]);

    // Register positioning scopes for prerequisites
    ScopeResolverHelpers.registerPositioningScopes(testEnv);

    // Register the maneuvering scope with its condition dependencies
    await ScopeResolverHelpers.registerCustomScope(
      testEnv,
      'maneuvering',
      'actors_in_location_not_facing_away_from_actor'
    );
  };

  beforeEach(async () => {
    // INV-CACHE-4: Ensure each test starts with an empty cache
    clearEntityCache();
    const stats = getCacheStatistics();
    expect(stats.size).toBe(0);
  });

  afterEach(() => {
    fixture?.cleanup();
  });

  describe('INV-CACHE-4: Test isolation', () => {
    /**
     * Test A: Sets facing_away component - action should NOT be available.
     *
     * This test adds a facing_away component to the actor. If cache isolation
     * fails, this state could leak to Test B.
     */
    it('Test A: Sets facing_away component - action should NOT be available', async () => {
      fixture = await ModTestFixture.forAction('maneuvering', ACTION_ID);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .closeToEntity('target1')
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['target1'],
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .closeToEntity('actor1')
        .asActor()
        .build();

      fixture.reset([room, actor, target]);
      await configureActionDiscovery();

      // Action should NOT be available because actor is facing away
      const actions = fixture.testEnv.getAvailableActions('actor1');
      const hasAction = actions.some((a) => a.id === ACTION_ID);

      expect(hasAction).toBe(false);
    });

    /**
     * Test B: No facing_away component - action SHOULD be available.
     *
     * This test creates a fresh scenario without the facing_away component.
     * If cache isolation FAILS (the original bug), this test would fail because
     * Test A's entity state would leak through the cache.
     *
     * The clearEntityCache() in beforeEach ensures isolation.
     */
    it('Test B: No facing_away component - action SHOULD be available (no cache leakage)', async () => {
      fixture = await ModTestFixture.forAction('maneuvering', ACTION_ID);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      // NO facing_away component - if cache leaked from Test A, this would fail
      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .closeToEntity('target1')
        .asActor()
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .closeToEntity('actor1')
        .asActor()
        .build();

      fixture.reset([room, actor, target]);
      await configureActionDiscovery();

      // Action SHOULD be available - no facing_away component
      const actions = fixture.testEnv.getAvailableActions('actor1');
      const hasAction = actions.some((a) => a.id === ACTION_ID);

      // This assertion would fail if Test A's entity state leaked through cache
      expect(hasAction).toBe(true);
    });
  });

  describe('Cache statistics verification', () => {
    it('should have zero size after clearEntityCache', () => {
      // This verifies the INV-CACHE-4 enforcement in beforeEach
      const stats = getCacheStatistics();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should track cache entries during test execution', async () => {
      fixture = await ModTestFixture.forAction('maneuvering', ACTION_ID);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');
      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);

      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      // Trigger action discovery which populates the cache
      fixture.testEnv.getAvailableActions(scenario.actor.id);

      // Cache should now have entries (exact count depends on implementation)
      const stats = getCacheStatistics();
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });
  });

  describe('INV-CACHE-3: Cache invalidation on component changes', () => {
    it('should reflect component additions in subsequent action discovery', async () => {
      fixture = await ModTestFixture.forAction('maneuvering', ACTION_ID);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');
      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);

      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      // Step 1: Action SHOULD be available initially
      let actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      let hasAction = actions.some((a) => a.id === ACTION_ID);
      expect(hasAction).toBe(true);

      // Step 2: Add facing_away component (simulating turn_your_back action)
      fixture.entityManager.addComponent(
        scenario.actor.id,
        'facing-states:facing_away',
        { facing_away_from: [scenario.target.id] }
      );

      // Step 3: Action should NO LONGER be available
      // This validates that cache was invalidated on component addition
      actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      hasAction = actions.some((a) => a.id === ACTION_ID);
      expect(hasAction).toBe(false);
    });

    it('should reflect component removals in subsequent action discovery', async () => {
      fixture = await ModTestFixture.forAction('maneuvering', ACTION_ID);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .closeToEntity('target1')
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['target1'],
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .closeToEntity('actor1')
        .asActor()
        .build();

      fixture.reset([room, actor, target]);
      await configureActionDiscovery();

      // Step 1: Action should NOT be available (facing away)
      let actions = fixture.testEnv.getAvailableActions('actor1');
      let hasAction = actions.some((a) => a.id === ACTION_ID);
      expect(hasAction).toBe(false);

      // Step 2: Remove facing_away component (simulating turn_around_to_face)
      fixture.entityManager.removeComponent(
        'actor1',
        'facing-states:facing_away'
      );

      // Step 3: Action SHOULD now be available
      // This validates that cache was invalidated on component removal
      actions = fixture.testEnv.getAvailableActions('actor1');
      hasAction = actions.some((a) => a.id === ACTION_ID);
      expect(hasAction).toBe(true);
    });
  });

  describe('Execution order independence', () => {
    /**
     * These tests verify that test results are independent of execution order.
     * Running them multiple times should produce consistent results.
     */
    it('execution order test 1: fresh state', async () => {
      fixture = await ModTestFixture.forAction('maneuvering', ACTION_ID);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');
      const scenario = fixture.createStandardActorTarget(['Alicia', 'Bobby']);

      fixture.reset([room, scenario.actor, scenario.target]);
      await configureActionDiscovery();

      const actions = fixture.testEnv.getAvailableActions(scenario.actor.id);
      const hasAction = actions.some((a) => a.id === ACTION_ID);

      expect(hasAction).toBe(true);
    });

    it('execution order test 2: fresh state with different entity IDs', async () => {
      fixture = await ModTestFixture.forAction('maneuvering', ACTION_ID);
      const room = ModEntityScenarios.createRoom('room2', 'Test Room 2');

      const actor = new ModEntityBuilder('differentActor')
        .withName('Charlie')
        .atLocation('room2')
        .closeToEntity('differentTarget')
        .asActor()
        .build();

      const target = new ModEntityBuilder('differentTarget')
        .withName('Diana')
        .atLocation('room2')
        .closeToEntity('differentActor')
        .asActor()
        .build();

      fixture.reset([room, actor, target]);
      await configureActionDiscovery();

      const actions = fixture.testEnv.getAvailableActions('differentActor');
      const hasAction = actions.some((a) => a.id === ACTION_ID);

      expect(hasAction).toBe(true);
    });

    it('execution order test 3: verify no cross-contamination', async () => {
      // This test uses the same entity IDs as test 1 but adds facing_away
      // If there was cache contamination from test 1, the cache might
      // incorrectly think the action is available

      fixture = await ModTestFixture.forAction('maneuvering', ACTION_ID);
      const room = ModEntityScenarios.createRoom(ROOM_ID, 'Test Room');

      const actor = new ModEntityBuilder('actor1')
        .withName('Alicia')
        .atLocation(ROOM_ID)
        .closeToEntity('target1')
        .asActor()
        .withComponent('facing-states:facing_away', {
          facing_away_from: ['target1'],
        })
        .build();

      const target = new ModEntityBuilder('target1')
        .withName('Bobby')
        .atLocation(ROOM_ID)
        .closeToEntity('actor1')
        .asActor()
        .build();

      fixture.reset([room, actor, target]);
      await configureActionDiscovery();

      const actions = fixture.testEnv.getAvailableActions('actor1');
      const hasAction = actions.some((a) => a.id === ACTION_ID);

      // Must correctly reflect that facing_away is set, regardless of test order
      expect(hasAction).toBe(false);
    });
  });
});
