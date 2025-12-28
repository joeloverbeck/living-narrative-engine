# OXYBARPHYCONPAN-005: Integration Tests for Oxygen Bar Display

## Summary

Create integration tests to verify the oxygen bar displays correctly in the Physical Condition panel when actors have respiratory organs, and updates appropriately after oxygen depletion and restoration operations.

## Prerequisites

- **OXYBARPHYCONPAN-001** must be completed (OxygenAggregationService exists)
- **OXYBARPHYCONPAN-002** must be completed (Service is registered)
- **OXYBARPHYCONPAN-003** must be completed (CSS styles exist)
- **OXYBARPHYCONPAN-004** must be completed (Panel renders oxygen bar)

## File List

### Files to Create

- `tests/integration/domUI/oxygenBarDisplay.integration.test.js` - Integration tests

### Files to Read (Reference Only - DO NOT MODIFY)

- `src/domUI/injuryStatusPanel.js` - Panel implementation
- `src/anatomy/services/oxygenAggregationService.js` - Service implementation
- `src/logic/operationHandlers/depleteOxygenHandler.js` - Depletion operation
- `src/logic/operationHandlers/restoreOxygenHandler.js` - Restoration operation
- `data/mods/breathing-states/components/respiratory_organ.component.json` - Component schema
- `specs/oxygen-bar-physical-condition-panel.md` - Specification reference

## Out of Scope

- **DO NOT** modify any source files
- **DO NOT** modify existing tests
- **DO NOT** create new mocks that duplicate existing patterns (use testBed helpers)
- **DO NOT** test CSS rendering/styles (that's visual testing)
- **DO NOT** test handler internals (those have their own tests)

## Implementation Details

### Test Setup

Use existing helpers rather than a non-existent `setupDomEnvironment` API:

- `SimpleEntityManager` from `tests/common/entities/simpleEntityManager.js` for entity/component setup
- `createEventBus` from `tests/common/mockFactories/eventBus.js` as the `validatedEventDispatcher`
- `DocumentContext` to bind DOM queries to the JSDOM document

```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createEventBus } from '../../common/mockFactories/eventBus.js';
import DocumentContext from '../../../src/domUI/documentContext.js';

describe('Oxygen Bar Display - Integration', () => {
  let entityManager;
  let eventBus;
  let documentContext;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="injury-status-widget">
        <div id="injury-status-content">
          <div id="injury-narrative"></div>
        </div>
      </div>
    `;

    entityManager = new SimpleEntityManager();
    eventBus = createEventBus();
    documentContext = new DocumentContext(document);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });
});
```

Notes:
- `TURN_STARTED_ID` in production event definitions expects `entityId`; avoid the integration test bed's test schema (actorId/turnNumber/timestamp) by dispatching on the mock event bus used as `validatedEventDispatcher`.

### Test Entity Setup

Create test entities with respiratory organs:

```javascript
const createActorWithLungs = async (actorId, oxygenLevel = 20) => {
  const leftLungId = `${actorId}-left-lung`;
  const rightLungId = `${actorId}-right-lung`;

  // Create actor entity
  entityManager.createEntity(actorId);
  await entityManager.addComponent(actorId, 'anatomy:body', {
    parts: [leftLungId, rightLungId]
  });

  // Create left lung with respiratory organ
  entityManager.createEntity(leftLungId);
  await entityManager.addComponent(leftLungId, 'anatomy:part', {
    ownerEntityId: actorId,
    subType: 'lung',
    orientation: 'left'
  });
  await entityManager.addComponent(leftLungId, 'breathing-states:respiratory_organ', {
    respirationType: 'pulmonary',
    oxygenCapacity: 10,
    currentOxygen: Math.min(10, oxygenLevel / 2),
    depletionRate: 1,
    restorationRate: 10
  });

  // Create right lung with respiratory organ
  entityManager.createEntity(rightLungId);
  await entityManager.addComponent(rightLungId, 'anatomy:part', {
    ownerEntityId: actorId,
    subType: 'lung',
    orientation: 'right'
  });
  await entityManager.addComponent(rightLungId, 'breathing-states:respiratory_organ', {
    respirationType: 'pulmonary',
    oxygenCapacity: 10,
    currentOxygen: Math.min(10, oxygenLevel / 2),
    depletionRate: 1,
    restorationRate: 10
  });
};

const createActorWithoutLungs = async (actorId) => {
  entityManager.createEntity(actorId);
  await entityManager.addComponent(actorId, 'anatomy:body', {
    parts: [`${actorId}-torso`]  // No respiratory organs
  });

  const torsoId = `${actorId}-torso`;
  entityManager.createEntity(torsoId);
  await entityManager.addComponent(torsoId, 'anatomy:part', {
    ownerEntityId: actorId,
    subType: 'torso'
  });
};
```

### Test Cases

#### T-3.1: Event Integration Tests

```javascript
describe('Event Integration', () => {
  it('should update oxygen bar on TURN_STARTED event', async () => {
    // Setup
    await createActorWithLungs('actor-001', 20);
    const panel = new InjuryStatusPanel(/* dependencies */);

    // Act - dispatch TURN_STARTED
    await eventBus.dispatch(TURN_STARTED_ID, { entityId: 'actor-001' });

    // Assert
    const oxygenWrapper = document.querySelector('#oxygen-bar-wrapper');
    expect(oxygenWrapper).not.toBeNull();
    expect(oxygenWrapper.querySelector('.oxygen-percentage-text').textContent).toBe('100%');
  });

  it('should reflect current component state after depletion', async () => {
    // Setup
    await createActorWithLungs('actor-001', 20);
    const panel = new InjuryStatusPanel(/* dependencies */);

    // Deplete oxygen
    await depleteHandler.execute(
      { entityId: 'actor-001', amount: 5 },
      executionContext
    );

    // Re-trigger update
    await eventBus.dispatch(TURN_STARTED_ID, { entityId: 'actor-001' });

    // Assert
    const oxygenWrapper = document.querySelector('#oxygen-bar-wrapper');
    expect(oxygenWrapper.querySelector('.oxygen-percentage-text').textContent).toBe('50%');
  });

  it('should reflect current component state after restoration', async () => {
    // Setup - start at 50%
    await createActorWithLungs('actor-001', 10);
    const panel = new InjuryStatusPanel(/* dependencies */);

    // Restore oxygen
    await restoreHandler.execute(
      { entityId: 'actor-001', restoreFull: true },
      executionContext
    );

    // Re-trigger update
    await eventBus.dispatch(TURN_STARTED_ID, { entityId: 'actor-001' });

    // Assert
    const oxygenWrapper = document.querySelector('#oxygen-bar-wrapper');
    expect(oxygenWrapper.querySelector('.oxygen-percentage-text').textContent).toBe('100%');
  });
});
```

#### T-3.2: Handler Integration Tests

```javascript
describe('Handler Integration', () => {
  it('should show reduced percentage after DEPLETE_OXYGEN execution', async () => {
    await createActorWithLungs('actor-001', 20);
    const handler = new DepleteOxygenHandler(/* dependencies */);

    await handler.execute(
      { entityId: 'actor-001', amount: 5 },
      executionContext
    );

    const summary = oxygenAggregationService.aggregateOxygen('actor-001');

    expect(summary.percentage).toBe(50); // (10/20) * 100 = 50%
  });

  it('should show increased percentage after RESTORE_OXYGEN execution', async () => {
    await createActorWithLungs('actor-001', 10); // Start at 50%
    const handler = new RestoreOxygenHandler(/* dependencies */);

    await handler.execute(
      { entityId: 'actor-001', amount: 10 },
      executionContext
    );

    const summary = oxygenAggregationService.aggregateOxygen('actor-001');

    expect(summary.percentage).toBe(100); // Clamped to max
  });

  it('should show 100% after restoreFull: true execution', async () => {
    await createActorWithLungs('actor-001', 0); // Start at 0%
    const handler = new RestoreOxygenHandler(/* dependencies */);

    await handler.execute(
      { entityId: 'actor-001', restoreFull: true },
      executionContext
    );

    const summary = oxygenAggregationService.aggregateOxygen('actor-001');

    expect(summary.percentage).toBe(100);
  });
});
```

#### T-3.3: Multi-Organ Scenarios

```javascript
describe('Multi-Organ Scenarios', () => {
  it('should show combined percentage for human with two lungs', async () => {
    await createActorWithLungs('actor-001', 20); // 10 + 10 capacity, 10 + 10 current
    const summary = oxygenAggregationService.aggregateOxygen('actor-001');

    expect(summary.percentage).toBe(100);
    expect(summary.organCount).toBe(2);
    expect(summary.totalOxygenCapacity).toBe(20);
  });

  it('should handle asymmetric damage (one lung at 50%, one at 100%)', async () => {
    const actorId = 'actor-001';
    const leftLungId = `${actorId}-left-lung`;
    const rightLungId = `${actorId}-right-lung`;

    entityManager.createEntity(actorId);

    // Left lung at 50%
    entityManager.createEntity(leftLungId);
    await entityManager.addComponent(leftLungId, 'anatomy:part', {
      ownerEntityId: actorId
    });
    await entityManager.addComponent(leftLungId, 'breathing-states:respiratory_organ', {
      respirationType: 'pulmonary',
      oxygenCapacity: 10,
      currentOxygen: 5  // 50%
    });

    // Right lung at 100%
    entityManager.createEntity(rightLungId);
    await entityManager.addComponent(rightLungId, 'anatomy:part', {
      ownerEntityId: actorId
    });
    await entityManager.addComponent(rightLungId, 'breathing-states:respiratory_organ', {
      respirationType: 'pulmonary',
      oxygenCapacity: 10,
      currentOxygen: 10  // 100%
    });

    const summary = oxygenAggregationService.aggregateOxygen(actorId);

    expect(summary.percentage).toBe(75); // (5 + 10) / 20 * 100 = 75%
  });

  it('should handle single organ creature', async () => {
    const creatureId = 'creature-001';
    const lungId = `${creatureId}-lung`;

    entityManager.createEntity(creatureId);
    entityManager.createEntity(lungId);
    await entityManager.addComponent(lungId, 'anatomy:part', {
      ownerEntityId: creatureId
    });
    await entityManager.addComponent(lungId, 'breathing-states:respiratory_organ', {
      respirationType: 'pulmonary',
      oxygenCapacity: 15,
      currentOxygen: 12
    });

    const summary = oxygenAggregationService.aggregateOxygen(creatureId);

    expect(summary.percentage).toBe(80); // 12/15 * 100 = 80%
    expect(summary.organCount).toBe(1);
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

All tests in `tests/integration/domUI/oxygenBarDisplay.integration.test.js`:

**T-3.1 Event integration:**
1. `should update oxygen bar on TURN_STARTED event`
2. `should reflect current component state after depletion`
3. `should reflect current component state after restoration`

**T-3.2 Handler integration:**
1. `should show reduced percentage after DEPLETE_OXYGEN execution`
2. `should show increased percentage after RESTORE_OXYGEN execution`
3. `should show 100% after restoreFull: true execution`

**T-3.3 Multi-organ scenarios:**
1. `should show combined percentage for human with two lungs`
2. `should handle asymmetric damage (one lung at 50%, one at 100%)`
3. `should handle single organ creature`

### Invariants That Must Remain True

1. Tests use existing SimpleEntityManager and createEventBus helpers (no ad-hoc mocks)
2. Tests do not modify source files
3. Tests clean up properly in afterEach
4. Tests are independent and can run in any order
5. Use unique entity IDs per test (e.g., suffix with test name) to avoid cross-test conflicts
6. Tests verify behavior through public APIs, not implementation details

## Estimated Diff Size

- New test file: ~300-400 lines

## Status

Completed

## Outcome

- Reframed setup to use SimpleEntityManager + createEventBus and documented event payload expectations for TURN_STARTED.
- Implemented integration coverage in `tests/integration/domUI/oxygenBarDisplay.integration.test.js` without source code changes.
