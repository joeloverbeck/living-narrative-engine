# OXYDROSYS-011: Create DEPLETE_OXYGEN operation schema

**STATUS: COMPLETED** ✅

## Description

Define the JSON schema for the DEPLETE_OXYGEN operation.

## Files to Create

- `data/schemas/operations/deplete-oxygen.schema.json`

## Files to Modify

- `data/schemas/operation.schema.json` - Add `$ref` to anyOf array
- `src/configuration/staticConfiguration.js` - Add schema filename to `OPERATION_SCHEMA_FILES` array (discovered during implementation - required for AJV schema loading)

## Out of Scope

- JavaScript handler implementation
- DI registration
- Rules using this operation

## Acceptance Criteria

1. **Schema valid**: Passes JSON Schema draft-07 validation ✅
2. **Inherits base**: Uses `allOf` with `../base-operation.schema.json` ✅
3. **Type const**: `"type": { "const": "DEPLETE_OXYGEN" }` ✅
4. **Parameters**: `entityId` (entityReference), `amount` (integer, optional - defaults to depletionRate) ✅
5. **Operation.schema.json updated**: Reference added alphabetically ✅
6. **StaticConfiguration updated**: Schema filename added alphabetically ✅ (discovered requirement)

## Tests That Must Pass

- `npm run validate` - Schema validation ✅

## Invariants

- Alphabetical ordering in operation.schema.json anyOf array ✅
- Alphabetical ordering in staticConfiguration.js OPERATION_SCHEMA_FILES array ✅
- Follows existing operation schema patterns exactly ✅

## Outcome

### Planned vs Actual

**Planned:**
- Create `data/schemas/operations/deplete-oxygen.schema.json`
- Add `$ref` to `data/schemas/operation.schema.json`

**Actual:**
- Created `data/schemas/operations/deplete-oxygen.schema.json` as planned
- Added `$ref` to `data/schemas/operation.schema.json` (alphabetically before `dispatchEvent`)
- **Additional discovery:** Also needed to add `'deplete-oxygen.schema.json'` to `OPERATION_SCHEMA_FILES` in `src/configuration/staticConfiguration.js` for AJV schema loading

### Issue Discovered

The original ticket did not account for the schema loading mechanism. Schemas are loaded via `SchemaLoader` which reads the list from `staticConfiguration.js`. Without adding the schema filename to `OPERATION_SCHEMA_FILES`, AJV cannot resolve the schema reference, causing `MissingRefError` during validation.

### Files Changed

1. **Created:** `data/schemas/operations/deplete-oxygen.schema.json`
   - Type: `DEPLETE_OXYGEN`
   - Parameters: `entityId` (required), `amount` (optional integer, minimum 1)
   - Extends `base-operation.schema.json`

2. **Modified:** `data/schemas/operation.schema.json`
   - Added `$ref` to `./operations/deplete-oxygen.schema.json` at line 60-61 (between `removeComponent` and `dispatchEvent`)

3. **Modified:** `src/configuration/staticConfiguration.js`
   - Added `'deplete-oxygen.schema.json'` to `OPERATION_SCHEMA_FILES` array at line 21 (between `checkFollowCycle` and `dispatchEvent`)

### Validation Results

```
npm run validate
✅ Schemas loaded successfully (115 schemas including deplete-oxygen)
✅ No cross-reference violations detected
✅ Validated 95 mods successfully
```
