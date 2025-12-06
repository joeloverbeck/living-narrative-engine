# APPDAMREFFLEX-060 Narrative and session isolation

## Goal
Isolate damage session lifecycle and narrative composition from handler control by using session tokens and `DamageResult` payloads, ensuring event dispatch order and narratives remain consistent after delegation to the resolution service.

## File list
- src/logic/services/damageResolutionService.js (session token management, narrative payload assembly)
- src/anatomy/services/damageAccumulator.js (consume DamageResult.narrativeEntry)
- src/anatomy/services/damageNarrativeComposer.js (adapt to new entry shape if needed)
- src/anatomy/services/deathCheckService.js (consume DamageResult totals instead of handler state)
- src/logic/operationHandlers/applyDamageHandler.js (use session tokens; dispatch narrative/events via result)
- tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js (assert narrative/event parity)
- tests/unit/anatomy/services/damageAccumulator.test.js (update expectations if structure changes)

## Out of scope
- Changing the textual content of narratives.
- Introducing new events or removing existing ones.
- Mitigation or propagation math (covered in other tickets).

## Acceptance criteria
- Tests: listed e2e and unit suites pass with unchanged snapshots/logging; any new session token helper tests included.
- Invariants: Event dispatch order remains narrative first, then legacy queued events, then death checks; narrative text for existing scenarios is byte-identical to pre-refactor output.
