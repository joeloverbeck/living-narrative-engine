# APPDAMREFFLEX-070 Trace, telemetry, and deprecation guardrails

## Goal

Add structured trace output to the damage resolution process (covering target selection, mitigation steps, propagation rolls, and errors) by attaching a trace log to the `executionContext`. Introduce validation/lint hooks that warn on legacy `amount`/`damage_type` usage in new content (specifically in `APPLY_DAMAGE` operations) without breaking backward compatibility.

## File list

- src/logic/services/damageResolutionService.js (trace object population in `executionContext`, error classification)
- src/anatomy/services/damageTypeEffectsService.js (emit trace entries for effect application)
- src/anatomy/validation/rules/propertySchemaValidationRule.js (update to warn on `deprecated` schema properties)
- data/schemas/operations/applyDamage.schema.json (mark `amount` and `damage_type` as deprecated)
- tests/unit/logic/services/damageResolutionService.trace.test.js (new unit coverage for trace contents and error vs soft skip behavior)
- tests/validation/legacyPayloadValidation.test.js (new validation test for flagging legacy-only payloads in mods)
- docs (short note on enabling trace/debug output)

## Out of scope

- Changing runtime behavior or damage math; traces must be additive and optional.
- Hard failing existing mods that still use legacy fields.
- Any client/UI surfacing of trace data beyond debug hooks.
- Changing the return signature of `DamageResolutionService.resolve` (it remains `Promise<void>`).

## Acceptance criteria

- Tests: new trace-focused unit test passes; validation/lint hook exercised in tests/validation and does not fail existing mod fixtures.
- Invariants: When trace/debugging is disabled (or `executionContext.trace` is not initialized), no additional events/log spam is emitted; legacy payloads continue to execute without errors, only warnings where configured.

## Outcome

- **Trace Output**: Implemented structured tracing in `DamageResolutionService.js` and `DamageTypeEffectsService.js`. Enabled by setting `enableTrace: true` in `executionContext`. Output is accumulated in `executionContext.trace`.
- **Deprecation Guardrails**:
  - Updated `PropertySchemaValidationRule.js` to detect and warn on properties marked with `deprecated: true` in their schema.
  - Updated `data/schemas/operations/applyDamage.schema.json` to mark `amount` and `damage_type` parameters as deprecated.
  - Added `tests/integration/validation/legacyPayloadValidation.test.js` which scans all mod JSON files for legacy `APPLY_DAMAGE` usage and logs warnings (currently clean).
- **Testing**: Added specific unit tests for tracing and legacy validation. All regression tests passed.
- **Documentation**: Updated `specs/damage-application-mechanics.md` with instructions on enabling tracing.
