# GRAPREFORACT-004: Add Grabbing Prerequisites to Items Mod Actions

## Summary

Add anatomy-based grabbing prerequisites to 4 items mod actions that require 1 free hand:
- `drink_entirely` - drinking requires a hand to hold the container
- `drink_from` - drinking requires a hand to hold the container
- `pick_up_item` - picking up items requires at least one free hand
- `take_from_container` - taking items from containers requires a free hand

## Background

The grabbing limitation system ensures actions requiring hands are only available when the actor has sufficient free appendages. All items mod actions require at least one free hand to manipulate objects.

**Reference Implementation**: `data/mods/weapons/actions/wield_threateningly.action.json`

## Files to Modify

| File | Current State | Change |
|------|---------------|--------|
| `data/mods/items/actions/drink_entirely.action.json` | Has `"prerequisites": []` | Populate empty array |
| `data/mods/items/actions/drink_from.action.json` | Has `"prerequisites": []` | Populate empty array |
| `data/mods/items/actions/pick_up_item.action.json` | Has `"prerequisites": []` | Populate empty array |
| `data/mods/items/actions/take_from_container.action.json` | **No prerequisites key** | Add prerequisites key with array |

## Detailed Changes

### 1. drink_entirely.action.json

**Current state**: Has `"prerequisites": []` (empty array)

**Change**: Replace empty array with:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need a free hand to drink."
  }
]
```

### 2. drink_from.action.json

**Current state**: Has `"prerequisites": []` (empty array)

**Change**: Replace empty array with:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need a free hand to drink."
  }
]
```

### 3. pick_up_item.action.json

**Current state**: Has `"prerequisites": []` (empty array)

**Change**: Replace empty array with:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need a free hand to pick up items."
  }
]
```

### 4. take_from_container.action.json

**Current state**: **No prerequisites key exists**

**Change**: Add new prerequisites key after the `forbidden_components` property:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need a free hand to take items from the container."
  }
]
```

## Out of Scope

- **DO NOT** modify any other properties in these action files (targets, required_components, forbidden_components, visual, template, etc.)
- **DO NOT** modify any condition files in `data/mods/anatomy/conditions/`
- **DO NOT** modify the grabbing operators in `src/logic/operators/`
- **DO NOT** create test files (covered in GRAPREFORACT-008)
- **DO NOT** modify any other mod's action files

## Acceptance Criteria

### Schema Validation
- [ ] `npm run validate` passes without errors
- [ ] All 4 modified files remain valid against `action.schema.json`

### Structural Integrity
- [ ] Each action's `prerequisites` array contains exactly 1 prerequisite object
- [ ] Each prerequisite has both `logic.condition_ref` and `failure_message` properties
- [ ] The `condition_ref` value is exactly `anatomy:actor-has-free-grabbing-appendage` for all 4 actions
- [ ] All other action properties remain unchanged

### Invariants That Must Remain True
- [ ] Action IDs unchanged:
  - `items:drink_entirely`
  - `items:drink_from`
  - `items:pick_up_item`
  - `items:take_from_container`
- [ ] Target configurations unchanged
- [ ] Template strings unchanged
- [ ] Visual styling unchanged
- [ ] Required/forbidden components unchanged
- [ ] `generateCombinations` setting unchanged for `take_from_container`

## Verification Commands

```bash
# Validate schema compliance
npm run validate

# Verify JSON syntax for all files
node -e "require('./data/mods/items/actions/drink_entirely.action.json')"
node -e "require('./data/mods/items/actions/drink_from.action.json')"
node -e "require('./data/mods/items/actions/pick_up_item.action.json')"
node -e "require('./data/mods/items/actions/take_from_container.action.json')"

# Verify all have prerequisites with correct condition
node -e "
['drink_entirely', 'drink_from', 'pick_up_item', 'take_from_container'].forEach(name => {
  const action = require('./data/mods/items/actions/' + name + '.action.json');
  console.log(name + ':', action.prerequisites?.[0]?.logic?.condition_ref);
});
"

# Check condition reference exists
cat data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json
```

## Dependencies

- **Depends on**: Nothing (condition files already exist)
- **Blocked by**: Nothing
- **Blocks**: GRAPREFORACT-008 (test file creation)

## Notes

- The `take_from_container.action.json` file is unique in that it doesn't have a `prerequisites` key at all - it needs to be added, not just populated
- All 4 actions use the **1-appendage** condition since manipulating items requires only one hand

## Outcome

**Status**: COMPLETED

### Changes Made

1. **drink_entirely.action.json** - Added grabbing prerequisite with failure message "You need a free hand to drink."
2. **drink_from.action.json** - Added grabbing prerequisite with failure message "You need a free hand to drink."
3. **pick_up_item.action.json** - Added grabbing prerequisite with failure message "You need a free hand to pick up items."
4. **take_from_container.action.json** - Added new `prerequisites` key with grabbing prerequisite (file previously had no prerequisites key)

### Tests Updated

| Test File | Changes Made | Rationale |
|-----------|--------------|-----------|
| `tests/integration/mods/items/pickUpItemActionDiscovery.test.js` | Updated assertion to verify prerequisite structure | Test now validates the new prerequisite exists |
| `tests/integration/mods/items/pickUpItemForbiddenComponents.test.js` | Added hand entity with `anatomy:can_grab` component | Actor needs free grabbing appendage for prerequisite to pass |
| `tests/integration/mods/items/takeFromContainerActionDiscovery.test.js` | Added hand entity with `anatomy:can_grab` component | Actor needs free grabbing appendage for prerequisite to pass |
| `tests/integration/mods/items/dropThenPickupCacheStaleness.test.js` | Added hand entities, registered grabbing condition, registered pick_up_item action | Complex test that tests drop→pickup workflow needed complete setup for both actions |

### Verification

- ✅ `npm run validate` passes
- ✅ All 67 items mod integration tests pass (457 tests total)
- ✅ ESLint passes on modified files
- ✅ All acceptance criteria met
