# MULTARRESSTAREF-013: Create Resolution Coordinator Tests

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 1.5 days
**Phase:** 3 - Resolution Coordination Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Create comprehensive unit tests for `TargetResolutionCoordinator` to ensure coordination logic is preserved during extraction and contextFrom dependencies work correctly.

## Background

The coordinator handles ~150 lines of critical coordination logic including dependency order resolution and contextFrom handling. Tests ensure no functionality is lost during extraction.

## Technical Requirements

### File to Create
- **Path:** `tests/unit/actions/pipeline/services/implementations/TargetResolutionCoordinator.test.js`

### Test Coverage Requirements

**Target Coverage:** 90%+ (branches, functions, lines)

### Test Suites

#### 1. Constructor and Initialization
```javascript
describe('TargetResolutionCoordinator - Constructor', () => {
  it('should validate all dependencies', () => {});
  it('should throw if dependencies missing required methods', () => {});
  it('should initialize with valid dependencies', () => {});
});
```

#### 2. Coordination Orchestration
```javascript
describe('coordinateResolution', () => {
  it('should coordinate resolution for action with targets', () => {});
  it('should use dependency resolver for order', () => {});
  it('should return success result with resolved targets', () => {});
  it('should include target contexts', () => {});
  it('should include detailed results', () => {});
  it('should handle empty targets gracefully', () => {});
  it('should return error result on failure', () => {});
});
```

#### 3. Dependency-Aware Resolution
```javascript
describe('resolveWithDependencies', () => {
  it('should resolve targets in dependency order', () => {});
  it('should handle primary targets first', () => {});
  it('should handle dependent targets after primaries', () => {});
  it('should track detailed results per target', () => {});
  it('should build target contexts for primary targets', () => {});
  it('should handle mixed primary and dependent targets', () => {});
  it('should handle only primary targets', () => {});
  it('should handle only dependent targets', () => {});
});
```

#### 4. ContextFrom Handling
```javascript
describe('resolveDependentTargets', () => {
  it('should resolve dependent targets using primary target context', () => {});
  it('should iterate through all primary targets', () => {});
  it('should build context for each primary target', () => {});
  it('should aggregate results from all contexts', () => {});
  it('should deduplicate dependent targets', () => {});
  it('should handle empty primary targets', () => {});
  it('should handle resolution failures gracefully', () => {});
});
```

#### 5. Resolution Order
```javascript
describe('Resolution Order', () => {
  it('should respect dependency resolver order', () => {});
  it('should resolve primary targets before dependents', () => {});
  it('should handle complex dependency chains', () => {});
  it('should handle circular dependencies gracefully', () => {});
});
```

#### 6. Detailed Results Tracking
```javascript
describe('Detailed Results Tracking', () => {
  it('should track primary target results', () => {});
  it('should track dependent target results with contextFrom', () => {});
  it('should include resolution counts', () => {});
  it('should mark primary vs dependent targets', () => {});
});
```

#### 7. Error Handling
```javascript
describe('Error Handling', () => {
  it('should not throw on resolution failures', () => {});
  it('should return error in result', () => {});
  it('should log errors with context', () => {});
  it('should handle partial resolution failures', () => {});
});
```

### Mock Helper Utilities

```javascript
function createMockDependencyResolver(order = ['primary', 'secondary']) {
  return {
    resolveOrder: jest.fn().mockResolvedValue(order),
  };
}

function createMockContextBuilder() {
  return {
    buildContext: jest.fn().mockResolvedValue({ actor: 'test-actor' }),
  };
}

function createMockScopeResolver(candidates = ['target-1', 'target-2']) {
  return {
    resolveScope: jest.fn().mockResolvedValue(candidates),
  };
}

function createMockEntityManager() {
  return {
    getEntity: jest.fn((id) => ({ id, name: `Entity ${id}` })),
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

function createMockActionDef(overrides = {}) {
  return {
    id: 'test:action',
    targets: {
      primary: { scope: 'primary_scope' },
      secondary: { scope: 'secondary_scope', contextFrom: 'primary' },
    },
    ...overrides,
  };
}
```

### Critical Test Cases

**Test contextFrom handling:**
```javascript
it('should resolve contextFrom targets using primary targets', async () => {
  const mockDependencyResolver = createMockDependencyResolver(['primary', 'secondary']);
  const coordinator = new TargetResolutionCoordinator({/*...*/});

  const actionDef = {
    targets: {
      primary: { scope: 'actors' },
      secondary: { scope: 'items', contextFrom: 'primary' },
    },
  };

  const result = await coordinator.coordinateResolution(actionDef, actor, context, trace);

  expect(result.success).toBe(true);
  expect(result.resolvedTargets).toHaveProperty('primary');
  expect(result.resolvedTargets).toHaveProperty('secondary');
  expect(result.detailedResults.secondary).toHaveProperty('contextFrom', 'primary');
});
```

**Test dependency order:**
```javascript
it('should resolve in dependency order', async () => {
  const resolveOrder = ['target1', 'target2', 'target3'];
  const mockDependencyResolver = createMockDependencyResolver(resolveOrder);

  const callOrder = [];
  const mockScopeResolver = {
    resolveScope: jest.fn((scope) => {
      callOrder.push(scope);
      return [];
    }),
  };

  await coordinator.resolveWithDependencies(/*...*/);

  expect(callOrder[0]).toBe('scope1');
  expect(callOrder[1]).toBe('scope2');
  expect(callOrder[2]).toBe('scope3');
});
```

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
