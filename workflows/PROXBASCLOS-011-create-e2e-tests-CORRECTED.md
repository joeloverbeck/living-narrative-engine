# PROXBASCLOS-011: End-to-End Testing Strategy for Proximity Scenarios (CORRECTED)

**Phase**: Testing Layer  
**Priority**: Low (Reassessed)  
**Complexity**: High (Due to infrastructure requirements)  
**Dependencies**: PROXBASCLOS-010 (integration tests completed)  
**Estimated Time**: 2-3 hours (for meaningful additions without Playwright)

## Critical Assessment: E2E Testing Viability

### Current Testing Reality

The codebase currently has:
1. **Comprehensive Integration Tests** that already cover:
   - Complete proximity workflows (`tests/integration/positioning/sittingProximityWorkflow.integration.test.js`)
   - Mixed manual/automatic closeness (`tests/integration/positioning/mixedClosenessScenarios.integration.test.js`)
   - Edge cases and capacity limits (`tests/integration/positioning/furnitureCapacityAndProximity.integration.test.js`)
   - Multi-seat scenarios (`tests/integration/positioning/furnitureSittingMultiSeat.integration.test.js`)
   - Movement locks and anatomical entities

2. **jsdom-based E2E Tests** that simulate complete workflows without real browsers:
   - Action execution pipelines
   - Multi-target scenarios
   - Cross-system integration
   - State persistence

### Why Playwright E2E Tests Are Not Viable

1. **No Browser Automation Infrastructure**:
   - Playwright is not installed (would require adding dependency)
   - No server infrastructure exists (app uses static file serving)
   - No UI automation attributes (no data-testid elements)
   - Would require extensive UI refactoring

2. **Complex Test Data Requirements**:
   - Need complete mod files with positioning components
   - Need furniture entities with sitting spots
   - Need multiple actors in same location
   - Need complex state setup that's already handled by integration tests

3. **Limited Additional Value**:
   - Integration tests already validate the operation handlers
   - Integration tests already test complete workflows
   - UI rendering is minimal (text-based game)
   - No visual elements that require browser validation

## Recommended Approach: Enhanced Integration Tests

Instead of creating Playwright E2E tests, enhance the existing test coverage with focused integration tests that fill any gaps.

### Option 1: jsdom-based E2E Tests (Recommended)

Create E2E tests using the existing jsdom infrastructure that simulate user interactions without requiring Playwright.

#### Files to Create

##### 1. `tests/e2e/positioning/proximityUserJourneys.e2e.test.js`
```javascript
/**
 * @file End-to-end tests for proximity-based closeness user journeys
 * Uses jsdom to simulate complete user workflows without Playwright
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import { createTestBed } from '../../common/testBed.js';

describe('Proximity-Based Closeness User Journeys E2E', () => {
  let facades;
  let entityTestBed;
  let testBed;
  let actionExecutor;
  let entityManager;

  beforeEach(async () => {
    // Use existing test infrastructure
    testBed = createTestBed();
    facades = createMockFacades({}, jest.fn);
    entityTestBed = new EntityManagerTestBed();
    
    // Setup complete game engine simulation
    actionExecutor = facades.actionService;
    entityManager = facades.entityService;
  });

  afterEach(() => {
    entityTestBed.cleanup();
    testBed.cleanup();
  });

  it('should handle complete Alice-Bob sitting workflow', async () => {
    // Create furniture and actors using existing test utilities
    await entityTestBed.createEntity('furniture', {
      instanceId: 'furniture:couch',
      overrides: {
        'positioning:allows_sitting': { spots: [null, null, null, null, null] },
        'core:display_name': { value: 'Living Room Couch' }
      }
    });

    await entityTestBed.createEntity('actor', {
      instanceId: 'game:alice',
      overrides: {
        'core:display_name': { value: 'Alice' },
        'core:position': { locationId: 'test:room' }
      }
    });

    await entityTestBed.createEntity('actor', {
      instanceId: 'game:bob',
      overrides: {
        'core:display_name': { value: 'Bob' },
        'core:position': { locationId: 'test:room' }
      }
    });

    // Simulate sit_down action for Alice
    const aliceSitResult = await actionExecutor.executeAction({
      actionId: 'positioning:sit_down',
      actorId: 'game:alice',
      targets: { furniture: 'furniture:couch', spot: 0 }
    });

    expect(aliceSitResult.success).toBe(true);

    // Simulate sit_down action for Bob (adjacent)
    const bobSitResult = await actionExecutor.executeAction({
      actionId: 'positioning:sit_down',
      actorId: 'game:bob',
      targets: { furniture: 'furniture:couch', spot: 1 }
    });

    expect(bobSitResult.success).toBe(true);

    // Verify closeness established
    const aliceState = await entityManager.getEntityState('game:alice');
    const bobState = await entityManager.getEntityState('game:bob');

    expect(aliceState.components['positioning:closeness']).toBeDefined();
    expect(aliceState.components['positioning:closeness'].partners).toContain('game:bob');
    expect(bobState.components['positioning:closeness'].partners).toContain('game:alice');

    // Simulate get_up action for Alice
    const aliceStandResult = await actionExecutor.executeAction({
      actionId: 'positioning:get_up_from_furniture',
      actorId: 'game:alice'
    });

    expect(aliceStandResult.success).toBe(true);

    // Verify closeness removed
    const aliceFinalState = await entityManager.getEntityState('game:alice');
    const bobFinalState = await entityManager.getEntityState('game:bob');

    expect(aliceFinalState.components['positioning:closeness']).toBeUndefined();
    expect(bobFinalState.components['positioning:closeness']).toBeUndefined();
  });
});
```

##### 2. `tests/e2e/positioning/complexProximityScenarios.e2e.test.js`
```javascript
/**
 * @file Complex proximity scenario E2E tests
 * Tests advanced multi-actor scenarios and edge cases
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createFullGameEngine } from '../../common/engine/gameEngineFactory.js';

describe('Complex Proximity Scenarios E2E', () => {
  let gameEngine;
  let ruleExecutor;

  beforeEach(async () => {
    // Create a more complete game engine simulation if available
    gameEngine = await createFullGameEngine({
      mods: ['positioning'],
      testMode: true
    });
    
    ruleExecutor = gameEngine.getRuleExecutor();
  });

  afterEach(() => {
    gameEngine.cleanup();
  });

  it('should handle middle position bridging scenario', async () => {
    // Test the scenario where Bob sits between Alicia and Zelda
    // This would use the actual rule execution system
  });

  it('should preserve manual closeness through sitting workflows', async () => {
    // Test mixed manual and automatic closeness preservation
  });
});
```

### Option 2: Enhance Existing Integration Tests (Most Practical)

Since integration tests already cover the core functionality, add any missing scenarios:

#### Gaps to Fill

1. **Long-duration state consistency** - Already partially covered but could be enhanced
2. **Error recovery scenarios** - Add more failure cases
3. **Performance under load** - Add stress tests

#### Example Enhancement

```javascript
// Add to existing tests/integration/positioning/sittingProximityWorkflow.integration.test.js

describe('Additional Edge Cases', () => {
  it('should handle rapid sit/stand cycles without state corruption', async () => {
    // Rapid state changes to test race conditions
  });

  it('should maintain consistency with 50+ actors', async () => {
    // Stress test with many entities
  });
});
```

### Option 3: UI Component Testing (Limited Value)

If UI testing is specifically needed, use @testing-library/dom (already installed):

```javascript
// tests/e2e/domUI/proximityUIRendering.e2e.test.js
import { screen, fireEvent } from '@testing-library/dom';

describe('Proximity UI Rendering', () => {
  it('should display closeness indicators in UI', () => {
    // Test that UI elements update when closeness changes
  });
});
```

## Revised Implementation Checklist

### If Pursuing jsdom E2E Tests
- [ ] Create user journey tests using existing test infrastructure
- [ ] Leverage EntityManagerTestBed for entity creation
- [ ] Use facade pattern for action execution
- [ ] Focus on workflows not covered by integration tests

### If Enhancing Integration Tests (Recommended)
- [ ] Review integration test coverage for gaps
- [ ] Add stress tests for performance validation
- [ ] Add error recovery scenarios
- [ ] Add rapid state change tests

### If Playwright is Absolutely Required (Not Recommended)
- [ ] Install Playwright as dev dependency
- [ ] Create server wrapper for static files
- [ ] Add data-testid attributes throughout UI
- [ ] Create page object models
- [ ] Implement test data factories
- [ ] Build extensive setup/teardown infrastructure

## Definition of Done (Revised)

### For jsdom E2E Tests
- [ ] User journey tests created using existing infrastructure
- [ ] Tests focus on gaps not covered by integration tests
- [ ] All tests pass consistently in CI/CD
- [ ] No duplicate coverage with integration tests

### For Enhanced Integration Tests
- [ ] Identified and filled coverage gaps
- [ ] Added stress/performance tests
- [ ] All tests maintain 80%+ branch coverage
- [ ] Tests run efficiently (<60s total)

## Recommendation

**DO NOT implement Playwright E2E tests** for this feature because:

1. **Integration tests already provide 90% of the value** - The existing integration tests thoroughly test the proximity system including complete workflows, edge cases, and error scenarios.

2. **Infrastructure cost is too high** - Would require:
   - Installing Playwright
   - Building server infrastructure
   - Adding UI automation attributes
   - Creating complex test data setup
   - Maintaining browser automation

3. **Limited additional value** - The proximity system is primarily logic-based, not UI-based. The integration tests already validate all the business logic thoroughly.

4. **User's concern is valid** - Setting up realistic test scenarios with mods, furniture, and multiple actors would be extremely complex for minimal benefit.

**INSTEAD**: Focus on filling any remaining gaps in the integration test suite, which already provides excellent coverage of the proximity-based closeness system.

## Evidence of Existing Coverage

The following integration tests already exist and provide comprehensive coverage:

1. **Basic Workflows**: `sittingProximityWorkflow.integration.test.js`
   - Alice-Bob adjacency scenarios
   - Standing up and closeness removal
   - Chain reactions with multiple actors

2. **Complex Scenarios**: `mixedClosenessScenarios.integration.test.js`
   - Manual vs automatic closeness
   - Preservation of manual relationships
   - Multi-type closeness interactions

3. **Edge Cases**: `furnitureCapacityAndProximity.integration.test.js`
   - Single-spot furniture
   - Full furniture handling
   - Maximum capacity scenarios

4. **Multi-Seat**: `furnitureSittingMultiSeat.integration.test.js`
   - Park bench scenarios
   - Multiple furniture items
   - Complex seating arrangements

These tests already validate the complete proximity system without needing browser automation.