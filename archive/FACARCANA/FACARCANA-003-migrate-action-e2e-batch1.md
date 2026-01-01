# FACARCANA-003: Migrate Action E2E Tests (Batch 1)

**Status**: ✅ COMPLETED
**Completed**: 2025-12-31

## Overview

Migrate 5 e2e action test files + 1 helper from mock facades to use real production services via the e2eTestContainer.

## Files Migrated

### Test Files (5)
1. `tests/e2e/actions/multiTargetDiscoveryPipeline.e2e.test.js`
2. `tests/e2e/actions/ActionExecutionPipeline.e2e.test.js`
3. `tests/e2e/actions/ActionValidationEdgeCases.e2e.test.js`
4. `tests/e2e/actions/singleTargetMultipleEntities.e2e.test.js`
5. `tests/e2e/actions/ActionPersistenceIntegration.simple.e2e.test.js`

### Helper Files (1)
6. `tests/e2e/actions/helpers/multiTargetTestBuilder.js`

## Definition of Done

- [x] e2eTestContainer.js extended with optional mod loading
- [x] Ticket FACARCANA-003 corrected with accurate information
- [x] All 5 test files migrated
- [x] multiTargetTestBuilder.js helper migrated
- [x] No imports from `tests/common/facades/` in migrated files
- [x] All individual tests pass (53 tests)
- [x] Full test suite passes
- [x] ESLint passes on modified files
- [x] Ticket archived with Outcome section

## Outcome

### Infrastructure Extension

Extended `tests/e2e/common/e2eTestContainer.js` with optional mod loading capability:

```javascript
export async function createE2ETestEnvironment(options = {}) {
  const {
    loadMods = false,        // NEW: whether to load real mods
    mods = ['core'],         // NEW: which mods to load
    stubLLM = true,
    // ... other options
  } = options;

  // When loadMods is true, loads real mod data from filesystem
  // Component schemas from core mod are available for validation
}
```

### Migration Pattern

All tests now follow the container-based pattern:

```javascript
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

describe('Action E2E Test', () => {
  let env;
  let entityManager;
  let actionDiscoveryService;
  let registry;

  beforeEach(async () => {
    env = await createE2ETestEnvironment({
      loadMods: true,
      mods: ['core'],
      stubLLM: true,
    });

    entityManager = env.services.entityManager;
    actionDiscoveryService = env.services.actionDiscoveryService;
    registry = env.container.resolve(tokens.IDataRegistry);

    // Register test entity definitions manually
    const actorDef = createEntityDefinition('test:actor', {
      'core:name': { text: 'Test Actor' },
      'core:actor': {},
    });
    registry.store('entityDefinitions', 'test:actor', actorDef);
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should use real production services', async () => {
    const entity = await entityManager.createEntityInstance('test:actor', {
      instanceId: 'test-actor',
      componentOverrides: {
        'core:name': { text: 'Test' },
        'core:position': { locationId },
        'core:actor': {},
      },
    });

    const result = await actionDiscoveryService.getValidActions(
      entity,
      {},
      { trace: false }
    );

    expect(result.actions).toBeDefined();
  });
});
```

### Key Technical Details

**Component Schema Requirements** (from core mod):
- `core:name` requires `{ text: string }`
- `core:actor` is a marker component requiring `{}` (empty object)
- `core:position` requires `{ locationId: string }`

**Entity Component Access**:
- Use `entity.components['componentId']` to access component data
- Not `entity.getComponent()` or similar methods

**Entity Definition Registration**:
- Core mod doesn't include entity definitions
- Must manually register using `createEntityDefinition()` and `registry.store()`

### Test Results

- **Total Tests**: 53
- **All Passing**: ✅
- **Test Files**: 5
- **Helper Files**: 1 (backward compatible)

### Benefits Achieved

1. **Real Service Testing**: Tests now execute against actual production code
2. **Better Coverage**: Real mod loading validates actual component schemas
3. **Reduced Mocking**: No more mock facades for action discovery pipeline
4. **Simplified Setup**: Container-based pattern is easier to understand and maintain
5. **Backward Compatibility**: Helper file updated to support both old and new patterns

### Notes

- The multiTargetTestBuilder.js helper maintains backward compatibility for Batch 2 tests
- ESLint errors for unused variables were fixed by removing variable assignments for entities created only for side effects
- Tests validate real action discovery results without mocking the pipeline
