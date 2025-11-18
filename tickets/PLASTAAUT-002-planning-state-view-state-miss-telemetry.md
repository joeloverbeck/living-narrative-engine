# PLASTAAUT-002: Emit STATE_MISS diagnostics from PlanningStateView

## File list
- src/goap/planner/planningStateView.js
- tests/unit/goap/planner/planningStateView.test.js

## Out of scope
- Any modifications to GOAP event bus consumers or GOAP event type definitions outside of `GOAP_EVENTS.STATE_MISS`.
- Refactoring other PlanningStateView APIs (e.g., value getters unrelated to component presence).
- Changes to docs, integration tests, or operator logic (covered by other tickets).

## Acceptance criteria
### Required tests
- `npm run lint`
- `npm run test:unit -- --runInBand tests/unit/goap/planner/planningStateView.test.js`

### Invariants to preserve
- `PlanningStateView.hasComponent(entityId, componentId, options)` signature and return values stay `{ status, value, source, reason }`.
- `recordPlanningStateMiss` fires with the existing payload structure `{ actorId, entityId, componentId, origin, goalId, taskId, reason }`, though extra optional metadata is allowed.
- Snapshot alias support (`core_needs` vs `core:needs`) remains intact.
- `GOAP_STATE_ASSERT=1` still promotes state misses to hard failures after the telemetry event is logged.

## Implementation notes
- Ensure `hasComponent` calls `recordPlanningStateMiss` whenever the entity is missing, the component id is invalid (null/empty), or the component is absent for a known entity, matching the spec's failure cases.
- Make sure diagnostic counters such as `totalLookups` and `unknownStatuses` track every `has_component` evaluation so stale planning data is observable.
- Expand unit tests to verify entity-miss and component-miss paths emit exactly one `STATE_MISS` event each, while explicit falsy component records return `false` without emitting events.
