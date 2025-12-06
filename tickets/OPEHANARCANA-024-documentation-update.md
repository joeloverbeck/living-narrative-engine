# OPEHANARCANA-024: Documentation Update

**Status:** Ready
**Priority:** Low (Final Phase)
**Estimated Effort:** 0.5 days
**Dependencies:** All previous OPEHANARCANA tickets complete

---

## Objective

Update project documentation to reflect the new composite operation handlers and migration patterns. This ensures future developers understand and use the new handlers correctly.

---

## Files to Touch

### Modified Files

- `CLAUDE.md` - Add new handlers to "Adding New Operations" section
- `docs/modding/` - Update modding guides (if applicable)

### New Files (Optional)

- `docs/operations/composite-handlers.md` - Guide for using PREPARE_ACTION_CONTEXT, ESTABLISH/BREAK_BIDIRECTIONAL_CLOSENESS, VALIDATED_ITEM_TRANSFER

---

## Out of Scope

**DO NOT modify:**

- Any source code files
- Any test files
- Any schema files
- Any rule files
- Any handler implementations

---

## Documentation Updates

### 1. CLAUDE.md Updates

Add to the "Adding New Operations" section or create new section:

````markdown
### Composite Operation Handlers

The project includes several composite handlers that consolidate common patterns:

#### PREPARE_ACTION_CONTEXT

Consolidates the common "simple action" pattern (82% of rules):

- Queries actor/target components
- Resolves entity names
- Sets up locationId from actor position
- Populates context for downstream operations

**Usage:**

```json
{
  "type": "PREPARE_ACTION_CONTEXT"
}
```
````

**Context populated:**

- `context.actorId`, `context.targetId`
- `context.actorName`, `context.targetName`
- `context.locationId`
- `context.actor` (full component data)
- `context.target` (full component data)

#### ESTABLISH_BIDIRECTIONAL_CLOSENESS

Handles relationship establishment with automatic third-party cleanup:

**Usage:**

```json
{
  "type": "ESTABLISH_BIDIRECTIONAL_CLOSENESS",
  "parameters": {
    "actor_component_type": "mod:active_component",
    "target_component_type": "mod:passive_component",
    "actor_data": { "partner_id": "{event.payload.targetId}" },
    "target_data": { "partner_id": "{event.payload.actorId}" },
    "existing_component_types_to_clean": [
      "mod:active_component",
      "mod:passive_component"
    ]
  }
}
```

#### BREAK_BIDIRECTIONAL_CLOSENESS

Handles relationship removal with automatic cleanup:

**Usage:**

```json
{
  "type": "BREAK_BIDIRECTIONAL_CLOSENESS",
  "parameters": {
    "actor_component_type": "mod:active_component",
    "target_component_type": "mod:passive_component"
  }
}
```

#### VALIDATED_ITEM_TRANSFER

Handles inventory operations with validation and dual success/failure paths:

**Usage:**

```json
{
  "type": "VALIDATED_ITEM_TRANSFER",
  "parameters": {
    "from_entity_ref": "actor",
    "to_entity_ref": "target",
    "item_entity_ref": "item",
    "validation_type": "inventory",
    "transfer_type": "inventory_to_inventory",
    "success_message_template": "{actorName} gives {itemName} to {targetName}.",
    "failure_message_template": "{targetName}'s inventory is full."
  }
}
```

````

### 2. New Documentation File

Create `docs/operations/composite-handlers.md`:

```markdown
# Composite Operation Handlers

This guide covers the composite operation handlers that consolidate common patterns.

## Overview

| Handler | Use Case | Reduction |
|---------|----------|-----------|
| PREPARE_ACTION_CONTEXT | Simple actions (most rules) | ~85% |
| ESTABLISH_BIDIRECTIONAL_CLOSENESS | Relationship establishment | ~88% |
| BREAK_BIDIRECTIONAL_CLOSENESS | Relationship removal | ~80% |
| VALIDATED_ITEM_TRANSFER | Inventory operations | ~92% |

## PREPARE_ACTION_CONTEXT

[Detailed documentation...]

## ESTABLISH_BIDIRECTIONAL_CLOSENESS

[Detailed documentation...]

## BREAK_BIDIRECTIONAL_CLOSENESS

[Detailed documentation...]

## VALIDATED_ITEM_TRANSFER

[Detailed documentation...]

## Migration Guide

When migrating existing rules:

1. Identify the pattern (simple action, bidirectional, inventory)
2. Replace expanded operations with appropriate composite handler
3. Update message templates to use context variables
4. Test that behavior is identical

## Examples

[Before/after examples for each handler type...]
````

---

## Acceptance Criteria

### Validation

1. **Documentation is accurate:**
   - All code examples compile/validate
   - Handler names match actual implementations
   - Parameter names match schemas

2. **Documentation is complete:**
   - All 4 composite handlers documented
   - Usage examples provided
   - Migration guidance included

3. **CLAUDE.md remains valid:**
   - File parses correctly
   - Links work
   - No broken references

### Invariants That Must Remain True

1. No code changes in this ticket
2. All existing documentation remains accurate
3. New documentation follows existing style

---

## Verification Steps

```bash
# 1. Validate CLAUDE.md is valid markdown
# (Manual review)

# 2. Verify handler names match code
grep -l "PREPARE_ACTION_CONTEXT" src/logic/operationHandlers/
grep -l "ESTABLISH_BIDIRECTIONAL_CLOSENESS" src/logic/operationHandlers/
grep -l "BREAK_BIDIRECTIONAL_CLOSENESS" src/logic/operationHandlers/
grep -l "VALIDATED_ITEM_TRANSFER" src/logic/operationHandlers/

# 3. Verify schema names match
ls data/schemas/operations/ | grep -E "(prepareActionContext|establishBidirectionalCloseness|breakBidirectionalCloseness|validatedItemTransfer)"

# 4. Run tests to ensure documentation examples are accurate
npm run test:ci
```

---

## Notes

- This ticket should be done LAST after all handlers are implemented and tested
- Documentation should reflect the ACTUAL implementation, not the planned one
- Keep examples minimal but complete
- Link to relevant schema files for full parameter documentation

---

## Reference Files

- Handler implementations: `src/logic/operationHandlers/`
- Schema definitions: `data/schemas/operations/`
- Existing docs: `docs/`
