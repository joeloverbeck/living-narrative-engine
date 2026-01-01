# FACARCANA-007: Migrate Test Utilities & Performance Tests

## Summary

Migrate test builder modules and performance tests from mock facades to the container-based approach. These are shared testing utilities and performance benchmarks that need to work with real production services.

## Dependencies

- **FACARCANA-001** must be completed (e2e container builder)
- **FACARCANA-002** through **FACARCANA-006** should be completed (all consumers migrated first)

## Files to Touch

### Modify

- `tests/common/testing/builders/modules/llmTestingModule.js`
- `tests/common/testing/builders/modules/entityManagementTestModule.js`
- `tests/common/testing/builders/modules/actionProcessingTestModule.js`
- `tests/common/testing/builders/modules/turnExecutionTestModule.js`
- `tests/performance/actions/multiTargetActionPerformanceIntegration.test.js`
- `tests/performance/turnExecutionPerformance.test.js`

### Reference (Read Only)

- `tests/e2e/common/e2eTestContainer.js` - Container builder
- `tests/integration/actions/testConfiguration.js` - Integration test patterns

## Out of Scope

- DO NOT delete testing facades yet (FACARCANA-008)
- DO NOT modify e2e tests (already migrated)
- DO NOT modify integration tests (already migrated)
- DO NOT modify production code
- DO NOT modify unit tests

## Acceptance Criteria

### Migration Requirements

1. **Test Builder Modules**
   - `llmTestingModule.js` provides stubbed LLM for testing
   - `entityManagementTestModule.js` uses real EntityManager
   - `actionProcessingTestModule.js` uses real action services
   - `turnExecutionTestModule.js` uses real turn execution

2. **Performance Tests**
   - `multiTargetActionPerformanceIntegration.test.js` measures real performance
   - `turnExecutionPerformance.test.js` measures real turn execution

3. **Module Interface**
   - Modules provide consistent interface for test consumers
   - Modules support configuration options
   - All modules include proper cleanup

### Tests That Must Pass

1. **Performance Tests**
   - `npm run test:performance -- tests/performance/actions/multiTargetActionPerformanceIntegration.test.js`
   - `npm run test:performance -- tests/performance/turnExecutionPerformance.test.js`

2. **Dependent Tests Using Modules**
   - All tests that import from `tests/common/testing/builders/modules/`

3. **Regression Check**
   - `npm run test:ci` passes
   - `npm run test:performance` passes

### Invariants

1. No imports from `tests/common/facades/` in migrated files
2. Performance tests measure real service performance
3. Test modules provide real services (not mocks)
4. All existing test assertions pass
5. Production facades unchanged
6. Performance benchmarks remain meaningful

## Implementation Notes

### LLM Testing Module

This module provides stubbed LLM for deterministic testing:

**Before:**

```javascript
import { createMockFacades } from '../../../facades/testingFacadeRegistrations.js';

export function createLLMTestModule() {
  const facades = createMockFacades();

  return {
    llmService: facades.llmService,
    setResponse: (response) => facades.llmService.setMockResponse(response)
  };
}
```

**After:**

```javascript
import { createE2ETestEnvironment } from '../../../../e2e/common/e2eTestContainer.js';

export async function createLLMTestModule(options = {}) {
  const env = await createE2ETestEnvironment({
    mods: options.mods || ['core'],
    stubLLM: true,
    defaultLLMResponse: options.defaultResponse || { actionId: 'core:wait' }
  });

  return {
    env,
    // LLM is stubbed via container override
    setResponse: (response) => env.stubLLM(response),
    getAIDecision: async (actorId, context) => {
      const aiService = env.container.resolve(tokens.IAIDecisionService);
      return aiService.getDecision(actorId, context);
    },
    cleanup: () => env.cleanup()
  };
}
```

### Entity Management Test Module

**Before:**

```javascript
import { createMockFacades } from '../../../facades/testingFacadeRegistrations.js';

export function createEntityTestModule() {
  const facades = createMockFacades();

  return {
    entityService: facades.entityService,
    createActor: (config) => facades.entityService.createTestActor(config)
  };
}
```

**After:**

```javascript
import { createE2ETestEnvironment } from '../../../../e2e/common/e2eTestContainer.js';

export async function createEntityTestModule(options = {}) {
  const env = await createE2ETestEnvironment({
    mods: options.mods || ['core'],
    stubLLM: true
  });

  return {
    env,
    entityManager: env.services.entityManager,
    createActor: async (config) => {
      return env.services.entityManager.createEntity({
        definitionId: 'core:actor',
        components: {
          'core:name': { name: config.name || 'Test Actor' },
          ...config.components
        }
      });
    },
    cleanup: () => env.cleanup()
  };
}
```

### Action Processing Test Module

```javascript
import { createE2ETestEnvironment } from '../../../../e2e/common/e2eTestContainer.js';

export async function createActionTestModule(options = {}) {
  const env = await createE2ETestEnvironment({
    mods: options.mods || ['core', 'positioning'],
    stubLLM: true
  });

  return {
    env,
    actionDiscoveryService: env.services.actionDiscoveryService,
    actionExecutionService: env.services.actionExecutionService,
    discoverActions: async (actorId, context) => {
      return env.services.actionDiscoveryService.discoverActions(actorId, context || {});
    },
    executeAction: async (params) => {
      return env.services.actionExecutionService.execute(params);
    },
    cleanup: () => env.cleanup()
  };
}
```

### Turn Execution Test Module

```javascript
import { createE2ETestEnvironment } from '../../../../e2e/common/e2eTestContainer.js';

export async function createTurnExecutionTestModule(options = {}) {
  const env = await createE2ETestEnvironment({
    mods: options.mods || ['core', 'positioning'],
    stubLLM: true,
    defaultLLMResponse: options.defaultDecision || { actionId: 'core:wait' }
  });

  const turnManager = env.container.resolve(tokens.ITurnManager);

  return {
    env,
    turnManager,
    entityManager: env.services.entityManager,
    eventBus: env.services.eventBus,
    executeTurn: async (actorId) => {
      return turnManager.executeTurn(actorId);
    },
    cleanup: () => env.cleanup()
  };
}
```

### Performance Test Migration

**Multi-Target Performance:**

```javascript
import { createE2ETestEnvironment } from '../../e2e/common/e2eTestContainer.js';

describe('Multi-Target Action Performance', () => {
  let env;

  beforeEach(async () => {
    env = await createE2ETestEnvironment({
      mods: ['core', 'positioning'],
      stubLLM: true
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should handle multi-target discovery within performance budget', async () => {
    const { entityManager, actionDiscoveryService } = env.services;

    // Create actor and multiple targets
    const actorId = await entityManager.createEntity({
      definitionId: 'core:actor',
      components: { 'core:name': { name: 'Actor' } }
    });

    const targetIds = [];
    for (let i = 0; i < 10; i++) {
      const targetId = await entityManager.createEntity({
        definitionId: 'core:actor',
        components: { 'core:name': { name: `Target ${i}` } }
      });
      targetIds.push(targetId);
    }

    // Measure performance
    const startTime = performance.now();

    const result = await actionDiscoveryService.discoverActions(actorId, {
      potentialTargets: targetIds
    });

    const elapsed = performance.now() - startTime;

    expect(result.actions).toBeDefined();
    expect(elapsed).toBeLessThan(1000); // 1 second budget
  });
});
```

**Turn Execution Performance:**

```javascript
import { createE2ETestEnvironment } from '../e2e/common/e2eTestContainer.js';

describe('Turn Execution Performance', () => {
  let env;

  beforeEach(async () => {
    env = await createE2ETestEnvironment({
      mods: ['core', 'positioning'],
      stubLLM: true,
      defaultLLMResponse: { actionId: 'core:wait' }
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should execute turn within performance budget', async () => {
    const { entityManager } = env.services;
    const turnManager = env.container.resolve(tokens.ITurnManager);

    const actorId = await entityManager.createEntity({
      definitionId: 'core:actor',
      components: { 'core:name': { name: 'Test Actor' } }
    });

    // Measure performance
    const startTime = performance.now();

    await turnManager.executeTurn(actorId);

    const elapsed = performance.now() - startTime;

    expect(elapsed).toBeLessThan(500); // 500ms budget
  });
});
```

## Verification Checklist

```bash
# Test performance files
npm run test:performance -- tests/performance/actions/multiTargetActionPerformanceIntegration.test.js
npm run test:performance -- tests/performance/turnExecutionPerformance.test.js

# Verify no facade imports
grep -r "common/facades" tests/common/testing/builders/modules/ tests/performance/

# Full performance suite
npm run test:performance

# Full regression
npm run test:ci
```

## Definition of Done

- [ ] All 6 files migrated to container-based approach
- [ ] Test modules provide consistent interface
- [ ] No imports from `tests/common/facades/` in migrated files
- [ ] Performance tests measure real service performance
- [ ] All performance tests pass
- [ ] Full test suite passes: `npm run test:ci`
- [ ] ESLint passes on all modified files
