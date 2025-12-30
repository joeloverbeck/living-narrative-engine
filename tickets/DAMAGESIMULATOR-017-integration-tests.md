# DAMAGESIMULATOR-017: Create Integration Tests

## Summary
Create comprehensive integration tests for the Damage Simulator tool, covering workflow scenarios, component interactions, and accuracy validation of analytics calculations.

## Dependencies
- All previous DAMAGESIMULATOR tickets (001-016) must be completed
- All unit tests must be passing

## Files to Touch

### Create
- `tests/integration/damage-simulator/damageSimulatorWorkflow.integration.test.js` - Workflow tests
- `tests/integration/damage-simulator/analyticsAccuracy.integration.test.js` - Analytics validation
- `tests/integration/damage-simulator/multiHitSimulation.integration.test.js` - Multi-hit tests
- `tests/common/damage-simulator/damageSimulatorTestFixtures.js` - Shared test fixtures

### Modify
- None (test files only)

### Reference (Read Only)
- All source files created in DAMAGESIMULATOR-001 through DAMAGESIMULATOR-016
- `tests/common/testBed.js` - Existing test utilities

## Out of Scope
- DO NOT modify source code based on test failures (create bug tickets instead)
- DO NOT create unit tests (those are covered in individual tickets)
- DO NOT create E2E tests (separate ticket DAMAGESIMULATOR-018)
- DO NOT modify existing test infrastructure

## Acceptance Criteria

### Workflow Integration Tests
1. Complete entity loading workflow
2. Damage configuration → execution → display refresh flow
3. History tracking across multiple damage applications
4. Entity change clearing state correctly
5. Error recovery scenarios

### Analytics Accuracy Tests
1. Hits-to-destroy calculations within 10% of manual calculation
2. Hit probability distributions match weight utilities
3. Death condition monitoring accuracy
4. Effect threshold calculations

### Multi-Hit Simulation Tests
1. Correct number of hits executed
2. Target mode behavior verification
3. Stop functionality responsiveness
4. Summary statistics accuracy
5. Concurrent simulation prevention

### Tests That Must Pass
1. **Integration: damageSimulatorWorkflow.integration.test.js**
   - `should load entity and display anatomy correctly`
   - `should configure damage and apply to entity`
   - `should refresh display after damage application`
   - `should record damage in history`
   - `should clear state on entity change`
   - `should handle weapon preset loading`
   - `should update analytics when config changes`
   - `should handle execution errors gracefully`

2. **Integration: analyticsAccuracy.integration.test.js**
   - `should calculate hits-to-destroy within 10% accuracy`
   - `should match hit probability to weight utilities`
   - `should correctly identify death conditions`
   - `should update analytics in real-time`
   - `should handle edge cases (0 damage, max health)`
   - `should calculate aggregate statistics correctly`

3. **Integration: multiHitSimulation.integration.test.js**
   - `should execute correct number of hits`
   - `should respect delay configuration`
   - `should use random targeting correctly`
   - `should use round-robin targeting correctly`
   - `should focus on single part when configured`
   - `should stop immediately when requested`
   - `should prevent concurrent simulations`
   - `should generate accurate summary statistics`
   - `should record all hits in history`

4. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. Tests use real services (not mocks) where possible
2. Tests verify actual DOM output where relevant
3. Tests clean up all created resources
4. Tests are deterministic (no flaky tests)

## Implementation Notes

### Test Fixtures
```javascript
// tests/common/damage-simulator/damageSimulatorTestFixtures.js

export function createDamageSimulatorTestContext() {
  return {
    container: null,
    services: {},
    cleanup: () => {}
  };
}

export const SAMPLE_DAMAGE_ENTRY = {
  name: 'slashing',
  amount: 15,
  penetration: 0.3
};

export const SAMPLE_ENTITY_DEF = 'test_humanoid';

export async function setupDamageSimulator() {
  // Set up full DI container with real services
  // Return initialized DamageSimulatorUI
}

export function createMockAnatomyData() {
  return {
    parts: [
      { id: 'torso', name: 'Torso', health: { current: 100, max: 100 } },
      { id: 'head', name: 'Head', health: { current: 50, max: 50 } },
      { id: 'left_arm', name: 'Left Arm', health: { current: 30, max: 30 } }
    ]
  };
}
```

### Workflow Test Structure
```javascript
// tests/integration/damage-simulator/damageSimulatorWorkflow.integration.test.js

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { setupDamageSimulator, SAMPLE_DAMAGE_ENTRY } from '../../common/damage-simulator/damageSimulatorTestFixtures.js';

describe('Damage Simulator Workflow', () => {
  let context;

  beforeEach(async () => {
    context = await setupDamageSimulator();
  });

  afterEach(() => {
    context.cleanup();
  });

  describe('Entity Loading', () => {
    it('should load entity and display anatomy correctly', async () => {
      // Arrange
      const entityDefId = 'test_humanoid';

      // Act
      await context.ui.loadEntity(entityDefId);

      // Assert
      expect(context.container.querySelector('.ds-anatomy-tree')).toBeTruthy();
      expect(context.container.querySelectorAll('.ds-part-card').length).toBeGreaterThan(0);
    });
  });

  describe('Damage Application Flow', () => {
    it('should configure damage and apply to entity', async () => {
      // Arrange
      await context.ui.loadEntity('test_humanoid');
      context.services.composer.setConfiguration(SAMPLE_DAMAGE_ENTRY);

      // Act
      const result = await context.services.execution.applyDamage({
        entityId: context.currentEntityId,
        damageEntry: SAMPLE_DAMAGE_ENTRY
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should refresh display after damage application', async () => {
      // Arrange
      await context.ui.loadEntity('test_humanoid');
      const initialHealth = getDisplayedHealth(context.container, 'torso');

      // Act
      await context.services.execution.applyDamage({
        entityId: context.currentEntityId,
        damageEntry: SAMPLE_DAMAGE_ENTRY,
        targetPartId: 'torso'
      });

      // Assert
      const updatedHealth = getDisplayedHealth(context.container, 'torso');
      expect(updatedHealth).toBeLessThan(initialHealth);
    });
  });
});
```

### Analytics Accuracy Test Structure
```javascript
// tests/integration/damage-simulator/analyticsAccuracy.integration.test.js

describe('Analytics Accuracy', () => {
  it('should calculate hits-to-destroy within 10% accuracy', async () => {
    // Arrange
    await context.ui.loadEntity('test_humanoid');
    const damageEntry = { name: 'slashing', amount: 10, penetration: 0 };
    context.services.composer.setConfiguration(damageEntry);

    // Act
    const analytics = context.services.analyticsPanel.getAnalytics();
    const torsoPart = analytics.parts.find(p => p.partId === 'torso');

    // Assert - Manual calculation: 100 HP / 10 damage = 10 hits
    const expectedHits = 10;
    const actualHits = torsoPart.hitsToDestroy;
    const accuracy = Math.abs(actualHits - expectedHits) / expectedHits;

    expect(accuracy).toBeLessThanOrEqual(0.1); // Within 10%
  });

  it('should match hit probability to weight utilities', async () => {
    // Arrange
    await context.ui.loadEntity('test_humanoid');

    // Act
    const probabilities = context.services.hitCalculator.calculateProbabilities(
      context.anatomyData.parts
    );

    // Assert
    const totalProbability = probabilities.reduce((sum, p) => sum + p.probability, 0);
    expect(totalProbability).toBeCloseTo(100, 1); // 100% ± 0.1%
  });
});
```

### Multi-Hit Simulation Test Structure
```javascript
// tests/integration/damage-simulator/multiHitSimulation.integration.test.js

describe('Multi-Hit Simulation', () => {
  it('should execute correct number of hits', async () => {
    // Arrange
    await context.ui.loadEntity('test_humanoid');
    context.services.simulator.configure({
      hitCount: 5,
      delayMs: 0,
      targetMode: 'random',
      damageEntry: SAMPLE_DAMAGE_ENTRY,
      multiplier: 1
    });

    // Act
    const result = await context.services.simulator.run();

    // Assert
    expect(result.hitsExecuted).toBe(5);
    expect(result.completed).toBe(true);
  });

  it('should stop immediately when requested', async () => {
    // Arrange
    await context.ui.loadEntity('test_humanoid');
    context.services.simulator.configure({
      hitCount: 100,
      delayMs: 50,
      targetMode: 'random',
      damageEntry: SAMPLE_DAMAGE_ENTRY,
      multiplier: 1
    });

    // Act
    const runPromise = context.services.simulator.run();
    await delay(100); // Let a few hits execute
    context.services.simulator.stop();
    const result = await runPromise;

    // Assert
    expect(result.completed).toBe(false);
    expect(result.stoppedReason).toBe('user_stopped');
    expect(result.hitsExecuted).toBeLessThan(100);
  });

  it('should prevent concurrent simulations', async () => {
    // Arrange
    await context.ui.loadEntity('test_humanoid');
    context.services.simulator.configure({
      hitCount: 10,
      delayMs: 100,
      targetMode: 'random',
      damageEntry: SAMPLE_DAMAGE_ENTRY,
      multiplier: 1
    });

    // Act & Assert
    context.services.simulator.run(); // Start first
    await expect(context.services.simulator.run()).rejects.toThrow('already running');
  });
});
```

### Test Utilities
```javascript
function getDisplayedHealth(container, partId) {
  const partCard = container.querySelector(`[data-part-id="${partId}"]`);
  const healthText = partCard.querySelector('.ds-health-text').textContent;
  const [current] = healthText.split('/').map(Number);
  return current;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Definition of Done
- [ ] All integration test files created
- [ ] Test fixtures documented and reusable
- [ ] Workflow tests cover full entity → damage → display flow
- [ ] Analytics accuracy tests validate calculations
- [ ] Multi-hit simulation tests cover all modes
- [ ] All tests pass consistently (no flaky tests)
- [ ] Tests clean up resources properly
- [ ] `npm run test:integration` includes new tests
- [ ] Tests complete in reasonable time (<60s total)
- [ ] ESLint passes on all test files
