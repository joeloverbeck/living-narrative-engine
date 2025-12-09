# OPEUSAANA-002: Remove hasClothingInSlotLayer operator and registrations

**Status:** Completed
**Priority:** High
**Estimated Effort:** 0.5 day
**Dependencies:** OPEUSAANA-001 (all usages migrated)

---

## Outcome

- Removed `src/logic/operators/hasClothingInSlotLayerOperator.js`.
- Removed `tests/unit/logic/operators/hasClothingInSlotLayerOperator.test.js`.
- Removed registration and whitelist entries from `src/logic/jsonLogicCustomOperators.js` and `src/logic/jsonLogicEvaluationService.js`.
- Removed legacy description support from `src/scopeDsl/analysis/filterClauseAnalyzer.js`.
- Removed stale references from `docs/architecture/hardcoded-references-audit.md`, `docs/goap/refinement-condition-context.md`, and `docs/goap/condition-patterns-guide.md`.
- Verified removal with existing test suites (unit and integration).

---

## Objective

Delete the `hasClothingInSlotLayer` operator from runtime and tests after all consumers are migrated, and prune DI/whitelist/registration paths to eliminate dead code.

---

## Files to Touch

### Modified/Removed
- `src/logic/operators/hasClothingInSlotLayerOperator.js`
- `src/logic/jsonLogicCustomOperators.js`
- `src/logic/jsonLogicEvaluationService.js`
- `src/scopeDsl/analysis/filterClauseAnalyzer.js`
- `tests/unit/logic/operators/hasClothingInSlotLayerOperator.test.js`
- `tests/unit/logic/jsonLogicCustomOperators.test.js`
- `tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js`
- `tests/unit/logic/jsonLogicOperatorRegistration.test.js`
- `tests/integration/logic/customOperatorRegistration.test.js`
- `tests/integration/logic/operatorWhitelistValidation.integration.test.js`

### Added
- None

---

## Out of Scope
- Do not alter `hasClothingInSlot` or `isSlotExposed` implementations.
- Do not modify data/mod scopes/actions (handled in OPEUSAANA-001 and OPEUSAANA-003).
- Do not change logging format or operator base class behaviors beyond removing references.

---

## Acceptance Criteria

### Tests That Must Pass
1. `npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js --runInBand`
2. `npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js --runInBand`
3. `npm run test:unit -- tests/unit/logic/jsonLogicOperatorRegistration.test.js --runInBand`
4. `npm run test:integration -- tests/integration/logic/customOperatorRegistration.test.js --runInBand`
5. `npm run test:integration -- tests/integration/logic/operatorWhitelistValidation.integration.test.js --runInBand`

### Invariants That Must Remain True
- All remaining custom operators stay registered and whitelisted as before (no accidental removals).
- JsonLogic evaluation continues to load without missing-operator errors for supported names.
- No references to `hasClothingInSlotLayer` remain in code, tests, or docs.
- Logging and error messaging for other operators remains unchanged.

---

## Notes
- Remove DI wiring, whitelist entries, and factory instantiation for the operator; ensure test fixtures are rewritten or deleted rather than skipped.
