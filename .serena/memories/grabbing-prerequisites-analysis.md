# Grabbing Prerequisites Analysis - Target Action Files

## Summary
Found all 9 target action files across 4 mod categories. All currently have empty or missing prerequisite arrays. One action (show_off_biceps) already has a different prerequisite structure serving as a reference pattern.

---

## TARGET ACTION FILES ANALYSIS

### 1. **remove_clothing.action.json**
- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/clothing/actions/remove_clothing.action.json`
- **Mod Category**: `clothing`
- **Current Prerequisites**: `"prerequisites": []` (line 20, empty array)
- **Structure**: Single target scope (`clothing:topmost_clothing`)
- **Required Components**: `clothing:equipment` on actor

### 2. **remove_others_clothing.action.json**
- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/clothing/actions/remove_others_clothing.action.json`
- **Mod Category**: `clothing`
- **Current Prerequisites**: `"prerequisites": []` (line 25, empty array)
- **Structure**: Multi-target (primary: person, secondary: clothing item)
- **Note**: Has `generateCombinations: true` (line 23)

### 3. **bury_face_in_hands.action.json**
- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/distress/actions/bury_face_in_hands.action.json`
- **Mod Category**: `distress`
- **Current Prerequisites**: `"prerequisites": []` (line 12, empty array)
- **Structure**: No targets (`"targets": "none"`)
- **Analysis**: Simple self-action, requires hands for the gesture

### 4. **clutch_onto_upper_clothing.action.json**
- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/distress/actions/clutch_onto_upper_clothing.action.json`
- **Mod Category**: `distress`
- **Current Prerequisites**: `"prerequisites": []` (line 28, empty array)
- **Structure**: Multi-target (primary: person, secondary: clothing)
- **Required Components**: `positioning:closeness` on actor

### 5. **show_off_biceps.action.json**
- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/exercise/actions/show_off_biceps.action.json`
- **Mod Category**: `exercise`
- **Current Prerequisites**: Non-empty (lines 12-38)
- **Structure**: Reference implementation with custom JSON Logic
- **Operator Used**: `hasPartOfTypeWithComponentValue`
- **Pattern**: Uses "or" logic for muscular/hulking build requirement

### 6. **drink_entirely.action.json**
- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/items/actions/drink_entirely.action.json`
- **Mod Category**: `items`
- **Current Prerequisites**: Missing from file (no prerequisites key)
- **Structure**: Single target scope (`items:examinable_items`)
- **Required Components**: `items:drinkable`, `items:liquid_container` on primary

### 7. **drink_from.action.json**
- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/items/actions/drink_from.action.json`
- **Mod Category**: `items`
- **Current Prerequisites**: Missing from file (no prerequisites key)
- **Structure**: Single target scope (`items:examinable_items`)
- **Required Components**: `items:drinkable`, `items:liquid_container` on primary

### 8. **pick_up_item.action.json**
- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/items/actions/pick_up_item.action.json`
- **Mod Category**: `items`
- **Current Prerequisites**: `"prerequisites": []` (line 19, empty array)
- **Structure**: Single target scope (`items:items_at_location`)
- **Required Components**: `items:inventory` on actor

### 9. **take_from_container.action.json**
- **Location**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/items/actions/take_from_container.action.json`
- **Mod Category**: `items`
- **Current Prerequisites**: Missing from file (no prerequisites key)
- **Structure**: Multi-target (primary: container, secondary: item)
- **Has `generateCombinations: true`**
- **Required Components**: `items:inventory` on actor

---

## EXISTING GRABBING PREREQUISITE PATTERN

### Reference Implementation
**File**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/weapons/actions/wield_threateningly.action.json`

Prerequisites structure using condition_ref:
```json
{
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
      },
      "failure_message": "You need at least one free hand or appendage to wield a weapon."
    }
  ]
}
```

### Condition File
**File**: `/home/joeloverbeck/projects/living-narrative-engine/data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "anatomy:actor-has-free-grabbing-appendage",
  "description": "Checks if the actor has at least one free (unlocked) grabbing appendage available",
  "logic": {
    "hasFreeGrabbingAppendages": ["actor", 1]
  }
}
```

### Operator Implementation
**File**: `/home/joeloverbeck/projects/living-narrative-engine/src/logic/operators/hasFreeGrabbingAppendagesOperator.js`

Available operators for grabbing actions:
- `hasFreeGrabbingAppendages` - Checks if actor has N free appendages
- `canActorGrabItemOperator` - Checks if actor can grab specific item
- `isItemBeingGrabbedOperator` - Checks if item is currently being grabbed

---

## TEST REFERENCES FOUND

### Integration Tests
1. **`wield_threateningly_prerequisites.test.js`** at `tests/integration/mods/weapons/`
   - Tests prerequisite evaluation with grabbing conditions
   - Pattern for testing grabbing prerequisites

2. **`actor-has-free-grabbing-appendage.test.js`** at `tests/unit/conditions/`
   - Unit tests for the free grabbing appendage condition
   - Tests the `hasFreeGrabbingAppendages` operator

3. **`fantasyWeaponGrabbingRequirements.test.js`** at `tests/integration/fantasy/`
   - Tests grabbing requirements for fantasy weapons

---

## KEY FINDINGS

### Files Missing Prerequisites Key (3)
- `drink_entirely.action.json`
- `drink_from.action.json`
- `take_from_container.action.json`

### Files with Empty Prerequisites (6)
- `remove_clothing.action.json`
- `remove_others_clothing.action.json`
- `bury_face_in_hands.action.json`
- `clutch_onto_upper_clothing.action.json`
- `pick_up_item.action.json`
- `show_off_biceps.action.json` (has non-grabbing prerequisites)

### Mod Category Distribution
- **clothing** (2): remove_clothing, remove_others_clothing
- **distress** (2): bury_face_in_hands, clutch_onto_upper_clothing
- **exercise** (1): show_off_biceps
- **items** (4): drink_entirely, drink_from, pick_up_item, take_from_container
