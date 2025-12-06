# OPEHANARCANA-009: ESTABLISH_BIDIRECTIONAL_CLOSENESS Schema Definition

**Status:** Completed
**Priority:** High (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-005 (Phase 1 complete)

---

## Objective

Create and register the JSON schema for the `ESTABLISH_BIDIRECTIONAL_CLOSENESS` operation so the operation toolchain recognizes the new type without breaking validation.

---

## Current Reality vs. Original Assumptions

- `npm run validate:operations` is the gating check for operation schema additions; `npm run validate` / `validate:strict` focus on mods and will not catch missing operation wiring.
- The validator expects every schema type to have the full registration surface (operation schema ref, whitelist entry, DI token, handler registration + mapping, and a handler file). Without those, `validate:operations` and `test:ci` fail.
- `operation.schema.json` is not alphabetized; place the new `$ref` near the existing closeness operations rather than reordering the file.
- Handler logic remains a follow-up ticket (OPEHANARCANA-010/011); for this ticket we only need a minimal handler stub so validation passes and consumers fail fast if invoked.

---

## Files to Touch

### New Files

- `data/schemas/operations/establishBidirectionalCloseness.schema.json`
- `src/logic/operationHandlers/establishBidirectionalClosenessHandler.js` (stub for validation completeness)

### Modified Files

- `data/schemas/operation.schema.json` (add `$ref` entry)
- `src/utils/preValidationUtils.js` (add to whitelist)
- `src/dependencyInjection/tokens/tokens-core.js` (add handler token)
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (register stub handler)
- `src/dependencyInjection/registrations/interpreterRegistrations.js` (map operation to token)

---

## Out of Scope

- Rule migrations (hugging/hand-holding) — separate tickets.
- Full handler logic, data cleanup, or DI wiring beyond the minimal stub/registration needed for validation.
- PREPARE_ACTION_CONTEXT work (completed in Phase 1).

---

## Implementation Details

### Schema Structure

Create `data/schemas/operations/establishBidirectionalCloseness.schema.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/operations/establishBidirectionalCloseness.schema.json",
  "title": "ESTABLISH_BIDIRECTIONAL_CLOSENESS Operation",
  "description": "Establishes mutual relationship components on both actor and target, with optional cleanup of existing third-party relationships",
  "allOf": [
    { "$ref": "../base-operation.schema.json" },
    {
      "properties": {
        "type": { "const": "ESTABLISH_BIDIRECTIONAL_CLOSENESS" },
        "parameters": {
          "type": "object",
          "properties": {
            "actor_component_type": {
              "type": "string",
              "description": "Component type to add to actor, e.g., 'hugging:hugging'",
              "pattern": "^[a-z_]+:[a-z_]+$"
            },
            "target_component_type": {
              "type": "string",
              "description": "Component type to add to target, e.g., 'hugging:being_hugged'",
              "pattern": "^[a-z_]+:[a-z_]+$"
            },
            "actor_data": {
              "type": "object",
              "description": "Component data for actor (supports template variables like {event.payload.targetId})"
            },
            "target_data": {
              "type": "object",
              "description": "Component data for target (supports template variables like {event.payload.actorId})"
            },
            "clean_existing": {
              "type": "boolean",
              "default": true,
              "description": "Whether to clean up existing relationships with third parties before establishing new ones"
            },
            "existing_component_types_to_clean": {
              "type": "array",
              "items": { "type": "string" },
              "description": "List of component types to remove from both entities before establishing new relationship. If not provided, defaults to removing actor_component_type and target_component_type."
            },
            "regenerate_descriptions": {
              "type": "boolean",
              "default": true,
              "description": "Whether to regenerate entity descriptions after relationship change"
            }
          },
          "required": [
            "actor_component_type",
            "target_component_type",
            "actor_data",
            "target_data"
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

Add to the `anyOf` array near the closeness operations:

```json
{ "$ref": "./operations/establishBidirectionalCloseness.schema.json" }
```

### Minimal Handler Stub

- Create `EstablishBidirectionalClosenessHandler` extending `BaseOperationHandler` with a logger-only dependency and a stub `execute` that warns/returns to prevent silent failures if invoked before OPEHANARCANA-010 implements real logic.
- Register the token and mapping so `validate:operations` and `test:ci` remain green.

---

## Schema Design Rationale

1. **`actor_component_type` / `target_component_type`**: Namespaced component IDs for flexibility.
2. **`actor_data` / `target_data`**: Objects that support template variable interpolation.
3. **`clean_existing`**: Boolean flag to control third-party cleanup (some relationships may not need it).
4. **`existing_component_types_to_clean`**: Override default cleanup behavior for complex cases.
5. **`regenerate_descriptions`**: Control whether descriptions are regenerated (performance optimization).

---

## Acceptance Criteria

### Tests That Must Pass

1. Operation validation: `npm run validate:operations`.
2. Schema JSON parses: `node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/establishBidirectionalCloseness.schema.json'))"`.

### Invariants That Must Remain True

1. No existing operation schemas change.
2. No rule or mod data changes occur in this ticket.
3. The new handler stub is registered but does not perform real logic (reserved for OPEHANARCANA-010/011).

---

## Verification Steps

```bash
# 1. Verify schema is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operations/establishBidirectionalCloseness.schema.json'))"

# 2. Verify operation.schema.json is valid after modification
node -e "JSON.parse(require('fs').readFileSync('data/schemas/operation.schema.json'))"

# 3. Run operation registration validation (fails if whitelist/registrations are missing)
npm run validate:operations
```

---

## Outcome

- Added `establishBidirectionalCloseness.schema.json` with the required parameters and defaults, plus a new `$ref` in `operation.schema.json`.
- Added the whitelist entry, DI token, handler registration, interpreter mapping, and a logger-only stub handler to keep `validate:operations`/`test:ci` green (warns if invoked until OPEHANARCANA-010/011 delivers real logic).
- Verified JSON parsing and ran `npm run validate:operations` successfully.

---

## Reference Files

- Pattern to follow: `data/schemas/operations/prepareActionContext.schema.json`
- Similar complexity: `data/schemas/operations/establishSittingCloseness.schema.json`
- Base schema: `data/schemas/base-operation.schema.json`
- Integration point: `data/schemas/operation.schema.json`
