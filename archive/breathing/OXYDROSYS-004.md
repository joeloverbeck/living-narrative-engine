# OXYDROSYS-004: Create unconscious_anoxia component

**Status**: ✅ Completed

## Description

Define the `breathing:unconscious_anoxia` component for unconsciousness specifically from oxygen deprivation.

## Files to Create

- `data/mods/breathing/components/unconscious_anoxia.component.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add component to `content.components` array

## Out of Scope

- Rules that apply/remove this component
- Brain damage mechanics
- Rescue/recovery mechanics

## Acceptance Criteria

1. **Schema valid**: Component passes JSON Schema validation ✅
2. **Properties defined**: `turnsUnconscious`, `brainDamageStarted` (boolean) ✅
3. **Activity metadata**: Higher priority (95) than hypoxic ✅
4. **Template**: `"{actor} has lost consciousness from lack of oxygen"` ✅

## Tests That Must Pass

- `npm run validate` - Schema validation ✅

## Invariants

- Component ID: `breathing:unconscious_anoxia`
- Priority (95) higher than hypoxic (80) to ensure correct activity description order

---

## Outcome

### What Was Changed

1. **Created** `data/mods/breathing/components/unconscious_anoxia.component.json`
   - Component with id `breathing:unconscious_anoxia`
   - Properties: `turnsUnconscious` (integer, required), `brainDamageStarted` (boolean), `activityMetadata`
   - Activity metadata with priority 95 and template `"{actor} has lost consciousness from lack of oxygen"`

2. **Modified** `data/mods/breathing/mod-manifest.json`
   - Added `"unconscious_anoxia.component.json"` to `content.components` array

3. **Created** `tests/unit/mods/breathing/components/unconscious_anoxia.component.test.js`
   - 34 unit tests validating component schema structure
   - Tests priority ordering (95 > 80) relative to hypoxic component

### Comparison to Original Plan

All planned changes were implemented exactly as specified:
- ✅ Component schema matches ticket requirements
- ✅ Manifest updated correctly
- ✅ Unit tests added following project patterns
- ✅ Validation passed (0 violations, 90 mods validated)
- ✅ All 113 tests in breathing component test suite passed

No deviations from the original ticket scope. No ticket corrections were needed as all assumptions were validated against the actual codebase.
