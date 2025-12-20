# Perception Log E2E Coverage Spec

## Scope

This spec documents the end-to-end workflow coverage for perceptible event dispatching
and perception log storage, focused on recent changes in:

- `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
- `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`

The goal is to map the full pipeline (from operation endpoint to stored perception logs),
identify which parts are exercised by existing e2e tests under `tests/e2e/`, and
recommend new e2e suites to reach near-complete coverage, with emphasis on:

- sense-aware perceptible log dispatching
- propagation of logs to sensorially-connected locations

## End-to-End Workflow Map

1. **Endpoint: DISPATCH_PERCEPTIBLE_EVENT operation**
   - Entry points: rules (`data/mods/**/rules/*.rule.json`), UI (`src/domUI/perceptibleEventSenderController.js`),
     and services (e.g., `src/logic/services/damageResolutionService.js`).
2. **Handler: dispatchPerceptibleEventHandler**
   - Validates params, normalizes recipients/exclusions, validates perception type,
     adds sense-aware fields (`alternateDescriptions`, `senseAware`), sets `originLocationId`.
   - Dispatches `core:perceptible_event` on the event bus.
3. **Rule: log_perceptible_events**
   - Rule `data/mods/core/rules/log_perceptible_events.rule.json` listens to
     `core:perceptible_event` and emits an `ADD_PERCEPTION_LOG_ENTRY` operation.
4. **Handler: addPerceptionLogEntryHandler**
   - Resolves recipients (explicit list, location broadcast, or broadcast with exclusions).
   - Applies sense-aware filtering via `PerceptionFilterService` (if wired).
   - Applies actor/target descriptions and alternate descriptions.
   - Writes log entry into `core:perception_log` for each recipient.
   - Propagates logs across `locations:sensorial_links` with origin prefixing and loop guard.
5. **Storage**
   - Perception log entries are stored on entity components:
     `core:perception_log.logEntries`.

## Current E2E Coverage (tests/e2e)

The existing e2e suites only assert that `core:perceptible_event` is dispatched, not
that perception logs are written or sense-aware/propagation logic is applied.

### Suites that touch `core:perceptible_event`

- `tests/e2e/infrastructure/completeWorkflow.test.js`
  - Asserts a perceptible event exists during action workflows.
  - Does not inspect `core:perception_log` storage or routing.
- `tests/e2e/actions/damageNarrativeDispatch.e2e.test.js`
  - Verifies dispatch payload for `core:perceptible_event` (damage narrative).
  - Does not validate log entry creation.
- `tests/e2e/actions/propagationBookkeeping.e2e.test.js`
  - Confirms a `core:perceptible_event` occurs for damage propagation narratives.
  - Does not validate log entry creation.
- `tests/e2e/actions/damageSessionEventQueueing.e2e.test.js`
  - Checks queued events include `core:perceptible_event`.
  - Does not validate log entry creation.

### Suites that create perception logs manually (not pipeline coverage)

- `tests/e2e/prompting/PromptGenerationPipeline.e2e.test.js`
- `tests/e2e/turns/common/fullTurnExecutionTestBed.js`

These tests seed `core:perception_log` directly, so they do not exercise the
dispatch → rule → log storage pipeline.

### Notes on test harness wiring

The `ModTestFixture` environment wires `ADD_PERCEPTION_LOG_ENTRY` but does not
inject `PerceptionFilterService`. That means sense-aware filtering is effectively
disabled in most existing e2e contexts unless the full DI container is used.

## Coverage Gaps

- No e2e test validates that `ADD_PERCEPTION_LOG_ENTRY` writes to
  `core:perception_log` after a `DISPATCH_PERCEPTIBLE_EVENT`.
- Sense-aware filtering (alternate descriptions, lighting, senses) is not covered.
- Actor/target description routing is not covered.
- Recipient vs exclusion routing is not covered.
- Sensorial link propagation with origin prefixing and loop guard is not covered.
- Max-entry truncation and batch update paths are not covered.

## Recommended E2E Suites (Priority Order)

1. **Perceptible Event -> Perception Log Pipeline**
   - Proposed file: `tests/e2e/perception/PerceptibleEventLoggingPipeline.e2e.test.js`
   - Purpose: Validate the full pipeline from `DISPATCH_PERCEPTIBLE_EVENT` to
     stored `core:perception_log` entries for actors in a location.
   - Must assert:
     - `core:perceptible_event` dispatched with expected payload.
     - `core:perception_log.logEntries` updated for recipients.
     - Entry fields match payload (descriptionText, timestamp, perceptionType, actorId, targetId).
   - Status: Implemented in `tests/e2e/perception/PerceptibleEventLoggingPipeline.e2e.test.js`
     covering dispatch payload + perception log entry storage for co-located actors.

2. **Recipient Routing and Exclusions**
   - Proposed file: `tests/e2e/perception/RecipientRoutingAndExclusion.e2e.test.js`
   - Purpose: Verify `recipientIds` and `excludedActorIds` logic in both
     `dispatchPerceptibleEventHandler` and `addPerceptionLogEntryHandler`.
   - Must assert:
     - Explicit recipients receive logs only.
     - Excluded actors are not logged on broadcast.
     - Conflict (recipients + exclusions) behaves as defined (warn or error).
   - Status: Implemented in `tests/e2e/perception/RecipientRoutingAndExclusion.e2e.test.js`
     covering explicit recipient routing, exclusion-based broadcasts, dispatch-time conflicts,
     and add-log warnings that fall back to recipients.

3. **Sense-Aware Filtering and Alternate Descriptions**
   - Proposed file: `tests/e2e/perception/SenseAwareFiltering.e2e.test.js`
   - Purpose: Ensure `PerceptionFilterService` is wired and filtering occurs.
   - Must assert:
     - Primary sense vs fallback sense behavior (e.g., dark lighting forces auditory fallback).
     - Alternate descriptions are used per sense.
     - `actor_description` bypasses filtering for the originating actor.
     - `target_description` applies for target only and still respects filtering.
     - `sense_aware: false` disables filtering and uses base description.
   - Status: Implemented in `tests/e2e/perception/SenseAwareFiltering.e2e.test.js`
     covering primary sense (visual) vs fallback sense (auditory, limited) behavior,
     actor_description bypassing filtering, target_description preservation,
     and sense_aware: false disabling all filtering. Test wires `PerceptionFilterService`
     with mock `SensoryCapabilityService` and `LightingStateService` to validate filtering.
   - Key implementation notes:
     - When primary sense works (e.g., visual in lit room), base description is used.
     - `alternate_descriptions` are only applied for fallback senses.
     - `target_description` is preserved even during filtering (custom description priority).

4. **Sensorial Link Propagation**
   - Proposed file: `tests/e2e/perception/SensorialLinkPropagation.e2e.test.js`
   - Purpose: Validate propagation across `locations:sensorial_links`.
   - Must assert:
     - Linked locations receive prefixed entries `(From <origin>) ...`.
     - `origin_location_id` prevents propagation loops.
     - Originating actor is excluded from propagated logs.
   - Status: Implemented in `tests/e2e/perception/SensorialLinkPropagation.e2e.test.js`
     with 10 test cases covering:
     - Prefixed propagation with `(From <origin>)` prefix for linked locations.
     - Fallback to location ID as prefix when location has no name component.
     - Loop prevention via `origin_location_id` matching validation.
     - Originating actor exclusion from propagated logs in linked locations.
     - Multi-location propagation to all linked targets.
     - Explicit recipients blocking propagation entirely.
     - Graceful handling of empty linked locations (no actors).
     - Correct behavior when location has no sensorial links.

5. **Perception Log Limits and Batch Update Paths**
   - Proposed file: `tests/e2e/perception/PerceptionLogLimits.e2e.test.js`
   - Purpose: Validate storage behavior under repeated writes.
   - Must assert:
     - `maxEntries` truncation is respected.
     - Batch update path maintains correct ordering.
   - Status: Implemented in `tests/e2e/perception/PerceptionLogLimits.e2e.test.js`
     with 10 test cases covering:
     - **maxEntries Truncation**:
       - Truncates log entries when exceeding maxEntries limit (verifies FIFO ordering).
       - Respects different maxEntries limits per actor in same location.
       - Handles maxEntries=1 edge case.
     - **Batch Update Ordering**:
       - Maintains chronological ordering in batch updates.
       - Updates all recipients atomically in same batch.
     - **Edge Cases and Recovery**:
       - Handles pre-existing entries correctly during truncation.
       - Recovers from corrupted logEntries (non-array).
       - Recovers from corrupted maxEntries (invalid number, falls back to default 50).
       - Handles empty location gracefully (no recipients).
     - **Burst Writing Behavior**:
       - Handles rapid sequential writes correctly with proper truncation per actor.

## Acceptance Criteria

- Each recommended suite targets at least one untested branch of the two handlers.
- At least one suite validates end-to-end storage in `core:perception_log` for
  multiple recipients.
- Sense-aware and sensorial link workflows are explicitly validated in e2e.
