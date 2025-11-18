# PLASTAAUT-002: Validate STATE_MISS diagnostics from PlanningStateView

## Status
- Completed — updated ticket scope and strengthened PlanningStateView diagnostics tests.

## File list
- tickets/PLASTAAUT-002-planning-state-view-state-miss-telemetry.md
- tests/unit/goap/planner/planningStateView.test.js

## Out of scope
- Any modifications to GOAP event bus consumers or GOAP event type definitions outside of `GOAP_EVENTS.STATE_MISS`.
- Refactoring other PlanningStateView APIs (e.g., value getters unrelated to component presence).
- Changes to docs, integration tests, or operator logic (covered by other tickets).

## Reality check
- `PlanningStateView.hasComponent` already records lookups/misses and emits `GOAP_EVENTS.STATE_MISS` through `recordPlanningStateMiss`. The missing piece is automated verification.
- Current unit tests only inspect in-memory diagnostics counters; they never register an event bus, so regressions in the `STATE_MISS` payloads/emit count would go unnoticed.

## Acceptance criteria
### Required tests
- `npm run lint` on the modified files only
- `npm run test:unit -- --runInBand tests/unit/goap/planner/planningStateView.test.js`

### Invariants to preserve
- `PlanningStateView.hasComponent(entityId, componentId, options)` signature and return values stay `{ status, value, source, reason }`.
- `recordPlanningStateMiss` fires with the existing payload structure `{ actorId, entityId, componentId, origin, goalId, taskId, reason }`, though extra optional metadata is allowed.
- Snapshot alias support (`core_needs` vs `core:needs`) remains intact.
- `GOAP_STATE_ASSERT=1` still promotes state misses to hard failures after the telemetry event is logged.

## Implementation notes
- Add a tiny fake event bus in the PlanningStateView unit tests via `registerPlanningStateDiagnosticsEventBus` so the suite can assert on the emitted `GOAP_EVENTS.STATE_MISS` payloads.
- Verify entity-miss and component-miss lookups emit exactly one telemetry event each, including the reason string, while explicit falsy component records return `false` without emitting events.
- Keep runtime code changes to an absolute minimum (tests-only unless a regression is discovered while adding coverage).

## Outcome
- Ticket scope corrected to reflect that code already emits `STATE_MISS` events; gap is automated verification.
- PlanningStateView unit tests now register a fake GOAP event bus to assert entity- and component-miss emissions along with the no-event path for explicit falsy component values.
