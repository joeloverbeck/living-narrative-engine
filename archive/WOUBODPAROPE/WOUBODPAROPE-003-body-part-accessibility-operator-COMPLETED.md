# WOUBODPAROPE-003: Implement Body Part Accessibility Operator (Completed)

**Goal:** Add `isBodyPartAccessible(entityPath, partEntityRef, options?)` that reuses the existing `isSlotExposed` and `socketExposure` operators to answer “is this body part interactable/exposed?” using `anatomy:visibility_rules` + `anatomy:joint` metadata. Defaults mirror wounded-scope logic: missing slots/sockets count as exposed, and non-blocking layers should be excluded from coverage checks.

## Corrected context & scope
- `isSlotExposed` and `socketExposure` already exist and are registered; this ticket only adds the composed accessibility operator and wires it up.
- `BaseBodyPartOperator` is already available; no new base helpers are required.
- The operator should honor `visibility_rules.nonBlockingLayers` by excluding those layers when delegating to `isSlotExposed`, while allowing explicit options to override layer behavior if provided.
- Cache clearing should delegate to the underlying socket exposure / coverage operators where applicable.

## File list
- `src/logic/operators/isBodyPartAccessibleOperator.js` (new operator combining slot visibility + socket exposure via part metadata)
- `src/logic/jsonLogicCustomOperators.js` (registration wiring)
- `src/logic/jsonLogicEvaluationService.js` (whitelist update)
- `tests/unit/logic/operators/isBodyPartAccessibleOperator.test.js` (covers slotless parts treated as exposed, missing sockets, any/all socket modes, layer exclusion passthrough, cache clearing)
- Update operator registration/whitelist tests if they hardcode expected operator sets.

## Out of scope
- Changing wounded scopes or any other scope JSON files
- Altering `isSlotExposed` or `socketExposure` signatures beyond what this operator consumes
- Modifying BodyGraph data files or anatomy schemas

## Acceptance criteria
- Tests: `npm run test:unit -- tests/unit/logic/operators/isBodyPartAccessibleOperator.test.js` passes
- Invariants:
  - Existing BodyPart operator helpers continue to behave the same for current tests
  - Accessibility defaults mirror wounded-scope behavior: missing slot/socket treated as exposed unless options override
  - Operator registration order/shape remains consistent with existing patterns

## Outcome
- Added the `isBodyPartAccessible` operator composed from the existing slot and socket exposure helpers, honoring `visibility_rules.nonBlockingLayers` and configurable options.
- Registered and whitelisted the operator alongside updated whitelist/registration tests.
- Added focused unit coverage plus whitelist integration verification; no scope JSON or schema changes were required.
