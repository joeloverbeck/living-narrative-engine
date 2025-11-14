# BASCHACUICONREF-003: Implement ControllerLifecycleOrchestrator

**Status:** Not Started  
**Priority:** Critical  
**Estimated Effort:** 4 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.3)

## Objective

Extract all lifecycle state, initialization phases, and destruction/cleanup orchestration from `BaseCharacterBuilderController` into `src/characterBuilder/services/controllerLifecycleOrchestrator.js`, enabling reusable and testable lifecycle management.

## Implementation Tasks

1. **Service Skeleton**  
   - Define class with constructor dependencies `{ logger, eventBus, hooks = {} }`.  
   - Internal state mirrors current private booleans/callback arrays: `#isInitialized`, `#isInitializing`, `#isDestroyed`, `#isDestroying`, `#cleanupTasks`, plus hook registries per lifecycle phase.

2. **Lifecycle Flow Porting**
   - Move methods controlling initialization/destroy/reinitialize sequences (`initialize`, `destroy`, `_executeLifecycleMethod`, `_preInitialize`, `_initializeServices`, `_initializeAdditionalServices`, `_loadInitialData`, `_initializeUIState`, `_postInitialize`, `_handleInitializationError`, `_onInitializationError`, `_reinitialize`).
   - Provide explicit hook phases (preInit, initServices, loadData, initUI, postInit, destroy, cleanup).  
   - Ensure concurrency guards prevent overlapping initialize/destroy operations and throw descriptive errors when misused.

3. **Cleanup Task Management**
   - Offer `_registerCleanupTask(taskFn, description)` storing metadata + idempotent execution (mirroring the existing protected helper in `BaseCharacterBuilderController`).
   - Provide `_makeDestructionSafe(method, name)` helper returning wrapped function that aborts when controller destroyed.

4. **Unit Tests**  
   - Create `tests/unit/characterBuilder/services/controllerLifecycleOrchestrator.test.js`.  
   - Cover: happy-path initialize/destroy, error propagation, double initialize prevention, cleanup task execution order, hook registration/deregistration, `reinitialize` resets, guard helpers.  
   - Use fake timers to assert async flows and ensure eventBus notifications triggered.

5. **Base Controller Integration Hooks**
   - Add property `this.#lifecycle` (injected) and re-route `initialize/destroy/_reinitialize` methods to orchestrator.
   - Provide bridging hooks so subclasses can continue overriding `_preInitialize`, `_postInitialize`, etc., until BASCHACUICONREF-010 finalizes base controller rewrite.

6. **Docs**  
   - Document lifecycle phases, hook names, and expected contract (sync vs async) in architecture doc + inline JSDoc.

## Acceptance Criteria

- Base controller no longer contains direct lifecycle state booleans or cleanup arrays.  
- Orchestrator exposes getters for lifecycle status (used by base controller).  
- Unit tests deliver ≥90% coverage and run via `npm run test:unit -- controllerLifecycleOrchestrator`.  
- Hook contract documented and circulated with dependent controller owners.
