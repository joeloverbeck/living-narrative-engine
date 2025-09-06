# PROXBASCLOS-011: Create End-to-End Tests for Proximity Scenarios

**Phase**: Testing Layer  
**Priority**: Medium  
**Complexity**: Medium  
**Dependencies**: PROXBASCLOS-010 (integration tests completed)  
**Estimated Time**: 6-8 hours

## Summary

Create end-to-end tests that validate the proximity-based closeness system from a user perspective, testing complete user journeys and realistic gameplay scenarios. These tests ensure the system works correctly in real-world usage patterns.

## Technical Requirements

### Files to Create

#### 1. `tests/e2e/positioning/proximityBasedCloseness.e2e.test.js`
- User-focused scenario testing with complete game state
- Multi-session workflow validation
- Real browser-based interaction simulation
- Performance validation in realistic conditions

#### 2. `tests/e2e/positioning/complexProximityScenarios.e2e.test.js`
- Advanced multi-actor scenarios
- Long-running gameplay sessions
- Error recovery and edge case handling
- Cross-system integration validation

### E2E Test Architecture

#### Test Environment
- **Full Game Engine**: Complete game engine with all systems loaded
- **Real Browser**: Actual DOM manipulation and rendering
- **Complete Mod Loading**: Full mod system with positioning components
- **State Persistence**: Test state persistence across actions
- **Event Simulation**: Realistic user input simulation

#### Test Scope
- **User Actions**: Click-based sit/stand actions
- **Visual Feedback**: UI updates and visual state changes
- **State Consistency**: Game state consistency across all systems
- **Performance**: Real-world performance under user interaction

## ProximityBasedCloseness E2E Tests

### Test Structure and Setup

#### E2E Test Environment Configuration
```javascript
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import { chromium } from 'playwright';
import { startGameServer } from '../../../common/gameServerSetup.js';
import { createE2ETestMod } from '../../../common/e2eModFactory.js';

describe('Proximity-Based Closeness E2E Tests', () => {
  let browser;
  let context;
  let page;
  let gameServer;

  beforeAll(async () => {
    // Start game server with proximity closeness features
    gameServer = await startGameServer({
      port: 3001,
      testMode: true,
      enableProximityCloseness: true
    });

    // Start browser
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext();
  });

  afterAll(async () => {
    await browser.close();
    await gameServer.shutdown();
  });

  beforeEach(async () => {
    page = await context.newPage();
    await page.goto('http://localhost:3001');
    
    // Wait for game to load
    await page.waitForSelector('[data-testid="game-loaded"]');
    
    // Load test scenario
    await page.evaluate(() => {
      window.gameEngine.loadMod(createE2ETestMod());
    });
  });

  afterEach(async () => {
    await page.close();
  });
});
```

### Basic User Journey Tests

#### Alice-Bob Sitting Scenario
```javascript
describe('Basic User Journeys', () => {
  it('should demonstrate Alice-Bob proximity workflow from user perspective', async () => {
    // Phase 1: Setup - Create furniture and actors in game world
    await page.evaluate(() => {
      // Create large couch entity
      window.gameEngine.createEntity('furniture:living_room_couch', {
        'positioning:allows_sitting': {
          spots: [null, null, null, null, null]
        },
        'core:display_name': { value: 'Large Living Room Couch' },
        'ui:renderable': { 
          element: 'furniture',
          x: 400,
          y: 300
        }
      });

      // Create Alice
      window.gameEngine.createEntity('game:alice', {
        'core:display_name': { value: 'Alice' },
        'ui:renderable': {
          element: 'actor', 
          x: 300,
          y: 200
        }
      });

      // Create Bob
      window.gameEngine.createEntity('game:bob', {
        'core:display_name': { value: 'Bob' },
        'ui:renderable': {
          element: 'actor',
          x: 500, 
          y: 200
        }
      });
    });

    // Phase 2: User Action - Alice sits down
    await page.click('[data-entity-id="game:alice"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="sit_down"]');
    await page.click('[data-entity-id="furniture:living_room_couch"]');

    // Wait for action to complete
    await page.waitForSelector('[data-testid="action-completed"]', { timeout: 5000 });

    // Verify Alice's UI state updated
    const aliceElement = await page.$('[data-entity-id="game:alice"]');
    const alicePosition = await aliceElement.getAttribute('data-position');
    expect(alicePosition).toBe('sitting');

    // Verify furniture occupancy in UI
    const couchElement = await page.$('[data-entity-id="furniture:living_room_couch"]');
    const occupancy = await couchElement.getAttribute('data-occupancy');
    expect(occupancy).toContain('game:alice');

    // Phase 3: User Action - Bob sits down next to Alice
    await page.click('[data-entity-id="game:bob"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="sit_down"]');
    await page.click('[data-entity-id="furniture:living_room_couch"]');

    await page.waitForSelector('[data-testid="action-completed"]');

    // Phase 4: Verify proximity closeness in UI
    const aliceClosenessUI = await page.$('[data-entity-id="game:alice"] [data-component="closeness"]');
    const bobClosenessUI = await page.$('[data-entity-id="game:bob"] [data-component="closeness"]');

    expect(aliceClosenessUI).toBeTruthy();
    expect(bobClosenessUI).toBeTruthy();

    // Verify closeness partners displayed
    const alicePartners = await aliceClosenessUI.getAttribute('data-partners');
    const bobPartners = await bobClosenessUI.getAttribute('data-partners');

    expect(alicePartners).toContain('game:bob');
    expect(bobPartners).toContain('game:alice');

    // Phase 5: Verify movement restriction UI indicators
    const aliceMovementIcon = await page.$('[data-entity-id="game:alice"] [data-component="movement-locked"]');
    const bobMovementIcon = await page.$('[data-entity-id="game:bob"] [data-component="movement-locked"]');

    expect(aliceMovementIcon).toBeTruthy();
    expect(bobMovementIcon).toBeTruthy();

    // Phase 6: User Action - Alice stands up
    await page.click('[data-entity-id="game:alice"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="get_up_from_furniture"]');

    await page.waitForSelector('[data-testid="action-completed"]');

    // Phase 7: Verify closeness removed in UI
    const aliceClosenessAfter = await page.$('[data-entity-id="game:alice"] [data-component="closeness"]');
    const bobClosenessAfter = await page.$('[data-entity-id="game:bob"] [data-component="closeness"]');

    expect(aliceClosenessAfter).toBeNull();
    expect(bobClosenessAfter).toBeNull();

    // Verify movement icons removed
    const aliceMovementAfter = await page.$('[data-entity-id="game:alice"] [data-component="movement-locked"]');
    const bobMovementAfter = await page.$('[data-entity-id="game:bob"] [data-component="movement-locked"]');

    expect(aliceMovementAfter).toBeNull();
    expect(bobMovementAfter).toBeNull();
  });
});
```

#### Middle Position Scenario
```javascript
describe('Complex Positioning Scenarios', () => {
  it('should demonstrate middle position bridging from user perspective', async () => {
    // Setup three-spot bench with Alicia and Zelda on ends
    await page.evaluate(() => {
      window.gameEngine.createEntity('furniture:park_bench', {
        'positioning:allows_sitting': {
          spots: ['game:alicia', null, 'game:zelda']
        },
        'core:display_name': { value: 'Park Bench' },
        'ui:renderable': { element: 'furniture', x: 400, y: 300 }
      });

      // Pre-position Alicia and Zelda as already sitting
      window.gameEngine.createEntity('game:alicia', {
        'positioning:sitting_on': {
          furniture_id: 'furniture:park_bench',
          spot_index: 0
        },
        'core:display_name': { value: 'Alicia' },
        'ui:renderable': { element: 'actor', x: 350, y: 300 }
      });

      window.gameEngine.createEntity('game:zelda', {
        'positioning:sitting_on': {
          furniture_id: 'furniture:park_bench', 
          spot_index: 2
        },
        'core:display_name': { value: 'Zelda' },
        'ui:renderable': { element: 'actor', x: 450, y: 300 }
      });

      window.gameEngine.createEntity('game:bob', {
        'core:display_name': { value: 'Bob' },
        'ui:renderable': { element: 'actor', x: 400, y: 200 }
      });
    });

    // Verify initial state: Alicia and Zelda not close (non-adjacent)
    const initialAliciaCloseness = await page.$('[data-entity-id="game:alicia"] [data-component="closeness"]');
    const initialZeldaCloseness = await page.$('[data-entity-id="game:zelda"] [data-component="closeness"]');

    expect(initialAliciaCloseness).toBeNull();
    expect(initialZeldaCloseness).toBeNull();

    // Bob sits in middle position
    await page.click('[data-entity-id="game:bob"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="sit_down"]');
    await page.click('[data-entity-id="furniture:park_bench"]');

    await page.waitForSelector('[data-testid="action-completed"]');

    // Verify Bob is close to both Alicia and Zelda
    const bobCloseness = await page.$('[data-entity-id="game:bob"] [data-component="closeness"]');
    const bobPartners = await bobCloseness.getAttribute('data-partners');

    expect(bobPartners).toContain('game:alicia');
    expect(bobPartners).toContain('game:zelda');

    // Verify Alicia is close to Bob only
    const aliciaCloseness = await page.$('[data-entity-id="game:alicia"] [data-component="closeness"]');
    const aliciaPartners = await aliciaCloseness.getAttribute('data-partners');
    expect(aliciaPartners).toBe('game:bob');

    // Verify Zelda is close to Bob only
    const zeldaCloseness = await page.$('[data-entity-id="game:zelda"] [data-component="closeness"]');
    const zeldaPartners = await zeldaCloseness.getAttribute('data-partners');
    expect(zeldaPartners).toBe('game:bob');

    // Verify Alicia and Zelda are still not directly close
    expect(aliciaPartners).not.toContain('game:zelda');
    expect(zeldaPartners).not.toContain('game:alicia');
  });
});
```

### Mixed Manual and Automatic Closeness E2E

#### Preserving Manual Relationships
```javascript
describe('Mixed Manual and Automatic Closeness', () => {
  it('should preserve manual closeness through sitting workflows', async () => {
    // Phase 1: Setup actors
    await page.evaluate(() => {
      window.gameEngine.createEntity('game:alice', {
        'core:display_name': { value: 'Alice' },
        'ui:renderable': { element: 'actor', x: 200, y: 200 }
      });

      window.gameEngine.createEntity('game:bob', {
        'core:display_name': { value: 'Bob' },
        'ui:renderable': { element: 'actor', x: 300, y: 200 }
      });

      window.gameEngine.createEntity('game:charlie', {
        'core:display_name': { value: 'Charlie' },
        'ui:renderable': { element: 'actor', x: 400, y: 200 }
      });

      window.gameEngine.createEntity('furniture:couch', {
        'positioning:allows_sitting': { spots: [null, null, null] },
        'core:display_name': { value: 'Couch' },
        'ui:renderable': { element: 'furniture', x: 300, y: 300 }
      });
    });

    // Phase 2: Alice and Charlie establish manual closeness
    await page.click('[data-entity-id="game:alice"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="get_close"]');
    await page.click('[data-entity-id="game:charlie"]');

    await page.waitForSelector('[data-testid="action-completed"]');

    // Verify manual closeness in UI
    const aliceManualCloseness = await page.$('[data-entity-id="game:alice"] [data-component="closeness"]');
    const aliceManualPartners = await aliceManualCloseness.getAttribute('data-partners');
    expect(aliceManualPartners).toContain('game:charlie');

    // Phase 3: Alice and Bob sit adjacent (automatic closeness)
    await page.click('[data-entity-id="game:alice"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="sit_down"]');
    await page.click('[data-entity-id="furniture:couch"]');
    await page.waitForSelector('[data-testid="action-completed"]');

    await page.click('[data-entity-id="game:bob"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="sit_down"]');
    await page.click('[data-entity-id="furniture:couch"]');
    await page.waitForSelector('[data-testid="action-completed"]');

    // Verify Alice now has both manual and automatic closeness
    const aliceMixedCloseness = await page.$('[data-entity-id="game:alice"] [data-component="closeness"]');
    const aliceMixedPartners = await aliceMixedCloseness.getAttribute('data-partners');
    
    expect(aliceMixedPartners).toContain('game:charlie'); // Manual
    expect(aliceMixedPartners).toContain('game:bob'); // Automatic

    // Phase 4: Alice stands up (should preserve manual, remove automatic)
    await page.click('[data-entity-id="game:alice"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="get_up_from_furniture"]');
    await page.waitForSelector('[data-testid="action-completed"]');

    // Verify Alice retains manual closeness only
    const aliceFinalCloseness = await page.$('[data-entity-id="game:alice"] [data-component="closeness"]');
    const aliceFinalPartners = await aliceFinalCloseness.getAttribute('data-partners');
    
    expect(aliceFinalPartners).toContain('game:charlie'); // Manual preserved
    expect(aliceFinalPartners).not.toContain('game:bob'); // Automatic removed

    // Verify Bob has no closeness
    const bobFinalCloseness = await page.$('[data-entity-id="game:bob"] [data-component="closeness"]');
    expect(bobFinalCloseness).toBeNull();

    // Verify Charlie still has manual closeness with Alice
    const charlieFinalCloseness = await page.$('[data-entity-id="game:charlie"] [data-component="closeness"]');
    const charlieFinalPartners = await charlieFinalCloseness.getAttribute('data-partners');
    expect(charlieFinalPartners).toBe('game:alice');
  });
});
```

## ComplexProximityScenarios E2E Tests

### Long-Running Session Tests

#### Multi-Hour Gameplay Simulation
```javascript
describe('Long-Running Gameplay Sessions', () => {
  it('should maintain proximity relationships across extended gameplay', async () => {
    // Setup large social scenario
    await page.evaluate(() => {
      // Create multiple furniture pieces
      const furniture = [
        { id: 'furniture:couch_1', spots: 5 },
        { id: 'furniture:couch_2', spots: 5 },
        { id: 'furniture:dining_table', spots: 8 }
      ];

      furniture.forEach(item => {
        window.gameEngine.createEntity(item.id, {
          'positioning:allows_sitting': {
            spots: new Array(item.spots).fill(null)
          },
          'core:display_name': { value: item.id },
          'ui:renderable': { element: 'furniture' }
        });
      });

      // Create 10 actors
      for (let i = 0; i < 10; i++) {
        window.gameEngine.createEntity(`game:actor_${i}`, {
          'core:display_name': { value: `Actor ${i}` },
          'ui:renderable': { element: 'actor' }
        });
      }
    });

    // Simulate 30 minutes of gameplay with random sitting/standing
    const startTime = Date.now();
    const testDuration = 3 * 60 * 1000; // 3 minutes for test (represents 30 min gameplay)

    while (Date.now() - startTime < testDuration) {
      // Random actor takes random action
      const actorIndex = Math.floor(Math.random() * 10);
      const actorId = `game:actor_${actorIndex}`;

      const isCurrentlySitting = await page.evaluate((id) => {
        return window.gameEngine.entityManager.hasComponent(id, 'positioning:sitting_on');
      }, actorId);

      if (isCurrentlySitting && Math.random() > 0.5) {
        // Stand up
        await page.click(`[data-entity-id="${actorId}"]`);
        await page.waitForSelector('[data-testid="action-menu"]');
        await page.click('[data-action="get_up_from_furniture"]');
        
        try {
          await page.waitForSelector('[data-testid="action-completed"]', { timeout: 2000 });
        } catch (e) {
          // Action may have failed, continue
        }
      } else if (!isCurrentlySitting) {
        // Sit down on random furniture
        const furnitureIds = ['furniture:couch_1', 'furniture:couch_2', 'furniture:dining_table'];
        const randomFurniture = furnitureIds[Math.floor(Math.random() * furnitureIds.length)];

        await page.click(`[data-entity-id="${actorId}"]`);
        await page.waitForSelector('[data-testid="action-menu"]');
        await page.click('[data-action="sit_down"]');
        await page.click(`[data-entity-id="${randomFurniture}"]`);
        
        try {
          await page.waitForSelector('[data-testid="action-completed"]', { timeout: 2000 });
        } catch (e) {
          // Action may have failed (furniture full), continue
        }
      }

      // Wait briefly between actions
      await page.waitForTimeout(100);
    }

    // Verify system integrity after extended session
    const finalState = await page.evaluate(() => {
      const actors = [];
      for (let i = 0; i < 10; i++) {
        const actorId = `game:actor_${i}`;
        const sitting = window.gameEngine.entityManager.getComponent(actorId, 'positioning:sitting_on');
        const closeness = window.gameEngine.entityManager.getComponent(actorId, 'positioning:closeness');
        
        actors.push({
          id: actorId,
          sitting: sitting !== null,
          closenessPartners: closeness ? closeness.partners.length : 0
        });
      }
      return actors;
    });

    // Verify no actor has impossible state
    finalState.forEach(actor => {
      if (actor.sitting) {
        // Sitting actors should have 0-2 closeness partners (adjacent spots)
        expect(actor.closenessPartners).toBeLessThanOrEqual(2);
      }
    });

    // Verify UI consistency
    const uiElements = await page.$$('[data-entity-id^="game:actor_"]');
    expect(uiElements).toHaveLength(10);

    // All actors should still be rendered and responsive
    for (const element of uiElements) {
      const isVisible = await element.isVisible();
      expect(isVisible).toBe(true);
    }
  });
});
```

### Error Recovery Testing

#### Network Failure Recovery
```javascript
describe('Error Recovery and Edge Cases', () => {
  it('should recover gracefully from action failures', async () => {
    // Setup scenario prone to failures
    await page.evaluate(() => {
      // Create single-spot chair
      window.gameEngine.createEntity('furniture:chair', {
        'positioning:allows_sitting': { spots: [null] },
        'core:display_name': { value: 'Chair' },
        'ui:renderable': { element: 'furniture' }
      });

      // Create two actors
      window.gameEngine.createEntity('game:alice', {
        'core:display_name': { value: 'Alice' },
        'ui:renderable': { element: 'actor' }
      });

      window.gameEngine.createEntity('game:bob', {
        'core:display_name': { value: 'Bob' },
        'ui:renderable': { element: 'actor' }
      });
    });

    // Alice sits on chair
    await page.click('[data-entity-id="game:alice"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="sit_down"]');
    await page.click('[data-entity-id="furniture:chair"]');
    await page.waitForSelector('[data-testid="action-completed"]');

    // Verify Alice is sitting
    const aliceSitting = await page.evaluate(() => {
      return window.gameEngine.entityManager.hasComponent('game:alice', 'positioning:sitting_on');
    });
    expect(aliceSitting).toBe(true);

    // Bob tries to sit on occupied chair (should fail gracefully)
    await page.click('[data-entity-id="game:bob"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    await page.click('[data-action="sit_down"]');
    await page.click('[data-entity-id="furniture:chair"]');

    // Should see failure notification, not action-completed
    await page.waitForSelector('[data-testid="action-failed"]');

    // Verify Bob is not sitting
    const bobSitting = await page.evaluate(() => {
      return window.gameEngine.entityManager.hasComponent('game:bob', 'positioning:sitting_on');
    });
    expect(bobSitting).toBe(false);

    // Verify Alice's state unchanged
    const aliceStillSitting = await page.evaluate(() => {
      return window.gameEngine.entityManager.hasComponent('game:alice', 'positioning:sitting_on');
    });
    expect(aliceStillSitting).toBe(true);

    // Verify chair occupancy unchanged
    const chairState = await page.evaluate(() => {
      return window.gameEngine.entityManager.getComponent('furniture:chair', 'positioning:allows_sitting');
    });
    expect(chairState.spots[0]).toBe('game:alice');

    // Verify UI reflects correct state
    const chairElement = await page.$('[data-entity-id="furniture:chair"]');
    const chairOccupancy = await chairElement.getAttribute('data-occupancy');
    expect(chairOccupancy).toBe('game:alice');

    // Bob should still be able to perform other actions
    await page.click('[data-entity-id="game:bob"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    
    const actionMenu = await page.$('[data-testid="action-menu"]');
    expect(actionMenu).toBeTruthy();
  });
});
```

## Performance and Load Testing

### UI Responsiveness Under Load
```javascript
describe('Performance and Load Testing', () => {
  it('should maintain UI responsiveness with maximum actors and furniture', async () => {
    // Create stress test scenario
    await page.evaluate(() => {
      // Create 5 pieces of max-capacity furniture (50 spots total)
      for (let i = 0; i < 5; i++) {
        window.gameEngine.createEntity(`furniture:bench_${i}`, {
          'positioning:allows_sitting': {
            spots: new Array(10).fill(null)
          },
          'core:display_name': { value: `Bench ${i}` },
          'ui:renderable': { element: 'furniture', x: i * 100, y: 300 }
        });
      }

      // Create 50 actors
      for (let i = 0; i < 50; i++) {
        window.gameEngine.createEntity(`game:actor_${i}`, {
          'core:display_name': { value: `Actor ${i}` },
          'ui:renderable': { element: 'actor', x: (i % 10) * 50, y: Math.floor(i / 10) * 50 }
        });
      }
    });

    // Measure UI render time
    const renderStart = performance.now();
    await page.waitForSelector('[data-entity-id="game:actor_49"]');
    const renderTime = performance.now() - renderStart;

    expect(renderTime).toBeLessThan(5000); // Should render in <5 seconds

    // Test interaction responsiveness
    const interactionStart = performance.now();
    await page.click('[data-entity-id="game:actor_0"]');
    await page.waitForSelector('[data-testid="action-menu"]');
    const interactionTime = performance.now() - interactionStart;

    expect(interactionTime).toBeLessThan(1000); // Should respond in <1 second

    // Test action execution performance with full system
    const actionStart = performance.now();
    await page.click('[data-action="sit_down"]');
    await page.click('[data-entity-id="furniture:bench_0"]');
    await page.waitForSelector('[data-testid="action-completed"]');
    const actionTime = performance.now() - actionStart;

    expect(actionTime).toBeLessThan(3000); // Should complete in <3 seconds

    // Verify system stability
    const finalActorCount = await page.$$eval('[data-entity-id^="game:actor_"]', els => els.length);
    expect(finalActorCount).toBe(50);

    const finalFurnitureCount = await page.$$eval('[data-entity-id^="furniture:bench_"]', els => els.length);
    expect(finalFurnitureCount).toBe(5);
  });
});
```

## Test Utilities and Helpers

### E2E Test Mod Factory
```javascript
// tests/common/e2eModFactory.js
export function createE2ETestMod() {
  return {
    id: 'e2e_proximity_test',
    version: '1.0.0',
    name: 'E2E Proximity Test Mod',
    dependencies: ['positioning'],
    components: [
      'positioning:allows_sitting',
      'positioning:sitting_on', 
      'positioning:closeness',
      'positioning:movement_locked',
      'core:display_name',
      'ui:renderable'
    ],
    actions: [
      'sit_down',
      'get_up_from_furniture',
      'get_close',
      'step_back'
    ],
    rules: [
      'handle_sit_down',
      'handle_get_up_from_furniture',
      'handle_get_close',
      'handle_step_back'
    ]
  };
}
```

### Game Server Setup for E2E
```javascript
// tests/common/gameServerSetup.js
import { createServer } from '../../src/server.js';

export async function startGameServer(options = {}) {
  const server = createServer({
    port: options.port || 3000,
    testMode: true,
    cors: true,
    staticFiles: '../../dist',
    ...options
  });

  await server.start();

  return {
    async shutdown() {
      await server.stop();
    }
  };
}
```

## Implementation Checklist

### Phase 1: E2E Test Environment Setup
- [ ] Create game server setup utilities
- [ ] Configure Playwright browser automation
- [ ] Implement E2E test mod factory
- [ ] Set up UI element selectors and page object patterns

### Phase 2: Basic User Journey Tests
- [ ] Implement Alice-Bob proximity workflow test
- [ ] Implement middle position bridging scenario
- [ ] Implement standing up and closeness removal test
- [ ] Implement UI state validation throughout workflows

### Phase 3: Complex Scenario Tests
- [ ] Implement mixed manual/automatic closeness preservation
- [ ] Implement long-running session simulation
- [ ] Implement error recovery and failure handling
- [ ] Implement cross-system integration validation

### Phase 4: Performance and Load Tests
- [ ] Implement UI responsiveness under load testing
- [ ] Implement maximum capacity stress testing
- [ ] Implement action execution performance validation
- [ ] Implement system stability verification

## Definition of Done
- [ ] All E2E test files created with comprehensive user journey coverage
- [ ] Browser automation working correctly with game UI
- [ ] Complete user workflows validated from click to final state
- [ ] Mixed closeness scenarios tested in realistic conditions
- [ ] Error recovery and edge cases validated in browser environment
- [ ] Performance benchmarks met under realistic load conditions
- [ ] Long-running session stability verified
- [ ] Test utilities created and reusable for other E2E tests
- [ ] All tests pass consistently in CI/CD with headless browser
- [ ] Documentation covers E2E test scenarios and setup requirements