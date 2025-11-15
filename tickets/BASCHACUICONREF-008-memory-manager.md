# BASCHACUICONREF-008: Implement MemoryManager

**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 2 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.8)

## Objective

Extract the weak reference helpers that currently live inside `src/characterBuilder/controllers/BaseCharacterBuilderController.js` (private fields `#weakReferences`/`#weakTracking` plus the `_setWeakReference`, `_getWeakReference`, `_trackWeakly`, and `_isWeaklyTracked` protected methods) into a dedicated service at `src/characterBuilder/services/memoryManager.js` to prevent leaks and enable deterministic cleanup.

## Implementation Tasks

1. **Service Implementation**
   - Provide methods `setWeakReference(key, value)`, `getWeakReference(key)`, `trackWeakly(obj)`, `isWeaklyTracked(obj)`, and `clear()` so downstream consumers can mirror the controller helpers that already exist in production.
   - Use `WeakMap`/`WeakSet` just like the controller does today; document (but do not implement) the manual fallback plan since the current runtime targets modern browsers and Node 20+.
   - Add logger warnings surfaced through the injected `ILogger` whenever the service receives invalid keys/values so regressions stay observable.

2. **Unit Tests**  
   - `tests/unit/characterBuilder/services/memoryManager.test.js`.  
   - Mock/spy on logger to ensure warnings triggered appropriately.  
   - Validate `clear()` removes references and that repeated `trackWeakly` is idempotent.

3. **Controller Integration**
   - Replace the controller-private `#weakReferences`/`#weakTracking` fields with an instance of the new `MemoryManager` service (it can be new-ed internally until the broader dependency injection work in BASCHACUICONREF-010 lands).
   - Update `_setWeakReference`, `_getWeakReference`, `_trackWeakly`, and `_isWeaklyTracked` to simply proxy to the service (or convert them to getters around the service helpers if that keeps the controller API stable for subclasses).
   - Wire the existing `_clearReferences()` hook—already registered with `DESTRUCTION_PHASES.CLEAR_REFERENCES` via `ControllerLifecycleOrchestrator`—to call `memoryManager.clear()` so destruction automatically purges tracked entries without modifying the orchestrator itself.

4. **Docs**  
   - Document when to use weak tracking vs strong references and how to register watchers for GC-critical resources.

## Acceptance Criteria

- Memory-related helpers exist solely inside `memoryManager.js`.  
- Base controller no longer stores WeakMap/WeakSet instances.  
- Unit tests cover service APIs (including logger warnings for invalid keys) and pass with ≥90% coverage.
- Documentation explains usage, GC considerations, and references the controller lifecycle hook that clears references.
