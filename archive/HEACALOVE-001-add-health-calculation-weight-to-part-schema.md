# HEACALOVE-001: Add health_calculation_weight to anatomy:part component schema

**Status: ✅ COMPLETED**

## Overview
Add a new `health_calculation_weight` property to the `anatomy:part` component schema to enable data-driven health percentage calculations.

## Problem
The current health calculation uses hardcoded `PART_WEIGHTS` in `injuryAggregationService.js`, which violates the modding-first design philosophy. Weights should be defined in entity data, not code.

## Solution
Add a new property to the existing `anatomy:part` component schema, similar to the existing `hit_probability_weight` property.

## File to Modify
`data/mods/anatomy/components/part.component.json`

## Implementation

Add the following property to the `dataSchema.properties` object:

```json
"health_calculation_weight": {
  "type": "number",
  "description": "Weight for overall health calculation (higher = more impact on health percentage). Default is 1.0.",
  "minimum": 0,
  "default": 1.0
}
```

### Full Updated Schema
The properties section should contain:
- `subType` (existing)
- `orientation` (existing)
- `hit_probability_weight` (existing)
- `definitionId` (existing)
- `health_calculation_weight` (NEW)

## Acceptance Criteria
- [x] Property added to component schema
- [x] Schema validates with `npm run validate`
- [x] Property has appropriate description
- [x] Default value is 1.0 (neutral weight)
- [x] Minimum value is 0 (cannot be negative)

## Dependencies
None - this is the first ticket in the sequence.

## Follow-up Tickets
- HEACALOVE-003: Service will read this property
- HEACALOVE-005 through HEACALOVE-012: Entity definitions will use this property

---

## Outcome

**Completed: 2025-12-04**

### What Was Changed vs Originally Planned

**Originally Planned:**
- Add `health_calculation_weight` property to `anatomy:part` component schema

**Actually Changed:**
1. **Schema Change** (as planned):
   - Added `health_calculation_weight` property to `data/mods/anatomy/components/part.component.json`
   - Property placed after `definitionId` to maintain logical grouping

2. **Test Coverage Added** (beyond original scope, but necessary for quality):
   - Added 7 new tests in `tests/unit/schemas/core-and-anatomy.allComponents.schema.test.js`:
     - `✓ valid with health_calculation_weight`
     - `✓ valid with health_calculation_weight at minimum (0)`
     - `✓ valid with health_calculation_weight as decimal`
     - `✓ valid with all optional fields including health_calculation_weight`
     - `✗ invalid - health_calculation_weight must be number`
     - `✗ invalid - health_calculation_weight cannot be negative`
     - `✓ backward compatibility - valid without health_calculation_weight`

### Verification
- Schema validation passed (`npm run validate`)
- All new tests pass
- Existing `anatomy:part` tests remain passing
- No breaking changes to public API

### Notes
- No discrepancies found between ticket assumptions and actual codebase
- The schema already had `hit_probability_weight` with identical structure, confirming the pattern
- Test file had a pre-existing failure for `core:weight` (unrelated to this change) - that component exists but lacks test payload entries
