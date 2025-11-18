# GOAMULACTROB-002 Multi-actor integration diagnostics

## Summary
- Strengthen the multi-actor GOAP integration suite so every actor in a simulated turn emits either `PLANNING_COMPLETED` or `PLANNING_FAILED`, never a silent miss.
- Capture per-actor planning state snapshots and event counts to verify the controller's actor-scoped plan map survives alternating turns without leaking tasks or diagnostics.
- Build ergonomic helpers in the GOAP integration harness to make future regression coverage around actor sequencing trivial.

## Status
Completed – helper landed, suite expanded, and archival docs updated.

## Assumption review
- `registerPlanningStateSnapshot` already accepts `options.actorId` and `options.origin`. No harness change is needed to add metadata support; we simply have to pass the actor ID from tests that care about diagnostics.
- The multi-actor integration suite currently issues direct assertions against the raw event bus. There is no helper for per-actor terminal-event tracking, so the ticket's helper deliverable still applies verbatim.
- `createGoapTestSetup` already exposes `registerPlanningStateSnapshot(...)`. Suites only need a thin wrapper (or inline usage) to stamp actor metadata.

## Tasks
- Extend `tests/integration/goap/multiActor.integration.test.js` with a harness that spins at least three actors through consecutive turns, tracking `GOAP_EVENTS.PLANNING_COMPLETED` vs `PLANNING_FAILED` counts per actor and asserting each turn registers exactly one terminal event per actor.
- Add a helper (`tests/integration/goap/testHelpers/multiActorCompletionTracker.js`) that subscribes to the shared event bus, records counts keyed by actor, and exposes assertions used by the suite.
- Wire the existing `registerPlanningStateSnapshot` helper into the multi-actor suite (passing `{ actorId }`) whenever we snapshot planning state, so diagnostics like `goap:state_miss` can be correlated with the actor currently under test without changing the helper API.
- Implement a regression case that alternates actors A/B over multiple turns, verifying the actor-scoped plan map (from GOAMULACTROB-001) persists state per actor and does not reuse tasks from previous actors.
- Document the helper usage inline inside the test file to keep future contributors aware of the new per-actor assertions.

## Outcome
- Added `tests/integration/goap/testHelpers/multiActorCompletionTracker.js` to subscribe to the event bus, count terminal planning events per actor/turn, and expose the summaries tests now rely on.
- Reworked `tests/integration/goap/multiActor.integration.test.js` to drive two alternating three-actor turns, stamp actor-tagged planning snapshots, assert every actor produces one terminal event per turn, and verify per-actor totals via the new tracker.
- No changes to `registerPlanningStateSnapshot` were required; tests now pass `{ actorId, origin }` directly, validating the helper's actor metadata pathway that already existed.

## File list
- `tests/integration/goap/multiActor.integration.test.js`
- `tests/integration/goap/testHelpers/multiActorCompletionTracker.js`
- `tests/integration/goap/testFixtures/goapTestSetup.js`

## Out of scope
- Changes to `GoapController` core logic beyond what is already covered by GOAMULACTROB-001.
- Modifying other GOAP integration suites (multi-action, diagnostic, etc.) unless they fail due to the new helper APIs.
- Telemetry/export hooks intended for production monitoring (handled separately).

## Acceptance criteria
### Specific tests that must pass
- `npm run test:integration -- multiActor.integration.test.js`
- `npm run test:integration -- goap` (full suite) to ensure helper changes don't break other harness consumers.

### Invariants that must remain true
- Each actor exercised by `multiActor.integration.test.js` must log exactly one terminal planning event (`PLANNING_COMPLETED` or `PLANNING_FAILED`) per simulated turn.
- `registerPlanningStateSnapshot` continues to work for existing suites that do not opt into the new actor-tagged metadata.
- Event bus instrumentation remains read-only; tests must not mutate production dispatcher behavior while observing counts.
