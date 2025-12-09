# OPEUSAANA-004: Remove hasClothingInSlot operator after consolidation

**Status:** Completed
**Priority:** Medium
**Estimated Effort:** 0.5-1 day
**Dependencies:** OPEUSAANA-003 (seduction prerequisites migrated)

---

## Outcome
- Removed `src/logic/operators/hasClothingInSlotOperator.js` and associated unit tests.
- Unregistered operator from `JsonLogicCustomOperators` and `JsonLogicEvaluationService` whitelist.
- Removed operator handling from `PrerequisiteDebugger` and `FilterClauseAnalyzer`.
- Verified that seduction actions (draw_attention_to_ass, draw_attention_to_breasts, grab_crotch_draw_attention) were already migrated to `!isSlotExposed` with explicit layer options.
- Updated documentation (`refinement-condition-context.md`, `condition-patterns-guide.md`, `examples/README.md`, etc.) to remove references and suggest `!isSlotExposed`.
- Updated unit and integration tests to remove `hasClothingInSlot` assertions.

---

## Objective

Retire the `hasClothingInSlot` operator after all runtime consumers move to `isSlotExposed` variants. Remove the implementation, DI wiring, whitelist entries, and tests while keeping coverage-based behaviors intact via the replacement operator.

---

## Files to Touch

### Modified/Removed
- `src/logic/operators/hasClothingInSlotOperator.js`
- `src/logic/jsonLogicCustomOperators.js`
- `src/logic/jsonLogicEvaluationService.js`
- `src/actions/validation/prerequisiteDebugger.js`
- `src/scopeDsl/analysis/filterClauseAnalyzer.js`
- `tests/unit/logic/operators/hasClothingInSlotOperator.test.js`
- `tests/unit/logic/jsonLogicCustomOperators.test.js`
- `tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js`
- `tests/unit/logic/jsonLogicOperatorRegistration.test.js`
- `tests/unit/actions/validation/prerequisiteDebugger.test.js`
- `tests/unit/actions/validation/prerequisiteErrorMessages.test.js`
- `tests/integration/logic/customOperatorRegistration.test.js`
- `tests/integration/logic/operatorWhitelistValidation.integration.test.js`
- `tests/integration/scopes/clothingSpecificScope.integration.test.js`
- `docs/goap/refinement-condition-context.md`
- `docs/goap/examples/README.md`
- `docs/goap/examples/conditional-patterns.refinement.json`
- `docs/goap/condition-patterns-guide.md`
- `docs/testing/debugging-prerequisites.md`
- `docs/testing/mod-testing-guide.md`
- `docs/architecture/hardcoded-references-audit.md`

### Added
- None

---

## Out of Scope
- Do not modify `isSlotExposed` semantics or socket coverage operators.
- Do not alter clothing data or scopes beyond test fixtures already named.
- Do not remove any unrelated prerequisite debugger cases.

---

## Acceptance Criteria

### Tests That Must Pass
1. `npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js --runInBand`
2. `npm run test:unit -- tests/unit/actions/validation/prerequisiteDebugger.test.js --runInBand`
3. `npm run test:unit -- tests/unit/actions/validation/prerequisiteErrorMessages.test.js --runInBand`
4. `npm run test:integration -- tests/integration/logic/customOperatorRegistration.test.js --runInBand`
5. `npm run test:integration -- tests/integration/logic/operatorWhitelistValidation.integration.test.js --runInBand`
6. `npm run test:integration -- tests/integration/scopes/clothingSpecificScope.integration.test.js --runInBand`

### Invariants That Must Remain True
- JsonLogic operator registration remains complete and consistent for all remaining operators.
- Prerequisite debugger still emits clear guidance for clothing coverage via the `isSlotExposed` path.
- No user-facing behavior change beyond the operator name swap (seduction prerequisites already migrated).
- Documentation accurately reflects the available clothing coverage operator (`isSlotExposed`) with corrected examples.

---

## Notes
- Ensure any fixtures or examples formerly demonstrating `hasClothingInSlot` are rewritten to use `!isSlotExposed` with `includeUnderwear/includeAccessories` or `layers` options that preserve behavior.
