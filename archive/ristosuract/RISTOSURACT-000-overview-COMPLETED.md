# RISTOSURACT-000: Rise to Surface Action - Overview

**Status**: ✅ ALL TICKETS COMPLETED

## Summary

This is the overview ticket for implementing the `liquids:rise_to_surface` action, which allows submerged actors to attempt to rise to the surface of a liquid body.

## Specification

See: `specs/rise-to-surface-action.md`

## Related Tickets

| Ticket | Title | Dependencies |
|--------|-------|--------------|
| RISTOSURACT-001 | Add visibility property to liquid_body component | None |
| RISTOSURACT-002 | Update dredgers liquid body entities with visibility | RISTOSURACT-001 |
| RISTOSURACT-003 | Create rise_to_surface action file | None |
| RISTOSURACT-004 | Create event-is-action-rise-to-surface condition | None |
| RISTOSURACT-005 | Create handle_rise_to_surface rule | RISTOSURACT-003, RISTOSURACT-004 |
| RISTOSURACT-006 | Update liquids mod-manifest.json | RISTOSURACT-003, RISTOSURACT-004, RISTOSURACT-005 |
| RISTOSURACT-007 | Action discovery tests | RISTOSURACT-006 |
| RISTOSURACT-008 | Rule execution tests | RISTOSURACT-006 |
| RISTOSURACT-009 | Component schema tests | RISTOSURACT-001, RISTOSURACT-002 |
| RISTOSURACT-010 | Modifier integration tests | RISTOSURACT-006 |

## Implementation Order

1. **Phase 1**: RISTOSURACT-001 (component) → RISTOSURACT-002 (entities)
2. **Phase 2**: RISTOSURACT-003 (action), RISTOSURACT-004 (condition) [parallel]
3. **Phase 3**: RISTOSURACT-005 (rule) → RISTOSURACT-006 (manifest)
4. **Phase 4**: RISTOSURACT-007, RISTOSURACT-008, RISTOSURACT-009, RISTOSURACT-010 [parallel]

## Success Criteria

All individual ticket acceptance criteria pass, plus:
- [ ] `npm run validate:mod:liquids` passes
- [ ] `npm run test:integration -- tests/integration/mods/liquids/` passes
- [ ] Action is discoverable when actor is submerged in liquid body
- [ ] All four outcome branches (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE) work correctly

## Risks

1. **Modifier logic verification**: The `get_component_value` operator may need verification that it supports nested entity lookups
2. **Schema breaking change**: Adding required `visibility` property requires all existing entities to be updated atomically

---

## Outcome

**All tickets completed on**: 2025-12-23

### Implementation Summary

The `liquids:rise_to_surface` action was successfully implemented across all 10 sub-tickets:

| Ticket | Title | Status |
|--------|-------|--------|
| RISTOSURACT-001 | Add visibility property to liquid_body component | ✅ Completed |
| RISTOSURACT-002 | Update dredgers liquid body entities with visibility | ✅ Completed |
| RISTOSURACT-003 | Create rise_to_surface action file | ✅ Completed |
| RISTOSURACT-004 | Create event-is-action-rise-to-surface condition | ✅ Completed |
| RISTOSURACT-005 | Create handle_rise_to_surface rule | ✅ Completed |
| RISTOSURACT-006 | Update liquids mod-manifest.json | ✅ Completed |
| RISTOSURACT-007 | Action discovery tests | ✅ Completed |
| RISTOSURACT-008 | Rule execution tests | ✅ Completed |
| RISTOSURACT-009 | Component schema tests | ✅ Completed |
| RISTOSURACT-010 | Modifier integration tests | ✅ Completed |

### Key Implementation Notes

1. **Modifier condition structure**: The action uses `{ "condition": { "logic": { ... } } }` wrapper for JSON Logic conditions in modifiers (discovered during RISTOSURACT-010)
2. **Tag/description vs label**: Modifiers use `tag` and `description` properties instead of a single `label` property
3. **All 225 liquids integration tests pass** confirming the complete implementation works correctly

### Final Verification

```bash
npm run test:integration -- tests/integration/mods/liquids/
# Result: 14 test suites, 225 tests passed
```
