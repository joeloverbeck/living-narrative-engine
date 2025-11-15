# BASCHACUICONREF-003: Implement ControllerLifecycleOrchestrator

**Status:** Complete
**Priority:** Critical  
**Estimated Effort:** 4 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.3)

## Objective

Extract all lifecycle state, initialization phases, and destruction/cleanup orchestration from `BaseCharacterBuilderController` into `src/characterBuilder/services/controllerLifecycleOrchestrator.js`, enabling reusable and testable lifecycle management.

## Implementation Summary

1. **Service Skeleton** – Added `ControllerLifecycleOrchestrator` with `logger`, `eventBus`, and optional `hooks` dependencies. The class encapsulates lifecycle state flags, cleanup task stacks, hook registries, and exports default initialization/destruction sequences plus phase enums for reuse.

2. **Lifecycle Flow Porting** – Migrated initialization/reinitialization/destruction flows out of `BaseCharacterBuilderController`. Each phase now runs through registered hooks with guardrails preventing concurrent runs, descriptive logging, success event dispatching, and dedicated error hooks (rather than separate event dispatches) when initialization fails.

3. **Cleanup Task Management** – Introduced `registerCleanupTask`, `checkDestroyed`, `makeDestructionSafe`, and private cleanup execution helpers so controllers can register LIFO teardown work while maintaining the legacy safety guarantees.

4. **Unit Tests** – Authored `tests/unit/characterBuilder/services/controllerLifecycleOrchestrator.test.js` covering happy-path lifecycle orchestration, concurrency guards, error propagation, cleanup ordering, hook deregistration, reinitialization, and destruction safety wrappers using fake timers.

5. **Base Controller Integration Hooks** – `BaseCharacterBuilderController` now injects/creates the orchestrator, registers bridge hooks (`#configureLifecycleHooks`), and delegates lifecycle entrypoints, state getters, cleanup task registration, and destruction guards to the orchestrator. Existing subclasses continue overriding the same protected helpers transparently.

6. **Docs** – Updated `docs/architecture/base-character-builder-refactor.md` with lifecycle phase descriptions, hook contract expectations, and instructions for targeted Jest suites to socialize the new service.

## Testing

- `npm run test:single -- tests/unit/characterBuilder/services/controllerLifecycleOrchestrator.test.js`

> **Note:** `npm run test:unit -- controllerLifecycleOrchestrator` still fails due to repository-wide coverage thresholds, but the dedicated suite passes per guidance in BASCHACUICONREF-000.

## Acceptance Criteria

- Base controller delegates lifecycle state, cleanup tracking, and guard helpers to the orchestrator.
- Orchestrator exposes lifecycle status getters and destruction-safe helpers consumed by controllers.
- New unit test suite exercises the orchestrator features with high coverage via the targeted Jest command above.
- Documentation advertises lifecycle phases, contracts, and the available test command for dependent controller owners.
