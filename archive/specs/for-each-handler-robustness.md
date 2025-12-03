# FOR_EACH Handler Robustness Specification

**Version**: 1.0
**Date**: 2025-12-03
**Status**: Active
**Related Fix**: FOR_EACH collection parameter type validation

---

## Context

### Location in Codebase

The FOR_EACH operation handler spans multiple modules:

| Module | File Path | Purpose |
|--------|-----------|---------|
| **Flow Handler** | `src/logic/flowHandlers/forEachHandler.js` | Core iteration logic |
| **Operation Handler** | `src/logic/operationHandlers/forEachHandler.js` | Operation registry wrapper |
| **Schema** | `data/schemas/operations/forEach.schema.json` | Parameter validation schema |
| **Pre-Validation** | `src/utils/preValidationUtils.js` | Whitelist for operation types |
| **Path Resolution** | `src/utils/objectUtils.js` | `resolvePath()` function |

### What the Module Does

The FOR_EACH handler iterates over a collection and executes an action sequence for each item:

```
FOR_EACH Operation
├─ Extract collection path from parameters
├─ Resolve path to array in evaluation context
├─ For each item:
│   ├─ Bind item to item_variable in context
│   └─ Execute nested actions
└─ Restore original context state
```

**Key Responsibilities:**

1. **Path Resolution**: Resolve string path to array in evaluation context
2. **Context Management**: Temporarily bind each item to a named variable
3. **Iteration**: Execute nested actions for each collection item
4. **Cleanup**: Restore original context state after iteration

---

## Problem

### What Failed

**Issue**: The FOR_EACH operation handler threw `TypeError: path?.trim is not a function` at `forEachHandler.js:48` during production execution of `handle_swing_at_target.rule.json`.

**Affected Rule**: `data/mods/weapons/rules/handle_swing_at_target.rule.json`

**Root Cause**: The rule file used a JSON Logic object `{ "var": "..." }` for the `collection` parameter instead of a string path, but the handler assumes collection is always a string.

### How It Failed

**Error Flow**:

1. Rule uses `"collection": { "var": "context.weaponDamage.entries" }` (object)
2. Handler extracts `collection: path` from `node.parameters`
3. Handler calls `path?.trim()` at line 48
4. `trim()` is not a function on objects → TypeError thrown
5. Rule execution fails completely

**Handler Code** (forEachHandler.js:47-55):
```javascript
if (
  !path?.trim() ||  // ← TypeError when path is object
  !varName?.trim() ||
  !Array.isArray(actions) ||
  actions.length === 0
) {
  logger.warn(`${scopeLabel}: invalid parameters.`);
  return;
}
```

### Why It Failed

1. **No Type Checking**: Handler assumes `path` is a string without validation
2. **Silent Schema Mismatch**: AJV schema requires `"type": "string"` but pre-validation didn't catch the object at runtime
3. **Unhelpful Error**: TypeError doesn't indicate the actual problem (wrong parameter type)
4. **Inconsistent Pattern Recognition**: Modders may expect JSON Logic objects to work since other operations use them

### Test Links

**Existing Tests**:
- `tests/unit/logic/flowHandlers/forEachHandler.test.js` - Unit tests for flow handler
- `tests/unit/logic/operationHandlers/forEachHandler.test.js` - Unit tests for operation handler wrapper

**New Tests Created**:
- `tests/integration/mods/weapons/forEachCollectionTypeValidation.integration.test.js` - Validates collection parameter type
- `tests/integration/mods/weapons/swingAtTargetDamageApplication.integration.test.js` - Updated to expect string format

---

## Truth Sources

### 1. Schema Definition

**Source**: `data/schemas/operations/forEach.schema.json`

**Relevant Section** (line 26):
```json
"collection": {
  "type": "string",
  "description": "Path to the collection in evaluation context"
}
```

**Key Implication**: Schema mandates string type, not object or JSON Logic expression.

### 2. Working Examples in Codebase

**Source**: `data/mods/movement/rules/follow_auto_move.rule.json:82`
```json
"collection": "context.followersToMove"  // ✅ String path
```

### 3. Path Resolution Utility

**Source**: `src/utils/objectUtils.js` → `resolvePath()`

The function expects a string path with dot notation (e.g., `"context.foo.bar"`).

### 4. Project Conventions

**Source**: `CLAUDE.md` (Adding New Operations checklist)

Step 7 (CRITICAL): Add operation type to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`

---

## Desired Behavior

### Normal Cases

#### 1. String Path Collection
**Input**:
```json
{
  "type": "FOR_EACH",
  "parameters": {
    "collection": "context.items",
    "item_variable": "item",
    "actions": [...]
  }
}
```
**Expected**: Resolve path, iterate, execute actions for each item.

#### 2. Nested Path Collection
**Input**:
```json
{
  "collection": "context.weaponDamage.entries"
}
```
**Expected**: Resolve nested path, iterate over entries array.

#### 3. Empty Collection
**Input**: Path resolves to `[]`
**Expected**: No iterations, no errors, clean return.

### Edge Cases

#### 1. JSON Logic Object Collection (Current Bug)
**Input**:
```json
{
  "collection": { "var": "context.items" }
}
```
**Current Behavior**: TypeError - `path?.trim is not a function`

**Proposed Behavior Options**:

**Option A (Recommended)**: Detect and provide helpful error message
```
FOR_EACH: 'collection' parameter must be a string path, not an object.
Received: {"var": "context.items"}
Use: "context.items" instead of {"var": "context.items"}
```

**Option B**: Support both formats (flexible but adds complexity)
- If string: use as path directly
- If object with `var`: extract the var path and use that
- Trade-off: More complex, may encourage inconsistent patterns

#### 2. Null/Undefined Collection Path
**Input**: `"collection": null` or missing
**Expected**: Early return with warning log
```
FOR_EACH: invalid parameters. 'collection' is required and must be a non-empty string.
```

#### 3. Path Resolves to Non-Array
**Input**: Path exists but points to object, string, or number
**Expected**: Warning log, no iteration
```
FOR_EACH: 'context.weaponDamage' did not resolve to an array. Got: object
```

#### 4. Path Resolves to Undefined
**Input**: Path doesn't exist in context
**Expected**: Warning log, no iteration
```
FOR_EACH: 'context.nonexistent' resolved to undefined.
```

### Failure Modes

#### 1. Type Validation Failure (Before Execution)
**When**: `collection` is not a string
**Error Response**:
```javascript
throw new TypeError(
  `FOR_EACH: 'collection' must be a string path. ` +
  `Received: ${typeof collection} (${JSON.stringify(collection)})`
);
```
**User Impact**: Clear indication of parameter type mismatch.

#### 2. Path Resolution Failure (During Execution)
**When**: Path doesn't resolve to array
**Error Response**: Warning log (current behavior is acceptable)

#### 3. Action Execution Failure (Within Loop)
**When**: Nested action throws
**Error Response**: Propagate error with context (current behavior)

### Invariants

**Properties that must ALWAYS hold:**

1. **Type Safety**: `collection` parameter must be string type before `resolvePath()` is called
2. **Context Restoration**: Original context state is restored even if iteration fails
3. **Deterministic**: Same input always produces same iteration behavior
4. **Clean Failure**: Invalid parameters result in warning + early return, not exceptions

### API Contracts

#### What Stays Stable

1. **Operation Type**: `"FOR_EACH"` constant
2. **Required Parameters**: `collection`, `item_variable`, `actions`
3. **Collection Resolution**: Uses `resolvePath()` with dot notation
4. **Variable Binding**: Item bound to `item_variable` in `context`

#### What Is Allowed to Change

1. **Error Messages**: Wording can be improved for clarity
2. **Type Handling**: Could add support for JSON Logic extraction (Option B)
3. **Validation Depth**: Could add pre-execution parameter validation
4. **Logging**: Detail level and format can evolve

---

## Testing Plan

### Tests to Add

#### 1. Robust Type Validation Tests
**File**: `tests/unit/logic/flowHandlers/forEachHandler.typeValidation.test.js` (NEW)

```javascript
describe('FOR_EACH collection type validation', () => {
  it('should throw TypeError with helpful message when collection is object', async () => {
    const node = {
      type: 'FOR_EACH',
      parameters: {
        collection: { var: 'context.items' }, // Object
        item_variable: 'item',
        actions: [{ type: 'LOG' }]
      }
    };

    await expect(handleForEach(node, ctx, logger, interpreter, executor))
      .rejects.toThrow(/collection.*must be.*string/i);
  });

  it('should provide fix suggestion for JSON Logic objects', async () => {
    const node = {
      parameters: { collection: { var: 'context.items' } }
    };

    await expect(handleForEach(node, ctx, logger, interpreter, executor))
      .rejects.toThrow(/Use: "context.items" instead/);
  });

  it('should accept valid string paths', async () => {
    const node = {
      parameters: {
        collection: 'context.items',
        item_variable: 'item',
        actions: [{ type: 'LOG' }]
      }
    };

    await expect(handleForEach(node, ctx, logger, interpreter, executor))
      .resolves.not.toThrow();
  });
});
```

#### 2. Schema Validation Integration Tests
**File**: `tests/integration/validation/forEachSchemaValidation.integration.test.js` (NEW)

```javascript
describe('FOR_EACH schema validation', () => {
  it('should reject object collection at validation stage', async () => {
    const rule = {
      actions: [{
        type: 'FOR_EACH',
        parameters: {
          collection: { var: 'context.items' },
          item_variable: 'item',
          actions: []
        }
      }]
    };

    const errors = validator.validate(schemaId, rule);
    expect(errors).toContain('collection must be string');
  });
});
```

### Tests to Update

1. **forEachCollectionTypeValidation.integration.test.js** - Already created
2. **swingAtTargetDamageApplication.integration.test.js** - Already updated

### Regression Tests

1. **All existing FOR_EACH tests pass** with improved error handling
2. **String path collection** continues to work identically
3. **Error handling** doesn't change for non-type-related failures

### Property Tests

```javascript
describe('FOR_EACH property tests', () => {
  it('should always restore context after iteration', () => {
    fc.assert(fc.property(
      fc.array(fc.anything()),
      (items) => {
        const originalContext = { ...ctx.evaluationContext.context };
        try {
          handleForEach(createNode(items), ctx, logger, interpreter, executor);
        } finally {
          expect(ctx.evaluationContext.context).toEqual(originalContext);
        }
      }
    ));
  });
});
```

---

## Implementation Recommendation

**Approach**: Add explicit type checking with helpful error messages (Option A)

### Changes Required

**File**: `src/logic/flowHandlers/forEachHandler.js`

**Before** (lines 47-55):
```javascript
if (
  !path?.trim() ||
  !varName?.trim() ||
  !Array.isArray(actions) ||
  actions.length === 0
) {
  logger.warn(`${scopeLabel}: invalid parameters.`);
  return;
}
```

**After**:
```javascript
// Type check collection parameter
if (typeof path !== 'string') {
  const received = JSON.stringify(path);
  const message = path && typeof path === 'object' && 'var' in path
    ? `FOR_EACH: 'collection' must be a string path, not a JSON Logic object. ` +
      `Received: ${received}. Use: "${path.var}" instead of ${received}`
    : `FOR_EACH: 'collection' must be a string path. Received: ${typeof path}`;
  throw new TypeError(message);
}

if (
  !path.trim() ||
  !varName?.trim() ||
  !Array.isArray(actions) ||
  actions.length === 0
) {
  logger.warn(`${scopeLabel}: invalid parameters.`);
  return;
}
```

### Benefits

1. **Clear Error Messages**: Developers immediately understand the issue
2. **Fix Suggestions**: Error tells exactly how to fix the problem
3. **Fail Fast**: Throws before attempting operations on wrong type
4. **Backward Compatible**: String paths work identically

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `specs/for-each-handler-robustness.md` | Create spec file (this file) |
| `src/logic/flowHandlers/forEachHandler.js` | Add type validation (optional improvement) |
| `tests/unit/logic/flowHandlers/forEachHandler.typeValidation.test.js` | Add type validation tests |
| `tests/integration/validation/forEachSchemaValidation.integration.test.js` | Add schema validation tests |

---

## Verification Commands

```bash
# Run all FOR_EACH related tests
NODE_ENV=test npx jest tests/unit/logic/flowHandlers/forEachHandler --no-coverage --verbose
NODE_ENV=test npx jest tests/unit/logic/operationHandlers/forEachHandler --no-coverage --verbose
NODE_ENV=test npx jest tests/integration/mods/weapons/forEachCollectionTypeValidation --no-coverage --verbose

# Validate schema
npm run validate:mod:weapons

# Full test suite
npm run test:ci
```
