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
Before (humanoid_head.entity.json):
```json
"anatomy:part": {
  "subType": "head",
  "hit_probability_weight": 18
}
```

After:
```json
"anatomy:part": {
  "subType": "head",
  "hit_probability_weight": 18,
  "health_calculation_weight": 8
}
```

Note: `hit_probability_weight` varies by entity type (18 for humanoid, 8-12 for creatures).

## Rationale
- **Weight 8**: Head is a critical structural part containing sensory organs
- High priority after torso (10) and vital organs (15)
- Head damage significantly impairs overall function

## Acceptance Criteria
- [x] All head entities identified via glob pattern
- [x] All head entities have `health_calculation_weight: 8` added
- [x] All files pass schema validation: `npm run validate`
- [x] No other properties are modified

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property

## Notes
- Includes humanoid, creature, and variant head types
- Brain is handled separately as vital organ (HEACALOVE-005)
- Face-related entities may be handled in a different ticket if they exist as separate parts

## Outcome

**Status**: ✅ Completed

**Summary**: Successfully added `health_calculation_weight: 8` to all 19 head entity definitions.

**Changes Made**:
- Modified 19 head entity files in `data/mods/anatomy/entities/definitions/`
- Each entity's `anatomy:part` component now includes `health_calculation_weight: 8`
- All files pass schema validation (0 violations)

**Testing**:
- Schema validation: `npm run validate` - 0 violations across 51 mods
- Unit tests: `injuryAggregationService.test.js` - 54 tests passed
- Integration tests: anatomy tests - 2164 tests passed
- New regression test added: `tests/integration/mods/anatomy/headHealthCalculationWeightValidation.test.js` (39 tests)

**Ticket Correction**:
- Original example showed `hit_probability_weight: 5` but actual humanoid head value is 18
- Corrected example to reflect accurate `hit_probability_weight: 18`
