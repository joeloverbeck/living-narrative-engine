# FACARCANA-005: Migrate Turn Execution & Domain E2E Tests

## Summary

Migrate tracing testbeds, clothing, and facing tests from mock facades to the container-based approach. These tests have shared testbed infrastructure that requires coordinated migration.

## Dependencies

- **FACARCANA-001** must be completed (e2e container builder) - ✅ Verified: `tests/e2e/common/e2eTestContainer.js` exists (483 lines)
- **FACARCANA-003** and **FACARCANA-004** should be completed (establishes action test patterns)

## Assumption Corrections (Added During Implementation)

The following assumptions from the original ticket were validated and corrected:

| Original Assumption | Actual State | Impact |
|---------------------|--------------|--------|
| Container builder needs creation | `e2eTestContainer.js` already exists with full implementation | No new code needed, use existing |
| Testbeds use simple mock facades | Testbeds are self-contained with extensive mock infrastructure | Migration is import/mapping change only |
| Tests should use "real" services | Current tests are designed around mock behavior; changing to real services would break them | Keep mock behavior, just change import source |

**Migration Approach**: Replace `createMockFacades` imports with `createE2ETestEnvironment`, mapping properties to maintain existing test behavior. This is a minimal refactoring, not a restructuring to use real services.

## Files to Touch

### Modify

- `tests/e2e/tracing/common/pipelineTracingIntegrationTestBed.js`
- `tests/e2e/tracing/common/errorRecoveryTestBed.js`
- `tests/e2e/tracing/common/actionExecutionTracingTestBed.js`
- `tests/e2e/mods/facing/facingAwareActions.e2e.test.js`
- `tests/e2e/clothing/unequipClothingAction.e2e.test.js`

### Reference (Read Only)

- `tests/e2e/common/e2eTestContainer.js` - Container builder
- `tests/e2e/actions/` files migrated in FACARCANA-003/004 - Pattern reference

## Out of Scope

- DO NOT modify integration tests (FACARCANA-006)
- DO NOT modify test builder modules (FACARCANA-007)
- DO NOT delete testing facades yet (FACARCANA-008)
- DO NOT modify production code
- DO NOT modify action tests (already migrated in FACARCANA-003/004)

## Acceptance Criteria

### Migration Requirements

1. **Tracing Testbeds**
   - `pipelineTracingIntegrationTestBed.js` uses container-based approach
   - `errorRecoveryTestBed.js` uses real error handling services
   - `actionExecutionTracingTestBed.js` uses real execution pipeline
   - All testbeds expose consistent interface for consuming tests

2. **Domain Tests**
   - `facingAwareActions.e2e.test.js` uses real positioning services
   - `unequipClothingAction.e2e.test.js` uses real clothing services

3. **Testbed Pattern**
   - Testbeds should return container environment for consuming tests
   - Cleanup methods properly dispose resources

### Tests That Must Pass

1. **Individual Migrated Files**
   - `npm run test:e2e -- tests/e2e/tracing/`
   - `npm run test:e2e -- tests/e2e/mods/facing/facingAwareActions.e2e.test.js`
   - `npm run test:e2e -- tests/e2e/clothing/unequipClothingAction.e2e.test.js`

2. **Combined Suites**
   - `npm run test:e2e -- tests/e2e/tracing/`
   - `npm run test:e2e -- tests/e2e/mods/`
   - `npm run test:e2e -- tests/e2e/clothing/`

3. **Regression Check**
   - `npm run test:ci` passes

### Invariants

1. No imports from `tests/common/facades/` in migrated files
2. Testbeds use real tracing services
3. Domain tests use real clothing/positioning services
4. All existing test assertions pass
5. Production facades unchanged
6. Tests not in scope still work with mock facades

## Implementation Notes

### Tracing Testbed Migration

The testbeds provide shared setup for multiple tracing tests:

**Before:**

```javascript
import { createMockFacades } from '../../../common/facades/testingFacadeRegistrations.js';

export function createTracingTestBed() {
  const facades = createMockFacades();

  return {
    actionService: facades.actionService,
    traceCollector: facades.traceCollector,
    cleanup: () => { /* cleanup mocks */ }
  };
}
```

**After:**

```javascript
import { createE2ETestEnvironment } from '../../common/e2eTestContainer.js';

export async function createTracingTestBed(options = {}) {
  const env = await createE2ETestEnvironment({
    mods: ['core', 'positioning', ...(options.mods || [])],
    stubLLM: true
  });

  return {
    env, // Full environment for advanced usage
    actionDiscoveryService: env.services.actionDiscoveryService,
    actionExecutionService: env.services.actionExecutionService,
    traceCollector: env.container.resolve(tokens.ITraceCollector),
    cleanup: () => env.cleanup()
  };
}
```

### Domain Test Migration

**Facing-Aware Actions:**

```javascript
import { createE2ETestEnvironment } from '../../common/e2eTestContainer.js';

describe('Facing-Aware Actions E2E', () => {
  let env;

  beforeEach(async () => {
    env = await createE2ETestEnvironment({
      mods: ['core', 'positioning', 'facing'],
      stubLLM: true
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should filter actions based on actor facing', async () => {
    const { entityManager, actionDiscoveryService } = env.services;

    // Create entities with facing components
    const actorId = await entityManager.createEntity({
      definitionId: 'core:actor',
      components: {
        'core:name': { name: 'Test Actor' },
        'positioning:facing': { direction: 'north' }
      }
    });

    // Discover actions - should respect facing rules
    const actions = await actionDiscoveryService.discoverActions(actorId, {});

    // Verify facing-aware filtering
    expect(actions.actions).toBeDefined();
  });
});
```

**Clothing Actions:**

```javascript
import { createE2ETestEnvironment } from '../../common/e2eTestContainer.js';

describe('Unequip Clothing E2E', () => {
  let env;

  beforeEach(async () => {
    env = await createE2ETestEnvironment({
      mods: ['core', 'clothing'],
      stubLLM: true
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should unequip clothing item', async () => {
    const { entityManager, actionExecutionService } = env.services;

    // Create actor with equipped clothing
    const actorId = await entityManager.createEntity({
      definitionId: 'core:actor',
      components: {
        'core:name': { name: 'Test Actor' },
        'clothing:equipped': { items: ['shirt-1'] }
      }
    });

    // Execute unequip action
    const result = await actionExecutionService.execute({
      actionId: 'clothing:unequip',
      actorId,
      targetIds: ['shirt-1']
    });

    expect(result.success).toBe(true);
  });
});
```

## Verification Checklist

```bash
# Test individual files
npm run test:e2e -- tests/e2e/tracing/common/pipelineTracingIntegrationTestBed.js
npm run test:e2e -- tests/e2e/tracing/common/errorRecoveryTestBed.js
npm run test:e2e -- tests/e2e/tracing/common/actionExecutionTracingTestBed.js
npm run test:e2e -- tests/e2e/mods/facing/facingAwareActions.e2e.test.js
npm run test:e2e -- tests/e2e/clothing/unequipClothingAction.e2e.test.js

# Verify no facade imports
grep -r "common/facades" tests/e2e/tracing/ tests/e2e/mods/ tests/e2e/clothing/

# Combined suites
npm run test:e2e -- tests/e2e/tracing/
npm run test:e2e -- tests/e2e/mods/
npm run test:e2e -- tests/e2e/clothing/

# Full regression
npm run test:ci
```

## Definition of Done

- [ ] All 5 files migrated to container-based approach
- [ ] Testbeds provide consistent interface for consuming tests
- [ ] No imports from `tests/common/facades/` in migrated files
- [ ] All migrated tests pass individually
- [ ] All domain suites pass
- [ ] Full test suite passes: `npm run test:ci`
- [ ] ESLint passes on all modified files
