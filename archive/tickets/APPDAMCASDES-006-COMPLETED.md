# APPDAMCASDES-006: Integration Tests for Cascade Destruction

**Title:** Create Integration Tests for Cross-Service Cascade Behavior

**Summary:** Create integration tests that verify cascade destruction works correctly across the full service stack with a real DI container (via `IntegrationTestBed`).

**Status:** Completed

## Files to Create

- `tests/integration/anatomy/cascadeDestruction.integration.test.js`

## Files to Modify

- None

## Out of Scope

- Large refactors or breaking changes
- Broad rewrites of existing anatomy systems
- E2E tests (ticket APPDAMCASDES-007)
- Report file (ticket APPDAMCASDES-007)
- Unit test modifications
- Changes to existing integration tests

## Test Scenarios

### 1. Torso Destruction Cascade

```javascript
describe('Torso destruction cascade', () => {
  it('should destroy all internal organs when torso is destroyed', async () => {
    // Setup: Actor with torso containing heart, spine, left lung, right lung
    // All organs at full health (e.g., 100)

    // Action: Apply enough damage to destroy torso (health → 0)

    // Verify:
    // - Torso health is 0
    // - Heart health is 0
    // - Spine health is 0
    // - Left lung health is 0
    // - Right lung health is 0
    // - anatomy:cascade_destruction was dispatched
  });
});
```

### 2. Head Destruction Cascade

```javascript
describe('Head destruction cascade', () => {
  it('should destroy brain when head is destroyed', async () => {
    // Setup: Actor with head containing brain

    // Action: Destroy head via damage

    // Verify:
    // - Brain destroyed via cascade
    // - anatomy:part_destroyed events for head and brain
  });
});
```

### 3. Cascade Triggers Death Check

```javascript
describe('Cascade triggers death', () => {
  it('should trigger death when cascade destroys vital organ', async () => {
    // Setup: Actor with torso containing heart (vital organ)

    // Action: Destroy torso (NOT directly damaging heart)

    // Verify:
    // - Heart destroyed via cascade
    // - anatomy:entity_died event triggered
    // - causeOfDeath === 'vital_organ_destroyed'
  });
});
```

### 4. Cascade Narrative Composition

```javascript
describe('Cascade narrative', () => {
  it('should include cascade destruction in narrative', async () => {
    // Setup: Actor with torso containing multiple organs

    // Action: Destroy torso

    // Verify narrative includes something like:
    // "As their torso collapses, the heart, spine, left lung, and right lung are destroyed."
  });
});
```

### 5. No Cascade for Non-Destroyed Parts

```javascript
describe('No cascade for damaged parts', () => {
  it('should NOT cascade when part damaged but not destroyed', async () => {
    // Setup: Actor with torso at 100 health containing organs

    // Action: Apply damage reducing torso to 25 (not 0)

    // Verify:
    // - Torso health is 25
    // - All organs remain at original health
    // - NO CASCADE_DESTRUCTION_EVENT
  });
});
```

### 6. Already Destroyed Children Ignored

```javascript
describe('Already destroyed children', () => {
  it('should not re-destroy already destroyed organs', async () => {
    // Setup: Actor with torso where heart is already at 0

    // Action: Destroy torso

    // Verify:
    // - Only living organs destroyed (spine, lungs)
    // - Heart not included in cascade (was already 0)
    // - No duplicate PART_DESTROYED for heart
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. All 6 scenarios above implemented and passing
2. Tests use project test fixtures and helpers from `tests/common/`
3. Tests clean up after themselves (afterEach blocks)
4. No test pollution between scenarios

### Invariants

- Minimal source changes are allowed only if required to satisfy cascade behavior (e.g., state updates for cascaded parts)
- Tests use IntegrationTestBed (real AppContainer) with locally registered schemas for anatomy components
- Tests verify event dispatching order where relevant (parent part_destroyed → child part_destroyed → cascade event)
- Tests follow project test naming conventions
- Tests are isolated and can run in any order

## Dependencies

- Depends on:
  - APPDAMCASDES-001 through APPDAMCASDES-005 (all implementation complete)
- Blocks:
  - APPDAMCASDES-007 (E2E tests + report)

## Test Setup Guidance

### Required Test Helpers

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
```

### Entity Setup Pattern

The tests need to create actors with specific body structures. Investigate existing patterns in:
- `tests/integration/anatomy/` for anatomy test patterns
- `tests/common/` for entity creation helpers

### Event Capture Pattern

```javascript
const dispatchedEvents = [];
const unsubscribe = eventBus.subscribe('*', (event) => dispatchedEvents.push(event));
// Run damage
// Assert on dispatchedEvents array
// unsubscribe() in afterEach
```

## Verification Commands

```bash
# Run integration tests for cascade destruction
npm run test:integration -- tests/integration/anatomy/cascadeDestruction.integration.test.js

# Lint the test file
npx eslint tests/integration/anatomy/cascadeDestruction.integration.test.js

# Run all integration tests to verify no regressions
npm run test:integration
```

## Notes

- Look at existing anatomy integration tests for patterns
- May need to create fixture for body part hierarchy if not existing
- Event ordering is important for cascade flow verification
- Consider using Jest's `toHaveBeenCalledBefore` for order assertions if available

## Outcome

- Updated assumptions for event IDs, narrative phrasing, and DI test bed usage.
- Added cascade destruction integration coverage with IntegrationTestBed and local schema registration for anatomy components.
- Adjusted cascade destruction to update part health state/turns during cascades to support death checks.
