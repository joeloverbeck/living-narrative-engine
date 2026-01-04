# Test Infrastructure Robustness Specification

**Status**: ✅ ARCHIVED - All tickets completed

**Completion Date**: 2026-01-04

**Related Tickets**:
- TESINFROB-001: Strict Property Proxy (COMPLETED)
- TESINFROB-002: API Documentation (COMPLETED)
- TESINFROB-003: mockScope() Helper (COMPLETED)
- TESINFROB-004: registerCondition() API (COMPLETED)
- TESINFROB-005: Early Validation (COMPLETED)
- TESINFROB-006: Migration Guide (COMPLETED)

---

## Context

**Location**: `tests/common/` directory
- `tests/common/engine/systemLogicTestEnv.js` - Creates test environments with engine services
- `tests/common/mods/ModTestFixture.js` - Factory for mod-specific test fixtures

**Purpose**: Provides `testEnv` objects for mod integration testing with access to engine services like entity management, event bus, scope resolution, and rule execution.

**Related Files**:
- `tests/common/mods/scopeResolverHelpers.js` - Scope resolver wrapper patterns
- `tests/common/strictObjectProxy.js` - Existing fail-fast proxy pattern
- `src/scopeDsl/errors/scopeResolutionError.js` - Rich error context patterns
- `src/utils/conditionSuggestionService.js` - Suggestion algorithm implementation

---

## Problem

### Error Encountered
```
TypeError: Cannot read properties of undefined (reading 'resolve')
    at fixture.testEnv.scopeResolver.resolve()
```

### Root Cause
The property `scopeResolver` **does not exist** on `testEnv`. The correct property name is `unifiedScopeResolver`.

```javascript
// ❌ Wrong - property doesn't exist
fixture.testEnv.scopeResolver.resolve(...)

// ✅ Correct - actual property name
fixture.testEnv.unifiedScopeResolver.resolveSync(...)
```

### Why This Was Hard to Debug

1. **Silent `undefined` Returns**: JavaScript silently returns `undefined` for missing object properties instead of throwing an error. This causes the real error to appear at `.resolve()` rather than at `.scopeResolver`.

2. **Complex Mocking Patterns**: Scope mocking requires 10-15 lines of boilerplate code:
   ```javascript
   const originalResolve = testEnv.unifiedScopeResolver.resolveSync;
   testEnv.unifiedScopeResolver.__originalResolve = originalResolve;
   testEnv.unifiedScopeResolver.resolveSync = function(scopeName, context) {
     if (scopeName === 'my:scope') {
       return new Set([entity.id]);
     }
     return originalResolve.call(this, scopeName, context);
   };
   ```

3. **Private API Access**: Tests access internal property `testEnv._loadedConditions` for condition mocking, which is undocumented and fragile.

4. **Undocumented API Surface**: No JSDoc or documentation lists available `testEnv` properties, making it easy to guess wrong names.

### Linked Tests
- `tests/integration/mods/striking/striking_facing_away_filter.test.js`
- All tests using manual scope resolver mocking

---

## Truth Sources

### 1. strictObjectProxy.js (Existing Pattern)
**Location**: `tests/common/strictObjectProxy.js`

Provides `createStrictProxy()` function that throws descriptive errors when accessing undefined properties:
```javascript
const proxy = createStrictProxy(target, {
  allowedUndefined: ['toJSON', '$$typeof'], // Jest internals
  suggestionAlgorithm: levenshteinSuggestion
});
```

### 2. ScopeResolutionError (Rich Error Context)
**Location**: `src/scopeDsl/errors/scopeResolutionError.js`

Demonstrates rich error context pattern with:
- Primary error message
- Hints array with helpful context
- Suggestions for fixes
- Example code snippets
- Stack of resolution context

### 3. conditionSuggestionService (Suggestion Algorithm)
**Location**: `src/utils/conditionSuggestionService.js`

Provides namespace-aware Levenshtein distance matching for "did you mean?" suggestions:
```javascript
getSuggestions('anatomy:actor-has-free-appendage', availableConditions)
// Returns: ['anatomy:actor-has-free-grabbing-appendage']
```

---

## Desired Behavior

### Normal Cases

1. **Property Access Returns Value If Exists**
   ```javascript
   const resolver = testEnv.unifiedScopeResolver; // ✅ Returns resolver
   const bus = testEnv.eventBus; // ✅ Returns event bus
   ```

2. **Throws Descriptive Error If Property Missing**
   ```javascript
   const resolver = testEnv.scopeResolver;
   // ❌ Throws: TestEnvPropertyError (see Failure Modes)
   ```

3. **Simplified Scope Mocking**
   ```javascript
   // New API - 2 lines instead of 10+
   fixture.mockScope('my:scope', () => new Set([actor.id]));
   fixture.mockScope('other:scope', new Set([target.id])); // Result shorthand
   ```

4. **Public Condition Registration API**
   ```javascript
   // New API - replaces private _loadedConditions access
   fixture.registerCondition('my:condition', {
     logic: { '==': [{ var: 'entity.type' }, 'actor'] }
   });
   ```

### Edge Cases

1. **Jest Internals Pass Through**
   - Properties like `toJSON`, `$$typeof`, `asymmetricMatch` must not throw
   - Symbol properties work normally (Jest matchers use these)

2. **Chained Mocks Compose Correctly**
   ```javascript
   fixture.mockScope('scope:a', () => new Set([actor.id]));
   fixture.mockScope('scope:b', () => new Set([target.id]));
   // Both mocks active simultaneously
   ```

3. **Cleanup on Reset**
   ```javascript
   fixture.cleanup(); // Restores all original implementations
   // OR
   fixture.clearScopeMocks(); // Clears only scope mocks
   ```

4. **Partial Name Matches in Suggestions**
   - `scopeResolver` suggests `unifiedScopeResolver`
   - `entityMgr` suggests `entityManager`
   - `evtBus` suggests `eventBus`

### Failure Modes

#### TestEnvPropertyError Format
```
TestEnvPropertyError: Property 'scopeResolver' does not exist on testEnv.

Available properties:
  - eventBus
  - events
  - operationRegistry
  - operationInterpreter
  - jsonLogic
  - systemLogicInterpreter
  - entityManager
  - actionIndex
  - unifiedScopeResolver
  - prerequisiteService
  - dataRegistry
  - logger

Did you mean: 'unifiedScopeResolver'?

Hint: Common property name confusion:
  - scopeResolver → unifiedScopeResolver
  - resolver → unifiedScopeResolver
  - scopeDsl → unifiedScopeResolver
```

#### Error Properties
```javascript
{
  name: 'TestEnvPropertyError',
  property: 'scopeResolver',
  availableProperties: ['eventBus', 'events', ...],
  suggestions: ['unifiedScopeResolver'],
  hints: ['Common property name confusion: ...']
}
```

---

## Invariants

1. **Fail-Fast Guarantee**: Accessing undefined properties on `testEnv` MUST throw immediately with actionable error message.

2. **No Silent Failures**: All API misuse produces clear, descriptive errors with suggestions.

3. **Backward Compatibility**: All existing tests continue to work unchanged. The proxy only affects undefined property access.

4. **Cleanup Guarantees**: Mocks registered through fixture methods are automatically cleaned up in `fixture.cleanup()` or `afterEach` blocks.

5. **Immutable Core Properties**: Core testEnv properties (`eventBus`, `entityManager`, etc.) cannot be accidentally overwritten through typos.

---

## API Contracts

### testEnv Properties (Stable - DO NOT CHANGE)

| Property | Type | Description |
|----------|------|-------------|
| `eventBus` | EventBus | Central event dispatch |
| `events` | Object | Event tracking/history |
| `operationRegistry` | OperationRegistry | Registered operations |
| `operationInterpreter` | OperationInterpreter | Operation execution |
| `jsonLogic` | JsonLogicService | JSON Logic evaluation |
| `systemLogicInterpreter` | SystemLogicInterpreter | Rule execution |
| `entityManager` | EntityManager | Entity CRUD |
| `actionIndex` | ActionIndex | Action lookup |
| `unifiedScopeResolver` | UnifiedScopeResolver | Scope resolution |
| `prerequisiteService` | PrerequisiteService | Prerequisite evaluation |
| `dataRegistry` | DataRegistry | Data access |
| `logger` | Logger | Logging interface |

### testEnv Methods (Stable)
- `cleanup()` - Release resources
- `initializeEnv()` - Re-initialize environment
- `validateRule(rule)` - Validate rule JSON

### New Fixture Methods (Can Add)

```typescript
interface ModTestFixture {
  // Existing
  testEnv: TestEnv;
  cleanup(): void;

  // New scope mocking API
  mockScope(
    scopeName: string,
    resolver: ((context: ScopeContext) => Set<string>) | Set<string>
  ): void;
  clearScopeMocks(): void;

  // New condition registration API
  registerCondition(conditionId: string, definition: ConditionDefinition): void;
  clearRegisteredConditions(): void;
}
```

### What Can Change
- Internal implementation of testEnv proxy
- Suggestion algorithm improvements
- Error message wording (not structure)
- Additional helper methods on fixture
- New optional parameters on existing methods

### What Must NOT Change
- testEnv property names
- testEnv method signatures
- Fixture factory method signatures (`forAction`, `forRule`, etc.)
- Return types of existing methods

---

## Implementation Tickets (ALL COMPLETED)

| Ticket ID | Priority | Effort | Description | Status |
|-----------|----------|--------|-------------|--------|
| TESINFROB-001 | High | Small | Wrap testEnv with strict property proxy in systemLogicTestEnv.js | ✅ COMPLETED |
| TESINFROB-002 | High | Small | Document testEnv API with comprehensive JSDoc | ✅ COMPLETED |
| TESINFROB-003 | Medium | Medium | Add `mockScope()` helper method to ModTestFixture | ✅ COMPLETED |
| TESINFROB-004 | Medium | Medium | Add `registerCondition()` public API to ModTestFixture | ✅ COMPLETED |
| TESINFROB-005 | Low | Small | Add early validation in `ModTestFixture.forAction()` for common issues | ✅ COMPLETED |
| TESINFROB-006 | Low | Medium | Create migration guide and update example test | ✅ COMPLETED |

---

## Files Modified

| File | Modifications |
|------|---------------|
| `tests/common/engine/systemLogicTestEnv.js` | Added strict proxy wrapper, JSDoc documentation |
| `tests/common/mods/ModTestFixture.js` | Added `mockScope()`, `registerCondition()` methods, dual-map registration fix |
| `docs/testing/test-infrastructure-migration.md` | Created - Migration guide |
| `docs/testing/mod-testing-guide.md` | Updated with new API documentation |
| `tests/integration/mods/striking/striking_facing_away_filter.test.js` | Migrated to new APIs |

---

## Archive Notes

This specification has been fully implemented. All six tickets (TESINFROB-001 through TESINFROB-006) have been completed. The test infrastructure now provides:

1. **Fail-fast property access** with helpful suggestions for typos
2. **Simplified scope mocking** via `fixture.mockScope()`
3. **Public condition registration** via `fixture.registerCondition()`
4. **Early validation** for common mistakes
5. **Comprehensive documentation** in migration guide and mod-testing-guide

A dual-map bug was discovered and fixed during TESINFROB-006 implementation, ensuring `registerCondition()` works correctly with both the ModTestFixture and ScopeResolverHelpers override mechanisms.
