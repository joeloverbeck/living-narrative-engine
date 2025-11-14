# MULTARRESSTAREF-004: Register Tracing Orchestrator in DI Container

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 0.5 days
**Phase:** 1 - Tracing Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Register `TargetResolutionTracingOrchestrator` in the dependency injection container to make it available for injection into `MultiTargetResolutionStage`.

## Background

The new tracing orchestrator service needs to be registered in the DI container following the project's established dependency injection patterns.

## Technical Requirements

### Files to Modify

#### 1. Define DI Token
**File:** `src/dependencyInjection/tokens/tokens-pipeline.js`

**Change:** Add the token to the pipeline-specific collection that already groups the extracted multi-target services. This file feeds into `src/dependencyInjection/tokens.js`, so no additional wiring is needed.

```javascript
export const pipelineTokens = freeze({
  // Multi-Target Resolution Stage Services
  ITargetDependencyResolver: 'ITargetDependencyResolver',
  ILegacyTargetCompatibilityLayer: 'ILegacyTargetCompatibilityLayer',
  IScopeContextBuilder: 'IScopeContextBuilder',
  ITargetDisplayNameResolver: 'ITargetDisplayNameResolver',
  ITargetResolutionTracingOrchestrator: 'ITargetResolutionTracingOrchestrator',

  // Service Infrastructure
  IPipelineServiceFactory: 'IPipelineServiceFactory',
  IPipelineServiceRegistry: 'IPipelineServiceRegistry',
});
```

#### 2. Register Service Factory
**File:** `src/dependencyInjection/registrations/pipelineServiceRegistrations.js`

This registration file already exists and uses the `Registrar` helper. Follow the existing singleton factory pattern so the orchestrator sits alongside the other extracted services.

```javascript
import TargetResolutionTracingOrchestrator from '../../actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';
import { tokens } from '../tokens.js';

// Inside registerPipelineServices(container):
  registrar.singletonFactory(tokens.ITargetResolutionTracingOrchestrator, (c) => {
    return new TargetResolutionTracingOrchestrator({
      logger: c.resolve(tokens.ILogger),
    });
  });
```

#### 3. Update Stage Registration
**File:** `src/dependencyInjection/registrations/commandAndActionRegistrations.js`

`MultiTargetResolutionStage` is registered inside `registerCommandAndAction()`. Update that factory so it resolves the new service and passes it to the stage constructor (the stage will start using it in MULTARRESSTAREF-005).

```javascript
  registrar.singletonFactory(tokens.IMultiTargetResolutionStage, (c) => {
    return new MultiTargetResolutionStage({
      targetDependencyResolver: c.resolve(tokens.ITargetDependencyResolver),
      // ... existing dependencies ...
      logger: c.resolve(tokens.ILogger),
      tracingOrchestrator: c.resolve(tokens.ITargetResolutionTracingOrchestrator),
    });
  });
```

## Acceptance Criteria

- [ ] Token defined in `tokens-pipeline.js`
- [ ] Service registered with factory pattern
- [ ] Factory injects `ILogger` dependency
- [ ] Registration follows project DI patterns
- [ ] No circular dependencies introduced
- [ ] TypeScript checks pass (`npm run typecheck`)

## Dependencies

- **MULTARRESSTAREF-002** - Implementation must exist before registration
- **MULTARRESSTAREF-003** - Tests should pass before registration

## Testing Strategy

**Validation Test:**
```javascript
describe('DI Container - Tracing Orchestrator', () => {
  it('should resolve ITargetResolutionTracingOrchestrator', () => {
    const container = createContainer();
    const orchestrator = container.resolve(tokens.ITargetResolutionTracingOrchestrator);
    expect(orchestrator).toBeDefined();
    expect(typeof orchestrator.isActionAwareTrace).toBe('function');
  });

  it('should inject logger dependency', () => {
    const container = createContainer();
    const orchestrator = container.resolve(tokens.ITargetResolutionTracingOrchestrator);
    // Verify logger is injected (implementation-specific check)
  });
});
```

## Validation Commands

```bash
npm run typecheck
npm run test:unit -- --testNamePattern="DI Container"
```

## Notes

- Follow existing DI registration patterns in the codebase
- Ensure logger is properly injected
- Token name follows interface naming convention (`I` prefix)
- Factory pattern allows for dependency injection
- Will be consumed by `MultiTargetResolutionStage` in next phase
