# MODTESDIAIMP-010: Extend ModTestFixture with Tracer Methods

**Phase**: 3 - Scope Evaluation Tracer
**Priority**: 🟡 High
**Estimated Effort**: 2 hours
**Dependencies**: MODTESDIAIMP-009
**Status**: ✅ Assumptions Validated (2025-11-09)

---

## ⚠️ Important Corrections

This workflow has been analyzed and corrected against the actual codebase:

1. **Target Class**: `BaseModTestFixture` (not `ModTestFixture`)
   - `ModTestFixture` is a static factory class with static methods
   - `BaseModTestFixture` is the actual instance base class that has constructor and cleanup
   - All fixture types inherit from `BaseModTestFixture`

2. **RuntimeContext Locations**: Tracer integration requires updating:
   - `ModActionTestFixture.registerCustomScope()` method (line ~2236)
   - Note added about `scopeResolverHelpers.js` for complete integration

3. **Code References**: All line numbers and code snippets updated to match current codebase structure

---

## Overview

Extend test fixture classes with scope tracer API methods, making scope tracing easily accessible to test code for debugging scope resolution issues. The tracer will be added to `BaseModTestFixture` so all fixture types inherit the functionality.

## Objectives

- Add ScopeEvaluationTracer instance to `BaseModTestFixture` constructor
- Expose tracer control methods on `BaseModTestFixture` (enable/disable/clear)
- Expose trace data access methods on `BaseModTestFixture` (getTrace, format, breakdown)
- Provide helper method for conditional tracing
- Integrate tracer with `runtimeCtx` in `ModActionTestFixture.registerCustomScope`
- Ensure tracer is properly cleaned up in `BaseModTestFixture.cleanup`
- Maintain backward compatibility (tracer disabled by default)

## Implementation Details

### File to Modify
- **Path**: `tests/common/mods/ModTestFixture.js`
- **Class**: `BaseModTestFixture` (the base class for all test fixtures)

**Note**: `ModTestFixture` is a static factory class. The actual instance classes are:
- `BaseModTestFixture` - Base class with constructor and cleanup (TARGET CLASS)
- `ModActionTestFixture` - Extends BaseModTestFixture
- `ModRuleTestFixture` - Extends ModActionTestFixture
- `ModCategoryTestFixture` - Extends BaseModTestFixture

### Import Statement

Add to top of file (around line 35, after other imports):

```javascript
import { ScopeEvaluationTracer } from './scopeEvaluationTracer.js';
```

### Constructor Modification

Modify `BaseModTestFixture` constructor (currently at line 746):

```javascript
class BaseModTestFixture {
  constructor(modId, options = {}) {
    this.modId = modId;
    this.options = options;
    this.testEnv = null;
    this.diagnostics = null; // Will be created on demand
    this.scopeTracer = new ScopeEvaluationTracer(); // ADD THIS
  }
}
```

### New Methods to Add

Add these methods to `BaseModTestFixture` class (after the `cleanup()` method, around line 1175):

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

Modify the `cleanup()` method in `BaseModTestFixture` (currently at line 1169):

```javascript
cleanup() {
  this.disableDiagnostics();

  // Clear tracer to prevent memory leaks (ADD THIS)
  if (this.scopeTracer) {
    this.scopeTracer.clear();
    this.scopeTracer.disable();
  }

  if (this.testEnv) {
    this.testEnv.cleanup();
  }
}
```

### RuntimeContext Modification

The tracer needs to be accessible to the scope engine via `runtimeCtx`. There are **two locations** where `runtimeCtx` is created that need to be updated:

#### Location 1: ModActionTestFixture.registerCustomScope

Modify the `runtimeCtx` creation in `registerCustomScope()` method (currently at line 2236):

```javascript
const runtimeCtx = {
  get entityManager() { return testEnv.entityManager; },
  get jsonLogicEval() { return testEnv.jsonLogic; },
  get logger() { return testEnv.logger; },
  get tracer() { return this.scopeTracer; }, // ADD THIS
};
```

#### Location 2: Consider scopeResolverHelpers.js

**Note**: Standard scope resolvers in `tests/common/mods/scopeResolverHelpers.js` also create `runtimeCtx` objects. For complete tracer integration with all scope types, those locations may need updating in a separate workflow. This workflow focuses on ModTestFixture integration only.

## Acceptance Criteria

### Constructor (BaseModTestFixture)
- ✅ ScopeEvaluationTracer instantiated in `BaseModTestFixture` constructor
- ✅ Tracer accessible via `this.scopeTracer` on all fixture instances
- ✅ All fixture types (ModActionTestFixture, ModRuleTestFixture, ModCategoryTestFixture) inherit the tracer

### Control Methods (BaseModTestFixture)
- ✅ `enableScopeTracing()` enables tracer
- ✅ `disableScopeTracing()` disables tracer
- ✅ `clearScopeTrace()` clears trace data
- ✅ `enableScopeTracingIf(condition)` conditional enable

### Data Access Methods (BaseModTestFixture)
- ✅ `getScopeTrace()` returns formatted string
- ✅ `getScopeTraceData()` returns raw trace object
- ✅ `getFilterBreakdown()` returns filter evaluations
- ✅ `getFilterBreakdown(entityId)` filters by entity

### RuntimeContext (ModActionTestFixture.registerCustomScope)
- ✅ Tracer accessible via `runtimeCtx.tracer` in registerCustomScope
- ✅ Tracer passed to ScopeEngine when resolving custom scopes
- ✅ Note documented about scopeResolverHelpers.js integration

### Cleanup (BaseModTestFixture)
- ✅ Tracer cleared on cleanup
- ✅ Tracer disabled on cleanup
- ✅ No memory leaks from tracer instances

## Testing Requirements

**Test File**: `tests/unit/common/mods/ModTestFixture.tracer.test.js` (new)

**Test Strategy**: Test the tracer functionality through `ModActionTestFixture` instances (which inherit from `BaseModTestFixture`). This ensures the tracer works in realistic usage scenarios.

### Test Cases

```javascript
describe('ModTestFixture - Scope Tracer Integration', () => {
  let fixture;

  beforeEach(async () => {
    // Use ModTestFixture.forAction factory which returns ModActionTestFixture instance
    fixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Tracer initialization (BaseModTestFixture)', () => {
    it('should create tracer instance in constructor');
    it('should start with tracer disabled');
    it('should be accessible on ModActionTestFixture instances');
    it('should be accessible on ModRuleTestFixture instances');
    it('should be accessible on ModCategoryTestFixture instances');
  });

  describe('Control methods (BaseModTestFixture)', () => {
    it('should enable tracing via enableScopeTracing()');
    it('should disable tracing via disableScopeTracing()');
    it('should clear trace data via clearScopeTrace()');
    it('should conditionally enable via enableScopeTracingIf()');
  });

  describe('Data access methods (BaseModTestFixture)', () => {
    it('should get formatted trace via getScopeTrace()');
    it('should get raw trace data via getScopeTraceData()');
    it('should get all filter evaluations via getFilterBreakdown()');
    it('should get filter evaluation by entity ID via getFilterBreakdown(entityId)');
    it('should return empty array when no filters recorded');
  });

  describe('RuntimeContext integration (registerCustomScope)', () => {
    it('should expose tracer in runtimeCtx when using registerCustomScope');
    it('should pass tracer to ScopeEngine during custom scope resolution');
    it('should use the same tracer instance across multiple scope resolutions');
  });

  describe('Cleanup (BaseModTestFixture)', () => {
    it('should clear tracer on cleanup()');
    it('should disable tracer on cleanup()');
    it('should not throw if tracer is null');
    it('should prevent memory leaks from accumulated trace data');
  });

  describe('Usage patterns', () => {
    it('should support enable → execute → get trace workflow');
    it('should support clear between multiple test runs');
    it('should support conditional tracing based on test results');
    it('should work with custom scope registration');
  });

  describe('Inheritance verification', () => {
    it('should inherit tracer in ModActionTestFixture');
    it('should inherit tracer in ModRuleTestFixture');
    it('should inherit tracer in ModCategoryTestFixture');
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
- **None** - Only adds new optional methods to `BaseModTestFixture`

### Backward Compatibility
- ✅ All existing tests continue to work without changes
- ✅ All fixture types (ModActionTestFixture, ModRuleTestFixture, ModCategoryTestFixture) automatically inherit tracer methods
- ✅ Tracer is disabled by default (no performance impact)
- ✅ Existing `cleanup()` behavior preserved
- ✅ No changes required to existing test files

### Implementation Notes
- Adding property to `BaseModTestFixture` constructor is safe (no conflicts with existing properties)
- New methods use unique names (no collision with existing methods)
- Tracer only activates when explicitly enabled via `enableScopeTracing()`

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
