# HUNMETSYS-002: Component Schemas - Metabolic Store & Hunger State

**Status:** ✅ Completed
**Priority:** High
**Estimated Effort:** 3 hours
**Actual Effort:** 2.5 hours
**Phase:** 1 - Foundation
**Dependencies:** None

## Objective

Create component schemas for `metabolism:metabolic_store` and `metabolism:hunger_state` that track entity energy reserves, burn rates, and hunger states.

## Files to Touch

### New Files (2)

- `data/mods/metabolism/components/metabolic_store.component.json`
- `data/mods/metabolism/components/hunger_state.component.json`

### Modified Files (1)

- `data/mods/metabolism/mod-manifest.json` - add new components to registry

## Out of Scope

- ❌ Operation handlers (covered in HUNMETSYS-003, 004, 014)
- ❌ Turn-based rules (covered in HUNMETSYS-007)
- ❌ Threshold configuration files (covered in HUNMETSYS-006)
- ❌ Integration with anatomy mod (covered in HUNMETSYS-015)

## Testing

**Location:** `tests/integration/validation/componentValidationRules.integration.test.js`

**Tests to Add:**

- Validation of metabolic_store component data
- Validation of hunger_state component data
- Enum value suggestions for typos
- Boundary value testing

## Implementation Details

### Metabolic Store Component

**Purpose:** Tracks an actor's energy reserves, burn rate, and metabolic state.

**Key Properties** (camelCase naming per project conventions):

- `currentEnergy`: Current energy level (minimum 0)
- `maxEnergy`: Maximum energy capacity
- `baseBurnRate`: Resting energy expenditure per turn (default 1.0)
- `activityMultiplier`: Current activity's energy cost multiplier (default 1.0)
- `lastUpdateTurn`: Turn number of last energy update (default 0)

**Schema Requirements:**

- Extend from `schema://living-narrative-engine/component.schema.json`
- Set id as `metabolism:metabolic_store`
- Include validation rules for:
  - Non-negative energy values
  - Current energy ≤ max energy
  - Positive burn rates (> 0)
- Provide error messages for invalid states

### Hunger State Component

**Purpose:** Defines threshold-based hunger states and their gameplay effects.

**Key Properties** (camelCase naming per project conventions):

- `state`: Current hunger state enum
- `energyPercentage`: Current energy as percentage of max (0-100+)
- `turnsInState`: Consecutive turns in current state (default 0)
- `starvationDamage`: Cumulative health damage from starvation (default 0)

**State Enum Values:**

- "gluttonous" (>100%)
- "satiated" (75-100%)
- "neutral" (30-75%)
- "hungry" (10-30%)
- "starving" (0.1-10%)
- "critical" (≤0%)

**Schema Requirements:**

- Extend from `schema://living-narrative-engine/component.schema.json`
- Set id as `metabolism:hunger_state`
- Include validation rules for:
  - State must be one of valid enum values
  - Non-negative turnsInState
  - Non-negative starvationDamage
  - Energy percentage must be non-negative

## Acceptance Criteria

### Schema Validation

- [ ] Both component schemas validate against `component.schema.json`
- [ ] All required properties are properly defined
- [ ] Enum values for hunger states are correctly specified
- [ ] Default values are provided for optional properties

### Data Integrity

- [ ] Current energy cannot exceed max energy (unless gluttonous state)
- [ ] Energy percentage can exceed 100 (for gluttonous state)
- [ ] Burn rates must be positive values
- [ ] All turn counters must be non-negative
- [ ] State enum only accepts valid values

### Validation Commands

```bash
# Run after creating schemas
npm run validate           # Basic validation
npm run validate:strict    # Strict validation
```

## Invariants

### Must Remain True

- Component schemas must be valid JSON
- Component IDs must follow format `metabolism:component_name`
- All properties must have clear descriptions
- Hunger state enum values must match threshold system (spec lines 1300-1378)

### System Invariants

- Existing component schemas must continue to validate
- No changes to core component schema structure
- Component registry must successfully load these schemas
- Hunger state values must be compatible with UPDATE_HUNGER_STATE operation

## Example Component Data

### Metabolic Store (Normal Actor)

```json
{
  "metabolism:metabolic_store": {
    "currentEnergy": 800,
    "maxEnergy": 1000,
    "baseBurnRate": 1.0,
    "activityMultiplier": 1.0,
    "lastUpdateTurn": 42
  }
}
```

### Hunger State (Hungry Actor)

```json
{
  "metabolism:hunger_state": {
    "state": "hungry",
    "energyPercentage": 25.5,
    "turnsInState": 15,
    "starvationDamage": 0
  }
}
```

### Hunger State (Starving Actor)

```json
{
  "metabolism:hunger_state": {
    "state": "starving",
    "energyPercentage": 5.2,
    "turnsInState": 8,
    "starvationDamage": 12
  }
}
```

## State Threshold Reference

For implementer's reference (from spec):

| State      | Energy % | Key Effects                        |
| ---------- | -------- | ---------------------------------- |
| gluttonous | 100%+    | Movement -10%, Stamina regen -20%  |
| satiated   | 75-100%  | Health regen +10%, Focus +5%       |
| neutral    | 30-75%   | No modifiers                       |
| hungry     | 10-30%   | Aim stability -5%, Stomach rumbles |
| starving   | 0.1-10%  | Health loss, Carry capacity -30%   |
| critical   | ≤0%      | Severe health loss, Movement -50%  |

## References

- Spec: Lines 265-389 (Component Definitions)
- Spec: Lines 1299-1398 (Threshold System)
- Related: HUNMETSYS-001 (fuel converter and source schemas)
- Related: HUNMETSYS-003 (BURN_ENERGY handler)
- Related: HUNMETSYS-014 (UPDATE_HUNGER_STATE handler)

## Outcome

**What Changed:**

- ✅ Created `metabolic_store.component.json` with 5 properties (all camelCase)
- ✅ Created `hunger_state.component.json` with 4 properties and 6 enum states
- ✅ Updated `mod-manifest.json` to register new components
- ✅ Added 12 comprehensive integration tests covering validation scenarios
- ✅ All schemas pass `npm run validate:strict` (0 violations)
- ✅ All 12 integration tests pass

**Critical Corrections Made:**

1. **Naming Convention Fix:** Ticket originally specified `snake_case` (e.g., `current_energy`) but corrected to `camelCase` (e.g., `currentEnergy`) per project standards
2. **Schema Syntax Fix:** Changed `exclusiveMinimum: true` to `exclusiveMinimum: 0` (AJV requires number, not boolean)
3. **Manifest Update:** Added manifest update requirement (not in original ticket scope)
4. **Test Addition:** Created integration tests (marked "out of scope" but added for quality assurance)

**Deviations from Plan:**

- Originally estimated no test creation, but added 12 comprehensive integration tests
- Fixed `exclusiveMinimum` schema syntax issue discovered during testing
- Updated ticket assumptions before implementation (snake_case → camelCase)

## Definition of Done

- [x] Both component schema files created with complete definitions
- [x] Schemas validate with `npm run validate:strict`
- [x] All properties documented with clear descriptions
- [x] Hunger state enum includes all 6 states
- [x] Validation rules implemented for data integrity
- [x] Code follows project naming conventions (camelCase for properties)
- [x] Committed with message: "feat(metabolism): add metabolic_store and hunger_state component schemas"
