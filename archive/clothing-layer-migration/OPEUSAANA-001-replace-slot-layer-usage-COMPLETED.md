# OPEUSAANA-001: Replace hasClothingInSlotLayer references with isSlotExposed

**Status:** Completed
**Priority:** High
**Estimated Effort:** 0.5-1 day
**Dependencies:** None

---

## Objective

Operator-usage analysis (see `reports/operator-usage-analysis.md`) shows `hasClothingInSlotLayer` no longer appears in runtime scopes—only in docs, legacy comments, and registration/cleanup tests. Align the codebase with the planned removal by rewriting those references to the `!isSlotExposed` + `layers` pattern while keeping the legacy operator registered for compatibility.

---

## Files to Touch

### Modified
- `data/mods/first-aid/scopes/wounded_actor_body_parts.scope` (example block only)
- `data/mods/first-aid/scopes/wounded_target_body_parts.scope` (example block only)
- `tests/integration/scopes/rubVaginaOverClothesActionDiscovery.integration.test.js` (custom-operator cleanup/registration lists)
- `tests/unit/logic/jsonLogicOperatorRegistration.test.js`
- `tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js`
- `docs/goap/refinement-condition-context.md`
- `docs/goap/condition-patterns-guide.md`
- `docs/architecture/hardcoded-references-audit.md`
- `src/scopeDsl/analysis/filterClauseAnalyzer.js` (recognizer messaging should highlight `isSlotExposed`; keep legacy mention minimal)

### Added/Removed
- None expected

---

## Out of Scope
- Do not delete or deregister the `hasClothingInSlotLayer` operator (follow-up ticket handles removal).
- Do not alter non-clothing scopes or actions outside the listed files.
- Do not change socket coverage operators (`isSocketCovered`, `socketExposure`).
- Do not refactor `hasClothingInSlot` consumers (separate consolidation ticket).

---

## Acceptance Criteria

### Tests That Must Pass
1. `npm run test:integration -- tests/integration/scopes/rubVaginaOverClothesActionDiscovery.integration.test.js --runInBand`
2. `npm run test:integration -- tests/integration/logic/customOperatorRegistration.test.js --runInBand` (to ensure registration remains stable after doc/test updates)
3. `npm run test:unit -- tests/unit/logic/jsonLogicCustomOperators.test.js --runInBand`

### Invariants That Must Remain True
- Behavior of wounded body part scopes matches pre-change logic (no change in eligible targets or exposure gating).
- Scope parsing/analysis still recognizes existing operator names while steering users toward `isSlotExposed`.
- No new references to `hasClothingInSlotLayer` are introduced outside compatibility mentions.
- Documentation examples continue to reflect actual available operators and syntax.

---

## Notes
- JSON Logic treats single-key objects as operators; use a layers array literal (e.g., `{ "!": { "isSlotExposed": ["actor|target", {"var": "...slotId..."}, ["base", "outer", "armor"]]}}`) or pass an options object via a `var` reference when mirroring legacy layer checks.

---

## Outcome
- Updated docs, test registrations, and example comments to steer usage toward `!isSlotExposed` with explicit layer arrays instead of `hasClothingInSlotLayer`.
- Added array handling to `isSlotExposed` options normalization so inline layer lists work with JSON Logic validation.
- Registration/whitelist tests now emphasize `isSlotExposed`; legacy operator references remain only for compatibility coverage and follow-up removal.
