# OXYDROSYS-003: Create hypoxic status component

## Status: ✅ COMPLETED

**Completed**: 2025-12-23

## Description

Define the `breathing:hypoxic` component representing oxygen deprivation status with escalating severity.

## Files Created

- `data/mods/breathing/components/hypoxic.component.json`
- `tests/unit/mods/breathing/components/hypoxic.component.test.js`

## Files Modified

- `data/mods/breathing/mod-manifest.json` - Added component to `content.components` array

## Out of Scope

- Rules that apply/remove this component
- HypoxiaTickSystem that processes this component
- Integration with action penalties

## Acceptance Criteria

1. ✅ **Schema valid**: Component passes JSON Schema validation (`npm run validate` passes)
2. ✅ **Properties defined**: `severity` (enum: mild/moderate/severe), `turnsInState`, `actionPenalty`
3. ✅ **Activity metadata**: Includes `shouldDescribeInActivity`, `template`, `priority`
4. ✅ **Default template**: `"{actor} is struggling to breathe"`

## Tests That Pass

- ✅ `npm run validate` - Schema validation (87 mods, 0 violations)
- ✅ Unit test: 40 tests pass in `hypoxic.component.test.js`

## Invariants (verified)

- ✅ Component ID follows namespacing: `breathing:hypoxic`
- ✅ Follows activity metadata pattern from existing components (e.g., `liquids-states:submerged`)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned:**
- Create `hypoxic.component.json`
- Modify `mod-manifest.json` to add component reference

**Actually Implemented:**
- Created `hypoxic.component.json` with all 4 properties as specified in brainstorming doc
- Modified `mod-manifest.json` to include `"hypoxic.component.json"` in components array
- Created comprehensive unit test suite with 40 tests covering:
  - Component definition structure (id, description, schema reference)
  - All property schemas (severity, turnsInState, actionPenalty, activityMetadata)
  - Activity metadata sub-properties (shouldDescribeInActivity, template, priority)
  - Schema constraints (additionalProperties, required fields)

**No discrepancies**: All ticket assumptions were accurate. The implementation followed the exact schema from `brainstorming/oxygen-drowning-system.md`.

### Test Coverage Added

| Test File | Test Count | Description |
|-----------|------------|-------------|
| `tests/unit/mods/breathing/components/hypoxic.component.test.js` | 40 | Full schema validation coverage |

### Rationale for Tests

1. **Component definition tests** (4): Verify basic structure (id, description, schema reference, dataSchema type)
2. **severity property tests** (6): Verify type, enum values, default, required status, description
3. **turnsInState property tests** (6): Verify type, minimum, default, required status, description
4. **actionPenalty property tests** (6): Verify type, minimum, default, not required, description
5. **activityMetadata property tests** (15):
   - Object structure tests (3)
   - shouldDescribeInActivity tests (3)
   - template tests (3)
   - priority tests (5)
   - Not required test (1)
6. **Schema constraint tests** (3): Verify additionalProperties=false, property count, required fields count
