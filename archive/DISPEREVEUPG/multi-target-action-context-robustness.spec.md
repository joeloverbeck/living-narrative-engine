# Multi-Target Action Context and Test Infrastructure Robustness Specification

> **Created**: 2025-12-18
> **Ticket**: DISPEREVEUPG-004-social.md
> **Purpose**: Document fixes and establish invariants to prevent similar test failures

## Context

### Where in the Codebase

| File | Purpose |
|------|---------|
| `src/logic/operationHandlers/prepareActionContextHandler.js` | Consolidates action context setup |
| `src/logic/operationHandlers/ifCoLocatedHandler.js` | Conditional operation for co-location checks |
| `src/logic/operationInterpreter.js` | Executes operations via registered handlers |
| `tests/common/mods/ModAssertionHelpers.js` | Test assertion utilities for mod tests |

### What These Modules Do

1. **PrepareActionContextHandler**: Sets up context variables (`actorName`, `targetName`, `locationId`, `perceptionType`) for action rules before perceptible events are dispatched. Uses a three-tier name resolution fallback.

2. **IfCoLocatedHandler**: Conditional branching based on entity co-location via `core:position` component. Executes `then_actions` or `else_actions` based on whether entities share the same `locationId`.

3. **ModAssertionHelpers**: Provides assertion utilities for mod integration tests, including perceptible event validation and field matching.

---

## Problem

### What Failed

1. **"Unknown" target names** in perceptible event descriptions
2. **Jest asymmetric matcher failures** in test assertions
3. **Nested operations not executing** in conditional handlers

### How It Failed

#### Issue 1: PrepareActionContextHandler Multi-Target Gap

- **Symptom**: `"Anna has smoothed Unknown's blouse"` instead of `"Anna has smoothed Ben's blouse"`
- **Test**: `tests/integration/mods/caressing/adjust_clothing_action.test.js`
- **Root Cause**: Handler used only `event.payload.targetId`, but multi-target actions use `primaryId`
- **Fix**: Added fallback `const targetId = event.payload.targetId || event.payload.primaryId`

#### Issue 2: ModAssertionHelpers Matcher Incompatibility

- **Symptom**: Tests using `expect.stringContaining()` failed with confusing matcher errors
- **Root Cause**: Used `.toBe()` which requires strict equality; asymmetric matchers need `.toEqual()`
- **Fix**: Changed to `.toEqual()` and made field checks conditional

#### Issue 3: IfCoLocatedHandler Circular Dependency

- **Symptom**: Nested operations in `then_actions`/`else_actions` didn't execute
- **Root Cause**: Direct operationInterpreter reference caused circular dependency at construction time
- **Fix**: Use lazy resolver pattern `() => operationInterpreter`

### Why It Failed

- **Multi-target pattern not universally applied**: Single-target pattern (`targetId`) predates multi-target pattern (`primaryId`/`secondaryId`)
- **Jest matcher semantics not understood**: `.toBe()` uses `Object.is()` vs `.toEqual()` uses deep equality
- **Circular dependency not detected early**: DI container allows lazy resolution but wasn't used consistently

---

## Truth Sources

### Documentation

- `CLAUDE.md` - Project architecture and patterns
- `docs/testing/mod-testing-guide.md` - Mod testing patterns

### Domain Rules

1. **Multi-target actions** ALWAYS use `primaryId` for the main target
2. **Single-target actions** MAY use `targetId` for backward compatibility
3. **Operation handlers** receiving nested `then_actions`/`else_actions` MUST use lazy resolver pattern

### External Contracts

- Jest asymmetric matchers API: https://jestjs.io/docs/expect#expectanything
- Event payload structure defined in `data/schemas/events/`

---

## Desired Behavior

### Normal Cases

#### PrepareActionContextHandler

1. Extract target ID from `event.payload.targetId` OR `event.payload.primaryId`
2. Resolve entity name via three-tier fallback:
   - `core:name.text` → `core:actor.name` → `core:item.name` → entityId → "Unknown"
3. Set context variables: `actorName`, `targetName`, `locationId`, `targetId`, `perceptionType`
4. Optionally resolve `secondaryName` when `include_secondary: true`

#### IfCoLocatedHandler

1. Resolve entity references to IDs
2. Compare `core:position.locationId` for both entities
3. Execute `then_actions` if same location, `else_actions` otherwise
4. Use lazy resolver `() => operationInterpreter` for nested operation execution

#### ModAssertionHelpers

1. Support both literal values AND Jest asymmetric matchers
2. Use `.toEqual()` for all value comparisons
3. Make field presence checks conditional on field being defined

### Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| `targetId` missing, `primaryId` present | Use `primaryId` |
| Both `targetId` and `primaryId` present | Prefer `targetId` (backward compat) |
| Neither ID present | Return "Unknown" |
| Entity has no name components | Return entityId as name |
| Empty entityId | Return "Unknown" |
| Nested operations throw | Log error, continue with safe dispatch |

### Failure Modes

| Condition | Error/Return |
|-----------|--------------|
| No event payload | Log warning, return context unchanged |
| Missing entity_ref_a/b | Dispatch error via safeDispatchError |
| Entity ID resolution fails | Log debug, return early (no-op) |
| Position component missing | Treat as not co-located |

### Invariants

1. **PrepareActionContextHandler MUST resolve target name** from either `targetId` or `primaryId`
2. **Name resolution MUST follow fallback chain** and never return undefined
3. **Lazy resolver pattern MUST be used** for any handler with nested operations
4. **Test assertions MUST use `.toEqual()`** for value comparisons supporting matchers

### API Contracts (Stable)

```javascript
// PrepareActionContextHandler - Input payload patterns
interface SingleTargetPayload {
  actorId: string;
  targetId: string;    // Single-target pattern
}

interface MultiTargetPayload {
  actorId: string;
  primaryId: string;   // Multi-target pattern
  secondaryId?: string;
}

// Both patterns MUST be supported
```

```javascript
// IfCoLocatedHandler - Constructor dependency
constructor({
  operationInterpreter, // MUST accept both:
                        // 1. () => OperationInterpreter (lazy resolver)
                        // 2. OperationInterpreter instance (auto-wrapped)
})
```

### What Is Allowed to Change

1. **Additional payload fields** - New fields can be added to payloads
2. **New name resolution sources** - Additional component types for name lookup
3. **Additional context variables** - New variables can be added to context
4. **Handler implementation details** - Internal logic as long as contracts hold

---

## Testing Plan

### Tests to Update/Add

#### Unit Tests (Required)

1. **`tests/unit/logic/operationHandlers/prepareActionContextHandler.test.js`**
   - [ ] Test with `targetId` only (single-target)
   - [ ] Test with `primaryId` only (multi-target)
   - [ ] Test with both `targetId` and `primaryId` (prefer `targetId`)
   - [ ] Test with neither (returns "Unknown")
   - [ ] Test name resolution fallback chain
   - [ ] Test with `include_secondary: true`

2. **`tests/unit/logic/operationHandlers/ifCoLocatedHandler.test.js`**
   - [ ] Test lazy resolver pattern
   - [ ] Test direct instance pattern (auto-wrap)
   - [ ] Test nested operation execution
   - [ ] Test error handling in nested operations

#### Integration Tests (Verified)

- `tests/integration/mods/caressing/adjust_clothing_action.test.js` ✅
- `tests/integration/mods/distress/clutch_onto_upper_clothing_action.test.js` ✅
- `tests/integration/mods/companionship/rules/dismissRule.integration.test.js` ✅
- `tests/integration/mods/companionship/rules/stopFollowingRule.integration.test.js` ✅

### Regression Tests

Add to existing test suites:

```javascript
describe('Multi-target compatibility', () => {
  it('should handle primaryId when targetId is missing', async () => {
    const fixture = await ModTestFixture.forRule('mod', 'rule');
    // Explicitly test primaryId-only payload
    await fixture.executeRuleWithPayload({
      actorId: 'actor:1',
      primaryId: 'target:1', // NOT targetId
    });
    expect(fixture.getPerceptibleEvents()[0].description)
      .toContain('Target Name'); // Not "Unknown"
  });
});
```

### Property Tests (Recommended)

```javascript
describe('Name resolution invariants', () => {
  it.each([
    { payload: { targetId: 'x' }, expected: 'not "Unknown"' },
    { payload: { primaryId: 'x' }, expected: 'not "Unknown"' },
    { payload: {}, expected: '"Unknown"' },
  ])('should resolve name correctly: %p', ({ payload, expected }) => {
    // Property: Name is never undefined
    // Property: At least one ID means resolved name
  });
});
```

---

## Implementation Checklist

When modifying these modules in the future:

- [ ] **PrepareActionContextHandler changes**: Verify both `targetId` and `primaryId` patterns work
- [ ] **New conditional handlers**: Use lazy resolver `() => operationInterpreter`
- [ ] **Test assertions with matchers**: Use `.toEqual()` not `.toBe()`
- [ ] **New name resolution sources**: Add to fallback chain in order
- [ ] **Run all related tests**: `npm run test:integration -- tests/integration/mods/`

---

## Related Files

### Production Code
- `src/logic/operationHandlers/prepareActionContextHandler.js:78` - Multi-target fix location
- `src/logic/operationHandlers/ifCoLocatedHandler.js:80-83` - Lazy resolver normalization
- `src/logic/operationInterpreter.js` - Operation execution engine

### Test Infrastructure
- `tests/common/mods/ModAssertionHelpers.js` - Jest matcher compatibility
- `tests/common/mods/ModTestFixture.js` - Test fixture factory
- `tests/common/engine/systemLogicTestEnv.js` - System test environment

### Schemas
- `data/schemas/operations/prepareActionContext.schema.json`
- `data/schemas/operations/ifCoLocated.schema.json`
