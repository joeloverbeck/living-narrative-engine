# TURORDTIC-016: Create Comprehensive Integration Test Suite

## Status
Ready for Implementation

## Priority
High - Validates component interactions

## Dependencies
- TURORDTIC-015 (unit tests establish baseline)

## Description
Create a comprehensive integration test suite that validates the ticker renderer's interaction with the game engine, event system, and other UI components. Test complete workflows from round start to completion.

## Affected Files
- `tests/integration/domUI/turnOrderTicker.integration.test.js` (consolidate and expand)
- `tests/integration/domUI/tickerRoundTransitions.integration.test.js` (optional)
- `tests/integration/domUI/tickerParticipation.integration.test.js` (optional)

## Test Scenarios

### 1. Complete Round Workflow
```javascript
describe('Turn Order Ticker - Complete Round Workflow', () => {
  it('should display complete turn order lifecycle', async () => {
    // Setup environment
    const { eventBus, entityManager, tickerRenderer } = await setupIntegrationEnvironment();

    // Create actors
    const actors = await Promise.all([
      entityManager.createEntity('actor-1', ['core:actor', 'core:name']),
      entityManager.createEntity('actor-2', ['core:actor', 'core:name']),
      entityManager.createEntity('actor-3', ['core:actor', 'core:name']),
    ]);

    // Start round
    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2', 'actor-3'],
      strategy: 'round-robin',
    });

    // Verify initial render
    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.children.length).toBe(3);

    // Actor 1 turn starts
    eventBus.dispatch('core:turn_started', { entityId: 'actor-1', entityType: 'actor' });
    expect(queueElement.querySelector('[data-entity-id="actor-1"]').classList.contains('current')).toBe(true);

    // Actor 1 turn ends
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-1' });

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(queueElement.children.length).toBe(2);
    expect(queueElement.querySelector('[data-entity-id="actor-1"]')).toBeNull();

    // Actor 2 turn starts
    eventBus.dispatch('core:turn_started', { entityId: 'actor-2', entityType: 'actor' });
    expect(queueElement.querySelector('[data-entity-id="actor-2"]').classList.contains('current')).toBe(true);

    // Complete remaining turns
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-2' });
    await new Promise(resolve => setTimeout(resolve, 500));

    eventBus.dispatch('core:turn_started', { entityId: 'actor-3', entityType: 'actor' });
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-3' });
    await new Promise(resolve => setTimeout(resolve, 500));

    // All actors should be removed
    expect(queueElement.children.length).toBe(0);
  });
});
```

### 2. Multiple Round Transitions
```javascript
describe('Turn Order Ticker - Multiple Rounds', () => {
  it('should handle sequential rounds correctly', async () => {
    const { eventBus, entityManager } = await setupIntegrationEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor']);
    await entityManager.createEntity('actor-2', ['core:actor']);

    // Round 1
    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    const roundElement = document.querySelector('#ticker-round-number');
    expect(roundElement.textContent).toBe('ROUND 1');

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.children.length).toBe(2);

    // Complete round 1
    eventBus.dispatch('core:turn_started', { entityId: 'actor-1', entityType: 'actor' });
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-1' });
    eventBus.dispatch('core:turn_started', { entityId: 'actor-2', entityType: 'actor' });
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-2' });

    await new Promise(resolve => setTimeout(resolve, 600));

    // Round 2
    eventBus.dispatch('core:round_started', {
      roundNumber: 2,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    expect(roundElement.textContent).toBe('ROUND 2');
    expect(queueElement.children.length).toBe(2);
  });
});
```

### 3. Participation Toggling During Round
```javascript
describe('Turn Order Ticker - Participation During Round', () => {
  it('should update visual state when participation changes mid-round', async () => {
    const { eventBus, entityManager } = await setupIntegrationEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor', 'core:participation']);
    await entityManager.createEntity('actor-2', ['core:actor', 'core:participation']);

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    const actor2Element = queueElement.querySelector('[data-entity-id="actor-2"]');

    // Disable actor-2 mid-round
    eventBus.dispatch('core:component_updated', {
      entityId: 'actor-2',
      componentId: 'core:participation',
      data: { participating: false },
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    expect(actor2Element.getAttribute('data-participating')).toBe('false');
  });

  it('should handle rapid participation toggling', async () => {
    const { eventBus, entityManager } = await setupIntegrationEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor', 'core:participation']);

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1'],
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    const actor1Element = queueElement.querySelector('[data-entity-id="actor-1"]');

    // Rapid toggle
    for (let i = 0; i < 5; i++) {
      eventBus.dispatch('core:component_updated', {
        entityId: 'actor-1',
        componentId: 'core:participation',
        data: { participating: i % 2 === 0 },
      });
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should settle on participating: false (last value)
    expect(actor1Element.getAttribute('data-participating')).toBe('false');
  });
});
```

### 4. Portrait Loading and Fallback
```javascript
describe('Turn Order Ticker - Portrait Handling', () => {
  it('should render actors with portraits correctly', async () => {
    const { eventBus, entityManager, entityDisplayDataProvider } = await setupIntegrationEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor', 'core:name', 'core:portrait']);

    entityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Alice',
      portraitPath: '/portraits/alice.jpg',
    });

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1'],
      strategy: 'round-robin',
    });

    const actorElement = document.querySelector('[data-entity-id="actor-1"]');
    const portraitImg = actorElement.querySelector('.ticker-actor-portrait');

    expect(portraitImg).toBeTruthy();
    expect(portraitImg.src).toContain('alice.jpg');
    expect(portraitImg.alt).toBe('Alice');
  });

  it('should fallback to name badge when portrait missing', async () => {
    const { eventBus, entityManager, entityDisplayDataProvider } = await setupIntegrationEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor', 'core:name']);

    entityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Bob',
    });

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1'],
      strategy: 'round-robin',
    });

    const actorElement = document.querySelector('[data-entity-id="actor-1"]');
    const nameBadge = actorElement.querySelector('.ticker-actor-name-badge');

    expect(nameBadge).toBeTruthy();
    expect(nameBadge.textContent).toBe('Bob');
  });

  it('should handle portrait load failure', async () => {
    const { eventBus, entityManager, entityDisplayDataProvider } = await setupIntegrationEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor', 'core:name', 'core:portrait']);

    entityDisplayDataProvider.getDisplayData.mockReturnValue({
      name: 'Charlie',
      portraitPath: '/invalid/path.jpg',
    });

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1'],
      strategy: 'round-robin',
    });

    const actorElement = document.querySelector('[data-entity-id="actor-1"]');
    const portraitImg = actorElement.querySelector('.ticker-actor-portrait');

    // Trigger image error
    if (portraitImg) {
      portraitImg.dispatchEvent(new Event('error'));
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    // Should have switched to name badge
    expect(actorElement.querySelector('.ticker-actor-portrait')).toBeFalsy();
    expect(actorElement.querySelector('.ticker-actor-name-badge')).toBeTruthy();
  });
});
```

### 5. Edge Cases and Error Scenarios
```javascript
describe('Turn Order Ticker - Edge Cases', () => {
  it('should handle empty actor list', async () => {
    const { eventBus } = await setupIntegrationEnvironment();

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: [],
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.children.length).toBe(1);
    expect(queueElement.firstChild.textContent).toBe('No participating actors');
  });

  it('should handle single actor', async () => {
    const { eventBus, entityManager } = await setupIntegrationEnvironment();

    await entityManager.createEntity('solo', ['core:actor']);

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['solo'],
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.children.length).toBe(1);
    expect(queueElement.querySelector('[data-entity-id="solo"]')).toBeTruthy();
  });

  it('should handle many actors (overflow)', async () => {
    const { eventBus, entityManager } = await setupIntegrationEnvironment();

    // Create 15 actors
    const actorIds = [];
    for (let i = 1; i <= 15; i++) {
      await entityManager.createEntity(`actor-${i}`, ['core:actor']);
      actorIds.push(`actor-${i}`);
    }

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: actorIds,
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.children.length).toBe(15);

    // Check for horizontal scroll
    const hasOverflow = queueElement.scrollWidth > queueElement.clientWidth;
    expect(hasOverflow).toBe(true);
  });

  it('should handle actor removal before round starts', async () => {
    const { eventBus, entityManager } = await setupIntegrationEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor']);

    // Start round
    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1'],
      strategy: 'round-robin',
    });

    // Immediately try to end turn for non-existent actor
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-999' });

    // Should not crash
    await new Promise(resolve => setTimeout(resolve, 100));

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.children.length).toBe(1); // actor-1 still present
  });
});
```

## Test Environment Setup

Create helper for integration test setup:

**File:** `tests/integration/common/turnOrderTickerTestSetup.js`

```javascript
/**
 * Setup integration test environment for turn order ticker.
 */
export async function setupIntegrationEnvironment() {
  // Setup DOM
  document.body.innerHTML = `
    <div id="turn-order-ticker" role="region" aria-label="Turn order">
      <div class="ticker-round-label">
        <span id="ticker-round-number">ROUND 0</span>
      </div>
      <div id="ticker-actor-queue" class="ticker-actor-queue"></div>
    </div>
  `;

  // Create DI container and services
  const container = createTestContainer();

  const eventBus = container.resolve(tokens.IValidatedEventDispatcher);
  const entityManager = container.resolve(tokens.IEntityManager);
  const entityDisplayDataProvider = container.resolve(tokens.IEntityDisplayDataProvider);
  const tickerRenderer = container.resolve(tokens.ITurnOrderTickerRenderer);

  return {
    container,
    eventBus,
    entityManager,
    entityDisplayDataProvider,
    tickerRenderer,
  };
}
```

## Testing Commands

```bash
# Run all integration tests
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --verbose

# Run specific workflow
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --testNamePattern="Complete Round Workflow" --verbose

# Run with coverage
NODE_ENV=test npm run test:integration -- tests/integration/domUI/ --coverage

# Silent mode (for CI)
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --silent
```

## Acceptance Criteria
- [ ] Complete round workflow tested
- [ ] Multiple round transitions tested
- [ ] Participation toggling tested (mid-round and rapid)
- [ ] Portrait loading and fallback tested
- [ ] Edge cases tested (empty, single, many actors)
- [ ] Error scenarios tested (invalid IDs, missing elements)
- [ ] Animation timing tested (with appropriate waits)
- [ ] Event integration tested (all event types)
- [ ] Actor removal tested (sequential and parallel)
- [ ] All tests passing
- [ ] No flaky tests
- [ ] Tests run in reasonable time (< 30 seconds total)

## Performance Testing

Consider adding performance assertions:

```javascript
it('should render 20 actors in under 100ms', async () => {
  const { eventBus, entityManager } = await setupIntegrationEnvironment();

  const actorIds = [];
  for (let i = 1; i <= 20; i++) {
    await entityManager.createEntity(`actor-${i}`, ['core:actor']);
    actorIds.push(`actor-${i}`);
  }

  const startTime = performance.now();

  eventBus.dispatch('core:round_started', {
    roundNumber: 1,
    actors: actorIds,
    strategy: 'round-robin',
  });

  const elapsed = performance.now() - startTime;

  expect(elapsed).toBeLessThan(100);
});
```

## Notes
- Integration tests may be slower than unit tests (animations, async operations)
- Use `setTimeout` waits for animations (not ideal but necessary for testing)
- Consider adding visual regression testing for future enhancement
- Test environment should closely match production setup

## Next Ticket
TURORDTIC-017: Accessibility and Polish
