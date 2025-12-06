# APPDAMREFFLEX-070 Trace, telemetry, and deprecation guardrails

## Goal
Add structured trace output to `DamageResult` (covering target selection, mitigation steps, propagation rolls, and errors) and introduce validation/lint hooks that warn on legacy `amount`/`damage_type` usage in new content without breaking backward compatibility.

## File list
- src/logic/services/damageResolutionService.js (trace object population, error classification)
- src/anatomy/services/damageTypeEffectsService.js (emit trace entries for effect application)
- tests/unit/logic/services/damageResolutionService.trace.test.js (new unit coverage for trace contents and error vs soft skip behavior)
- scripts/validation or tests/validation (lint/validation rule for flagging legacy-only payloads in new mods)
- docs (short note on enabling trace/debug output)

## Out of scope
- Changing runtime behavior or damage math; traces must be additive and optional.
- Hard failing existing mods that still use legacy fields.
- Any client/UI surfacing of trace data beyond debug hooks.

## Acceptance criteria
- Tests: new trace-focused unit test passes; validation/lint hook exercised in tests/validation and does not fail existing mod fixtures.
- Invariants: When trace/debugging is disabled, no additional events/log spam is emitted; legacy payloads continue to execute without errors, only warnings where configured.
