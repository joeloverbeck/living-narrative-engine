# MODTESDIAIMP-010: Extend ModTestFixture with Tracer Methods

**Phase**: 3 - Scope Evaluation Tracer
**Priority**: 🟡 High
**Estimated Effort**: 2 hours
**Dependencies**: MODTESDIAIMP-009

---

## Overview

Extend `ModTestFixture` class with scope tracer API methods, making scope tracing easily accessible to test code for debugging scope resolution issues.

## Objectives

- Add ScopeEvaluationTracer instance to ModTestFixture
- Expose tracer control methods (enable/disable/clear)
- Expose trace data access methods (getTrace, format, performance)
- Provide helper method for conditional tracing
- Ensure tracer is properly cleaned up

## Implementation Details

### File to Modify
- **Path**: `tests/common/mods/ModTestFixture.js`
- **Class**: `ModTestFixture`

### Import Statement

```javascript
import { ScopeEvaluationTracer } from './scopeEvaluationTracer.js';
```

### Constructor Modification

```javascript
export class ModTestFixture {
  constructor() {
    // ...existing properties...
    this.scopeTracer = new ScopeEvaluationTracer();
  }
}
```

### New Methods to Add

```javascript
/**
 * Enable scope evaluation tracing
 * @returns {void}
 */
enableScopeTracing() {
  this.scopeTracer.enable();
}

/**
 * Disable scope evaluation tracing
 * @returns {void}
 */
disableScopeTracing() {
  this.scopeTracer.disable();
}

/**
 * Get formatted scope trace output
 * @returns {string} Human-readable trace
 */
getScopeTrace() {
  return this.scopeTracer.format();
}

/**
 * Get raw scope trace data
 * @returns {object} Trace data structure
 */
getScopeTraceData() {
  return this.scopeTracer.getTrace();
}

/**
 * Get filter breakdown for last evaluation
 * @param {string} entityId - Optional entity ID to filter by
 * @returns {object|Array} Filter breakdown
 */
getFilterBreakdown(entityId = null) {
  const trace = this.scopeTracer.getTrace();
  const filterEvals = trace.steps.filter(s => s.type === 'FILTER_EVALUATION');

  if (entityId) {
    return filterEvals.find(e => e.entityId === entityId);
  }

  return filterEvals;
}

/**
 * Clear scope trace data
 * @returns {void}
 */
clearScopeTrace() {
  this.scopeTracer.clear();
}

/**
 * Enable tracing if condition is true
 * @param {boolean} condition - Enable condition
 * @returns {void}
 */
enableScopeTracingIf(condition) {
  if (condition) {
    this.scopeTracer.enable();
  }
}
```

### Cleanup Modification

```javascript
cleanup() {
  // ...existing cleanup...

  // Clear tracer to prevent memory leaks
  if (this.scopeTracer) {
    this.scopeTracer.clear();
    this.scopeTracer.disable();
  }
}
```

### RuntimeContext Modification

Ensure tracer is accessible to scope engine:

```javascript
const runtimeCtx = {
  get entityManager() { return testEnv.entityManager; },
  get jsonLogicEval() { return testEnv.jsonLogic; },
  get logger() { return testEnv.logger; },
  get tracer() { return this.scopeTracer; }, // ADD THIS
};
```

## Acceptance Criteria

### Constructor
- ✅ ScopeEvaluationTracer instantiated in constructor
- ✅ Tracer accessible via `this.scopeTracer`

### Control Methods
- ✅ `enableScopeTracing()` enables tracer
- ✅ `disableScopeTracing()` disables tracer
- ✅ `clearScopeTrace()` clears trace data
- ✅ `enableScopeTracingIf(condition)` conditional enable

### Data Access Methods
- ✅ `getScopeTrace()` returns formatted string
- ✅ `getScopeTraceData()` returns raw trace object
- ✅ `getFilterBreakdown()` returns filter evaluations
- ✅ `getFilterBreakdown(entityId)` filters by entity

### RuntimeContext
- ✅ Tracer accessible via `runtimeCtx.tracer`
- ✅ Tracer passed to ScopeEngine

### Cleanup
- ✅ Tracer cleared on cleanup
- ✅ Tracer disabled on cleanup

## Testing Requirements

**Test File**: `tests/unit/common/mods/ModTestFixture.tracer.test.js` (new)

### Test Cases

```javascript
describe('ModTestFixture - Scope Tracer', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Tracer initialization', () => {
    it('should create tracer instance')
    it('should start with tracer disabled')
  });

  describe('Control methods', () => {
    it('should enable tracing')
    it('should disable tracing')
    it('should clear trace data')
    it('should conditionally enable tracing')
  });

  describe('Data access methods', () => {
    it('should get formatted trace')
    it('should get raw trace data')
    it('should get all filter evaluations')
    it('should get filter evaluation by entity ID')
    it('should return empty array when no filters')
  });

  describe('RuntimeContext integration', () => {
    it('should expose tracer in runtimeCtx')
    it('should pass tracer to ScopeEngine')
  });

  describe('Cleanup', () => {
    it('should clear tracer on cleanup')
    it('should disable tracer on cleanup')
    it('should not throw if tracer is null')
  });

  describe('Usage patterns', () => {
    it('should support enable → execute → get trace')
    it('should support clear between runs')
    it('should support conditional tracing based on result')
  });
});
```

## Usage Examples

### Basic Tracing

```javascript
it('test with tracing', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
  const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);

  console.log(testFixture.getScopeTrace());
});
```

### Conditional Tracing

```javascript
it('test with conditional tracing', async () => {
  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
  const actions = testFixture.testEnv.getAvailableActions(scenario.actor.id);

  // Enable tracing only if test fails
  if (actions.length === 0) {
    testFixture.enableScopeTracing();
    // Re-run to get trace
    testFixture.testEnv.getAvailableActions(scenario.actor.id);
    console.log(testFixture.getScopeTrace());
  }

  expect(actions).not.toHaveLength(0);
});
```

### Filter Breakdown Analysis

```javascript
it('analyze filter breakdown', async () => {
  testFixture.enableScopeTracing();

  const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
  testFixture.testEnv.getAvailableActions(scenario.actor.id);

  const breakdown = testFixture.getFilterBreakdown(scenario.target.id);

  if (breakdown && !breakdown.result) {
    console.log('Filter failed for:', scenario.target.id);
    console.log('Breakdown:', breakdown.breakdown);
  }
});
```

## Migration Impact

### Breaking Changes
- **None** - Only adds new optional methods

### Backward Compatibility
- All existing tests continue to work without changes
- Tracer is disabled by default (no performance impact)

## Documentation Requirements

Update `docs/testing/mod-testing-guide.md`:
- Add section on scope tracing
- Document all new methods
- Provide usage examples
- Explain when to use tracing

## References

- **Spec Section**: 3.3 Integration with ModTestFixture (lines 1029-1077)
- **API Design**: 6.1 ModTestFixture Extensions (lines 2089-2167)
- **Related Tickets**:
  - MODTESDIAIMP-009 (ScopeEvaluationTracer class)
  - MODTESDIAIMP-011 (ScopeEngine integration)
  - MODTESDIAIMP-012 (Integration tests)
