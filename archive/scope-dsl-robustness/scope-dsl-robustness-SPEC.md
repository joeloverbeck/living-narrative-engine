# Scope DSL Robustness Specification

## Document Overview

This specification defines improvements to make the scope DSL entity cache and condition evaluation systems more robust with fail-fast error handling. The goal is to prevent silent failures that cause difficult-to-debug test isolation issues.

**Analysis Trigger:** Integration tests for `place_yourself_behind` action with facing state filtering. Test 4 passed in isolation but failed when run with other tests due to module-level entity cache staleness.

**Related Test Files:**
- `tests/integration/mods/maneuvering/place_yourself_behind_facing_away_filter.test.js`
- `tests/integration/mods/grabbing/grab_neck_target_action_discovery.test.js`

**Production Files Analyzed:**
- `src/scopeDsl/core/entityHelpers.js` - Entity cache and evaluation context
- `src/scopeDsl/nodes/filterResolver.js` - Filter evaluation with JSON Logic
- `src/logic/jsonLogicEvaluationService.js` - Condition reference resolution
- `tests/common/engine/systemLogicTestEnv.js` - Test cleanup utilities
- `tests/common/mods/ModTestFixture.js` - Mod test fixture cleanup chain

---

## Section 1: Context

### 1.1 Module Locations and Responsibilities

#### Entity Cache System (`src/scopeDsl/core/entityHelpers.js`)

**Purpose:** Provides a module-level cache for entity data to optimize scope resolution performance by avoiding repeated `entityManager.getEntity()` calls.

**Key Exports:**
- `createEvaluationContext(actorId, entityManager, location, logger)` - Creates JSON Logic evaluation context
- `clearEntityCache()` - Clears the module-level cache (critical for test isolation)
- `invalidateEntityCache(entityId)` - Removes single entity from cache
- `setupEntityCacheInvalidation(eventBus, entityManager)` - Connects cache to EventBus for automatic invalidation

**Cache Characteristics:**
- Module-level `Map` with 10,000 entry limit (LRU eviction)
- Keyed by entity ID
- Contains full component data for entities
- Persists across test runs unless explicitly cleared

#### Filter Resolution (`src/scopeDsl/nodes/filterResolver.js`)

**Purpose:** Evaluates JSON Logic filter expressions against entities during scope resolution.

**Critical Code Path (lines 280-327):**
```javascript
// Simplified representation of the problematic pattern
try {
  const result = jsonLogic.apply(filter, context);
  return result;
} catch (err) {
  if (err instanceof ConditionRefResolutionError) {
    throw err; // Re-throw condition_ref errors
  }
  // OTHER ERRORS ARE SILENTLY SWALLOWED - items pass filter incorrectly
  return false;
}
```

#### Condition Reference Resolution (`src/logic/jsonLogicEvaluationService.js`)

**Purpose:** Resolves `condition_ref` strings in JSON Logic expressions to actual condition definitions loaded from mod data.

**Critical Code Path (lines 314-326):**
```javascript
// Simplified representation of fallback pattern
#resolveRule(conditionRef) {
  const condition = this.#conditionRegistry.get(conditionRef);
  if (!condition) {
    // SILENT FALLBACK - missing condition becomes "always false"
    return { '==': [true, false] };
  }
  return condition.logic;
}
```

### 1.2 Data Flow Diagram

```
Action Discovery Pipeline
         │
         ▼
┌─────────────────────────┐
│   Scope Resolution      │
│   (scopeDsl/engine.js)  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Filter Resolver       │────▶│   Entity Cache          │
│   (filterResolver.js)   │     │   (entityHelpers.js)    │
└───────────┬─────────────┘     └─────────────────────────┘
            │                              ▲
            ▼                              │
┌─────────────────────────┐                │
│   JSON Logic Evaluation │     EventBus invalidation
│   (jsonLogicEvalSvc.js) │                │
└───────────┬─────────────┘                │
            │                              │
            ▼                              │
┌─────────────────────────┐     ┌─────────────────────────┐
│   Condition Registry    │     │   Entity Manager        │
│   (conditionResolver)   │     │   (entityManager.js)    │
└─────────────────────────┘     └─────────────────────────┘
```

---

## Section 2: Problem Analysis

### 2.1 Issue 1: Silent Filter Errors (HIGH RISK)

**Location:** `src/scopeDsl/nodes/filterResolver.js` (lines 280-327)

**Symptoms:**
- Entity incorrectly included/excluded from scope results
- No error logged or thrown
- Debugging requires deep knowledge of filter resolution internals

**Root Cause:** The catch block only re-throws `ConditionRefResolutionError`. All other exceptions (TypeError, ReferenceError, undefined property access) are caught and silently discarded, causing the filter to return `false`.

**Impact:**
- **Data Corruption**: Entities pass/fail filters for wrong reasons
- **Silent Logic Bypass**: Business rules not enforced
- **Debugging Nightmare**: No indication that an error occurred

**Example Scenario:**
```javascript
// Filter expects entity.components['core:position'].locationId
// But entity has malformed data: entity.components['core:position'] = null

// Expected: Throw error "Cannot read property 'locationId' of null"
// Actual: Filter silently returns false, entity excluded without explanation
```

### 2.2 Issue 2: Fallback to Always-False (HIGH RISK)

**Location:** `src/logic/jsonLogicEvaluationService.js` (lines 314-326)

**Symptoms:**
- Prerequisites not enforced
- Actions available when they shouldn't be (or vice versa)
- No indication that condition definition is missing

**Root Cause:** When a `condition_ref` cannot be resolved, the method returns `{ '==': [true, false] }` which always evaluates to `false`. This silently bypasses the intended logic.

**Impact:**
- **Logic Bypass**: Intended conditions never evaluated
- **Configuration Errors Hidden**: Missing condition definitions not reported
- **Inconsistent Behavior**: Same action works/fails depending on condition presence

**Example Scenario:**
```javascript
// Action requires: { "condition_ref": "facing-states:entity-not-facing-away-from-actor" }
// But condition file is missing or has typo: "facing:entity-not-facing-away-from-actor"

// Expected: Throw "Condition 'facing-states:entity-not-facing-away-from-actor' not found"
// Actual: Condition evaluates to false, action blocked without explanation
```

### 2.3 Issue 3: Cache Staleness Without Detection

**Location:** `src/scopeDsl/core/entityHelpers.js`

**Symptoms:**
- Test passes in isolation but fails with other tests
- Entity data reflects previous test's state
- Intermittent failures depending on test execution order

**Root Cause:** Module-level `entityCache` persists between tests unless explicitly cleared. If `clearEntityCache()` is not called during cleanup, stale entity data from previous tests affects subsequent tests.

**Impact:**
- **Test Flakiness**: Results depend on execution order
- **False Positives/Negatives**: Tests pass/fail based on cached data, not actual behavior
- **Debugging Difficulty**: Issue only manifests in specific test combinations

**Evidence from Original Bug:**
```
Test 4: "should NOT discover action when actor is facing away from target"
- PASSED in isolation
- FAILED when run after tests that modified entity components
- Root cause: entityCache contained stale facing_away data from previous tests
```

### 2.4 Issue 4: Fragile Cleanup Chain

**Location:** `tests/common/mods/ModTestFixture.js` (lines 1655-1667)

**Symptoms:**
- If early cleanup step throws, later steps (including cache clear) are skipped
- Cascading test failures in subsequent test files
- Hard to trace back to original failure

**Root Cause:** Cleanup operations are executed sequentially without try-catch protection. An exception in any step prevents subsequent cleanup steps from running.

**Current Pattern (Problematic):**
```javascript
cleanup() {
  this.entityManager.clear();      // If this throws...
  this.eventBus.clear();           // ...these are skipped
  this.scopeResolver.clear();
  clearEntityCache();              // Cache never cleared!
}
```

**Impact:**
- **Cascading Failures**: One cleanup failure affects all subsequent tests
- **Resource Leaks**: Incomplete cleanup leaves system in inconsistent state
- **Hidden Root Cause**: Original failure masked by subsequent failures

---

## Section 3: Truth Sources

### 3.1 Existing Documentation

| Document | Relevance |
|----------|-----------|
| `CLAUDE.md` - Error Handling Pattern | "Never log errors directly - dispatch events" |
| `CLAUDE.md` - Testing Requirements | "Test coverage: 80% branches, 90% functions/lines" |
| `docs/testing/mod-testing-guide.md` | ModTestFixture usage patterns |

### 3.2 Domain Rules from CLAUDE.md

1. **Fail Fast on Critical Errors**
   > "Be defensive - validate dependencies"
   > "Fail fast on critical errors"

2. **Event-Based Error Reporting**
   > "NEVER log errors directly - dispatch events"
   > Use `SYSTEM_ERROR_OCCURRED` event type

3. **Domain-Specific Errors**
   > "Use domain-specific errors not generic ones"
   > Reference: `src/errors/*.js`

### 3.3 External Contracts

- **JSON Logic Specification**: [jsonlogic.com](https://jsonlogic.com/)
- **ECS Pattern**: Entities are ID references, components are data, systems process via rules

---

## Section 4: Desired Behavior

### 4.1 Normal Cases

#### Cache Hit Path
1. Scope resolution requests entity data
2. `createEvaluationContext()` checks cache
3. Entity found in cache, no EntityManager call
4. Returns cached context for JSON Logic evaluation

#### Cache Miss Path
1. Scope resolution requests entity data
2. Cache miss detected
3. `entityManager.getEntity()` called
4. Result stored in cache (with LRU eviction if at limit)
5. Returns fresh context for JSON Logic evaluation

#### Cache Invalidation Path
1. EntityManager modifies entity (add/remove component)
2. EventBus dispatches `COMPONENT_ADDED` or `COMPONENT_REMOVED`
3. `invalidateEntityCache(entityId)` removes entry
4. Next access triggers cache miss, gets fresh data

### 4.2 Edge Cases

#### EventBus Not Connected
- **Scenario:** Cache used without `setupEntityCacheInvalidation()` call
- **Current Behavior:** Cache never invalidates, grows stale
- **Desired Behavior:** Log warning on first cache hit, include in diagnostics

#### Concurrent Component Mutations
- **Scenario:** Entity modified during scope resolution
- **Current Behavior:** Race condition, inconsistent results
- **Desired Behavior:** Accept eventual consistency within single resolution cycle

#### Entity Deleted During Evaluation
- **Scenario:** Entity removed from EntityManager during filter evaluation
- **Current Behavior:** Undefined - may throw, may return stale data
- **Desired Behavior:** Return `null` from cache, filter handles gracefully

#### Condition Reference Typo
- **Scenario:** `condition_ref` has typo: `"facing:entity-..."` vs `"facing-states:entity-..."`
- **Current Behavior:** Silently evaluates to false
- **Desired Behavior:** Throw `ConditionResolutionError` with suggestion for similar conditions

### 4.3 Failure Modes

#### Error Code Definitions

| Code | Name | Trigger | Action |
|------|------|---------|--------|
| `SCOPE_5001` | `FilterEvaluationError` | Non-condition_ref error in filter | Throw with entity ID, filter logic, original error |
| `SCOPE_3001` | `ConditionResolutionError` | Missing condition_ref | Throw with ref name, available conditions, suggestions |
| `SCOPE_4001` | `CacheStalenessWarning` | Cache accessed without EventBus setup | Log warning, return data |
| `SCOPE_4002` | `CacheValidationError` | Cache validation API detects stale entry | Return diagnostic info |

#### Error Message Templates

**SCOPE_5001 - FilterEvaluationError:**
```
Filter evaluation failed for entity '{entityId}' in scope '{scopeId}'.
Filter: {JSON.stringify(filterLogic)}
Original error: {originalError.message}
Context: {JSON.stringify(contextSummary)}
```

**SCOPE_3001 - ConditionResolutionError:**
```
Condition reference '{conditionRef}' not found.
Available conditions: {availableConditions.slice(0, 5).join(', ')}...
Did you mean: {suggestions.join(', ')}
```

---

## Section 5: Invariants

These properties MUST always hold:

### Cache Invariants

1. **INV-CACHE-1: Cache Consistency**
   If an entity exists in cache, its data matches EntityManager at time of caching (eventual consistency acceptable within same resolution cycle).

2. **INV-CACHE-2: Cache Bounded**
   Cache size never exceeds 10,000 entries. LRU eviction maintains bound.

3. **INV-CACHE-3: Invalidation Completeness**
   When `clearEntityCache()` is called, all entries are removed. `size === 0` after call.

4. **INV-CACHE-4: Test Isolation**
   Each test starts with empty cache. `clearEntityCache()` is called in cleanup.

### Evaluation Invariants

5. **INV-EVAL-1: No Silent Failures**
   All errors during filter evaluation are either:
   - Re-thrown as domain-specific errors, OR
   - Logged with full context before returning default

6. **INV-EVAL-2: Condition Reference Transparency**
   Every condition_ref evaluation produces one of:
   - Resolved condition logic
   - Thrown `ConditionResolutionError` with actionable message

7. **INV-EVAL-3: Deterministic Results**
   Same inputs (entity state, filter logic) produce same outputs (filtered entities).

### Cleanup Invariants

8. **INV-CLEAN-1: Cleanup Completeness**
   All cleanup steps execute regardless of previous step failures.

9. **INV-CLEAN-2: Error Aggregation**
   Multiple cleanup failures are aggregated and reported together.

10. **INV-CLEAN-3: Cache Clear Last**
   Entity cache clear is guaranteed to execute (try-finally pattern).

---

## Section 6: API Contracts

### 6.1 Stable APIs (MUST NOT CHANGE)

These APIs are used across the codebase and must maintain backward compatibility:

```javascript
// entityHelpers.js - Stable exports
function createEvaluationContext(actorId, entityManager, location, logger): object
function clearEntityCache(): void
function invalidateEntityCache(entityId: string): boolean
function setupEntityCacheInvalidation(eventBus, entityManager): void

// filterResolver.js - Stable interface
class FilterResolver {
  resolve(entities: string[], filter: object, context: object): string[]
}

// jsonLogicEvaluationService.js - Stable interface
class JsonLogicEvaluationService {
  apply(logic: object, data: object): any
}
```

### 6.2 Extensible APIs (MAY CHANGE WITH DEPRECATION)

These APIs may be extended with new optional parameters:

```javascript
// entityHelpers.js - Extensible
function createEvaluationContext(
  actorId,
  entityManager,
  location,
  logger,
  options?: { validateCache?: boolean, includeMetadata?: boolean }
): object

// filterResolver.js - Extensible
class FilterResolver {
  resolve(
    entities: string[],
    filter: object,
    context: object,
    options?: { throwOnError?: boolean, collectDiagnostics?: boolean }
  ): string[]
}
```

### 6.3 New APIs to Add

```javascript
// entityHelpers.js - New diagnostic APIs
function getCacheStatistics(): {
  size: number,
  hits: number,
  misses: number,
  evictions: number,
  invalidations: number,
  isEventBusConnected: boolean
}

function validateCacheEntry(entityId: string): {
  cached: boolean,
  stale: boolean, // Compares to EntityManager
  age: number     // Milliseconds since cached
}

function getCacheSnapshot(): Map<string, { data: object, cachedAt: number }>

// errors/scopeErrors.js - New error types
class ScopeResolutionError extends Error {
  code: string
  entityId?: string
  scopeId?: string
  filterLogic?: object
  cause?: Error
}

class ConditionResolutionError extends ScopeResolutionError {
  conditionRef: string
  availableConditions: string[]
  suggestions: string[]
}

class FilterEvaluationError extends ScopeResolutionError {
  filterLogic: object
  entityId: string
  context: object
}
```

---

## Section 7: Testing Plan

### 7.1 Unit Tests to Add/Update

#### entityHelpers.js Tests

| Test | File | Purpose |
|------|------|---------|
| "should warn when cache used without EventBus setup" | `tests/unit/scopeDsl/core/entityHelpers.test.js` | Verify warning logged |
| "should provide accurate cache statistics" | `tests/unit/scopeDsl/core/entityHelpers.test.js` | Test new diagnostics |
| "should detect stale cache entries" | `tests/unit/scopeDsl/core/entityHelpers.test.js` | Test validation API |
| "should clear all entries on clearEntityCache" | `tests/unit/scopeDsl/core/entityHelpers.test.js` | Invariant INV-CACHE-3 |

#### filterResolver.js Tests

| Test | File | Purpose |
|------|------|---------|
| "should throw ScopeResolutionError on non-condition_ref errors" | `tests/unit/scopeDsl/nodes/filterResolver.test.js` | Fail-fast behavior |
| "should include entity ID and filter logic in error" | `tests/unit/scopeDsl/nodes/filterResolver.test.js` | Error context |
| "should chain original error as cause" | `tests/unit/scopeDsl/nodes/filterResolver.test.js` | Error chaining |

#### jsonLogicEvaluationService.js Tests

| Test | File | Purpose |
|------|------|---------|
| "should throw ConditionResolutionError for missing condition_ref" | `tests/unit/logic/jsonLogicEvaluationService.test.js` | Fail-fast behavior |
| "should include available conditions in error" | `tests/unit/logic/jsonLogicEvaluationService.test.js` | Actionable hints |
| "should suggest similar condition names" | `tests/unit/logic/jsonLogicEvaluationService.test.js` | Typo detection |

### 7.2 Integration Tests to Add

| Test | File | Purpose |
|------|------|---------|
| "should maintain test isolation with entity cache" | `tests/integration/scopeDsl/entityCacheIsolation.integration.test.js` | Regression for original bug |
| "should fail fast on missing condition in action discovery" | `tests/integration/actions/conditionRefResolution.integration.test.js` | End-to-end fail-fast |
| "should recover from cleanup failures" | `tests/integration/infrastructure/cleanupRobustness.integration.test.js` | Cleanup chain resilience |

### 7.3 Regression Tests

**Original Bug Regression:**
```javascript
// tests/integration/scopeDsl/entityCacheIsolation.integration.test.js

describe('Entity cache test isolation', () => {
  it('should not leak entity state between tests - Test A', async () => {
    // Setup entity with facing_away component
    const fixture = await ModTestFixture.forAction('maneuvering', 'maneuvering:place_yourself_behind');
    const { actor, target } = fixture.createStandardActorTarget(['Alicia', 'Bobby']);

    actor.components['facing-states:facing_away'] = {
      facing_away_from: [target.id]
    };

    fixture.reset([room, actor, target]);

    // Action should NOT be available
    const actions = fixture.testEnv.getAvailableActions(actor.id);
    expect(actions.map(a => a.id)).not.toContain('maneuvering:place_yourself_behind');

    fixture.cleanup();
  });

  it('should not leak entity state between tests - Test B', async () => {
    // Same entities but WITHOUT facing_away component
    const fixture = await ModTestFixture.forAction('maneuvering', 'maneuvering:place_yourself_behind');
    const { actor, target } = fixture.createStandardActorTarget(['Alicia', 'Bobby']);

    // No facing_away component added

    fixture.reset([room, actor, target]);

    // Action SHOULD be available - no leakage from Test A
    const actions = fixture.testEnv.getAvailableActions(actor.id);
    expect(actions.map(a => a.id)).toContain('maneuvering:place_yourself_behind');

    fixture.cleanup();
  });
});
```

### 7.4 Test Infrastructure Changes

#### ModTestFixture.js Cleanup Update

```javascript
// tests/common/mods/ModTestFixture.js

cleanup() {
  const errors = [];

  // Cleanup steps with individual try-catch
  try {
    this.entityManager?.clear();
  } catch (err) {
    errors.push({ step: 'entityManager.clear', error: err });
  }

  try {
    this.eventBus?.clear();
  } catch (err) {
    errors.push({ step: 'eventBus.clear', error: err });
  }

  try {
    this.scopeResolver?.clear();
  } catch (err) {
    errors.push({ step: 'scopeResolver.clear', error: err });
  }

  // CRITICAL: Cache clear in finally block
  try {
    clearEntityCache();
  } catch (err) {
    errors.push({ step: 'clearEntityCache', error: err });
  }

  // Report aggregated errors
  if (errors.length > 0) {
    const message = errors.map(e => `${e.step}: ${e.error.message}`).join('\n');
    console.error(`Cleanup encountered ${errors.length} error(s):\n${message}`);
  }
}
```

#### systemLogicTestEnv.js Cleanup Update

```javascript
// tests/common/engine/systemLogicTestEnv.js

cleanup() {
  // ... existing cleanup ...

  // ALWAYS clear entity cache, even if other cleanup fails
  try {
    clearEntityCache();
  } finally {
    // Log cache statistics for debugging
    const stats = getCacheStatistics();
    if (stats.size > 0) {
      console.warn(`Cache not empty after clear: ${stats.size} entries remaining`);
    }
  }
}
```

---

## Section 8: Implementation Priority

| Priority | Change | Effort | Impact | Files |
|----------|--------|--------|--------|-------|
| **P0** | Try-catch cleanup chain | Low | Prevents cascading test failures | `ModTestFixture.js`, `systemLogicTestEnv.js` |
| **P0** | Throw on filter evaluation errors | Low | Fixes silent data corruption | `filterResolver.js` |
| **P1** | Throw on condition_ref resolution failure | Medium | Fixes logic bypass | `jsonLogicEvaluationService.js` |
| **P1** | Add cache staleness warning | Medium | Improves debugging | `entityHelpers.js` |
| **P2** | Add cache validation API | Medium | Improves test diagnostics | `entityHelpers.js` |
| **P2** | Add error types | Low | Structured error handling | New: `errors/scopeErrors.js` |

---

## Appendix A: Related Files Quick Reference

| File | Lines | Key Functions/Classes |
|------|-------|----------------------|
| `src/scopeDsl/core/entityHelpers.js` | ~200 | `createEvaluationContext`, `clearEntityCache`, `invalidateEntityCache` |
| `src/scopeDsl/nodes/filterResolver.js` | ~350 | `FilterResolver.resolve()`, catch block at 280-327 |
| `src/logic/jsonLogicEvaluationService.js` | ~400 | `#resolveRule()` at 314-326 |
| `tests/common/mods/ModTestFixture.js` | ~1700 | `cleanup()` at 1655-1667 |
| `tests/common/engine/systemLogicTestEnv.js` | ~300 | cleanup function |

## Appendix B: Example Error Messages

### Before (Current State)
```
# No error message - test simply fails with unexpected result
Expected: ["maneuvering:place_yourself_behind"]
Received: []
```

### After (With Fail-Fast)
```
ScopeResolutionError [SCOPE_5001]: Filter evaluation failed for entity 'actor1' in scope 'maneuvering:actors_in_location_not_facing_away_from_actor'.
Filter: {"and": [{"condition_ref": "facing-states:entity-not-facing-away-from-actor"}]}
Original error: Cannot read property 'facing_away_from' of undefined
Context: {actorId: "actor1", locationId: "room1", entityComponents: ["core:position", "core:actor"]}
```

```
ConditionResolutionError [SCOPE_3001]: Condition reference 'facing:entity-not-facing-away-from-actor' not found.
Available conditions: facing-states:entity-facing-away-from-actor, facing-states:entity-not-facing-away-from-actor, core:entity-at-location...
Did you mean: 'facing-states:entity-not-facing-away-from-actor'?
```
