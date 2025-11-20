# HUNMETSYS-008: Action Definitions - Eat, Drink, Rest

**Status:** Ready  
**Priority:** High  
**Estimated Effort:** 4 hours  
**Phase:** 2 - Mod Structure  
**Dependencies:** HUNMETSYS-001, 002, 006 (schemas and mod structure)

## Objective

Create action definition files for eat, drink, and rest actions that players and AI can use to manage hunger and energy.

## Files to Touch

### New Files (3)
- `data/mods/metabolism/actions/eat.action.json`
- `data/mods/metabolism/actions/drink.action.json`
- `data/mods/metabolism/actions/rest.action.json`

### Modified Files (1)
- `data/mods/metabolism/mod-manifest.json` (add to content.actions array)

## Out of Scope

- ❌ Rule handlers for actions (HUNMETSYS-009)
- ❌ Conditions/scopes referenced by actions (HUNMETSYS-013)
- ❌ Integration tests (HUNMETSYS-017)
- ❌ GOAP integration (HUNMETSYS-013)

## Implementation Details

### Eat Action

**Purpose:** Consume food item to restore energy via digestion buffer

**Required Components:**
- Actor: metabolism:fuel_converter, metabolism:metabolic_store

**Forbidden Components:**
- Actor: metabolism:overfull (prevents eating when too full)

**Prerequisites:**
- Buffer has room for item (uses can_consume condition - placeholder for now)

**Target:** Primary target from scope metabolism:consumable_items

### Drink Action

**Purpose:** Consume liquid item (similar to eat but for drinks)

**Required Components:**
- Actor: metabolism:fuel_converter, metabolism:metabolic_store

**Prerequisites:**
- Item has "liquid" fuel tag
- Buffer has room

**Target:** Primary target from scope metabolism:consumable_items

### Rest Action

**Purpose:** Recover energy through rest without consuming food

**Required Components:**
- Actor: metabolism:metabolic_store

**No Prerequisites:** Can always rest

**No Targets:** Self-directed action

**Special Mechanics:**
- Adds fixed energy amount (bypasses digestion)
- Increases digestion speed temporarily (1.5x multiplier)

## Acceptance Criteria

### Action Files
- [ ] All 3 action files created with valid JSON
- [ ] Actions validate against action.schema.json
- [ ] Action IDs follow format: metabolism:action_name
- [ ] Required/forbidden components correctly specified
- [ ] Template strings use correct placeholder names
- [ ] Visual properties include category and icon

### Action Logic
- [ ] Eat action requires fuel_converter and metabolic_store
- [ ] Drink action similar to eat with liquid fuel tag requirement
- [ ] Rest action only requires metabolic_store
- [ ] Eat/drink prevent execution when overfull
- [ ] Prerequisites reference conditions (placeholders acceptable)

### Mod Manifest
- [ ] All 3 actions added to content.actions array
- [ ] Manifest validates after update

### Validation
```bash
npm run validate           # Actions validate
```

## Example Action Definitions

### Eat Action
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "metabolism:eat",
  "name": "Eat",
  "description": "Consume a food item to restore energy",
  "targets": {
    "primary": {
      "scope": "metabolism:consumable_items",
      "placeholder": "food"
    }
  },
  "template": "eat {food}",
  "required_components": {
    "actor": ["metabolism:fuel_converter", "metabolism:metabolic_store"]
  },
  "forbidden_components": {
    "actor": ["metabolism:overfull"]
  },
  "prerequisites": [
    {
      "logic": { "condition_ref": "metabolism:can_consume" },
      "failure_message": "Your stomach is too full to eat more."
    }
  ],
  "visual_properties": {
    "category": "survival",
    "icon": "utensils"
  }
}
```

### Rest Action
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "metabolism:rest",
  "name": "Rest",
  "description": "Recover energy through rest (no food required)",
  "targets": {},
  "template": "rest",
  "required_components": {
    "actor": ["metabolism:metabolic_store"]
  },
  "prerequisites": [],
  "visual_properties": {
    "category": "survival",
    "icon": "bed"
  }
}
```

## Invariants

### Must Remain True
- Action IDs must be namespaced with "metabolism:"
- Required components must exist for actions to execute
- Prerequisites must fail gracefully with clear messages
- Template strings must match target placeholder names

### System Invariants
- Action discovery continues functioning
- Action validation works correctly
- GOAP can evaluate action availability
- UI can display actions properly

## References

- Spec: Lines 939-1069 (Action Integration)
- Related: HUNMETSYS-005 (CONSUME_ITEM operation)
- Related: HUNMETSYS-009 (action rule handlers)
- Related: HUNMETSYS-013 (conditions and scopes)

## Definition of Done

- [ ] All 3 action files created with complete definitions
- [ ] Actions validate with `npm run validate`
- [ ] Mod manifest updated with actions
- [ ] Action IDs follow naming conventions
- [ ] Required/forbidden components correctly specified
- [ ] Committed with message: "feat(metabolism): add eat, drink, and rest action definitions"
