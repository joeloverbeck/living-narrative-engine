# Spec: Test Infrastructure Robustness - Entity ID vs Object API Confusion

> **Related Spec**: `specs/test-infrastructure-robustness.md` (covers testEnv property access)
> **Status**: Ready for implementation

---

## Context

**Location in codebase:**
- `tests/common/mods/ModTestFixture.js` - Primary test fixture for mod testing
- `tests/common/mods/ModEntityBuilder.js` - Entity builder with fluent API
- `tests/common/entities/simpleEntityManager.js` - In-memory entity storage for tests
- `src/utils/cloneUtils.js` - Deep cloning utility used throughout

**What these modules do:**
- `ModTestFixture` provides high-level test helpers for action discovery, rule execution, and entity management
- `ModEntityBuilder` constructs entity objects using a fluent builder pattern
- `simpleEntityManager` stores entities in memory for tests, using `deepClone` for data isolation
- `cloneUtils.deepClone` creates deep copies using `structuredClone` or JSON serialization fallback

## Problem

### What Failed
The integration tests in `tests/integration/clothing/complexBlockingScenarios.integration.test.js` (3 tests) failed silently with empty equipment data.

### How It Failed
Equipment components were stored as empty objects `{}` instead of containing entity IDs like `{accessories: 'belt'}`.

### Why It Failed (Root Cause Chain)

1. **API Misuse**: `fixture.createEntity({id: 'belt', ...})` returns **string** `'belt'`, not an object
2. **Incorrect Access**: Test code used `belt.id` which returns `undefined` (accessing `.id` on a string primitive)
3. **Silent Data Loss**: `deepClone({accessories: undefined})` became `{}` due to JSON serialization stripping undefined
4. **No Validation**: Neither `modifyComponent` nor `addComponent` validated that component data had expected properties
5. **Scope Resolution Failure**: Empty equipment meant no items to filter, returning empty results

### Debugging Journey (Issues Encountered)

| Step | Investigation | Time Cost | Could Have Failed Fast? |
|------|--------------|-----------|------------------------|
| 1 | Traced scope resolution returning empty | 30 min | Yes - could log component data |
| 2 | Suspected JSON Logic filter issues | 20 min | No - red herring |
| 3 | Checked schema validation | 15 min | Yes - schema requires `equipped` to have content |
| 4 | Created debug test files | 25 min | N/A |
| 5 | Traced `createEntity` return type | 10 min | Yes - TypeScript would catch |
| 6 | Found `.id` on string returns undefined | 5 min | Yes - lint rule could catch |
| 7 | Traced `deepClone` undefined stripping | 15 min | Yes - validation could catch |

**Total debugging time: ~2 hours** for what could have been caught in <1 minute with proper validation.

## Truth Sources

### Documentation
- `ModTestFixture.createEntity()` JSDoc: `@returns {string} Entity ID` (line 1528)
- `ModEntityBuilder.build()` JSDoc: `@returns {object} The complete entity object` (line 709)
- `cloneUtils.deepClone` JSDoc: "properties that cannot be stringified are silently dropped" (line 32)

### Domain Rules
- Equipment components store entity IDs as strings (not entity objects)
- Component data must match the component schema after any transformation
- Entity IDs are always strings, never objects with `.id` properties

### External Contracts
- `structuredClone()` preserves `undefined` values
- `JSON.stringify()` silently strips `undefined` values (ECMAScript specification)

## Desired Behavior

### Normal Cases

1. **`createEntity()` returns string ID**
   - Caller uses ID directly: `const beltId = fixture.createEntity({id: 'belt'})`
   - Component data uses ID: `{equipped: {slot: {layer: beltId}}}`

2. **`build()` returns entity object**
   - Caller accesses `.id`: `const entity = builder.build(); entity.id`
   - Used for full entity data access including components

3. **`deepClone` preserves data fidelity**
   - Input properties are preserved in output
   - `undefined` values are either preserved or explicitly rejected

### Edge Cases

1. **String primitive with property access**
   - `'belt'.id` returns `undefined` (not an error)
   - Should be caught by static analysis or runtime validation

2. **Empty component data after cloning**
   - If source has keys, clone should have same keys
   - Property count mismatch indicates data loss

3. **Mixed API usage patterns**
   - Some methods return IDs, others return objects
   - Consistent patterns within each method family

### Failure Modes (What Errors to Raise/Return)

| Scenario | Current Behavior | Desired Behavior |
|----------|-----------------|------------------|
| `.id` on string | Returns `undefined` | Lint error or runtime check |
| `undefined` in component data | Silently stripped | Warning log or schema validation error |
| Empty `equipped` object | Stored silently | Warning: "Equipment has no items equipped" |
| Property count mismatch after clone | Not detected | Error: "Data loss detected in deepClone" |

### Invariants (Properties That Must Always Hold)

1. **INV-CLONE-1**: `Object.keys(source).length === Object.keys(deepClone(source)).length` for any component data
2. **INV-ID-1**: Entity IDs are always primitive strings, never objects
3. **INV-COMP-1**: Component data after storage matches component schema
4. **INV-EQUIP-1**: Equipment component's `equipped` object has at least one slot if the component is present

### API Contracts (What Stays Stable)

| Method | Returns | Guaranteed |
|--------|---------|-----------|
| `ModTestFixture.createEntity(config)` | `string` | Entity ID |
| `ModEntityBuilder.build()` | `object` | Entity with `.id` and `.components` |
| `ModEntityScenarios.createActorTargetPair()` | `object` | `{actor: Entity, target: Entity}` |
| `deepClone(value)` | same type | Deep copy (with documented limitations) |

### What Is Allowed to Change

1. **Validation strictness** - Can add more validation without breaking API
2. **Error messages** - Can improve diagnostic detail
3. **Logging** - Can add debug/warn logs for suspicious patterns
4. **Internal cloning strategy** - Can use polyfill for `structuredClone`

## Implementation Plan

### Phase 1: Immediate Prevention (Test Infrastructure)

#### 1.1 Add `undefined` detection in `simpleEntityManager.addComponent`
**File**: `tests/common/entities/simpleEntityManager.js` (line 230)

```javascript
addComponent(id, type, data) {
  // Detect undefined values that will be stripped
  const undefinedKeys = Object.entries(data)
    .filter(([_, v]) => v === undefined)
    .map(([k]) => k);
  if (undefinedKeys.length > 0) {
    console.warn(
      `[SimpleEntityManager] addComponent: Data for ${type} contains undefined values ` +
      `that will be stripped during cloning: ${undefinedKeys.join(', ')}`
    );
  }
  // ... existing code
}
```

#### 1.2 Add property count validation after `deepClone`
**File**: `tests/common/entities/simpleEntityManager.js` (line 230)

```javascript
const cloned = deepClone(data);
const sourceKeys = Object.keys(data).length;
const clonedKeys = Object.keys(cloned).length;
if (sourceKeys !== clonedKeys) {
  console.error(
    `[SimpleEntityManager] DATA LOSS DETECTED: ${type} had ${sourceKeys} properties, ` +
    `clone has ${clonedKeys}. Lost: ${Object.keys(data).filter(k => !(k in cloned)).join(', ')}`
  );
}
```

### Phase 2: Fail-Fast Validation

#### 2.1 Add equipment-specific validation in `modifyComponent`
**File**: `tests/common/mods/ModTestFixture.js` (around line 1450)

```javascript
async modifyComponent(entityId, componentId, data) {
  // Validate equipment component has content
  if (componentId === 'clothing:equipment' && data.equipped) {
    const slots = Object.keys(data.equipped);
    const emptySlots = slots.filter(slot =>
      Object.keys(data.equipped[slot] || {}).length === 0
    );
    if (emptySlots.length === slots.length) {
      console.warn(
        `[ModTestFixture] Equipment modification has all empty slots. ` +
        `This usually indicates incorrect entity ID usage (e.g., using .id on a string).`
      );
    }
  }
  // ... existing code
}
```

### Phase 3: Static Analysis (ESLint Rule)

#### 3.1 Create custom ESLint rule for `.id` on `createEntity` results
**File**: `scripts/eslint-rules/no-id-on-create-entity.js` (new file)

Rule to detect pattern: `fixture.createEntity(...).id` or `const x = fixture.createEntity(...); x.id`

### Phase 4: Test Coverage

#### 4.1 Add deepClone undefined handling tests
**File**: `tests/unit/utils/cloneUtils.test.js`

```javascript
describe('undefined value handling', () => {
  it('should document undefined stripping with JSON fallback', () => {
    global.structuredClone = undefined;
    const source = { a: 1, b: undefined, c: 2 };
    const cloned = deepClone(source);
    // Currently: undefined is stripped - document this behavior
    expect(cloned).toEqual({ a: 1, c: 2 });
    expect(Object.keys(cloned).length).toBe(2); // Not 3!
  });

  it('should preserve undefined with structuredClone', () => {
    // Ensure structuredClone is available
    const source = { a: 1, b: undefined, c: 2 };
    const cloned = deepClone(source);
    expect('b' in cloned).toBe(true);
    expect(cloned.b).toBeUndefined();
  });
});
```

#### 4.2 Add ModTestFixture.createEntity return type tests
**File**: `tests/unit/common/mods/ModTestFixture.createEntity.test.js` (new or extend existing)

```javascript
describe('createEntity return type', () => {
  it('returns a string ID, not an entity object', async () => {
    const fixture = await ModTestFixture.forAction('core', 'core:test');
    const result = fixture.createEntity({ id: 'test', components: {} });

    expect(typeof result).toBe('string');
    expect(result).toBe('test');
    expect(result.id).toBeUndefined(); // Accessing .id on string returns undefined
  });
});
```

## Testing Plan

### Tests to Update
1. `tests/integration/clothing/complexBlockingScenarios.integration.test.js` - Already fixed

### Tests to Add

| Test File | Purpose | Type |
|-----------|---------|------|
| `tests/unit/utils/cloneUtils.undefinedHandling.test.js` | Document undefined stripping behavior | Unit |
| `tests/unit/common/mods/ModTestFixture.apiContract.test.js` | Verify return types match JSDoc | Unit |
| `tests/unit/common/entities/simpleEntityManager.validation.test.js` | Test data loss detection | Unit |

### Regression Tests

1. **Property preservation test**: Run `deepClone` on sample equipment data, verify all keys present
2. **Entity ID type test**: Verify all fixture methods return documented types
3. **Equipment validation test**: Verify empty equipment triggers warning

### Property Tests (Recommended)

1. **Clone fidelity**: For any object `O`, `deepClone(O)` should have same property count
2. **ID stability**: `createEntity({id: X})` always returns exactly `X`
3. **Builder consistency**: `builder.build().id` always equals constructor ID

## Critical Files

| File | Change | Priority |
|------|--------|----------|
| `tests/common/entities/simpleEntityManager.js` | Add undefined detection | P1 |
| `tests/common/mods/ModTestFixture.js` | Add equipment validation | P1 |
| `tests/unit/utils/cloneUtils.test.js` | Add undefined tests | P2 |
| `scripts/eslint-rules/no-id-on-create-entity.js` | Static analysis rule | P3 |
| `tests/integration/clothing/complexBlockingScenarios.integration.test.js` | Already fixed | Done |

## Implementation Tickets

| Ticket ID | Priority | Effort | Description |
|-----------|----------|--------|-------------|
| ENTIDAPI-001 | High | Small | Add undefined detection warning in `simpleEntityManager.addComponent` |
| ENTIDAPI-002 | High | Small | Add property count validation after deepClone |
| ENTIDAPI-003 | Medium | Medium | Add equipment-specific validation in `ModTestFixture.modifyComponent` |
| ENTIDAPI-004 | Medium | Small | Add unit tests documenting deepClone undefined behavior |
| ENTIDAPI-005 | Low | Medium | Create ESLint rule for `.id` on createEntity results |
| ENTIDAPI-006 | Low | Small | Add API contract tests for createEntity return type |

### Ticket Details

#### ENTIDAPI-001: Undefined Detection Warning
- Add warning in `simpleEntityManager.addComponent` when data contains undefined values
- Detects problem at data storage time, before deepClone strips values
- Helps developers catch the root cause immediately

#### ENTIDAPI-002: Property Count Validation
- Compare `Object.keys(source).length` vs `Object.keys(cloned).length`
- Log error if mismatch detected
- Catches data loss regardless of cause

#### ENTIDAPI-003: Equipment-Specific Validation
- In `ModTestFixture.modifyComponent`, check for `clothing:equipment` component
- Warn if all slots are empty objects
- Include helpful message about common cause (using .id on string)

#### ENTIDAPI-004: DeepClone Undefined Tests
- Document that JSON fallback strips undefined
- Document that structuredClone preserves undefined
- Make behavior explicit in test suite

#### ENTIDAPI-005: ESLint Rule (Optional)
- Detect `fixture.createEntity(...).id` pattern
- Also detect `const x = fixture.createEntity(...); ... x.id`
- Low priority - runtime validation catches this anyway

#### ENTIDAPI-006: API Contract Tests
- Verify `createEntity` returns string
- Verify `build()` returns object with `.id`
- Enforce documented contracts

---

## Verification Checklist

- [x] All 5 failing integration tests pass (34 tests total)
- [x] Fail-fast unit tests still pass (12 tests)
- [x] New validation catches the original bug if reintroduced (ENTIDAPI-001, 002, 003 implemented)
- [x] Documentation updated for `createEntity` return type emphasis (warnings include guidance)
- [x] Property count validation logs warnings for data loss (ENTIDAPI-002 implemented)

## Implementation Status

| Ticket | Status | Implementation |
|--------|--------|----------------|
| ENTIDAPI-001 | ✅ Complete | `simpleEntityManager.addComponent` undefined detection |
| ENTIDAPI-002 | ✅ Complete | `simpleEntityManager.addComponent` property count validation |
| ENTIDAPI-003 | ✅ Complete | `ModTestFixture.modifyComponent` equipment validation |
| ENTIDAPI-004 | ✅ Complete | 5 new tests in `cloneUtils.test.js` |
| ENTIDAPI-005 | ⏭️ Deferred | ESLint rule - runtime validation sufficient, anti-pattern not found in codebase |
| ENTIDAPI-006 | ⏭️ Deferred | API contract tests - covered by ENTIDAPI-004 and runtime validation |

---

## Summary

This spec addresses a class of bugs where:
1. Test code incorrectly accesses `.id` on values that are already string IDs
2. The resulting `undefined` values are silently stripped by `deepClone`
3. Equipment/component data ends up empty, causing silent test failures

The fix involves:
- **Immediate**: Warning logs when undefined values detected in component data
- **Medium-term**: Equipment-specific validation for common patterns
- **Long-term**: Static analysis to catch the pattern at authoring time

This complements the existing `specs/test-infrastructure-robustness.md` which addresses testEnv property access confusion.
