# MULTARRESSTAREF-014: Register Resolution Coordinator in DI Container

**Status:** Not Started
**Priority:** Medium
**Estimated Effort:** 0.5 days
**Phase:** 3 - Resolution Coordination Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Register `TargetResolutionCoordinator` in the dependency injection container to make it available for injection into `MultiTargetResolutionStage`.

## Background

The resolution coordinator service needs to be registered in the DI container following the project's established dependency injection patterns.

## Technical Requirements

### Files to Modify

#### 1. Define DI Token
**File:** `src/dependencyInjection/tokens/tokens-pipeline.js`

**Change:** Add `ITargetResolutionCoordinator` to the exported `pipelineTokens` map that already includes the other multi-target pipeline services. This keeps all pipeline-specific DI keys grouped together and automatically exposes the token through `src/dependencyInjection/tokens.js` (which spreads `pipelineTokens` into the global `tokens` object).

#### 2. Register Service Factory
**File:** `src/dependencyInjection/registrations/pipelineServiceRegistrations.js`

**Change:** Use the existing `Registrar` helper (see how tracing/result builder registrations are implemented) to add a `singletonFactory` for `tokens.ITargetResolutionCoordinator`. The factory should instantiate `TargetResolutionCoordinator` from `src/actions/pipeline/services/implementations/TargetResolutionCoordinator.js` and inject **all eight** constructor dependencies:

- `ITargetDependencyResolver`
- `IScopeContextBuilder`
- `ITargetDisplayNameResolver`
- `IUnifiedScopeResolver`
- `IEntityManager`
- `ILogger`
- `ITargetResolutionTracingOrchestrator`
- `ITargetResolutionResultBuilder`

> `TargetResolutionCoordinator` validates each dependency (see its constructor), so make sure the factory resolves the exact tokens listed above. Follow the logging pattern already in the registration file so the completion message includes the new service.

#### 3. Stage Wiring (Deferred)
`MultiTargetResolutionStage` is still orchestrating everything directly. Per the program overview, integration happens in MULTARRESSTAREF-015, so **do not modify** `src/dependencyInjection/registrations/commandAndActionRegistrations.js` yet. This ticket only ensures the coordinator can be resolved from the container when Phase 4 starts.

## Acceptance Criteria

- [ ] Token defined in `tokens-pipeline.js` and therefore exposed through `tokens.js`
- [ ] Service registered with factory pattern
- [ ] Factory injects all 8 dependencies required by `TargetResolutionCoordinator`
- [ ] Registration follows project DI patterns
- [ ] No circular dependencies introduced
- [ ] TypeScript checks pass (`npm run typecheck`)

## Dependencies

- **MULTARRESSTAREF-012** - Implementation must exist before registration
- **MULTARRESSTAREF-013** - Tests should pass before registration

## Testing Strategy

**Validation Tests:**

- Extend `tests/unit/dependencyInjection/registrations/pipelineServiceRegistrations.test.js` (new or existing case) to assert that `registerPipelineServices` registers the coordinator token and resolves all dependencies when the factory is invoked.
- Optional smoke test: resolve `ITargetResolutionCoordinator` through `registerPipelineServices` in a focused unit test to ensure `coordinateResolution` is callable (constructor already validates dependencies).

## Validation Commands

```bash
npm run typecheck
npm run test:unit -- --testNamePattern="DI Container"
```

## Notes

- Follow existing DI registration patterns in the codebase
- Ensure all 8 dependencies are properly injected
- Token name follows interface naming convention (`I` prefix)
- Factory pattern allows for dependency injection
- Will be consumed by `MultiTargetResolutionStage` in next phase
