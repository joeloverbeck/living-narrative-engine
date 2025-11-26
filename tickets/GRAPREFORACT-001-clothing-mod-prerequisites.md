# GRAPREFORACT-001: Add Grabbing Prerequisites to Clothing Mod Actions

## Summary

Add anatomy-based grabbing prerequisites to 2 clothing mod actions that require both hands free: `remove_clothing` and `remove_others_clothing`.

## Background

The grabbing limitation system ensures actions requiring hands are only available when the actor has sufficient free appendages. This prevents unrealistic scenarios like removing clothing while wielding a two-handed weapon.

**Reference Implementation**: `data/mods/weapons/actions/wield_threateningly.action.json`

## Files to Modify

| File | Change |
|------|--------|
| `data/mods/clothing/actions/remove_clothing.action.json` | Populate empty `prerequisites` array with 2-appendage condition |
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
- [ ] `npm run validate` passes without errors
- [ ] Both modified files remain valid against `action.schema.json`

### Structural Integrity
- [ ] Each action's `prerequisites` array contains exactly 1 prerequisite object
- [ ] Each prerequisite has both `logic.condition_ref` and `failure_message` properties
- [ ] The `condition_ref` value is exactly `anatomy:actor-has-two-free-grabbing-appendages`
- [ ] All other action properties remain unchanged

### Invariants That Must Remain True
- [ ] Action IDs unchanged: `clothing:remove_clothing`, `clothing:remove_others_clothing`
- [ ] Target scopes unchanged: `clothing:topmost_clothing`, `positioning:close_actors`
- [ ] Template strings unchanged
- [ ] Visual styling unchanged
- [ ] Required/forbidden components unchanged

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
