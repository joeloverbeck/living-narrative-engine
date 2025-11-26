# GRAPREFORACT-002: Add Grabbing Prerequisites to Distress Mod Actions

## Summary

Add anatomy-based grabbing prerequisites to 2 distress mod actions:
- `bury_face_in_hands` - requires **2 free appendages** (both hands to cover face)
- `clutch_onto_upper_clothing` - requires **1 free appendage** (single hand clutch)

## Background

The grabbing limitation system ensures actions requiring hands are only available when the actor has sufficient free appendages. Different actions require different numbers of appendages based on their physical requirements.

**Reference Implementation**: `data/mods/weapons/actions/wield_threateningly.action.json`

## Files to Modify

| File | Change | Appendages Required |
|------|--------|---------------------|
| `data/mods/distress/actions/bury_face_in_hands.action.json` | Populate empty `prerequisites` array | 2 |
| `data/mods/distress/actions/clutch_onto_upper_clothing.action.json` | Populate empty `prerequisites` array | 1 |

## Detailed Changes

### 1. bury_face_in_hands.action.json

**Current state**: Has `"prerequisites": []` (empty array)

**Change**: Replace empty array with:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"
    },
    "failure_message": "You need both hands free to bury your face in them."
  }
]
```

**Rationale**: Action explicitly requires both hands to cover face.

### 2. clutch_onto_upper_clothing.action.json

**Current state**: Has `"prerequisites": []` (empty array)

**Change**: Replace empty array with:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need at least one free hand to clutch onto clothing."
  }
]
```

**Rationale**: Clutching can be done with a single hand.

## Out of Scope

- **DO NOT** modify any other properties in these action files (targets, required_components, forbidden_components, visual, template, etc.)
- **DO NOT** modify any condition files in `data/mods/anatomy/conditions/`
- **DO NOT** modify the grabbing operators in `src/logic/operators/`
- **DO NOT** create test files (covered in GRAPREFORACT-006)
- **DO NOT** modify any other mod's action files

## Acceptance Criteria

### Schema Validation
- [ ] `npm run validate` passes without errors
- [ ] Both modified files remain valid against `action.schema.json`

### Structural Integrity
- [ ] `bury_face_in_hands.action.json` prerequisites array contains exactly 1 prerequisite object
- [ ] `clutch_onto_upper_clothing.action.json` prerequisites array contains exactly 1 prerequisite object
- [ ] Each prerequisite has both `logic.condition_ref` and `failure_message` properties
- [ ] `bury_face_in_hands` uses condition `anatomy:actor-has-two-free-grabbing-appendages`
- [ ] `clutch_onto_upper_clothing` uses condition `anatomy:actor-has-free-grabbing-appendage`
- [ ] All other action properties remain unchanged

### Invariants That Must Remain True
- [ ] Action IDs unchanged: `distress:bury_face_in_hands`, `distress:clutch_onto_upper_clothing`
- [ ] Target configurations unchanged
- [ ] Template strings unchanged
- [ ] Visual styling unchanged
- [ ] Required/forbidden components unchanged

## Verification Commands

```bash
# Validate schema compliance
npm run validate

# Verify JSON syntax
node -e "require('./data/mods/distress/actions/bury_face_in_hands.action.json')"
node -e "require('./data/mods/distress/actions/clutch_onto_upper_clothing.action.json')"

# Check condition references exist
cat data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
cat data/mods/anatomy/conditions/actor-has-two-free-grabbing-appendages.condition.json
```

## Dependencies

- **Depends on**: Nothing (condition files already exist)
- **Blocked by**: Nothing
- **Blocks**: GRAPREFORACT-006 (test file creation)
