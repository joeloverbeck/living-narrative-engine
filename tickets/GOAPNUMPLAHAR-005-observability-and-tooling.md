# GOAPNUMPLAHAR-005: Observability and Tooling Hardening

**Status**: Ready  
**Priority**: Medium  
**Spec Reference**: `specs/goap-numeric-planning-hardening.md`

## Summary

Reinforce the debugging pipeline described in the numeric planning hardening spec. Engineers should rely on the documented tooling (Plan Inspector, GOAPDebugger, refinery tracer) rather than scattering ad-hoc logging. Failure tracking needs to distinguish reasons such as "Depth limit reached" or "Distance check rejected all tasks" so GOAPDebugger reports are self-explanatory when planners stall.

## Requirements

1. Audit planner/controller telemetry hooks to confirm they emit the metrics and failure reasons consumed by Plan Inspector and GOAPDebugger (plan lengths, failure counts, reasons, etc.).
2. Extend failure tracking enums/messages so numeric planning-specific causes (depth limit, distance guard) are recorded and surfaced via `getFailedGoals()` / `getFailedTasks()`.
3. Update `docs/goap/debugging-tools.md` with guidance on using the existing tools before adding temporary `console.log` statements, emphasizing the new failure reason coverage.
4. Verify refinery tracer artifacts (if present) can display the new failure states or include action items to extend the tracer schema if it currently drops them.

## Tasks

- [ ] Add structured failure reason codes/strings in the planner and ensure they propagate through GOAPDebugger aggregations.
- [ ] Update tests (unit or integration) that assert `getFailedGoals()` / `getFailedTasks()` output to include the new reason labels.
- [ ] Refresh debugging documentation screenshots or snippets to reflect the improved observability.
- [ ] Identify and remove any lingering ad-hoc numeric planner logging in favor of the standardized telemetry.

## Dependencies / Related Work

- Planner/controller telemetry in `src/goap/planner/` and `src/goap/controllers/`
- GOAP debugging tooling docs under `docs/goap/debugging-tools.md`
- GOAPDebugger implementation files (search `getFailedGoals` / `getFailedTasks`)

## Acceptance Criteria

- Failure reasons for numeric planning surface inside GOAPDebugger/Plan Inspector without extra logging.
- Automation verifies the presence of the new failure reasons.
- Documentation clearly instructs developers to lean on the established debugging stack.

