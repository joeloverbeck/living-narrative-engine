# GRAPREEXP-000: Overview - Add Free Grabbing Appendage Prerequisites

## Status: ✅ ALL TICKETS COMPLETED

## Summary

This ticket series adds free grabbing appendage prerequisites to 5 existing actions. All actions require at least 1 free grabbing appendage (hand/tentacle/claw) to perform, using the existing `anatomy:actor-has-free-grabbing-appendage` condition.

## Scope

- **5 action JSON files** to modify
- **5 test files** to create
- Uses existing condition infrastructure - no new operators or conditions required

## Ticket Breakdown

| Ticket        | Action                            | Mod       | Complexity                            | Status       |
| ------------- | --------------------------------- | --------- | ------------------------------------- | ------------ |
| GRAPREEXP-001 | `violence:slap`                   | violence  | Simple - add new prerequisites array  | ✅ COMPLETED |
| GRAPREEXP-002 | `violence:sucker_punch`           | violence  | Simple - add new prerequisites array  | ✅ COMPLETED |
| GRAPREEXP-003 | `seduction:brush_hair_back_coyly` | seduction | Moderate - insert into existing array | ✅ COMPLETED |
| GRAPREEXP-004 | `items:put_in_container`          | items     | Simple - add new prerequisites array  | ✅ COMPLETED |
| GRAPREEXP-005 | `items:give_item`                 | items     | Simple - add new prerequisites array  | ✅ COMPLETED |

## Implementation Order

Tickets can be implemented in parallel - no dependencies between them.

**Recommended order for efficiency:**

1. GRAPREEXP-001 and GRAPREEXP-002 (same mod, similar structure)
2. GRAPREEXP-004 and GRAPREEXP-005 (same mod, similar structure)
3. GRAPREEXP-003 (requires careful array insertion)

## Related Infrastructure

| File                                                                            | Purpose                 |
| ------------------------------------------------------------------------------- | ----------------------- |
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js`                      | Operator implementation |
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Condition definition    |
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js`      | Test pattern reference  |
| `docs/testing/mod-testing-guide.md`                                             | Testing guide           |

## Validation Commands

```bash
# Validate all mod files
npm run validate

# Run all prerequisite tests after implementation
npm run test:integration -- --testPathPattern="prerequisites"

# Lint all modified/created files
npx eslint data/mods/violence/actions/slap.action.json \
           data/mods/violence/actions/sucker_punch.action.json \
           data/mods/seduction/actions/brush_hair_back_coyly.action.json \
           data/mods/items/actions/put_in_container.action.json \
           data/mods/items/actions/give_item.action.json \
           tests/integration/mods/violence/*_prerequisites.test.js \
           tests/integration/mods/seduction/*_prerequisites.test.js \
           tests/integration/mods/items/*_prerequisites.test.js
```

## Completion Criteria

All tickets complete when:

- [x] All 5 action files modified with prerequisites
- [x] All 5 test files created and passing
- [x] `npm run validate` passes
- [x] `npm run test:integration -- --testPathPattern="prerequisites"` passes
- [x] ESLint passes on all modified/created files

## Source Specification

See `archive/appendage-grabbing-system/grabbing-prerequisites-expansion-spec.md` for the complete specification.
