# HEACALOVE-005: Update vital organ entities with health calculation weights and caps

## Overview
Add `health_calculation_weight` to vital organ entity definitions and configure their health cap properties.

## Status: ✅ COMPLETED

## Files to Modify
- `data/mods/anatomy/entities/definitions/human_heart.entity.json`
- `data/mods/anatomy/entities/definitions/human_brain.entity.json`
- `data/mods/anatomy/entities/definitions/human_spine.entity.json`
- `data/mods/anatomy/entities/definitions/chicken_heart.entity.json`
- `data/mods/anatomy/entities/definitions/chicken_brain.entity.json`
- `data/mods/anatomy/entities/definitions/chicken_spine.entity.json`

## Implementation

### Weight Value
All vital organs get `health_calculation_weight: 15` (Tier 1: Life-Critical).

### Cap Values
All vital organs get:
- `healthCapThreshold: 20` - When organ health drops below 20%, apply cap
- `healthCapValue: 30` - Critical damage limits overall health to 30%

Note: These values already have defaults in the `anatomy:vital_organ` component schema, but are explicitly set for documentation clarity.

### Changes per File

#### human_heart.entity.json
Add to `anatomy:part` component:
```json
"health_calculation_weight": 15
```

Add to `anatomy:vital_organ` component:
```json
"healthCapThreshold": 20,
"healthCapValue": 30
```

#### human_brain.entity.json
Add to `anatomy:part` component:
```json
"health_calculation_weight": 15
```

Add to `anatomy:vital_organ` component:
```json
"healthCapThreshold": 20,
"healthCapValue": 30
```

#### human_spine.entity.json
Add to `anatomy:part` component:
```json
"health_calculation_weight": 15
```

Add to `anatomy:vital_organ` component:
```json
"healthCapThreshold": 20,
"healthCapValue": 30
```

#### chicken_heart.entity.json
Add to `anatomy:part` component:
```json
"health_calculation_weight": 15
```

Add to `anatomy:vital_organ` component:
```json
"healthCapThreshold": 20,
"healthCapValue": 30
```

#### chicken_brain.entity.json
Add to `anatomy:part` component:
```json
"health_calculation_weight": 15
```

Add to `anatomy:vital_organ` component:
```json
"healthCapThreshold": 20,
"healthCapValue": 30
```

#### chicken_spine.entity.json
Add to `anatomy:part` component:
```json
"health_calculation_weight": 15
```

Add to `anatomy:vital_organ` component:
```json
"healthCapThreshold": 20,
"healthCapValue": 30
```

## Rationale
- **Weight 15**: Vital organs have the highest weight because their damage should dramatically impact overall health
- **Cap threshold 20%**: When organ health drops below 20%, overall health is capped
- **Cap value 30%**: Critical damage to vital organs means you can't be better than 30% overall health

## Acceptance Criteria
- [x] All 6 vital organ entities have `health_calculation_weight: 15`
- [x] All 6 vital organ entities have `healthCapThreshold: 20`
- [x] All 6 vital organ entities have `healthCapValue: 30`
- [x] All files pass schema validation: `npm run validate`

## Dependencies
- HEACALOVE-001: Schema must have `health_calculation_weight` property ✅
- HEACALOVE-002: Schema must have cap properties ✅

## Assumptions Verified
- The `anatomy:part` component schema supports `health_calculation_weight` ✅
- The `anatomy:vital_organ` component schema supports `healthCapThreshold` and `healthCapValue` ✅
- Both human and chicken vital organs need updating (6 entities total, not 3)

## Follow-up
None - this ticket is independent of other entity update tickets.

## Outcome

### What was actually changed vs originally planned

**Originally planned (3 entities)**:
- human_heart, human_brain, human_spine

**Actually changed (6 entities)**:
- human_heart, human_brain, human_spine
- chicken_heart, chicken_brain, chicken_spine (discovered during implementation)

### Changes Made

1. **6 vital organ entities updated** with:
   - `health_calculation_weight: 15` in `anatomy:part` component
   - `healthCapThreshold: 20` in `anatomy:vital_organ` component
   - `healthCapValue: 30` in `anatomy:vital_organ` component

2. **Test fix**: Updated `tests/integration/anatomy/injuryReportingFlow.integration.test.js`
   - Fixed `should calculate weighted overall health correctly` test
   - Test was missing explicit `health_calculation_weight` values in mock data
   - Added `health_calculation_weight: 10` to torso and `health_calculation_weight: 1` to finger

### Tests Modified

| File | Change | Rationale |
|------|--------|-----------|
| `tests/integration/anatomy/injuryReportingFlow.integration.test.js` | Added explicit `health_calculation_weight` values to mock data | Test expected weighted calculation but mock data relied on implicit defaults, causing false failure |

### Validation
- All 6 vital organ entities pass schema validation
- 54 unit tests pass for `injuryAggregationService`
- 14 integration tests pass for `injuryReportingFlow`
- 1038 anatomy service unit tests pass
