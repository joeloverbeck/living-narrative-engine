# HEACALOVE-009: Update extremity entities with health calculation weights

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
- [ ] All hand entities identified and updated
- [ ] All foot entities identified and updated
- [ ] All files have `health_calculation_weight: 2` added
- [ ] All files pass schema validation: `npm run validate`
- [ ] No other properties are modified

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes
- Includes creature extremities (chicken, tortoise)
- Includes variant hands (craftsman, scarred, rough)
- Eldritch malformed hand included as it's still functionally a hand
