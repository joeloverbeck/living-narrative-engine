# GOAPIMPL-021-10: End-to-End Tests

**Parent Ticket**: GOAPIMPL-021 (GOAP Controller)
**Priority**: MEDIUM
**Estimated Effort**: 1.5 hours
**Dependencies**: GOAPIMPL-021-01 through GOAPIMPL-021-09, GOAPIMPL-022 (Action Decider Integration)

## Description

Create end-to-end tests that validate complete game scenarios with GOAP AI actors. Tests the full integration from game setup through GOAP decision-making to action execution and world state changes.

## Acceptance Criteria

- [ ] Complete game scenarios with GOAP actors
- [ ] Actor achieves complex goals over multiple turns
- [ ] Plan adaptation to dynamic world tested
- [ ] Multi-actor GOAP scenarios validated
- [ ] Integration with turn system verified
- [ ] Action execution and state changes confirmed
- [ ] All tests pass

## Files to Create

- `tests/e2e/goap/goapFullCycle.e2e.test.js`

## Test Structure

### Test Setup

```javascript
/**
 * @file End-to-end tests for GOAP system
 * Tests complete game scenarios with GOAP AI
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import GameEngine from '../../../src/engine/gameEngine.js';  // Main game engine
import { loadMods } from '../../../src/loaders/modsLoader.js';

describe('GOAP System - E2E', () => {
  let testBed;
  let gameEngine;
  let world;

  beforeEach(async () => {
    testBed = createTestBed();

    // Setup: Load game with mods
    await loadMods(['core', 'goap_test_mod']);

    // Setup: Initialize game engine with GOAP
    gameEngine = new GameEngine({
      container: testBed.container,
      config: {
        playerTypes: {
          goap: { enabled: true }
        }
      }
    });

    world = gameEngine.getWorld();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // Test suites below
});
```

## E2E Test Scenarios

### Simple Goal Achievement

```javascript
describe('Simple Goal Achievement', () => {
  it('should achieve hunger goal over multiple turns', async () => {
    // Setup: Create GOAP actor with hunger goal
    const actor = gameEngine.createEntity('test_actor', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            {
              id: 'satisfy_hunger',
              priority: 10,
              conditions: [
                { '>=': [{ var: 'actor.components.core:needs.hunger' }, 80] }
              ]
            }
          ]
        },
        'core:needs': {
          hunger: 30  // Hungry
        },
        'core:inventory': {
          items: []
        }
      }
    });

    // Setup: Create food in world
    const food = gameEngine.createEntity('food_item', {
      type: 'item',
      components: {
        'items:consumable': {
          nutrition: 60
        },
        'core:location': {
          locationId: 'test_location'
        }
      }
    });

    // Place actor in same location
    actor.components['core:location'] = { locationId: 'test_location' };

    const turnHistory = [];

    // Execute: Run game for up to 10 turns
    for (let turn = 0; turn < 10; turn++) {
      const turnResult = await gameEngine.executeTurn(actor.id);

      turnHistory.push({
        turn,
        action: turnResult.actionTaken,
        hungerBefore: actor.components['core:needs'].hunger,
        hungerAfter: null  // Will be updated
      });

      // Update state snapshot
      turnHistory[turn].hungerAfter = actor.components['core:needs'].hunger;

      // Check if goal achieved
      if (actor.components['core:needs'].hunger >= 80) {
        break;
      }
    }

    // Verify: Actor achieved goal
    expect(actor.components['core:needs'].hunger).toBeGreaterThanOrEqual(80);

    // Verify: Expected action sequence
    const actions = turnHistory.map(t => t.action?.actionId);
    expect(actions).toContain('items:pick_up_item');  // Picked up food
    expect(actions).toContain('items:consume_item');  // Ate food

    // Verify: Hunger increased
    const hungerValues = turnHistory.map(t => t.hungerAfter);
    const hungerIncreased = hungerValues.some((v, i) =>
      i > 0 && v > hungerValues[i - 1]
    );
    expect(hungerIncreased).toBe(true);
  });
});
```

### Complex Multi-Step Goal

```javascript
describe('Complex Multi-Step Goal', () => {
  it('should complete crafting goal requiring resource gathering', async () => {
    // Setup: Actor with crafting goal
    const actor = gameEngine.createEntity('craftsman_actor', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            {
              id: 'build_shelter',
              priority: 10,
              conditions: [
                { '==': [
                  { var: 'actor.components.core:inventory.items.length' },
                  1
                ] },
                { 'in': [
                  'shelter',
                  { var: 'actor.components.core:inventory.items.*.type' }
                ] }
              ]
            }
          ]
        },
        'core:inventory': { items: [] }
      }
    });

    // Setup: World with resources and crafting station
    const wood = gameEngine.createEntity('wood_resource', {
      type: 'item',
      components: {
        'items:gatherable': { resourceType: 'wood' },
        'core:location': { locationId: 'forest' }
      }
    });

    const stone = gameEngine.createEntity('stone_resource', {
      type: 'item',
      components: {
        'items:gatherable': { resourceType: 'stone' },
        'core:location': { locationId: 'quarry' }
      }
    });

    const craftingStation = gameEngine.createEntity('workbench', {
      type: 'station',
      components: {
        'crafting:workstation': { recipes: ['shelter'] },
        'core:location': { locationId: 'workshop' }
      }
    });

    actor.components['core:location'] = { locationId: 'forest' };

    const turnHistory = [];
    const MAX_TURNS = 20;

    // Execute: Run game until goal achieved or max turns
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const turnResult = await gameEngine.executeTurn(actor.id);

      turnHistory.push({
        turn,
        action: turnResult.actionTaken,
        location: actor.components['core:location'].locationId,
        inventory: [...actor.components['core:inventory'].items]
      });

      // Check goal achievement
      const hasShelter = actor.components['core:inventory'].items.some(
        item => item.type === 'shelter'
      );
      if (hasShelter) {
        break;
      }
    }

    // Verify: Actor achieved goal
    const hasShelter = actor.components['core:inventory'].items.some(
      item => item.type === 'shelter'
    );
    expect(hasShelter).toBe(true);

    // Verify: Logical action sequence
    const actions = turnHistory.map(t => t.action?.actionId);

    // Should include movement, gathering, and crafting
    expect(actions).toContain('movement:move_to_location');
    expect(actions).toContain('items:pick_up_item');
    expect(actions).toContain('crafting:craft_item');

    // Verify: Actor visited required locations
    const locations = turnHistory.map(t => t.location);
    expect(locations).toContain('forest');     // Gathered wood
    expect(locations).toContain('quarry');     // Gathered stone
    expect(locations).toContain('workshop');   // Crafted shelter
  });
});
```

### Dynamic World Adaptation

```javascript
describe('Dynamic World Adaptation', () => {
  it('should adapt plan when target becomes unavailable', async () => {
    // Setup: Actor targeting specific item
    const actor = gameEngine.createEntity('adaptive_actor', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            {
              id: 'acquire_tool',
              priority: 10,
              conditions: [
                { '>': [
                  { var: 'actor.components.core:inventory.items.length' },
                  0
                ] }
              ]
            }
          ]
        },
        'core:inventory': { items: [] },
        'core:location': { locationId: 'town' }
      }
    });

    // Setup: Create multiple tools
    const tool1 = gameEngine.createEntity('tool_1', {
      type: 'item',
      components: {
        'items:tool': { type: 'hammer' },
        'core:location': { locationId: 'town' }
      }
    });

    const tool2 = gameEngine.createEntity('tool_2', {
      type: 'item',
      components: {
        'items:tool': { type: 'saw' },
        'core:location': { locationId: 'town' }
      }
    });

    let replanDetected = false;

    // Execute: First turn - create plan
    await gameEngine.executeTurn(actor.id);

    // World change: Remove tool1
    gameEngine.destroyEntity('tool_1');

    // Listen for replanning event
    gameEngine.eventBus.subscribe('GOAP_PLAN_INVALIDATED', () => {
      replanDetected = true;
    });

    // Execute: Second turn - should detect invalidation and replan
    const result = await gameEngine.executeTurn(actor.id);

    // Verify: Replanning occurred
    expect(replanDetected).toBe(true);

    // Continue until goal achieved
    for (let turn = 0; turn < 10; turn++) {
      await gameEngine.executeTurn(actor.id);

      if (actor.components['core:inventory'].items.length > 0) {
        break;
      }
    }

    // Verify: Actor still achieved goal with alternative tool
    expect(actor.components['core:inventory'].items.length).toBeGreaterThan(0);
    expect(actor.components['core:inventory'].items[0].id).toBe('tool_2');
  });

  it('should replan when world state changes mid-execution', async () => {
    // Setup: Actor with resource gathering goal
    const actor = gameEngine.createEntity('gatherer', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            {
              id: 'gather_resources',
              priority: 10,
              conditions: []
            }
          ]
        },
        'core:location': { locationId: 'start' }
      }
    });

    // Setup: Create resource at distant location
    const resource = gameEngine.createEntity('resource', {
      type: 'item',
      components: {
        'core:location': { locationId: 'distant_location' }
      }
    });

    // Execute: Start moving toward resource
    await gameEngine.executeTurn(actor.id);
    await gameEngine.executeTurn(actor.id);

    // World change: Move resource closer
    resource.components['core:location'].locationId = 'nearby_location';

    // Execute: Continue turns
    const turnsBefore = 2;
    let turnsAfter = 0;

    for (let turn = 0; turn < 10; turn++) {
      await gameEngine.executeTurn(actor.id);
      turnsAfter++;

      // Check if actor has resource
      const hasResource = actor.components['core:inventory']?.items.some(
        item => item.id === 'resource'
      );

      if (hasResource) {
        break;
      }
    }

    // Verify: Actor adapted and found resource
    const hasResource = actor.components['core:inventory']?.items.some(
      item => item.id === 'resource'
    );
    expect(hasResource).toBe(true);

    // Verify: Completed faster due to replanning
    expect(turnsAfter).toBeLessThan(8);  // Would take longer to distant location
  });
});
```

### Multi-Actor Scenarios

```javascript
describe('Multi-Actor GOAP', () => {
  it('should handle multiple GOAP actors with independent goals', async () => {
    // Setup: Create two GOAP actors with different goals
    const actor1 = gameEngine.createEntity('actor_1', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            { id: 'goal_1', priority: 10, conditions: [] }
          ]
        }
      }
    });

    const actor2 = gameEngine.createEntity('actor_2', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            { id: 'goal_2', priority: 10, conditions: [] }
          ]
        }
      }
    });

    const actor1Actions = [];
    const actor2Actions = [];

    // Execute: Alternate turns between actors
    for (let turn = 0; turn < 10; turn++) {
      const result1 = await gameEngine.executeTurn('actor_1');
      actor1Actions.push(result1.actionTaken?.actionId);

      const result2 = await gameEngine.executeTurn('actor_2');
      actor2Actions.push(result2.actionTaken?.actionId);
    }

    // Verify: Both actors made independent decisions
    const actor1Acted = actor1Actions.some(a => a !== undefined);
    const actor2Acted = actor2Actions.some(a => a !== undefined);

    expect(actor1Acted).toBe(true);
    expect(actor2Acted).toBe(true);

    // Verify: Actions are different (independent planning)
    expect(actor1Actions).not.toEqual(actor2Actions);
  });

  it('should handle resource competition between GOAP actors', async () => {
    // Setup: Two actors competing for same resource
    const actor1 = gameEngine.createEntity('competitor_1', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            { id: 'acquire_rare_item', priority: 10, conditions: [] }
          ]
        },
        'core:location': { locationId: 'location_a' }
      }
    });

    const actor2 = gameEngine.createEntity('competitor_2', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            { id: 'acquire_rare_item', priority: 10, conditions: [] }
          ]
        },
        'core:location': { locationId: 'location_b' }
      }
    });

    // Only one rare item available
    const rareItem = gameEngine.createEntity('rare_item', {
      type: 'item',
      components: {
        'core:location': { locationId: 'center' }
      }
    });

    // Execute: Both actors compete
    let winner = null;

    for (let turn = 0; turn < 20; turn++) {
      await gameEngine.executeTurn('competitor_1');

      const actor1HasItem = actor1.components['core:inventory']?.items.some(
        item => item.id === 'rare_item'
      );

      if (actor1HasItem) {
        winner = 'competitor_1';
        break;
      }

      await gameEngine.executeTurn('competitor_2');

      const actor2HasItem = actor2.components['core:inventory']?.items.some(
        item => item.id === 'rare_item'
      );

      if (actor2HasItem) {
        winner = 'competitor_2';
        break;
      }
    }

    // Verify: One actor succeeded
    expect(winner).not.toBeNull();

    // Verify: Other actor adapted (replanned or gave up)
    const loser = winner === 'competitor_1' ? actor2 : actor1;
    // Loser should have detected plan invalidation
    // (Verify via event log or behavior)
  });
});
```

### Integration with Turn System

```javascript
describe('Turn System Integration', () => {
  it('should integrate with standard turn execution pipeline', async () => {
    const actor = gameEngine.createEntity('turn_test_actor', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            { id: 'test_goal', priority: 10, conditions: [] }
          ]
        }
      }
    });

    // Execute: Standard turn
    const turnResult = await gameEngine.executeTurn(actor.id);

    // Verify: Turn result structure
    expect(turnResult).toMatchObject({
      actorId: actor.id,
      actionTaken: expect.objectContaining({
        actionId: expect.any(String)
      }),
      worldChanges: expect.any(Array)
    });

    // Verify: Action went through prerequisite checks
    expect(turnResult.prerequisitesPassed).toBe(true);

    // Verify: System rules applied
    expect(turnResult.rulesApplied).toBeGreaterThan(0);
  });

  it('should respect turn system action validation', async () => {
    // Setup: Actor with goal requiring unavailable action
    const actor = gameEngine.createEntity('validation_test_actor', {
      type: 'actor',
      playerType: 'goap',
      components: {
        'core:goals': {
          goals: [
            { id: 'impossible_action_goal', priority: 10, conditions: [] }
          ]
        }
      }
    });

    // Execute: Turn should fail prerequisites and idle
    const turnResult = await gameEngine.executeTurn(actor.id);

    // Verify: Either idled or action failed prerequisites
    expect(
      turnResult.actionTaken === null ||
      turnResult.prerequisitesPassed === false
    ).toBe(true);

    // Verify: Plan should invalidate next turn
    const result2 = await gameEngine.executeTurn(actor.id);
    // Replanning should occur
  });
});
```

## Test Data Setup

### GOAP Test Mod Structure

Create `data/mods/goap_test_mod/` with:
- Actions for testing (gather, craft, consume, move)
- Tasks for testing (simple and complex)
- Refinement templates
- Test goals and prerequisites

### Event Logging Helper

```javascript
class EventLogger {
  constructor(eventBus) {
    this.events = [];
    this.subscriptions = [];

    const goapEvents = [
      'GOAP_PLANNING_STARTED',
      'GOAP_PLANNING_COMPLETED',
      'GOAP_PLAN_INVALIDATED',
      'GOAP_GOAL_ACHIEVED'
    ];

    goapEvents.forEach(eventType => {
      const sub = eventBus.subscribe(eventType, (event) => {
        this.events.push(event);
      });
      this.subscriptions.push(sub);
    });
  }

  getEvents() {
    return this.events;
  }

  cleanup() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
```

## Success Validation

✅ **Done when**:
- Complete game scenarios execute successfully
- Actors achieve complex goals over multiple turns
- Dynamic world adaptation works correctly
- Multi-actor scenarios pass
- Turn system integration verified
- Action execution and state changes confirmed
- All E2E tests pass
- Tests demonstrate real game value of GOAP system

## Related Tickets

- **Previous**: GOAPIMPL-021-09 (Integration Tests)
- **Implements**: GOAPIMPL-021 (Parent - GOAP Controller)
- **Depends On**: GOAPIMPL-022 (Action Decider Integration)
- **Validates**: Complete GOAP system implementation
