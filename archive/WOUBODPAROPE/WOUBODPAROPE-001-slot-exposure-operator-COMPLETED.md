# WOUBODPAROPE-001: Implement Slot Exposure Operator

Status: Completed

**Goal:** Introduce `isSlotExposed(entityPath, slotName, options?)` as a reusable clothing-layer emptiness check that matches the wounded scope's triple `!hasClothingInSlotLayer` logic.

## File list
- `src/logic/operators/isSlotExposedOperator.js` (new operator extending `BaseEquipmentOperator`)
- `src/logic/jsonLogicCustomOperators.js` (register operator and expose options signature)
- `src/logic/jsonLogicEvaluationService.js` (whitelist/registration update)
- `tests/unit/logic/operators/isSlotExposedOperator.test.js` (new unit coverage for default layers, custom layer sets, accessories/underwear toggles, falsy slotName behavior)
- Update existing operator registration/whitelist tests to include the new operator.

## Out of scope
- Changing existing `hasClothingInSlot` or `hasClothingInSlotLayer` behavior
- Modifying any scope JSON files
- Adding configuration flags to gameplay content or manifests
- Adding caches beyond the existing equipment utilities (only `isSocketCovered` is cached today)

## Operator behavior assumptions
- Default layer set mirrors the wounded scopes: `['base', 'outer', 'armor']`.
- Options allow overriding layers (`layers`) and optionally including underwear/accessories via booleans.
- Missing or falsy `slotName` (including absent `visibility_rules.clothingSlotId`) should return `true` to match the existing guard.
- Missing slots or equipment data count as exposed (no items to cover the slot), consistent with the current triple-negation pattern.

## Outcome
- Added `isSlotExposed` operator with default base/outer/armor layers, optional underwear/accessories inclusion, and falsy-slot guard to mirror wounded scope semantics.
- Registered/whitelisted the operator alongside existing clothing operators and updated registration/whitelist tests.
- Added focused unit coverage for default/custom layers and inclusion toggles; ran `npm run test:unit -- --runInBand tests/unit/logic/operators/isSlotExposedOperator.test.js tests/unit/logic/jsonLogicOperatorRegistration.test.js tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js` and `npm run test:integration -- --runInBand tests/integration/logic/customOperatorRegistration.test.js tests/integration/logic/operatorWhitelistValidation.integration.test.js`.

## Acceptance criteria
- Tests: `npm run test:unit -- tests/unit/logic/operators/isSlotExposedOperator.test.js` passes
- Invariants:
  - Existing clothing-related operators continue to behave identically for current callers
  - Operator registration list remains alphabetical/consistent with current structure
  - No new console logging or additional dependencies introduced
