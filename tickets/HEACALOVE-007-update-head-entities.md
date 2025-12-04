# HEACALOVE-007: Update head entities with health calculation weights

## Overview
Add `health_calculation_weight: 8` to all head entity definitions.

## Weight Value
All head variants get `health_calculation_weight: 8` (Tier 3: Structural).

## Files to Modify
Find all head entities:
```bash
ls data/mods/anatomy/entities/definitions/*head*.entity.json
```

Expected files include:
- `humanoid_head.entity.json`
- `humanoid_head_attractive.entity.json`
- `humanoid_head_bearded.entity.json`
- `humanoid_head_beautiful.entity.json`
- `humanoid_head_cute.entity.json`
- `humanoid_head_hideous.entity.json`
- `humanoid_head_moustached.entity.json`
- `humanoid_head_plain.entity.json`
- `humanoid_head_plain_weary.entity.json`
- `humanoid_head_scarred.entity.json`
- `humanoid_head_stubble.entity.json`
- `centaur_head.entity.json`
- `dragon_head.entity.json`
- `kraken_head.entity.json`
- `chicken_head.entity.json`
- `chicken_head_chalky_white.entity.json`
- `chicken_head_rust_red.entity.json`
- `chicken_head_twisted_joints.entity.json`
- `tortoise_head.entity.json`

## Implementation
For each head entity, add to the `anatomy:part` component:
```json
"health_calculation_weight": 8
```

## Example Change
Before:
```json
"anatomy:part": {
  "subType": "head",
  "hit_probability_weight": 5
}
```

After:
```json
"anatomy:part": {
  "subType": "head",
  "hit_probability_weight": 5,
  "health_calculation_weight": 8
}
```

## Rationale
- **Weight 8**: Head is a critical structural part containing sensory organs
- High priority after torso (10) and vital organs (15)
- Head damage significantly impairs overall function

## Acceptance Criteria
- [ ] All head entities identified via glob pattern
- [ ] All head entities have `health_calculation_weight: 8` added
- [ ] All files pass schema validation: `npm run validate`
- [ ] No other properties are modified

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes
- Includes humanoid, creature, and variant head types
- Brain is handled separately as vital organ (HEACALOVE-005)
- Face-related entities may be handled in a different ticket if they exist as separate parts
