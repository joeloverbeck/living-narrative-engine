# MULTARRESSTAREF-013: Create Resolution Coordinator Tests

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 1.5 days
**Phase:** 3 - Resolution Coordination Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create comprehensive unit tests for `TargetResolutionCoordinator` (`src/actions/pipeline/services/implementations/TargetResolutionCoordinator.js`) to ensure the extracted service correctly coordinates dependency-aware target resolution, surfaces failure conditions, and integrates with the surrounding tracing/result-building infrastructure.

## Background

The coordinator currently spans ~180 lines and owns the full dependency-aware coordination logic, including:

- Validating and storing eight service dependencies (`ITargetDependencyResolver`, `IScopeContextBuilder`, `ITargetDisplayNameResolver`, `UnifiedScopeResolver`, `IEntityManager`, `ILogger`, `ITargetResolutionTracingOrchestrator`, `ITargetResolutionResultBuilder`).
- `coordinateResolution(context, trace)`, which expects the full pipeline context (with `actionDef`, `actor`, `actionContext`, and `data`), validates `actionDef.targets`, invokes `dependencyResolver.getResolutionOrder`, calls `resolveWithDependencies(...)`, and either forwards `PipelineResult` failures or delegates success payload building to `resultBuilder.buildMultiTargetResult`.
- `resolveWithDependencies({ ... })`, which iterates over the resolver-provided order, branches between primary targets and `contextFrom`-dependent targets, records `detailedResolutionResults`, short-circuits with a `PipelineResult.success(... continueProcessing: false)` when any scope yields zero candidates, and defers to `resolveDependentTargets` for per-primary evaluation.
- `resolveDependentTargets({ ... })`, which loops through previously resolved primaries, builds scope context via `buildScopeContextForSpecificPrimary`, calls the internal `#resolveScope`, and returns flattened targets/contexts plus diagnostics.

Tests need to verify these real-world behaviors rather than the older stage assumptions.

## Technical Requirements

### File to Create
- **Path:** `tests/unit/actions/pipeline/services/implementations/TargetResolutionCoordinator.test.js`

### Test Coverage Requirements

**Target Coverage:** 90%+ (branches, functions, lines)

### Test Suites

#### 1. Constructor and Initialization
```javascript
describe('TargetResolutionCoordinator - Constructor', () => {
  it('validates each dependency with the proper required methods (e.g., getResolutionOrder, buildScopeContext, resolve)', () => {});
  it('throws when a dependency is missing its required method (exercise each dependency to ensure coverage)', () => {});
  it('stores dependencies when validation succeeds', () => {});
});
```

#### 2. Coordination Orchestration
```javascript
describe('coordinateResolution', () => {
  it('returns PipelineResult.failure when actionDef.targets is missing or invalid', async () => {});
  it('passes actionDef.targets to dependencyResolver.getResolutionOrder and propagates thrown errors as PipelineResult.failure', async () => {});
  it('short-circuits when resolveWithDependencies returns a PipelineResult instance', async () => {});
  it('invokes resultBuilder.buildMultiTargetResult with context, resolved targets, contexts, target definitions, action definition, and detailed results', async () => {});
  it('captures multi-target resolution statistics through tracingOrchestrator when the trace is action-aware', async () => {});
  it('returns the builder-produced PipelineResult payload (including continueProcessing true/false) when there are resolved targets', async () => {});
});
```

#### 3. Dependency-Aware Resolution (`resolveWithDependencies`)
```javascript
describe('resolveWithDependencies', () => {
  it('iterates targets using the supplied resolutionOrder and logs diagnostics for each target', async () => {});
  it('calls contextBuilder.buildScopeContext for primary targets and unifiedScopeResolver.resolve with the computed scope context', async () => {});
  it('hydrates primary targets using entityManager.getEntityInstance + nameResolver.getEntityDisplayName', async () => {});
  it('uses resolveDependentTargets for targets with contextFrom and merges its return shape', async () => {});
  it('records detailedResolutionResults with scopeId, contextFrom, counts, and evaluation times', async () => {});
  it('returns PipelineResult.success({ continueProcessing: false }) when a primary or dependent scope resolves to zero candidates', async () => {});
});
```

#### 4. ContextFrom Handling (`resolveDependentTargets`)
```javascript
describe('resolveDependentTargets', () => {
  it('builds scope context for every primary target via buildScopeContextForSpecificPrimary', async () => {});
  it('calls into the private #resolveScope through dependency injection stubs and aggregates all candidates', async () => {});
  it('hydrates each resolved dependent target (including contextFromId) and returns flattened target contexts', async () => {});
  it('tracks candidatesFound, contextEntityIds (matching the supplied primaries), and evaluation time', async () => {});
  it('returns empty arrays when there are no primary targets', async () => {});
});
```

#### 5. Resolution Order & Diagnostics
```javascript
describe('Resolution Order', () => {
  it('respects the order returned by dependencyResolver.getResolutionOrder', async () => {});
  it('handles mixed primary/dependent chains by ensuring dependent targets run only after their contextFrom targets exist', async () => {});
  it('records tracing information (trace.step/info/success/failure) for each scope when a trace is provided', async () => {});
});
```

#### 6. Detailed Results Tracking
```javascript
describe('Detailed Results Tracking', () => {
  it('captures candidatesFound/candidatesResolved/evaluationTimeMs for primaries', async () => {});
  it('captures primaryTargetCount/contextEntityIds and failureReason for dependents when zero candidates are returned', async () => {});
  it('aggregates targetContexts for every hydrated target (primary and dependent)', async () => {});
});
```

#### 7. Error Handling
```javascript
describe('Error Handling', () => {
  it('propagates scope resolution errors by logging and returning [] from #resolveScope (causing PipelineResult.success w/ continueProcessing: false)', async () => {});
  it('logs dependency resolver errors and wraps them in PipelineResult.failure from coordinateResolution', async () => {});
  it('handles action-aware tracing by calling tracingOrchestrator.captureScopeEvaluation and captureMultiTargetResolution only when trace supports it', async () => {});
});
```

### Mock Helper Utilities

```javascript
function createMockDependencyResolver(order = ['primary', 'secondary']) {
  return {
    getResolutionOrder: jest.fn(() => order),
  };
}

function createMockContextBuilder() {
  return {
    buildScopeContext: jest.fn(() => ({ actor: 'test-actor' })),
    buildScopeContextForSpecificPrimary: jest.fn(() => ({ actor: 'test-actor', location: 'test-location' })),
  };
}

function createMockNameResolver() {
  return {
    getEntityDisplayName: jest.fn((id) => `Entity ${id}`),
  };
}

function createMockUnifiedScopeResolver(candidates = ['target-1', 'target-2']) {
  return {
    resolve: jest.fn(async () => ({ success: true, value: candidates })),
  };
}

function createMockEntityManager() {
  return {
    getEntityInstance: jest.fn((id) => ({ id, name: `Entity ${id}` })),
  };
}

function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

function createMockTracingOrchestrator() {
  return {
    isActionAwareTrace: jest.fn(() => false),
    captureScopeEvaluation: jest.fn(),
    captureMultiTargetResolution: jest.fn(),
  };
}

function createMockResultBuilder(result = PipelineResult.success({ data: { actionsWithTargets: ['foo'] } })) {
  return {
    buildMultiTargetResult: jest.fn(() => result),
  };
}

function createMockActionContext() {
  return { currentLocation: 'loc-1' };
}

function createMockActionDef(overrides = {}) {
  return {
    id: 'test:action',
    targets: {
      primary: { scope: 'primary_scope', placeholder: 'Primary Target' },
      secondary: { scope: 'secondary_scope', contextFrom: 'primary', placeholder: 'Secondary Target' },
    },
    ...overrides,
  };
}
```

> **Note:** The helper above references `PipelineResult`. Import it from `src/actions/pipeline/PipelineResult.js` inside the test file to construct success/failure instances consistent with production code.

### Critical Test Cases

**Test contextFrom handling:**
```javascript
it('resolves contextFrom targets using previously resolved primaries', async () => {
  const dependencyResolver = createMockDependencyResolver(['primary', 'secondary']);
  const contextBuilder = createMockContextBuilder();
  const scopeResolver = createMockUnifiedScopeResolver(['entity-1']);
  const entityManager = createMockEntityManager();
  const nameResolver = createMockNameResolver();
  const tracingOrchestrator = createMockTracingOrchestrator();
  const resultBuilder = createMockResultBuilder();
  const coordinator = new TargetResolutionCoordinator({
    dependencyResolver,
    contextBuilder,
    nameResolver,
    unifiedScopeResolver: scopeResolver,
    entityManager,
    logger: createMockLogger(),
    tracingOrchestrator,
    resultBuilder,
  });

  const context = {
    actionDef: createMockActionDef(),
    actor: { id: 'actor-1' },
    actionContext: createMockActionContext(),
    data: {},
  };

  await coordinator.coordinateResolution(context);

  expect(resultBuilder.buildMultiTargetResult).toHaveBeenCalled();
  expect(tracingOrchestrator.captureMultiTargetResolution).toHaveBeenCalled();
});
```

**Test dependency order:**
```javascript
it('resolves scopes in the order provided by getResolutionOrder', async () => {
  const resolveOrder = ['primary', 'secondary'];
  const dependencyResolver = createMockDependencyResolver(resolveOrder);
  const scopeResolver = createMockUnifiedScopeResolver(['entity-1']);
  const contextBuilder = createMockContextBuilder();
  const coordinator = createCoordinator({
    dependencyResolver,
    unifiedScopeResolver: scopeResolver,
    contextBuilder,
  });

  await coordinator.resolveWithDependencies({
    context: {
      data: {},
    },
    actionDef: createMockActionDef(),
    targetDefs: createMockActionDef().targets,
    actor: { id: 'actor-1' },
    actionContext: createMockActionContext(),
    resolutionOrder: resolveOrder,
  });

  expect(scopeResolver.resolve.mock.calls.map(([scope]) => scope)).toEqual([
    'primary_scope',
    'secondary_scope',
  ]);
});
```

> Define `createCoordinator` in the test file to reduce boilerplate; it should wire all required dependencies using the helpers above while allowing overrides per test.

## Acceptance Criteria

- [ ] Test file created at specified path
- [ ] All 7 test suites implemented
- [ ] Coverage meets 90%+ target (branches, functions, lines)
- [ ] All edge cases covered (empty targets, failures, etc.)
- [ ] Mock utilities created for all dependencies
- [ ] ContextFrom dependency tests comprehensive
- [ ] Resolution order tests verify correct sequencing
- [ ] Tests follow project testing patterns
- [ ] All tests pass with `npm run test:unit`

## Dependencies

- **MULTARRESSTAREF-012** - Implementation must exist before testing

## Validation Commands

```bash
npm run test:unit -- tests/unit/actions/pipeline/services/implementations/TargetResolutionCoordinator.test.js
```

## Notes

- ContextFrom handling is critical - test thoroughly
- Dependency order must be respected in resolution
- Test both success and failure paths
- Verify detailed results include all necessary metadata
- Consider integration tests for complex dependency scenarios
