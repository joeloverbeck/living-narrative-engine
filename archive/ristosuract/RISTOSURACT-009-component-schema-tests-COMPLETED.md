# RISTOSURACT-009: Component schema tests for liquid_body visibility

## Status: ✅ COMPLETED

## Summary

Create integration tests that verify the `liquid_body.component.json` schema correctly validates the visibility property and that all existing entity definitions comply with the updated schema.

## Implementation Assessment

### Assumption Corrections

| Original Assumption | Actual State |
|---------------------|--------------|
| Test file: `tests/integration/mods/liquids/liquid_body_visibility.test.js` (NEW) | **Already exists** in different locations (see below) |
| Visibility default: `"opaque"` | Actual default: `"clear"` |
| Tests need to be created | Tests already exist and pass |

### Existing Test Coverage

The tests required by this ticket **already exist** in two files:

1. **Unit tests**: `tests/unit/mods/liquids/components/liquid_body.component.test.js` (19 tests)
   - Component ID validation
   - Schema structure tests
   - Visibility property tests (type, enum, default, description, required)
   - connected_liquid_body_ids property tests
   - Schema constraints tests

2. **Integration tests**: `tests/integration/mods/dredgers/liquidBodyVisibility.integration.test.js` (11 tests)
   - Entity definition compliance (all 4 dredgers entities)
   - connected_liquid_body_ids preservation
   - Entity metadata preservation

## Files

- `tests/unit/mods/liquids/components/liquid_body.component.test.js` (exists)
- `tests/integration/mods/dredgers/liquidBodyVisibility.integration.test.js` (exists)

## Out of Scope

- **DO NOT** modify any mod data files
- **DO NOT** modify any existing test files
- **DO NOT** create tests for action discovery (handled in RISTOSURACT-007)
- **DO NOT** create tests for rule execution (handled in RISTOSURACT-008)
- **DO NOT** create tests for modifiers (handled in RISTOSURACT-010)
- **DO NOT** test schema loading/compilation (assume AJV works)

## Acceptance Criteria

### Tests That Must Pass

- [x] Unit tests pass: `npm run test:unit -- tests/unit/mods/liquids/components/liquid_body.component.test.js`
- [x] Integration tests pass: `npm run test:integration -- tests/integration/mods/dredgers/liquidBodyVisibility.integration.test.js`
- [x] Schema structure tests verify all visibility properties
- [x] All 4 entity definitions pass compliance tests

### Test Coverage Summary

| Section | Required Tests | Actual Tests |
|---------|---------------|--------------|
| Schema structure | 7+ | 19 (unit tests) |
| Schema constraints | 2+ | 3 (unit tests) |
| Entity compliance | 4+ | 4 (integration tests) |
| Entity preservation | 4+ | 7 (integration tests) |

### Invariants That Remain True

- [x] No new test files needed (existing coverage is sufficient)
- [x] Tests only verify JSON structure, not AJV runtime validation
- [x] Entity IDs and connected_liquid_body_ids assertions use actual current values

## Verification Commands

```bash
# Run the unit tests
npm run test:unit -- tests/unit/mods/liquids/components/liquid_body.component.test.js

# Run the integration tests
npm run test:integration -- tests/integration/mods/dredgers/liquidBodyVisibility.integration.test.js

# Run all liquids tests
npm run test:integration -- tests/integration/mods/liquids/

# Validate both mods
npm run validate:mod:liquids
npm run validate:mod:dredgers
```

## Dependencies

- RISTOSURACT-001 (component schema must be updated) ✅
- RISTOSURACT-002 (entity definitions must be updated) ✅

## Blocks

- None (this is a testing ticket)

## Reference

- Spec section: `specs/rise-to-surface-action.md` Section 7.3

---

## Outcome

### What Was Originally Planned

The ticket specified creating a new integration test file at `tests/integration/mods/liquids/liquid_body_visibility.test.js` with:
- Schema structure tests (7+)
- Schema constraints tests (2+)
- Entity definition compliance tests (4)
- Entity preservation tests (4)

### What Was Actually Done

**No code changes were required.** Upon reassessment:

1. **Tests already existed** in two separate files:
   - Unit tests: `tests/unit/mods/liquids/components/liquid_body.component.test.js` (19 tests)
   - Integration tests: `tests/integration/mods/dredgers/liquidBodyVisibility.integration.test.js` (11 tests)

2. **Ticket assumptions were corrected**:
   - File location: Tests exist at different paths than specified
   - Default value: `"clear"` not `"opaque"` as stated
   - Test requirements: All acceptance criteria were already satisfied

3. **Verification**: All 30 existing tests pass successfully.

### Key Learning

The ticket was created before the tests were implemented, and the test file locations diverged from the original plan (unit tests for schema, integration tests in dredgers for entity compliance). This is a better organization than the single file proposed in the ticket.
