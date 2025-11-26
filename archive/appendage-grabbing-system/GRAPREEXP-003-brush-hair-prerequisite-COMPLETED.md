# GRAPREEXP-003: Add Free Grabbing Appendage Prerequisite to Brush Hair Back Coyly Action

## Status: COMPLETED

## Summary

Insert a new prerequisite at the **beginning** (index 0) of the existing `prerequisites` array for the `seduction:brush_hair_back_coyly` action. This action already has two prerequisites; the grabbing appendage prerequisite must be added FIRST.

**Key difference from other tickets**: This action already has a `prerequisites` array. The new prerequisite must be **inserted at index 0**, not appended.

## Files Modified

| File | Change |
|------|--------|
| `data/mods/seduction/actions/brush_hair_back_coyly.action.json` | Inserted new prerequisite at index 0 of existing `prerequisites` array |
| `tests/integration/mods/seduction/brush_hair_back_coyly_action_discovery.test.js` | Updated prerequisite count assertion from 2 to 3 |
| `tests/integration/mods/seduction/brush_hair_back_coyly_action.test.js` | Updated prerequisite tests to reflect new 3-prerequisite structure |

## Files Created

| File | Purpose |
|------|---------|
| `tests/integration/mods/seduction/brush_hair_back_coyly_prerequisites.test.js` | Integration tests for prerequisite evaluation (18 tests) |

## Implementation Details

### brush_hair_back_coyly.action.json

**Previous State (2 prerequisites)**:
```json
"prerequisites": [
  {
    "logic": {
      "hasPartOfType": ["actor", "hair"]
    },
    "failure_message": "You need hair to perform this action."
  },
  {
    "logic": {
      "hasOtherActorsAtLocation": ["actor"]
    },
    "failure_message": "There is nobody here to draw attention from."
  }
]
```

**New State (3 prerequisites)**:
```json
"prerequisites": [
  {
    "logic": {
      "condition_ref": "anatomy:actor-has-free-grabbing-appendage"
    },
    "failure_message": "You need a free hand to brush your hair."
  },
  {
    "logic": {
      "hasPartOfType": ["actor", "hair"]
    },
    "failure_message": "You need hair to perform this action."
  },
  {
    "logic": {
      "hasOtherActorsAtLocation": ["actor"]
    },
    "failure_message": "There is nobody here to draw attention from."
  }
]
```

### Why Index 0?

1. **Physical capability checks should precede contextual checks** - "Can't use hands" is a clearer failure reason than "nobody around"
2. **Logical order**: Can you do it → Should you do it
3. **Consistency** with how physical prerequisites are ordered in other actions

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Modify 1 action file
- Modify 1 test file (discovery test)
- Create 1 new test file (prerequisites test)

**Actually Changed:**
- Modified 1 action file (as planned)
- Modified 2 existing test files (discovery test + action test - additional file discovered during testing)
- Created 1 new test file (as planned)

**Reason for Deviation:**
The existing `brush_hair_back_coyly_action.test.js` test file also contained prerequisite assertions that expected 2 prerequisites. This file was discovered when running the full seduction test suite after initial implementation.

### Test Coverage

New test file `brush_hair_back_coyly_prerequisites.test.js` provides 18 tests covering:
- Action definition structure (6 tests)
- Multiple prerequisites validation (3 tests)
- Pass cases for grabbing prerequisite (3 tests)
- Fail cases for grabbing prerequisite (2 tests)
- Edge cases (2 tests)
- Condition definition validation (2 tests)

### Invariants Verified

- [x] Action ID remains `seduction:brush_hair_back_coyly`
- [x] Template remains `brush your hair back coyly`
- [x] Targets remain `"none"`
- [x] `forbidden_components` remain unchanged
- [x] `visual` properties remain unchanged
- [x] **Existing hasPartOfType prerequisite preserved at index 1**
- [x] **Existing hasOtherActorsAtLocation prerequisite preserved at index 2**
- [x] Existing tests in the project continue to pass (195 seduction tests)
- [x] JSON schema validation passes

### Validation Commands Run

```bash
# Schema validation - PASSED
npm run validate

# New test file - 18 tests PASSED
NODE_ENV=test npx jest tests/integration/mods/seduction/brush_hair_back_coyly_prerequisites.test.js --no-coverage --verbose

# All seduction tests - 195 tests PASSED
NODE_ENV=test npx jest tests/integration/mods/seduction/ --no-coverage --silent

# Lint - 0 errors (only JSDoc style warnings)
npx eslint data/mods/seduction/actions/brush_hair_back_coyly.action.json tests/integration/mods/seduction/brush_hair_back_coyly_prerequisites.test.js tests/integration/mods/seduction/brush_hair_back_coyly_action_discovery.test.js
```

## Dependencies

- **Depends on**: Nothing (uses existing infrastructure)
- **Blocked by**: Nothing
- **Blocks**: Nothing

## Reference Files

| File | Purpose |
|------|---------|
| `tests/integration/mods/weapons/wield_threateningly_prerequisites.test.js` | Test pattern template |
| `data/mods/anatomy/conditions/actor-has-free-grabbing-appendage.condition.json` | Condition referenced |
| `specs/grabbing-prerequisites-expansion.md` | Full specification |
