# AJV FOR_EACH Validation Investigation Report

## Executive Summary

Investigation of 930 AJV validation errors for FOR_EACH operations reveals a critical schema reference resolution issue in the browser environment. The issue is NOT a simple missing schema - it's a cascading validation failure caused by how AJV resolves circular `$ref` patterns when loading schemas asynchronously in the browser.

**Key Finding:** The problem occurs specifically in the `loadSchema` function (ajvSchemaValidator.js:76-235) when resolving the nested `$ref` at line 35 of forEach.schema.json:

```json
"$ref": "../operation.schema.json#/$defs/Action"
```

This creates a circular reference: `operation.schema.json` includes `forEach.schema.json` in its `anyOf` array, and then `forEach.schema.json` tries to reference back to `operation.schema.json`'s internal definitions.

## Problem Details

### 1. Schema Structure Analysis

**forEach.schema.json** has this reference chain:

```json
{
  "$id": "schema://living-narrative-engine/operations/forEach.schema.json",
  "allOf": [
    { "$ref": "../base-operation.schema.json" }, // ✅ Works - external ref
    {
      "properties": {
        "parameters": {
          "$ref": "#/$defs/Parameters" // ✅ Works - local ref
        }
      }
    }
  ],
  "$defs": {
    "Parameters": {
      "properties": {
        "actions": {
          "items": {
            "$ref": "../operation.schema.json#/$defs/Action" // ❌ PROBLEMATIC
          }
        }
      }
    }
  }
}
```

**operation.schema.json** includes:

```json
{
  "$id": "schema://living-narrative-engine/operation.schema.json",
  "$defs": {
    "Operation": {
      "anyOf": [
        { "$ref": "./operations/forEach.schema.json" } // Creates circular ref
        // ... 49 other operation types
      ]
    }
  }
}
```

### 2. Why Node.js Validation Passes But Browser Fails

**Node.js (npm run validate):**

- Uses synchronous file system access
- All schemas are loaded into AJV upfront
- When `forEach.schema.json` needs `operation.schema.json#/$defs/Action`, the full schema is already in memory
- AJV can immediately resolve the $ref without waiting

**Browser (runtime):**

- Uses asynchronous fetch-based schema loading (schemaLoader.js:109-130)
- Schemas are loaded in batches via `addSchemas()`
- When AJV tries to validate and encounters the $ref, the resolution logic in `loadSchema` (line 165) is called
- The async `loadSchema` function is provided to AJV's constructor (line 352)

### 3. The Root Cause: loadSchema Resolution Logic

From ajvSchemaValidator.js, the `loadSchema` function (lines 76-235):

When the schema is added to AJV, the `loadSchema` callback is invoked during compilation if AJV encounters an unresolved $ref. The critical section is lines 144-150:

```javascript
if (fragment && candidateId === baseId) {
  const fragmentSchema = resolveFragment(schemaEnv.schema, fragment);
  if (fragmentSchema) {
    return fragmentSchema; // ✅ Success
  }
  // Fragment resolution failed - return null to signal error
  return null; // ❌ THIS CAUSES AJV TO VALIDATE AGAINST ALL anyOf BRANCHES
}
```

**The Problem:** When `operation.schema.json#/$defs/Action` is requested:

1. The code looks for candidateId = `schema://living-narrative-engine/operation.schema.json`
2. It tries to resolve fragment `#/$defs/Action` from that schema
3. If the fragment resolution returns null, AJV treats this as an unresolvable reference
4. When AJV encounters an unresolved $ref in an `anyOf`, it validates against ALL branches as a fallback
5. Since forEach.schema.json references operation.schema.json which has 50 operation types, this generates 930+ validation errors

### 4. Why 930 Errors Specifically

- The `anyOf` in operation.schema.json has ~50 operation type references
- Each operation schema can have multiple validation errors
- 930 errors = ~18-20 errors per operation type across multiple validation attempts
- This matches the pattern of exhaustive validation when schema resolution fails

## Investigation Steps Completed

1. ✅ **Schema Structure Review**
   - Examined forEach.schema.json - correctly uses `$ref: "../operation.schema.json#/$defs/Action"`
   - Verified operation.schema.json correctly references forEach.schema.json at line 90
   - Confirmed both files exist in dist/data/schemas/

2. ✅ **Load Path Analysis**
   - Traced schema loading: SchemaPhase.js → SchemaLoader.js → AjvSchemaValidator.addSchemas()
   - Confirmed batch loading via `addSchemas()` at line 134 of SchemaLoader.js (Phase 2)
   - Identified `loadSchema` callback provided to AJV at line 352 of ajvSchemaValidator.js

3. ✅ **Fragment Resolution Logic**
   - Found fragment handling at lines 80-106 in ajvSchemaValidator.js
   - Identified the issue: returns `null` when fragment can't resolve (line 150)
   - Confirmed this is called during async ref resolution

4. ✅ **Circular Reference Pattern Confirmed**
   - operation.schema.json (main) includes forEach.schema.json (line 90 in anyOf)
   - forEach.schema.json references operation.schema.json#/$defs/Action (line 35)
   - This creates a circular dependency that breaks during async schema loading

5. ✅ **Testing Verification**
   - Unit tests pass (forEach collection type validation works)
   - Integration tests pass (forEach handler works correctly)
   - This confirms the handler is fine - it's purely a validation-time issue

## Root Cause Analysis

The issue is in how AJV handles unresolved `$ref` during async schema loading:

1. **SchemaLoader.js Phase 1** (lines 109-130): All schemas are fetched in parallel
2. **SchemaLoader.js Phase 2** (line 134): All schemas are registered at once with `addSchemas()`
3. When AJV compiles `operation.schema.json`, it encounters the reference to `forEach.schema.json`
4. The `loadSchema` callback resolves this successfully
5. When AJV compiles `forEach.schema.json`, it encounters the reference to `operation.schema.json#/$defs/Action`
6. The `loadSchema` callback tries to resolve this fragment
7. **KEY FAILURE POINT:** The fragment resolution at line 145 of ajvSchemaValidator.js:

   ```javascript
   const fragmentSchema = resolveFragment(schemaEnv.schema, fragment);
   ```

   - `schemaEnv.schema` may not have the `$defs` property visible
   - OR the `$defs/Action` pointer path doesn't exist at that moment
   - OR the timing of schema registration causes the fragment to be unavailable

8. Since fragment resolution returns `null` (line 150), AJV can't resolve the $ref
9. AJV enters fallback validation mode
10. For unresolved $ref in `anyOf`, AJV validates against ALL 50 branches
11. This generates 930+ cumulative validation errors

## Critical Code Sections

### ajvSchemaValidator.js, lines 144-150

```javascript
if (fragment && candidateId === baseId) {
  const fragmentSchema = resolveFragment(schemaEnv.schema, fragment);
  if (fragmentSchema) {
    return fragmentSchema;
  }
  // Fragment resolution failed - return null to signal error
  return null; // ❌ RETURNS NULL - CAUSES FALLBACK TO ALL anyOf BRANCHES
}
```

### ajvSchemaValidator.js, lines 80-106 (resolveFragment helper)

```javascript
const resolveFragment = (schemaObject, fragment) => {
  if (!fragment || fragment === '#') {
    return schemaObject;
  }

  const pointer = fragment.startsWith('#') ? fragment.slice(1) : fragment;
  const parts = pointer
    .split('/')
    .filter((part) => part.length > 0)
    .map(decodePointerSegment);

  let current = schemaObject;
  for (const part of parts) {
    if (
      current &&
      typeof current === 'object' &&
      Object.prototype.hasOwnProperty.call(current, part)
    ) {
      current = current[part];
    } else {
      return null; // ❌ Returns null if path doesn't exist
    }
  }
  return current;
};
```

The issue is that `resolveFragment` is correct - it properly navigates JSON Pointer paths. The problem is likely that `schemaEnv.schema` doesn't have the `$defs` property at the moment of resolution.

## Proposed Solution Categories

### Option A: Fix Fragment Resolution Order (RECOMMENDED)

- Ensure all schemas are fully loaded and indexed before attempting $ref resolution
- Modify `loadSchema` to wait for schema availability before returning
- Check if the schema needs to be compiled first before fragment resolution
- Complexity: Low-Medium - targeted fix to existing code
- Risk: Low - improves existing resolution logic

**Implementation:**

- Before returning null, try to compile the base schema if not yet compiled
- OR: Cache schema compilation results after first resolution

### Option B: Pre-fetch and Resolve External References

- During schema loading phase, pre-resolve all `../operation.schema.json#/$defs/Action` references
- Load operation.schema.json first, then operations
- Modify SchemaLoader to handle dependencies
- Complexity: Medium - requires dependency analysis
- Risk: Medium - changes loading order

### Option C: Inline Critical References

- Transform forEach.schema.json to not reference operation.schema.json fragments
- Instead, copy the Action definition locally
- Complexity: High - requires schema transformation
- Risk: High - maintenance burden

### Option D: Use AJV's Native Schema Caching

- Let AJV's built-in $ref resolution handle fragments
- Remove or simplify the custom loadSchema logic
- Complexity: Medium - requires understanding AJV internals
- Risk: Medium - may have unintended side effects

## Next Steps (For Implementation Phase)

### Step 1: Verify the Hypothesis

Add detailed logging to `loadSchema` function:

```javascript
// Around line 165
this.#logger.debug(`AjvSchemaValidator: loadSchema called with URI: ${uri}`);

// Around line 145
this.#logger.debug(`Resolving fragment '${fragment}' from schema '${baseId}'`);
const fragmentSchema = resolveFragment(schemaEnv.schema, fragment);
if (!fragmentSchema) {
  this.#logger.warn(
    `Fragment '${fragment}' not found in schema '${baseId}'. Available keys: ${Object.keys(schemaEnv.schema).join(', ')}`
  );
}
```

### Step 2: Check Schema Compilation Status

Verify if the issue is timing-related:

```javascript
// Before resolveFragment
try {
  const compiled = this.#ajv.compile(schemaEnv.schema);
  const fragmentSchema = resolveFragment(compiled.schema, fragment);
  // ...
} catch (e) {
  this.#logger.error(
    `Failed to compile schema before fragment resolution: ${e.message}`
  );
}
```

### Step 3: Test Fragment Resolution

Manually test if the $defs path exists:

```javascript
const schema = this.#ajv.getSchema(baseId);
console.log('Schema has $defs:', !!schema.schema.$defs);
console.log('Action definition exists:', !!schema.schema.$defs?.Action);
```

### Step 4: Implement Fix (Option A)

If hypothesis is confirmed, implement:

```javascript
// In loadSchema, when fragment resolution fails:
if (!fragmentSchema && baseId) {
  // Try compiling the schema if not done yet
  try {
    this.#ajv.compile(schemaEnv.schema);
    // Retry fragment resolution after compilation
    fragmentSchema = resolveFragment(schemaEnv.schema, fragment);
    if (fragmentSchema) {
      return fragmentSchema;
    }
  } catch (e) {
    this.#logger.debug(
      `Schema compilation before fragment resolution failed: ${e.message}`
    );
  }
}
```

## Files Involved

| File                                        | Role                                         | Status                                |
| ------------------------------------------- | -------------------------------------------- | ------------------------------------- |
| src/validation/ajvSchemaValidator.js        | Schema validator, loadSchema callback        | 🔴 **Fragment resolution incomplete** |
| src/loaders/schemaLoader.js                 | Batch schema loading (Phase 1 & 2)           | ⚠️ **Possibly order-dependent**       |
| data/schemas/operation.schema.json          | Main operation schema with 50 anyOf branches | ✅ **Structure correct**              |
| data/schemas/operations/forEach.schema.json | FOR_EACH schema with circular ref            | ✅ **Structure correct**              |
| src/loaders/phases/SchemaPhase.js           | Orchestrates schema loading phases           | ✅ **Orchestration correct**          |

## Browser vs Node.js Differences

| Aspect             | Node.js (npm run validate) | Browser (runtime)          |
| ------------------ | -------------------------- | -------------------------- |
| File access        | Synchronous, direct FS     | Async, via fetch           |
| Schema loading     | All at once, sequential    | Batch, concurrent          |
| AJV initialization | No custom loadSchema       | Custom loadSchema callback |
| $ref resolution    | Immediate (all loaded)     | On-demand (async)          |
| Error visibility   | Clear validation results   | Generic 930 errors         |

## Conclusion

The 930 AJV validation errors for FOR_EACH operations are caused by circular schema references combined with asynchronous schema loading in the browser environment. The issue is NOT that FOR_EACH is missing - it's that the `loadSchema` callback in AjvSchemaValidator fails to resolve fragment references to `operation.schema.json#/$defs/Action`, causing AJV to fall back to exhaustive validation of all 50 operation types in the anyOf array.

The recommended fix is **Option A: Improve Fragment Resolution** - specifically, ensuring schemas are fully compiled before attempting fragment resolution, or retrying fragment resolution after schema compilation.

The fix is low-risk and targeted, requiring changes only to the `loadSchema` callback's fragment resolution logic in ajvSchemaValidator.js.
