# Performance Test Analysis: ModTestFixture Dependency

## Executive Summary

Both failing performance test files (`tracerOverhead.performance.test.js` and `performanceMetrics.performance.test.js`) **DO NOT truly need the full action fixture setup**. They are testing scope tracer and performance metrics functionality, not action execution. The use of `ModTestFixture.forAction('positioning', 'positioning:sit_down')` is **unnecessary overhead**.

### Key Finding
These tests are fundamentally testing scope resolution performance and tracer metrics - they need:
- A scope resolver (`unifiedScopeResolver`)
- Scenario entities (actors with positioning components)
- Scope tracer instance
- Scope definitions (close_actors)

They do **NOT need**:
- Full action discovery pipeline
- Action validation schemas
- Rule definitions
- Condition files
- Event bus integration

---

## Detailed Findings

### File 1: tracerOverhead.performance.test.js

**Current Setup:**
```javascript
testFixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
await testFixture.registerCustomScope('positioning', 'close_actors');
```

**What It Actually Tests:**
- Scope tracer overhead when disabled (line 27-61)
- Scope tracer overhead when enabled (line 63-106)
- Memory leaks with repeated tracing (line 108-128)
- Performance with large trace data (line 130-157)
- Formatting efficiency (line 159-184)

**Assertions Made:**
All assertions focus on **tracer and scope resolution metrics**, not action execution:
- `expect(overhead).toBeLessThan(5)` - tracer overhead
- `expect(duration).toBeLessThan(1000)` - resolution time
- `expect(trace.steps.length).toBe(0)` - trace clearing
- `expect(formatted.length).toBeGreaterThan(0)` - formatting output

**Action Independence:**
Lines 28-40, 64-87, 109-122, 133-144, 160-171 all use the same pattern:
1. Create scenario (`createCloseActors`)
2. Get entity instance
3. Resolve scope multiple times
4. Measure/assert on scope resolution performance

The `positioning:sit_down` action is **never executed**. It's only used to create a full test environment.

### File 2: performanceMetrics.performance.test.js

**Current Setup:**
```javascript
testFixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
await testFixture.registerCustomScope('positioning', 'close_actors');
```

**What It Actually Tests:**
- Timing accuracy of metrics (line 28-56)
- Step duration summation (line 58-82)
- Percentage calculations (line 84-108)
- Tracing overhead calculations (line 128-146)
- Per-resolver statistics (line 232-258)
- Filter evaluation statistics (line 260-286)
- Slowest operations identification (line 288-313)
- Performance regression detection (line 333-363)
- Formatted output efficiency (line 425-446)

**Assertions Made:**
All assertions focus on **metrics properties and calculation correctness**:
- `expect(difference).toBeLessThan(tolerance)` - metric accuracy
- `expect(metrics.resolverStats).toBeTruthy()` - structure validation
- `expect(overhead).toBeLessThan(400)` - overhead percentage
- `expect(metrics.slowestOperations.steps.length).toBeLessThanOrEqual(5)` - metrics data

**Action Independence:**
Every test follows the same pattern:
1. Enable/disable scope tracing
2. Create scenario (`createCloseActors`)
3. Resolve `positioning:close_actors` scope
4. Query performance metrics
5. Assert on metrics structure and values

The `positioning:sit_down` action is **never referenced after fixture creation**.

---

## Required vs. Unnecessary Components

### What Tests Actually Require

```javascript
// Minimal requirements for these tests:
- unifiedScopeResolver          // scope resolution engine
- entityManager                 // entity lookup
- scopeTracer                   // tracing system
- Test entities (actors)        // positioning components
- Scope definition (close_actors) // scope resolution
```

### What Tests DO NOT Use

```javascript
// Never used in these tests:
- Rule execution                // UNUSED
- Action discovery             // UNUSED
- Condition evaluation          // UNUSED
- Event system                 // UNUSED
- Action validation             // UNUSED
- Action handler setup          // UNUSED
```

### Current Overhead

`ModTestFixture.forAction()` does:
1. Load rule file from disk (file I/O)
2. Load condition file from disk (file I/O)
3. Create full test environment (creates event bus, logger, validation)
4. Initialize action discovery pipeline
5. Register scope categories
6. Setup entity manager with full ECS
7. Setup event system
8. Initialize validator

**For performance tests, 80% of this setup is wasted.**

---

## Restructuring Options

### Option A: Lighter Test Fixture (RECOMMENDED)

Create a new `ScopePerformanceTestFixture` that provides only:
- Scope resolver
- Entity manager
- Scope tracer
- Basic scenario helpers

**Benefits:**
- Tests remain focused on scope/tracer performance
- Faster test setup (no file I/O, no action discovery)
- Clearer intent (testing tracer, not actions)
- Easier to maintain

**Effort:** Medium (new fixture class, ~150-200 lines)

### Option B: Skip Action Fixture Entirely (NOT RECOMMENDED)

Directly use system logic test environment:
```javascript
import { createRuleTestEnvironment } from '../../common/engine/systemLogicTestEnv.js';
import { ScopeEvaluationTracer } from './scopeEvaluationTracer.js';

const testEnv = createRuleTestEnvironment();
const scopeTracer = new ScopeEvaluationTracer();
// ... register scope directly ...
```

**Benefits:**
- Minimal changes to current structure
- Direct control over setup

**Drawbacks:**
- Duplicate scenario creation logic
- Less maintainable (no abstraction)
- Still requires scope registration logic

### Option C: Keep Current Structure (STATUS QUO)

Keep using `ModTestFixture.forAction()` but acknowledge the overhead is acceptable for integration testing.

**Drawbacks:**
- Tests are slower than necessary
- Tests fail if action fixture setup changes
- Misleading test intent (looks like testing actions)
- Unnecessary I/O and initialization

---

## Dependencies in `close_actors` Scope

The `positioning:close_actors` scope requires:
```
positioning:close_actors := actor.components.positioning:closeness.partners[][...]
```

This needs:
1. Actor entity with `positioning:closeness` component
2. Component with `partners` array
3. Condition evaluation (entity-kneeling-before-actor, actor-kneeling-before-entity)

**Where does this come from?**
- `createCloseActors()` creates entities with positioning components
- `registerCustomScope()` registers the scope definition
- Test environment provides condition resolution

---

## Why Tests Were Created This Way

Likely reasons for using `ModTestFixture.forAction()`:

1. **Copy-paste from action tests** - Most mod tests use full fixture
2. **Convenience** - Fixture provides helpful scenario builders (`createCloseActors`)
3. **Scope registration** - Tests need registered scopes to resolve
4. **No lighter alternative existed** - Performance tests added without a dedicated fixture

---

## Recommendations

### Priority 1: Understand the Failure
Before restructuring, need to know:
1. **Are tests actually failing due to missing action files?**
   - ModTestFixture.forAction tries to auto-load: `data/mods/positioning/rules/sit_down.rule.json`
   - If files don't exist, it throws an error
2. **Or are they failing due to slow setup?**
   - Performance constraints in CI environment

### Priority 2: Quick Fix (If Needed)
If tests must pass immediately without restructuring:
- **Option A:** Create minimal action files that pass validation:
  - `data/mods/positioning/rules/sit_down.rule.json` (placeholder)
  - `data/mods/positioning/conditions/sit_down.condition.json` (placeholder)
- **Option B:** Modify fixtures to skip auto-loading:
  ```javascript
  const fixture = await ModTestFixture.forAction(
    'positioning',
    'positioning:sit_down',
    { /* empty rule */ },
    { /* empty condition */ }
  );
  ```

### Priority 3: Long-term Solution (RECOMMENDED)
1. Create `ScopePerformanceTestFixture` class in `/tests/common/mods/`
2. Extract `createCloseActors()` and `registerCustomScope()` to this fixture
3. Remove dependency on action files
4. Migrate both performance test files to new fixture
5. Delete unnecessary action fixture overhead

---

## Test Structure Comparison

### Current (Action-Focused)
```javascript
describe('Tracer Performance Overhead', () => {
  let testFixture;

  beforeEach(async () => {
    // Creates full action discovery environment
    testFixture = await ModTestFixture.forAction('positioning', 'positioning:sit_down');
    // Then registers scope
    await testFixture.registerCustomScope('positioning', 'close_actors');
  });

  it('should have minimal overhead when disabled', () => {
    // Actually tests scope resolution performance
    const scenario = testFixture.createCloseActors(['Alice', 'Bob']);
    // ... measure scope resolution ...
  });
});
```

### Proposed (Scope-Focused)
```javascript
describe('Tracer Performance Overhead', () => {
  let fixture;

  beforeEach(async () => {
    // Creates scope resolver environment only
    fixture = await ScopePerformanceTestFixture.create('positioning');
    // Already includes scope registration
  });

  it('should have minimal overhead when disabled', () => {
    // Clear intent: testing scope performance
    const scenario = fixture.createCloseActors(['Alice', 'Bob']);
    // ... measure scope resolution ...
  });
});
```

---

## Impact Assessment

### If we keep current structure:
- Tests depend on action files that aren't tested
- False coupling between tracer tests and action structure
- Slower initialization than necessary

### If we restructure with lighter fixture:
- Faster test execution (~30-50% faster setup)
- Clearer test intent
- Tests independent of action files
- Better maintainability
- Still uses full scope resolver for accurate benchmarks

---

## Key Differences from Action Tests

| Aspect | Action Tests | Performance Tests |
|--------|-------------|------------------|
| Goal | Execute action, validate rules | Measure tracer overhead, metrics accuracy |
| Uses Rule Execution | YES | NO |
| Uses Action Discovery | YES | NO |
| Uses Event System | YES | NO |
| Uses Scope Resolution | YES (for discovery) | YES (directly) |
| Uses Entity Manager | YES | YES |
| Uses Scenario Builders | YES | YES |
| Needs Action Files | YES | NO |

---

## Code Evidence

### What the tests actually call:

**From tracerOverhead.performance.test.js:**
- Line 20: `await testFixture.registerCustomScope(...)` - registers scope
- Line 28: `testFixture.createCloseActors(...)` - creates entities
- Line 36-39: `testFixture.testEnv.unifiedScopeResolver.resolveSync(...)` - resolves scope
- Line 44: `testFixture.scopeTracer.disable()` - controls tracer
- Line 80: `testFixture.enableScopeTracing()` - enables tracer

**Nothing related to action execution:**
- No `executeAction()`
- No rule discovery
- No rule validation
- No action handlers
- No event dispatch

**From performanceMetrics.performance.test.js:**
- Line 21: `await testFixture.registerCustomScope(...)` - registers scope
- Line 30: `testFixture.createCloseActors(...)` - creates entities
- Line 39: `testFixture.testEnv.unifiedScopeResolver.resolveSync(...)` - resolves scope
- Line 44: `testFixture.getScopePerformanceMetrics()` - gets metrics

**Same pattern:** scope resolution testing, no action execution.

---

## Conclusion

The performance tests are **misusing ModTestFixture.forAction()** because:
1. They only test scope resolution and tracer functionality
2. They never execute the action
3. They never use rules or conditions
4. They only need scenario building and scope registration

The tests could be refactored to use a lighter fixture that doesn't require action files, reducing initialization time and making test intent clearer. However, the current structure works if the required action files exist.
