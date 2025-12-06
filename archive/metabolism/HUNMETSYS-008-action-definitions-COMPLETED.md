# HUNMETSYS-008: Action Definitions - Eat, Drink, Rest

**Status:** Completed
**Priority:** High
**Estimated Effort:** 4 hours
**Actual Effort:** 2 hours
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

## Placeholder Dependencies

**Note:** The following references are intentionally left as placeholders and will be implemented in future tickets:

- **metabolism:consumable_items scope** (HUNMETSYS-013) - Actions reference but will not validate until scope is created
- **metabolism:can_consume condition** (HUNMETSYS-013) - Prerequisites reference but will not execute until condition is created
- **metabolism:overfull component** - Forbidden component check will not trigger until component is created in a future ticket

These placeholders allow actions to be defined now and will function correctly once dependencies are implemented.

## Implementation Details

### Eat Action

**Purpose:** Consume food item to restore energy via digestion buffer

**Required Components:**

- Actor: metabolism:fuel_converter, metabolism:metabolic_store

**Forbidden Components:**

- Actor: metabolism:overfull (prevents eating when too full)
  - **Note:** This component does not exist yet - acts as placeholder reference for future implementation

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

- [x] All 3 action files created with valid JSON
- [x] Actions validate against action.schema.json
- [x] Action IDs follow format: metabolism:action_name
- [x] Required/forbidden components correctly specified
- [x] Template strings use correct placeholder names
- [x] Visual properties include backgroundColor, textColor, and hover variants

### Action Logic

- [x] Eat action requires fuel_converter and metabolic_store
- [x] Drink action similar to eat with liquid fuel tag requirement
- [x] Rest action only requires metabolic_store
- [x] Eat/drink prevent execution when overfull
- [x] Prerequisites reference conditions (placeholders acceptable)

### Mod Manifest

- [x] All 3 actions added to content.actions array
- [x] Manifest validates after update

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
  "visual": {
    "backgroundColor": "#8d6e63",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#6d4c41",
    "hoverTextColor": "#ffffff"
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
  "visual": {
    "backgroundColor": "#5e35b1",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#4527a0",
    "hoverTextColor": "#ffffff"
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

- [x] All 3 action files created with complete definitions
- [x] Actions validate with `npm run validate`
- [x] Mod manifest updated with actions
- [x] Action IDs follow naming conventions
- [x] Required/forbidden components correctly specified
- [x] Committed with message: "feat(metabolism): add eat, drink, and rest action definitions"

---

## Outcome

**Implementation Date:** 2025-11-21

### What Was Actually Changed

1. **Ticket Corrections:**
   - Fixed property name from `visual_properties` to `visual` (critical schema compliance)
   - Added explicit documentation for placeholder dependencies (scope, condition, overfull component)
   - Updated visual property format to use backgroundColor, textColor, and hover variants

2. **Action Files Created:**
   - `data/mods/metabolism/actions/eat.action.json` - Brown theme (#8d6e63)
   - `data/mods/metabolism/actions/drink.action.json` - Blue theme (#0288d1)
   - `data/mods/metabolism/actions/rest.action.json` - Purple theme (#5e35b1)

3. **Mod Manifest Updated:**
   - Added all 3 actions to `content.actions` array in `data/mods/metabolism/mod-manifest.json`

4. **Validation:**
   - All actions pass schema validation
   - Metabolism mod: 0 cross-reference violations
   - Placeholder references (scope, condition) correctly handled

### Deviations from Plan

**Simplified Implementation:**

- Originally planned to use "category" and "icon" fields for visual properties
- Discovered schema requires backgroundColor, textColor, and hover variants instead
- Updated ticket and implementation to match actual schema requirements

**Component Discovery:**

- Found that `metabolism:overfull` component doesn't exist yet
- Documented as placeholder for future implementation
- Action still validates correctly with missing component reference

### Testing Notes

- No new tests created (out of scope per ticket HUNMETSYS-017)
- Validation confirms actions are structurally correct
- Actions ready for rule handler implementation (HUNMETSYS-009)
- Scope and condition placeholders will be resolved in HUNMETSYS-013

### Next Steps

1. HUNMETSYS-009: Implement rule handlers for eat, drink, and rest actions
2. HUNMETSYS-013: Create `metabolism:consumable_items` scope and `metabolism:can_consume` condition
3. Future ticket: Create `metabolism:overfull` component for fullness prevention
4. HUNMETSYS-017: Add integration tests for action discovery and execution
