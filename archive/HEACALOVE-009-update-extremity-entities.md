# HEACALOVE-009: Update extremity entities with health calculation weights

## Status: COMPLETED

## Overview
Add `health_calculation_weight: 2` to all hand and foot entity definitions.

## Weight Value
All extremity variants get `health_calculation_weight: 2` (Tier 5: Extremities).

## Files to Modify

### Hand Entities
```bash
ls data/mods/anatomy/entities/definitions/*hand*.entity.json
```

Expected hand files:
- `human_hand.entity.json`
- `humanoid_hand_craftsman_scarred.entity.json`
- `humanoid_hand_craftsman_stained.entity.json`
- `humanoid_hand_rough.entity.json`
- `humanoid_hand_scarred.entity.json`
- `tortoise_hand.entity.json`
- `eldritch_malformed_hand.entity.json`

### Foot Entities
```bash
ls data/mods/anatomy/entities/definitions/*foot*.entity.json
```

Expected foot files:
- `human_foot.entity.json`
- `chicken_foot.entity.json`
- `tortoise_foot.entity.json`

## Implementation
For each hand and foot entity, add to the `anatomy:part` component:
```json
"health_calculation_weight": 2
```

## Example Change
Before:
```json
"anatomy:part": {
  "subType": "foot",
  "orientation": "right",
  "hit_probability_weight": 3
}
```

After:
```json
"anatomy:part": {
  "subType": "foot",
  "orientation": "right",
  "hit_probability_weight": 3,
  "health_calculation_weight": 2
}
```

## Rationale
- **Weight 2**: Extremities are functional but loss is more survivable than limbs
- Lower than limbs (3) because hands/feet are "ends" of limbs
- Still meaningful as loss impacts function

## Acceptance Criteria
- [x] All hand entities identified and updated
- [x] All foot entities identified and updated
- [x] All files have `health_calculation_weight: 2` added
- [x] All files pass schema validation: `npm run validate`
- [x] No other properties are modified

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes
- Includes creature extremities (chicken, tortoise)
- Includes variant hands (craftsman, scarred, rough)
- Eldritch malformed hand included as it's still functionally a hand

---

## Outcome

**Completed: 2025-12-04**

### What was actually changed vs originally planned:

**Planned:**
- Add `health_calculation_weight: 2` to 7 hand entities and 3 foot entities

**Actual:**
- Added `health_calculation_weight: 2` to all 10 extremity entities as planned
- All entity files matched the expected file list exactly
- No discrepancies found between ticket assumptions and actual codebase

### Files Modified (10 total):

**Hand Entities (7):**
1. `human_hand.entity.json`
2. `humanoid_hand_craftsman_scarred.entity.json`
3. `humanoid_hand_craftsman_stained.entity.json`
4. `humanoid_hand_rough.entity.json`
5. `humanoid_hand_scarred.entity.json`
6. `tortoise_hand.entity.json`
7. `eldritch_malformed_hand.entity.json`

**Foot Entities (3):**
1. `human_foot.entity.json`
2. `chicken_foot.entity.json`
3. `tortoise_foot.entity.json`

### New Test Added:
- `tests/integration/mods/anatomy/extremityHealthCalculationWeightValidation.test.js`
  - 24 test cases validating extremity health calculation weights
  - Follows same pattern as existing `headHealthCalculationWeightValidation.test.js` and `limbHealthCalculationWeightValidation.test.js`

### Validation:
- All schema validations pass: `npm run validate`
- All 24 new tests pass
- Existing head/limb validation tests (106 tests) continue to pass
- ESLint passes on new test file
