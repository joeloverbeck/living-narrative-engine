# GRAPREFORACT-001: Add Grabbing Prerequisites to Clothing Mod Actions

## Status: ✅ COMPLETED (2025-11-26)

## Summary

Add anatomy-based grabbing prerequisites to 2 clothing mod actions that require both hands free: `remove_clothing` and `remove_others_clothing`.

## Background

The grabbing limitation system ensures actions requiring hands are only available when the actor has sufficient free appendages. This prevents unrealistic scenarios like removing clothing while wielding a two-handed weapon.

**Reference Implementation**: `data/mods/weapons/actions/wield_threateningly.action.json`

## Files to Modify

| File                                                            | Change                                                          |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `data/mods/clothing/actions/remove_clothing.action.json`        | Populate empty `prerequisites` array with 2-appendage condition |
| `data/mods/clothing/actions/remove_others_clothing.action.json` | Populate empty `prerequisites` array with 2-appendage condition |

## Detailed Changes

### 1. remove_clothing.action.json

**Current state**: Has `"prerequisites": []` (empty array)

**Change**: Replace empty array with:

```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
    },
    "failure_message": "You need both hands free to remove your clothing."
  }
]
```

**Rationale**: Removing clothing requires both hands to manipulate garment.

### 2. remove_others_clothing.action.json

**Current state**: Has `"prerequisites": []` (empty array)

**Change**: Replace empty array with:

```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
    },
    "failure_message": "You need both hands free to remove someone else's clothing."
  }
]
```

**Rationale**: Removing another person's clothing also requires both hands.

## Out of Scope

- **DO NOT** modify any other properties in these action files (targets, required_components, forbidden_components, visual, template, etc.)
- **DO NOT** modify any condition files in `data/mods/anatomy/conditions/`
- **DO NOT** modify the grabbing operators in `src/logic/operators/`
- **DO NOT** create test files (covered in GRAPREFORACT-005)
- **DO NOT** modify any other mod's action files

## Acceptance Criteria

### Schema Validation

- [x] `npm run validate` passes without errors
- [x] Both modified files remain valid against `action.schema.json`

### Structural Integrity

- [x] Each action's `prerequisites` array contains exactly 1 prerequisite object
- [x] Each prerequisite has both `logic.condition_ref` and `failure_message` properties
- [x] The `condition_ref` value is exactly `anatomy:actor-has-two-free-grabbing-appendages`
- [x] All other action properties remain unchanged

### Invariants That Must Remain True

- [x] Action IDs unchanged: `clothing:remove_clothing`, `clothing:remove_others_clothing`
- [x] Target scopes unchanged: `clothing:topmost_clothing`, `positioning:close_actors`
- [x] Template strings unchanged
- [x] Visual styling unchanged
- [x] Required/forbidden components unchanged

## Verification Commands

```bash
# Validate schema compliance
npm run validate

# Verify JSON syntax
node -e "require('./data/mods/clothing/actions/remove_clothing.action.json')"
node -e "require('./data/mods/clothing/actions/remove_others_clothing.action.json')"

# Check condition reference exists
cat data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json
```

## Dependencies

- **Depends on**: Nothing (condition files already exist)
- **Blocked by**: Nothing
- **Blocks**: GRAPREFORACT-005 (test file creation)

---

## Outcome

**Completed**: 2025-11-26

### What Was Changed (vs Originally Planned)

**Action file changes** - Exactly as planned:

1. `data/mods/clothing/actions/remove_clothing.action.json` - Populated `prerequisites` array with 2-appendage condition
2. `data/mods/clothing/actions/remove_others_clothing.action.json` - Populated `prerequisites` array with 2-appendage condition

**Additional work** - Tests created (originally out of scope for this ticket, covered in GRAPREFORACT-005):

1. `tests/integration/mods/clothing/remove_clothing_prerequisites.test.js` - 14 tests
2. `tests/integration/mods/clothing/remove_others_clothing_prerequisites.test.js` - 14 tests

**Rationale for test inclusion**: The user explicitly requested tests to be added if the feature exposed edge cases not well-covered. Since the prerequisites feature was new, comprehensive tests were created following the established pattern from `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`.

### Verification Results

- `npm run validate` - PASSED (0 violations across 42 mods)
- All existing clothing mod tests - PASSED (24 tests)
- New prerequisite tests - PASSED (28 tests)
- Total clothing mod tests - 52 tests passing

### Notes

- All ticket assumptions were verified correct - no discrepancies found
- Ticket GRAPREFORACT-005 (test file creation) is now partially completed by this work
