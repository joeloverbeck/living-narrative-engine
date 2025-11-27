# OPEHANARCANA-017: VALIDATED_ITEM_TRANSFER Schema Definition

**Status:** Ready
**Priority:** Medium (Phase 3)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-005 (Phase 1 complete)

---

## Objective

Create the JSON schema for the `VALIDATED_ITEM_TRANSFER` operation, which will consolidate the inventory validation + transfer + logging pattern affecting 4 rules (each ~180 lines, 92% reduction).

---

## Files to Touch

### New Files
- `data/schemas/operations/validatedItemTransfer.schema.json`

### Modified Files
- `data/schemas/operation.schema.json` (add `$ref` entry)

---

## Out of Scope

**DO NOT modify:**
- Any existing operation handler schemas
- Any operation handler implementation files
- Any rule files (migrations are separate tickets)
- Any DI registration files (covered in OPEHANARCANA-019)
- `preValidationUtils.js` (covered in OPEHANARCANA-019)
- Bidirectional closeness files (Phase 2)

---

## Implementation Details

### Schema Structure

Create `data/schemas/operations/validatedItemTransfer.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/validatedItemTransfer.schema.json",
  "title": "VALIDATED_ITEM_TRANSFER Operation",
  "description": "Validates capacity and transfers an item between entities, handling both success and failure paths with appropriate events",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "VALIDATED_ITEM_TRANSFER" },
        "parameters": {
          "type": "object",
          "properties": {
            "from_entity_ref": {
              "type": "string",
              "description": "Reference to source entity (e.g., 'actor', 'target', or entity ID)",
              "enum": ["actor", "target", "secondary", "item"]
            },
            "to_entity_ref": {
              "type": "string",
              "description": "Reference to destination entity",
              "enum": ["actor", "target", "secondary", "location"]
            },
            "item_entity_ref": {
              "type": "string",
              "description": "Reference to the item being transferred",
              "default": "item"
            },
            "validation_type": {
              "type": "string",
              "enum": ["inventory", "container", "none"],
              "default": "inventory",
              "description": "Type of capacity validation to perform"
            },
            "transfer_type": {
              "type": "string",
              "enum": ["inventory_to_inventory", "location_to_inventory", "inventory_to_location", "inventory_to_container", "container_to_inventory"],
              "description": "Type of transfer operation"
            },
            "success_message_template": {
              "type": "string",
              "description": "Message template for successful transfer (supports {actorName}, {targetName}, {itemName})"
            },
            "failure_message_template": {
              "type": "string",
              "description": "Message template for failed transfer due to capacity"
            },
            "perception_type": {
              "type": "string",
              "default": "item_transfer",
              "description": "Type of perception event to dispatch"
            },
            "failure_perception_type": {
              "type": "string",
              "default": "item_transfer_failed",
              "description": "Type of perception event for failure"
            }
          },
          "required": [
            "from_entity_ref",
            "to_entity_ref",
            "transfer_type",
            "success_message_template",
            "failure_message_template"
          ],
          "additionalProperties": false
        }
      },
      "required": ["type", "parameters"]
    }
  ]
}
```

### operation.schema.json Update

Add to the `anyOf` array in alphabetical order:

```json
{ "$ref": "./operations/validatedItemTransfer.schema.json" }
```

---

## Schema Design Rationale

1. **Entity references**: Use refs like `actor`, `target`, `item` instead of IDs for flexibility
2. **Validation type**: Support different validation strategies (inventory, container, none)
3. **Transfer type**: Explicit about what kind of transfer to perform
4. **Message templates**: Support variable interpolation for log messages
5. **Dual perception types**: Different events for success vs failure
6. **Failure path handling**: Built-in support for capacity validation failures

---

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation tests:**
   - `npm run validate` passes without errors
   - `npm run validate:strict` passes without errors

2. **JSON schema validity:**
   - Schema file is valid JSON (parseable)
   - Schema references resolve correctly

3. **Manual validation:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/validatedItemTransfer.schema.json'))"
   ```

### Invariants That Must Remain True

1. All existing operation schemas remain unchanged
2. All existing rules continue to validate successfully
3. `npm run test:ci` passes (no regressions)

---

## Verification Steps

```bash
# 1. Verify schema is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/validatedItemTransfer.schema.json'))"

# 2. Verify operation.schema.json is valid after modification
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operation.schema.json'))"

# 3. Run full validation
npm run validate

# 4. Run test suite
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/schemas/operations/transferItem.schema.json`
- Validation pattern: `data/schemas/operations/validateInventoryCapacity.schema.json`
- Base schema: `data/schemas/base-operation.schema.json`
