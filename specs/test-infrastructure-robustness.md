# Test Infrastructure Robustness Specification

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

## Testing Plan

### Tests to Create

#### 1. Strict TestEnv Proxy Tests
**File**: `tests/unit/common/engine/strictTestEnv.test.js`

```javascript
describe('strictTestEnv', () => {
  describe('fail-fast property access', () => {
    it('should throw TestEnvPropertyError for undefined properties', () => {
      const testEnv = createTestEnv();
      expect(() => testEnv.scopeResolver).toThrow(TestEnvPropertyError);
    });

    it('should suggest similar property names', () => {
      const testEnv = createTestEnv();
      try {
        testEnv.scopeResolver;
      } catch (err) {
        expect(err.suggestions).toContain('unifiedScopeResolver');
      }
    });

    it('should allow Jest internal properties', () => {
      const testEnv = createTestEnv();
      expect(() => testEnv.toJSON).not.toThrow();
      expect(() => testEnv.$$typeof).not.toThrow();
    });

    it('should return correct values for existing properties', () => {
      const testEnv = createTestEnv();
      expect(testEnv.eventBus).toBeDefined();
      expect(testEnv.unifiedScopeResolver).toBeDefined();
    });
  });
});
```

#### 2. Scope Mocking Helper Tests
**File**: `tests/unit/common/mods/ModTestFixture.scopeMocking.test.js`

```javascript
describe('ModTestFixture.mockScope()', () => {
  it('should mock scope with resolver function', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');
    fixture.mockScope('test:scope', () => new Set(['entity-1']));

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {});
    expect(result).toEqual(new Set(['entity-1']));
  });

  it('should mock scope with result Set shorthand', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');
    fixture.mockScope('test:scope', new Set(['entity-1']));

    const result = fixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {});
    expect(result).toEqual(new Set(['entity-1']));
  });

  it('should allow multiple scope mocks', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');
    fixture.mockScope('scope:a', new Set(['a']));
    fixture.mockScope('scope:b', new Set(['b']));

    expect(fixture.testEnv.unifiedScopeResolver.resolveSync('scope:a', {})).toEqual(new Set(['a']));
    expect(fixture.testEnv.unifiedScopeResolver.resolveSync('scope:b', {})).toEqual(new Set(['b']));
  });

  it('should clean up mocks on fixture.cleanup()', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');
    fixture.mockScope('test:scope', new Set(['mocked']));
    fixture.cleanup();

    // After cleanup, original resolver behavior restored
    expect(() => fixture.testEnv.unifiedScopeResolver.resolveSync('test:scope', {}))
      .toThrow(); // Or return empty set, depending on original behavior
  });
});
```

#### 3. Condition Registration Tests
**File**: `tests/unit/common/mods/ModTestFixture.conditionRegistration.test.js`

```javascript
describe('ModTestFixture.registerCondition()', () => {
  it('should register condition for use in rules', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');
    fixture.registerCondition('test:is-valid', {
      logic: { '==': [1, 1] }
    });

    const result = fixture.testEnv.jsonLogic.evaluate(
      { condition_ref: 'test:is-valid' },
      {}
    );
    expect(result).toBe(true);
  });

  it('should clean up registered conditions on cleanup()', async () => {
    const fixture = await ModTestFixture.forAction('test', 'test:action');
    fixture.registerCondition('test:temp-condition', { logic: { '==': [1, 1] } });
    fixture.cleanup();

    // After cleanup, condition should not be available
    expect(() => fixture.testEnv.jsonLogic.evaluate(
      { condition_ref: 'test:temp-condition' },
      {}
    )).toThrow();
  });
});
```

### Tests to Update

**File**: `tests/integration/mods/striking/striking_facing_away_filter.test.js`

Migrate from manual scope mocking:
```javascript
// Before (10+ lines)
const originalResolve = testEnv.unifiedScopeResolver.resolveSync;
testEnv.unifiedScopeResolver.__originalResolve = originalResolve;
testEnv.unifiedScopeResolver.resolveSync = function(scopeName, context) {
  if (scopeName === 'striking:actors_in_location_not_facing_away') {
    return new Set([target.id]);
  }
  return originalResolve.call(this, scopeName, context);
};

// After (1-2 lines)
fixture.mockScope('striking:actors_in_location_not_facing_away', new Set([target.id]));
```

### Regression Tests

1. **Existing Test Suite**: All 200+ tests using `testEnv.unifiedScopeResolver` must pass unchanged
2. **Manual Mock Pattern**: Tests using `__originalResolve` pattern must continue working
3. **Private API Access**: Tests using `testEnv._loadedConditions` work (deprecated but functional)

---

## Implementation Tickets

| Ticket ID | Priority | Effort | Description |
|-----------|----------|--------|-------------|
| TESTINFRA-001 | High | Small | Wrap testEnv with strict property proxy in systemLogicTestEnv.js |
| TESTINFRA-002 | High | Small | Document testEnv API with comprehensive JSDoc |
| TESTINFRA-003 | Medium | Medium | Add `mockScope()` helper method to ModTestFixture |
| TESTINFRA-004 | Medium | Medium | Add `registerCondition()` public API to ModTestFixture |
| TESTINFRA-005 | Low | Small | Add early validation in `ModTestFixture.forAction()` for common issues |
| TESTINFRA-006 | Low | Large | Create migration guide and gradually update existing tests |

### Ticket Details

#### TESTINFRA-001: Strict Property Proxy
- Modify `systemLogicTestEnv.js` to wrap returned testEnv in strict proxy
- Use existing `strictObjectProxy.js` pattern
- Configure Jest internal properties as allowed undefined
- Add suggestion generation using Levenshtein distance

#### TESTINFRA-002: API Documentation
- Add comprehensive JSDoc to systemLogicTestEnv.js
- Document all testEnv properties with types and descriptions
- Add @example annotations for common usage patterns
- Generate TypeScript declaration file for IDE support

#### TESTINFRA-003: mockScope() Helper
- Add method to ModTestFixture class
- Store original resolver and active mocks
- Support both function and Set shorthand
- Ensure cleanup integration

#### TESTINFRA-004: registerCondition() API
- Replace private `_loadedConditions` access with public API
- Validate condition definition on registration
- Track registered conditions for cleanup
- Log deprecation warning for direct `_loadedConditions` access

#### TESTINFRA-005: Early Validation
- In `ModTestFixture.forAction()`, validate action ID format
- Check mod exists before attempting load
- Provide clear error if mod/action not found
- Suggest similar action IDs on typos

#### TESTINFRA-006: Migration Guide
- Document new API usage patterns
- Create codemod script for automated migration
- Update documentation in `docs/testing/mod-testing-guide.md`
- Gradual deprecation of manual mocking patterns

---

## Files to Modify (Future Tickets)

| File | Modifications |
|------|---------------|
| `tests/common/engine/systemLogicTestEnv.js` | Add strict proxy wrapper, JSDoc documentation |
| `tests/common/mods/ModTestFixture.js` | Add `mockScope()`, `registerCondition()` methods |
| `tests/common/strictObjectProxy.js` | Enhance for testEnv-specific needs if required |
| `docs/testing/mod-testing-guide.md` | Document new patterns, deprecate old ones |

## Reference Patterns

### From strictObjectProxy.js
```javascript
function createStrictProxy(target, options = {}) {
  return new Proxy(target, {
    get(obj, prop) {
      if (prop in obj || options.allowedUndefined?.includes(prop)) {
        return obj[prop];
      }
      throw new PropertyAccessError(prop, Object.keys(obj), options.suggester);
    }
  });
}
```

### From ScopeResolutionError
```javascript
class ScopeResolutionError extends Error {
  constructor(message, { hints = [], suggestions = [], examples = [] } = {}) {
    super(message);
    this.hints = hints;
    this.suggestions = suggestions;
    this.examples = examples;
  }
}
```

### From conditionSuggestionService
```javascript
function getSuggestions(input, candidates, options = { maxDistance: 3, limit: 3 }) {
  return candidates
    .map(c => ({ candidate: c, distance: levenshtein(input, c) }))
    .filter(r => r.distance <= options.maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, options.limit)
    .map(r => r.candidate);
}
```
