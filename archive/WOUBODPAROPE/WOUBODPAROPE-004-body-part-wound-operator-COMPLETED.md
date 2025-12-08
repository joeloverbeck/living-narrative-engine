# WOUBODPAROPE-004: Introduce Body Part Wound Predicate Operator

**Status:** Completed  
**Goal:** Provide `isBodyPartWounded(entityPath, partEntityRef, options?)` as a JSON Logic operator that encapsulates the `currentHealth < maxHealth` predicate used in wounded/bleeding scopes, with options to exclude vital organs and require specific status components (e.g., bleeding/infection).

## Reality check / assumptions updated
- `isBodyPartAccessible`, `isSlotExposed`, and `socketExposure` already exist (Specs item 1–3 shipped), so this ticket only adds the wound predicate from Specs item 4.
- There is no existing `isBodyPartWounded` operator or tests; BodyGraphService has only whole-body `hasWoundedPart`, so the new operator must read the part components directly via the entityManager/part ref rather than a BodyGraphService helper.
- Base body-part operators expect the signature `[entityPath, ...params]` with params including the part reference; JSON Logic registration and the whitelist in `jsonLogicEvaluationService` must be updated accordingly.
- Scope JSON rewrites remain out of scope here; this ticket only introduces the operator + coverage to unblock later scope refactors.

## File list
- `src/logic/operators/isBodyPartWoundedOperator.js` (new operator, likely extending `BaseBodyPartOperator`)
- `src/logic/jsonLogicCustomOperators.js` (operator registration and option defaults)
- `src/logic/jsonLogicEvaluationService.js` (whitelist/registration update)
- `tests/unit/logic/operators/isBodyPartWoundedOperator.test.js` (unit coverage for baseline wound check, vital organ exclusion, required component flags)
- `tests/unit/logic/operators/hasWoundedPartOperator.test.js` (ensure existing behavior still passes; no functional change expected)

## Out of scope
- Changing wound calculation formulas (no new health components or scaling)
- Editing scope JSON files
- Modifying BodyGraph or anatomy data

## Outcome
- Added `isBodyPartWounded` operator with `excludeVitalOrgans` and `requireComponents` options, registered in JsonLogic (whitelist + factory).
- Unit coverage for baseline wound check, vital-organ exclusion, required component gating; existing `hasWoundedPart` suite still passes.
- No scope JSON or BodyGraph changes; operator reads part components directly via entityManager/part refs.

## Acceptance criteria
- Tests: 
  - `npm run test:unit -- tests/unit/logic/operators/isBodyPartWoundedOperator.test.js` passes
  - `npm run test:unit -- tests/unit/logic/operators/hasWoundedPartOperator.test.js` still passes
- Invariants:
  - Existing `hasWoundedPart` results remain unchanged unless explicitly using new options
  - No new side effects on entity health state or mutation during operator evaluation
  - Operator registration list keeps previous operators intact and ordered
