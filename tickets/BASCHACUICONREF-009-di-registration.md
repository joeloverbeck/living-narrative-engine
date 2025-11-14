# BASCHACUICONREF-009: Register New Character Builder Service Dependencies

**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 2 days  
**Phase:** 1 - Infrastructure Enablement  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Dependency Injection Configuration section)

## Objective

Extend the DI container configuration so the eight new services can be injected into `BaseCharacterBuilderController` and downstream controllers via named tokens.

## Implementation Tasks

1. **Token Definitions**  
   - Create/extend `src/characterBuilder/tokens-characterBuilder.js` (new file if needed) exporting constants for: `DOMElementManager`, `EventListenerRegistry`, `ControllerLifecycleOrchestrator`, `ErrorHandlingStrategy`, `AsyncUtilitiesToolkit`, `PerformanceMonitor`, `ValidationService`, `MemoryManager`.  
   - Update any existing token registries or barrel files to re-export these identifiers.

2. **Container Registration**  
   - Modify the DI container setup (likely `src/config/container.js` or similar) to register each service.  
   - Ensure `EventListenerRegistry` receives `asyncUtilities` instance, `ErrorHandlingStrategy` receives `uiStateManager`, etc.  
   - Provide factory functions where constructor dependency graph requires cross-service references.  
   - Document optional configuration (e.g., performance thresholds) using environment variables or config constants.

3. **Base Controller Injection Wiring**  
   - Update `BaseCharacterBuilderController` constructor signature to accept the services via DI tokens while maintaining backwards compatibility (allow old options but log deprecation warning).  
   - Add validation to ensure tokens resolve to proper classes.

4. **Smoke Tests**  
   - Create a minimal integration harness under `tests/integration/characterBuilder/di/baseController.di.test.js` verifying DI container builds controller instances with all services available.  
   - Use spies to ensure services are singletons or scoped appropriately (document chosen lifetime).

5. **Documentation**  
   - Update architecture doc with DI graph diagram and instructions for registering additional services.  
   - Mention required changes for external mods hooking into controller tokens.

## Acceptance Criteria

- New tokens defined and exported.  
- DI container instantiates all services successfully with dependency graph validated by tests.  
- Base controller constructor supports injection + logs descriptive errors when services missing.  
- Docs describe new tokens + registration approach.
