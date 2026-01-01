# FACARCANA-006: Migrate Integration Tests Using Facades

## Summary

Migrate integration tests that use testing facades to the container-based approach. These tests are in the `tests/integration/` directory and use `createMockFacades()` for test setup.

## Dependencies

- **FACARCANA-001** must be completed (e2e container builder)
- **FACARCANA-002** through **FACARCANA-005** should be completed (establishes migration patterns)

## Files to Touch

### Modify

- `tests/integration/actions/testConfiguration.js`
- `tests/integration/actions/crossComponentIntegration.test.js`
- `tests/integration/actions/backwardCompatibilityIntegration.test.js`
- `tests/integration/actions/contextResolutionIntegration.test.js`
- `tests/integration/builders/testModuleIntegration.test.js`

### Reference (Read Only)

- `tests/e2e/common/e2eTestContainer.js` - Container builder
- `tests/e2e/actions/` migrated files - Pattern reference

## Out of Scope

- DO NOT modify test builder modules (FACARCANA-007)
- DO NOT modify e2e tests (already migrated)
- DO NOT delete testing facades yet (FACARCANA-008)
- DO NOT modify production code
- DO NOT modify unit tests (they don't use facades)

## Acceptance Criteria

### Migration Requirements

1. **Test Configuration**
   - `testConfiguration.js` provides container-based setup utilities
   - Configuration works with both action and builder integration tests

2. **Action Integration Tests**
   - `crossComponentIntegration.test.js` uses real component services
   - `backwardCompatibilityIntegration.test.js` uses real validation services
   - `contextResolutionIntegration.test.js` uses real context resolution

3. **Builder Integration Tests**
   - `testModuleIntegration.test.js` uses real builder services

### Tests That Must Pass

1. **Individual Migrated Files**
   - `npm run test:integration -- tests/integration/actions/crossComponentIntegration.test.js`
   - `npm run test:integration -- tests/integration/actions/backwardCompatibilityIntegration.test.js`
   - `npm run test:integration -- tests/integration/actions/contextResolutionIntegration.test.js`
   - `npm run test:integration -- tests/integration/builders/testModuleIntegration.test.js`

2. **Combined Suites**
   - `npm run test:integration -- tests/integration/actions/`
   - `npm run test:integration -- tests/integration/builders/`

3. **Regression Check**
   - `npm run test:ci` passes

### Invariants

1. No imports from `tests/common/facades/` in migrated files
2. Tests use real integration between components
3. All existing test assertions pass
4. Production facades unchanged
5. Integration tests not in scope still work

## Implementation Notes

### Integration Test Configuration

The `testConfiguration.js` provides shared utilities:

**Before:**

```javascript
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

export function createIntegrationTestContext() {
  const facades = createMockFacades();

  return {
    entityService: facades.entityService,
    actionService: facades.actionService,
    eventBus: facades.eventBus,
  };
}
```

**After:**

```javascript
import { createE2ETestEnvironment } from '../../e2e/common/e2eTestContainer.js';

export async function createIntegrationTestContext(options = {}) {
  const env = await createE2ETestEnvironment({
    mods: ['core', 'positioning', ...(options.mods || [])],
    stubLLM: true
  });

  return {
    env,
    entityManager: env.services.entityManager,
    actionDiscoveryService: env.services.actionDiscoveryService,
    actionExecutionService: env.services.actionExecutionService,
    eventBus: env.services.eventBus,
    cleanup: () => env.cleanup()
  };
}
```

### Cross-Component Integration Test

**Before:**

```javascript
import { createMockFacades } from '../../../common/facades/testingFacadeRegistrations.js';

describe('Cross-Component Integration', () => {
  let facades;

  beforeEach(() => {
    facades = createMockFacades();
  });

  it('should handle cross-component communication', async () => {
    const result = await facades.actionService.executeWithComponents(/*...*/);
    expect(result.success).toBe(true);
  });
});
```

**After:**

```javascript
import { createIntegrationTestContext } from './testConfiguration.js';

describe('Cross-Component Integration', () => {
  let context;

  beforeEach(async () => {
    context = await createIntegrationTestContext({
      mods: ['core', 'positioning']
    });
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it('should handle cross-component communication', async () => {
    const { entityManager, actionExecutionService } = context;

    // Create test entities
    const actorId = await entityManager.createEntity({
      definitionId: 'core:actor',
      components: { 'core:name': { name: 'Test Actor' } }
    });

    // Execute action with real services
    const result = await actionExecutionService.execute({
      actionId: 'core:look',
      actorId
    });

    expect(result.success).toBe(true);
  });
});
```

### Backward Compatibility Test

Tests should verify that migrations maintain backward compatibility:

```javascript
import { createIntegrationTestContext } from './testConfiguration.js';

describe('Backward Compatibility Integration', () => {
  let context;

  beforeEach(async () => {
    context = await createIntegrationTestContext();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it('should maintain API compatibility', async () => {
    const { actionDiscoveryService, entityManager } = context;

    const actorId = await entityManager.createEntity({
      definitionId: 'core:actor'
    });

    // Verify old API patterns still work
    const result = await actionDiscoveryService.discoverActions(actorId, {});

    expect(result).toHaveProperty('actions');
    expect(Array.isArray(result.actions)).toBe(true);
  });
});
```

### Context Resolution Test

```javascript
import { createIntegrationTestContext } from './testConfiguration.js';

describe('Context Resolution Integration', () => {
  let context;

  beforeEach(async () => {
    context = await createIntegrationTestContext({
      mods: ['core', 'positioning']
    });
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it('should resolve context correctly', async () => {
    const { entityManager, actionDiscoveryService } = context;

    // Create complex entity setup
    const actorId = await entityManager.createEntity({
      definitionId: 'core:actor',
      components: {
        'core:name': { name: 'Actor' },
        'positioning:location': { locationId: 'room-1' }
      }
    });

    const targetId = await entityManager.createEntity({
      definitionId: 'core:actor',
      components: {
        'core:name': { name: 'Target' },
        'positioning:location': { locationId: 'room-1' }
      }
    });

    // Context should be resolved correctly
    const actions = await actionDiscoveryService.discoverActions(actorId, {
      potentialTargets: [targetId]
    });

    expect(actions.actions).toBeDefined();
  });
});
```

## Verification Checklist

```bash
# Test individual files
npm run test:integration -- tests/integration/actions/crossComponentIntegration.test.js
npm run test:integration -- tests/integration/actions/backwardCompatibilityIntegration.test.js
npm run test:integration -- tests/integration/actions/contextResolutionIntegration.test.js
npm run test:integration -- tests/integration/builders/testModuleIntegration.test.js

# Verify no facade imports
grep -r "common/facades" tests/integration/actions/ tests/integration/builders/

# Combined suites
npm run test:integration -- tests/integration/actions/
npm run test:integration -- tests/integration/builders/

# Full regression
npm run test:ci
```

## Definition of Done

- [ ] All 5 files migrated to container-based approach
- [ ] `testConfiguration.js` provides consistent setup utilities
- [ ] No imports from `tests/common/facades/` in migrated files
- [ ] All migrated tests pass individually
- [ ] Integration suites pass
- [ ] Full test suite passes: `npm run test:ci`
- [ ] ESLint passes on all modified files
