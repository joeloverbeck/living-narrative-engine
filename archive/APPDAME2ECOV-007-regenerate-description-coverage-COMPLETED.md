# APPDAME2ECOV-007: REGENERATE_DESCRIPTION After APPLY_DAMAGE E2E Coverage

## Status

Completed

## Summary

Add e2e coverage proving that `REGENERATE_DESCRIPTION` runs after `APPLY_DAMAGE` and that the refreshed `core:description` reflects injury/effect state. The existing weapons handler profile stubs `BodyDescriptionComposer`, so the suite must install the real composer to observe damage-aware text rather than the default placeholder.

## Background

- `data/mods/weapons/macros/handleMeleeHit.macro.json` already invokes `REGENERATE_DESCRIPTION` immediately after each `APPLY_DAMAGE` entry (integration tests confirm ordering), but no e2e test asserts the resulting description content.
- The weapons ModTestFixture profile wires a mock composer (`Description for <id>`), so damage never appears in regenerated text unless tests re-register the handler with the real `BodyDescriptionComposer` (plus injury aggregation/formatting services).
- `RegenerateDescriptionHandler` only updates `core:description`; it does not emit log entries, so scope should focus on description state.

## Files Expected to Touch

### New Files

- `tests/e2e/actions/regenerateDescriptionAfterDamage.e2e.test.js` — new e2e suite exercising APPLY_DAMAGE → REGENERATE_DESCRIPTION with the real composer.

### Files Referenced (Read-Only for Context)

- `src/logic/operationHandlers/regenerateDescriptionHandler.js`
- `src/anatomy/bodyDescriptionComposer.js`
- `data/mods/weapons/macros/handleMeleeHit.macro.json`

## Out of Scope

- Production code changes in `src/`
- Editing existing test files
- Changing macro definitions
- Adding logging behavior to RegenerateDescriptionHandler
- Other APPLY_DAMAGE coverage gaps (narrative dispatch, hit resolution controls, metadata/tags, propagation bookkeeping, session queueing, non-health edge cases)

## Acceptance Criteria

1) **Description refreshed after damage** — An e2e test shows `core:description.text` changes after APPLY_DAMAGE triggers REGENERATE_DESCRIPTION for the target.
2) **Health/injury line reflects damage** — Regenerated description includes a health line that mentions the inflicted injury state (e.g., wounded part) after damage.
3) **Damage effects appear** — Regenerated description surfaces effect-specific text when bleeding or burning components are present.
4) **Destroyed parts reported** — Regenerated description notes missing/destroyed parts when damage crosses destruction thresholds.

## Invariants

- Existing e2e suites under `tests/e2e/actions/` continue to pass.
- `RegenerateDescriptionHandler` behavior remains unchanged (tests only).
- Tests use `ModTestFixture`/`ModEntityBuilder` utilities and clean up in `afterEach`.
- Damage/effect components remain on entities after regeneration.

## Implementation Notes

- Re-register REGENERATE_DESCRIPTION in the test with a real `BodyDescriptionComposer` wired to `InjuryAggregationService` and `InjuryNarrativeFormatterService`; otherwise the stub composer masks damage.
- Drive the APPLY_DAMAGE → REGENERATE_DESCRIPTION flow via the `weapons:swing_at_target` action; reuse real ApplyDamageHandler wiring for deterministic effects.
- Assert before/after description text and check for effect keywords (bleeding/burning) or destruction phrasing.

## Testing Command

```bash
NODE_ENV=test npx jest tests/e2e/actions/regenerateDescriptionAfterDamage.e2e.test.js --no-coverage --verbose
```

## Dependencies

- None (new standalone test file with inline handler wiring)

## Estimated Size

Small-Medium — Single test file with a handful of cases

## Outcome

- Added `tests/e2e/actions/regenerateDescriptionAfterDamage.e2e.test.js` with four cases (injury line shift, bleeding, burning, destroyed/missing parts) using the real BodyDescriptionComposer and ApplyDamage wiring.
- No production code changes; coverage gap closed by test-only additions.
