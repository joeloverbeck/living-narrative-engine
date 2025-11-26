# SCHVALTESINT-007: Migrate lockGrabbing.schema.json to Use $ref

**Epic**: SCHVALTESINT - Schema Validation Test Integration
**Priority**: MEDIUM
**Phase**: 3 - Template String Standardization
**Dependencies**: SCHVALTESINT-006
**Blocks**: SCHVALTESINT-009

---

## Objective

Update `lockGrabbing.schema.json` to use `$ref` to `common.schema.json` for the `count` parameter instead of a local `oneOf` definition, establishing the pattern for other operations to follow.

## File List

### Files to Modify

| File | Change Type |
|------|-------------|
| `data/schemas/operations/lockGrabbing.schema.json` | Replace local oneOf with $ref to common |

### Files to Create

None

### Files to Read (for reference)

| File | Purpose |
|------|---------|
| `data/schemas/common.schema.json` | Target for $ref (from SCHVALTESINT-006) |

---

## Out of Scope

**DO NOT MODIFY:**

- `data/schemas/common.schema.json` - Already created in SCHVALTESINT-006
- `data/schemas/operations/unlockGrabbing.schema.json` - Separate ticket (SCHVALTESINT-008)
- Any other operation schemas
- Any source code files in `src/`
- The `type: "LOCK_GRABBING"` constant or base-operation inheritance

**DO NOT:**

- Add new parameters to the schema
- Change validation behavior (should accept same inputs as before)
- Modify the `actor_id` or `item_id` parameter definitions (only `count`)

---

## Implementation Details

### Current Schema (Before)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/lockGrabbing.schema.json",
  "title": "LOCK_GRABBING Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "LOCK_GRABBING" },
        "parameters": {
          "type": "object",
          "properties": {
            "actor_id": { "type": "string" },
            "count": {
              "oneOf": [
                { "type": "integer", "minimum": 1 },
                {
                  "type": "string",
                  "pattern": "^\\{[a-zA-Z_][a-zA-Z0-9_]*(\\.[a-zA-Z_][a-zA-Z0-9_]*)*\\}$"
                }
              ]
            },
            "item_id": { "type": "string" }
          },
          "required": ["actor_id", "count"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

### Required Schema (After)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/lockGrabbing.schema.json",
  "title": "LOCK_GRABBING Operation",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "LOCK_GRABBING" },
        "parameters": {
          "type": "object",
          "properties": {
            "actor_id": { "type": "string" },
            "count": { "$ref": "../common.schema.json#/definitions/positiveIntegerOrTemplate" },
            "item_id": { "type": "string" }
          },
          "required": ["actor_id", "count"],
          "additionalProperties": false
        }
      }
    }
  ]
}
```

### Key Changes

1. Replace inline `oneOf` with `$ref` to `common.schema.json#/definitions/positiveIntegerOrTemplate`
2. Remove local pattern definition
3. Preserve all other schema properties unchanged

---

## Acceptance Criteria

### Tests That Must Pass

1. **Existing test**: `tests/integration/mods/weapons/wield_grabbing_schema_validation.test.js`
   - All existing tests must continue to pass
   - No changes to test file required

2. **Validation behavior unchanged**:
   - `{ "count": 2 }` - Passes (integer)
   - `{ "count": "{context.value}" }` - Passes (template)
   - `{ "count": "two" }` - Fails (invalid string)
   - `{ "count": 0 }` - Fails (must be ≥1)
   - `{ "count": -1 }` - Fails (must be ≥1)

### Manual Verification Steps

1. Run existing tests:
   ```bash
   NODE_ENV=test npx jest tests/integration/mods/weapons/wield_grabbing_schema_validation.test.js --no-coverage
   ```

2. Validate schema syntax:
   ```bash
   npm run validate:strict
   ```

3. Test $ref resolution manually:
   ```bash
   node -e "
   const Ajv = require('ajv');
   const ajv = new Ajv();
   const schema = require('./data/schemas/operations/lockGrabbing.schema.json');
   const common = require('./data/schemas/common.schema.json');
   ajv.addSchema(common);
   const validate = ajv.compile(schema);
   console.log('Valid integer:', validate({ type: 'LOCK_GRABBING', parameters: { actor_id: 'a', count: 2 }}));
   console.log('Valid template:', validate({ type: 'LOCK_GRABBING', parameters: { actor_id: 'a', count: '{ctx.val}' }}));
   console.log('Invalid string:', validate({ type: 'LOCK_GRABBING', parameters: { actor_id: 'a', count: 'two' }}));
   "
   ```

### Invariants That Must Remain True

1. **INV-2 (Template Pattern Consistency)**: After this change, lockGrabbing uses shared definition
2. **Backward Compatibility**: All valid inputs remain valid, all invalid inputs remain invalid
3. **$ref Resolution**: AJV correctly resolves the cross-schema reference

---

## Estimated Effort

- **Size**: Small (S)
- **Complexity**: Low - simple find/replace of schema definition
- **Risk**: Low - behavior unchanged, just definition source

## Review Checklist

- [ ] `count` uses `$ref` to common.schema.json
- [ ] `$ref` path is correct (`../common.schema.json#/definitions/positiveIntegerOrTemplate`)
- [ ] All existing tests pass unchanged
- [ ] Schema validates with `npm run validate:strict`
- [ ] No other properties modified
- [ ] No local oneOf pattern remains
