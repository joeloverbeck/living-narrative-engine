# GOAP Event Dispatch Contract

## Summary

The GOAP refinement and tracing stacks currently rely on the shared `EventBus` to emit lifecycle events. Production code calls `eventBus.dispatch(type, payload)` while several tests (for example `tests/e2e/goap/refinementEngine.e2e.test.js`) assumed a `{ type, payload }` object signature. Because nothing in production asserts or documents the expected contract, the mismatch silently propagated until tests broke. This spec proposes formalizing the dispatch contract for GOAP events, adding helpers that enforce/normalize payloads, and instrumenting the system so regressions are detected immediately.

## Problem Statement

- `EventBus.dispatch` only accepts `(eventName, payload)` but different subsystems (tests, tooling, diagnostic tracers) sometimes treat the API as if it accepted a single object. When mocks drift away from production the tests start asserting on the wrong shape.
- There is no canonical helper or schema for GOAP event payloads, so every emitter assembles objects by hand and no runtime guard validates them.
- Failures surface late and indirectly (e.g. jest mismatch) instead of failing fast when an invalid call is made.

## Goals

1. Make the GOAP event emission API tolerant to both common call signatures so helper utilities and older mocks remain interoperable.
2. Provide a first-class helper for emitting GOAP events that stamps timestamps, actor IDs, and validates payload structure before reaching the bus.
3. Add runtime and automated-test validation so future regressions are caught as soon as dispatch is invoked.

## Non-Goals

- Redesigning the entire EventBus implementation or listener lifecycle.
- Changing event names, payload schemas, or how refinement consumers interpret them.
- Rewriting existing specs/tests beyond the additions required for coverage of the new helpers.

## Proposed Changes

### 1. Dual-Signature Dispatch Support

- Update `EventBus.dispatch` to accept either `(eventName: string, payload?: object)` **or** `({ type, payload, ... })`.
- Implementation detail: detect if the first argument is an object with a `type` property and treat it as the canonical event object. Normalize internally so listeners always receive `{ type, payload }`.
- Emit a development-mode warning if both the legacy signature and a `payload.payload` object are detected (misuse signal).

### 2. GOAP Event Helper

- Introduce `createGoapEvent(type, payload, { actorId, taskId })` inside `src/goap/events/goapEventFactory.js`.
- Responsibilities:
  - Auto-inject `timestamp` if absent.
  - Enforce payload to be a plain object (throws in dev/test otherwise).
  - Optionally merge contextual metadata (actorId/taskId) so emitters stay DRY.
- Provide `emitGoapEvent(eventBus, type, payload, context)` wrapper that calls the factory and forwards the normalized event via `eventBus.dispatch` using whichever signature the bus now supports.

### 3. Contract Validation & Tooling

- In test/dev builds, wrap `eventBus.dispatch` with a proxy that validates:
  - event `type` is a non-empty string.
  - payload is serializable (or at minimum plain object / undefined).
  - GOAP event payloads contain the required fields defined in `goapEvents.js` (e.g., `actorId` for refinement events).
- Emit descriptive errors that link to this spec when validation fails.
- Add Jest helpers so mocks can opt into the same validation (e.g., `createValidatedEventBusMock()` used by GOAP tests).
- Document the helper + contract in `docs/goap/debugging-tools.md` so tracing/debugging scripts call the same helper.

### 4. Automated Coverage

- Add unit tests for `goapEventFactory` ensuring timestamps + context injection.
- Add regression tests around `EventBus.dispatch` verifying both signatures behave identically for listeners and validation warnings trigger on misuse.
- Extend `tests/e2e/goap/refinementEngine.e2e.test.js` (or a nearby integration test) to assert that emitting GOAP events through the helper results in enriched payloads being delivered to tracers.

## Observability & Fast Failure

- Because dispatch validation now runs in dev/test, calling `dispatch` with the wrong signature throws immediately instead of letting expectations drift.
- Logging copy references the helper so developers know the fix.
- Optional metric hook: increment a counter when validation warnings fire so CI can detect misuses even if no listener asserts on the payload.

## Rollout Plan

1. Land the helper + dual-signature support along with tests.
2. Update GOAP emitters (refinement engine, tracer, planner diagnostics) to use `emitGoapEvent`.
3. Update test utilities to use `createValidatedEventBusMock` so mocks enforce the same signature.
4. Enable validation warnings in development builds; gate throwing behavior behind `process.env.NODE_ENV !== 'production'` to avoid shipping breaking changes immediately.

## Open Questions

- Should validation errors throw in production builds, or merely log and continue? (leaning towards warnings in prod to avoid runtime regressions.)
- Do non-GOAP systems (UI/evented tools) also need the helper, or do we scope the helper strictly to `goap` for now?
- Is additional metadata (planId, goalId) required in the helper context to satisfy other diagnostics?

Addressing these items gives us a clear contract for emitting GOAP events, shared helpers to eliminate duplicated logic, and automated safeguards so any future mismatch between mocks and reality is caught instantly instead of surfacing through brittle assertions.
