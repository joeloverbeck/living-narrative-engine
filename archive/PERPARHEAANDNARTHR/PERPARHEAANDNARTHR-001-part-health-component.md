# PERPARHEAANDNARTHR-001: Part Health Component Schema

**Status:** Completed
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** None

---

## Objective

Create the `anatomy:part_health` component schema that tracks health status on body part entities, including current/max health values, narrative state label, and state duration tracking.

---

## Files to Touch

### New Files
- `data/mods/anatomy/components/part_health.component.json`

### Modified Files
- `tests/unit/schemas/core.allComponents.schema.test.js` (add test fixtures for part_health component)

---

## Out of Scope

**DO NOT modify:**
- Any existing anatomy components (`part.component.json`, `joint.component.json`, etc.)
- Any entity definition files
- Any operation handler files
- Any DI registration files
- The mod manifest (covered in PERPARHEAANDNARTHR-011)

**NOTE:** Test fixtures in `tests/unit/schemas/core.allComponents.schema.test.js` must be added for the new component. This test auto-discovers components and requires valid/invalid payload fixtures.

---

## Implementation Details

### Component Schema Structure

Create `data/mods/anatomy/components/part_health.component.json`:

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "anatomy:part_health",
  "description": "Tracks health status of a body part entity. Maps numeric health values to narrative state labels based on percentage thresholds.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "currentHealth": {
        "type": "number",
        "minimum": 0,
        "description": "Current health points of the body part. Must not exceed maxHealth."
      },
      "maxHealth": {
        "type": "number",
        "minimum": 1,
        "description": "Maximum health capacity of the body part."
      },
      "state": {
        "type": "string",
        "enum": [
          "healthy",
          "bruised",
          "wounded",
          "badly_damaged",
          "destroyed"
        ],
        "description": "Narrative health state based on percentage thresholds. healthy (76-100%), bruised (51-75%), wounded (26-50%), badly_damaged (1-25%), destroyed (0%)."
      },
      "turnsInState": {
        "type": "integer",
        "minimum": 0,
        "default": 0,
        "description": "Consecutive turns the part has been in the current state. Resets to 0 when state changes."
      }
    },
    "required": [
      "currentHealth",
      "maxHealth",
      "state"
    ],
    "additionalProperties": false
  },
  "validationRules": {
    "generateValidator": true,
    "errorMessages": {
      "invalidEnum": "Invalid health state: {{value}}. Valid states: healthy, bruised, wounded, badly_damaged, destroyed",
      "missingRequired": "{PropertyLabel} is required",
      "invalidType": "Invalid type for {propertyName}: expected {{expected}}, got {{actual}}",
      "minimum": "{PropertyLabel} must be at least {{limit}}"
    },
    "suggestions": {
      "enableSimilarity": true,
      "maxDistance": 3,
      "maxSuggestions": 3
    }
  }
}
```

### Design Rationale

1. **Combined Component**: Follows `metabolism:hunger_state` pattern - keeps health values and narrative state together
2. **Minimum Health of 1**: maxHealth must be at least 1 to prevent division by zero in percentage calculation
3. **turnsInState**: Enables time-based rules (e.g., "if wounded for 5+ turns, infection risk")
4. **additionalProperties: false**: Strict schema prevents future creep; extensions use new components
5. **State enum**: Fixed set of narrative states matching spec thresholds

---

## Acceptance Criteria

### Tests That Must Pass

1. **Schema validation tests:**
   - `npm run validate` passes without errors
   - `npm run validate:strict` passes without errors

2. **JSON schema validity:**
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/components/part_health.component.json'))"
   ```

3. **Component schema compliance:**
   - File validates against `schema://living-narrative-engine/component.schema.json`
   - All required fields present (`id`, `description`, `dataSchema`)
   - `id` follows namespaced format `anatomy:part_health`

### Invariants That Must Remain True

1. All existing anatomy components remain unchanged
2. All existing entity definitions continue to validate
3. `npm run test:ci` passes (no regressions)
4. Component follows exact same pattern as `metabolism:hunger_state.component.json`
5. No breaking changes to anatomy mod

---

## Verification Steps

```bash
# 1. Verify component file is valid JSON
node -e "JSON.parse(require('fs').readFileSync('data/mods/anatomy/components/part_health.component.json'))"

# 2. Run full validation
npm run validate

# 3. Run strict validation
npm run validate:strict

# 4. Run test suite to ensure no regressions
npm run test:ci
```

---

## Reference Files

- Pattern to follow: `data/mods/metabolism/components/hunger_state.component.json`
- Schema reference: `data/schemas/component.schema.json`
- Existing anatomy components: `data/mods/anatomy/components/part.component.json`

---

## Outcome

**Completion Date:** 2025-11-27

### What Was Actually Changed

1. **Created `data/mods/anatomy/components/part_health.component.json`**
   - Implemented exactly as specified in the ticket
   - Follows `metabolism:hunger_state.component.json` pattern
   - Includes all required fields: `currentHealth`, `maxHealth`, `state`, `turnsInState`
   - State enum: `healthy`, `bruised`, `wounded`, `badly_damaged`, `destroyed`

2. **Modified `tests/unit/schemas/core.allComponents.schema.test.js`**
   - Added valid payload fixture for `anatomy:part_health`
   - Added invalid payload fixture for `anatomy:part_health`
   - Required because the test auto-discovers components and validates payloads

### Discrepancies From Original Plan

- **Test file modification required**: The original ticket stated "DO NOT modify any test files" but the `core.allComponents.schema.test.js` auto-discovers new components and requires test fixtures. Ticket was updated to reflect this reality before implementation.

### Verification Results

- ✅ `npm run validate` passes
- ✅ `npm run validate:strict` passes
- ✅ JSON is valid (verified with `node -e`)
- ✅ Unit tests pass (2250 test suites pass, pre-existing `main.test.js` isolation issue unrelated)
- ✅ No changes to existing anatomy components
- ✅ Component follows `hunger_state` pattern exactly
