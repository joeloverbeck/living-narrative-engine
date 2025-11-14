# BASCHACUICONREF-008: Implement MemoryManager

**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 2 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.8)

## Objective

Extract weak reference tracking logic into `src/characterBuilder/services/memoryManager.js` to prevent leaks and enable deterministic cleanup.

## Implementation Tasks

1. **Service Implementation**  
   - Provide methods `setWeakReference(key, value)`, `getWeakReference(key)`, `trackWeakly(obj)`, `isWeaklyTracked(obj)`, `clear()`.  
   - Use `WeakMap`/`WeakSet` when supported, fall back to Map/Set polyfills (documented) for environments lacking Weak collections.  
   - Add logging when falling back to strong references (warn about potential leaks).

2. **Unit Tests**  
   - `tests/unit/characterBuilder/services/memoryManager.test.js`.  
   - Mock/spy on logger to ensure warnings triggered appropriately.  
   - Validate `clear()` removes references and that repeated `trackWeakly` is idempotent.

3. **Controller Integration**  
   - Remove `#weakReferences` and `#weakTracking` fields from base controller; delegate to service for caches like DOM nodes, services, etc.  
   - Ensure lifecycle orchestrator calls `memoryManager.clear()` during destroy.

4. **Docs**  
   - Document when to use weak tracking vs strong references and how to register watchers for GC-critical resources.

## Acceptance Criteria

- Memory-related helpers exist solely inside `memoryManager.js`.  
- Base controller no longer stores WeakMap/WeakSet instances.  
- Unit tests cover fallback behavior and pass with ≥90% coverage.  
- Documentation explains usage and GC considerations.
