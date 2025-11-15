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
   - Extend `src/dependencyInjection/tokens/tokens-core.js` (current home for Character Builder tokens) with entries for `DOMElementManager`, `EventListenerRegistry`, `ControllerLifecycleOrchestrator`, `ErrorHandlingStrategy`, `AsyncUtilitiesToolkit`, `PerformanceMonitor`, `ValidationService`, and `MemoryManager`.
   - Ensure these tokens are re-exported through `src/dependencyInjection/tokens.js` so `CharacterBuilderBootstrap` and downstream callers can resolve them.

2. **Container Registration**
   - Update `src/dependencyInjection/registrations/characterBuilderRegistrations.js` (invoked from `configureBaseContainer`) to register each new service.
   - Wire their actual dependencies: e.g., `EventListenerRegistry` needs both the logger and `AsyncUtilitiesToolkit`, `DOMElementManager` expects DOM/performance references, and `ControllerLifecycleOrchestrator` consumes the logger plus the event bus.
   - Stick with the existing `registrar.singletonFactory(...)` pattern so the lifetime/ordering matches the rest of the Phase 1 plan from BASCHACUICONREF-000.
   - Document optional configuration (e.g., performance thresholds) using environment variables or config constants.

3. **Base Controller Injection Wiring**
   - Update `src/characterBuilder/controllers/BaseCharacterBuilderController.js` so the constructor can accept these services in the `dependencies` object rather than instantiating them inside the private getters.
   - Keep the lazy-instantiation code as a temporary fallback (log a deprecation warning) to avoid breaking controllers that are still being migrated.
   - Update `src/characterBuilder/CharacterBuilderBootstrap.js` to resolve the new tokens from the container and include them in each controller’s dependency bag alongside the logger/event bus/schemaValidator.

4. **Smoke Tests**
   - Add a controller-focused spec under `tests/integration/characterBuilder/controllers/BaseCharacterBuilderController.di.integration.test.js` (same folder the other base-controller specs use) to verify `configureMinimalContainer` can resolve and inject the new services.
   - Use spies to ensure services are singletons or scoped appropriately (document chosen lifetime).

5. **Documentation**  
   - Update architecture doc with DI graph diagram and instructions for registering additional services.  
   - Mention required changes for external mods hooking into controller tokens.

## Acceptance Criteria

- New tokens defined and exported.  
- DI container instantiates all services successfully with dependency graph validated by tests.  
- Base controller constructor supports injection + logs descriptive errors when services missing.  
- Docs describe new tokens + registration approach.
