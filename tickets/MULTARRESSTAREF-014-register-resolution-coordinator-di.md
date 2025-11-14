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
**File:** `src/dependencyInjection/tokens/tokens-core.js`

**Change:**
```javascript
export const tokens = {
  // ... existing tokens ...

  // Target Resolution Pipeline Services
  ITargetResolutionTracingOrchestrator: 'ITargetResolutionTracingOrchestrator',
  ITargetResolutionResultBuilder: 'ITargetResolutionResultBuilder',
  ITargetResolutionCoordinator: 'ITargetResolutionCoordinator',

  // ... existing tokens ...
};
```

#### 2. Register Service Factory
**File:** `src/dependencyInjection/registrations/pipelineServiceRegistrations.js` (or similar)

**Change:**
```javascript
import TargetResolutionCoordinator from '../../actions/pipeline/services/implementations/TargetResolutionCoordinator.js';
import { tokens } from '../tokens/tokens-core.js';

// In registration function:
container.register(
  tokens.ITargetResolutionCoordinator,
  ({ resolve }) => {
    return new TargetResolutionCoordinator({
      dependencyResolver: resolve(tokens.ITargetDependencyResolver),
      contextBuilder: resolve(tokens.IScopeContextBuilder),
      unifiedScopeResolver: resolve(tokens.UnifiedScopeResolver),
      entityManager: resolve(tokens.IEntityManager),
      logger: resolve(tokens.ILogger),
    });
  }
);
```

#### 3. Update Stage Registration
**File:** `src/dependencyInjection/registrations/pipelineStageRegistrations.js` (or similar)

**Change:** Add `ITargetResolutionCoordinator` to `MultiTargetResolutionStage` dependencies (will be used in MULTARRESSTAREF-015)

## Acceptance Criteria

- [ ] Token defined in `tokens-core.js`
- [ ] Service registered with factory pattern
- [ ] Factory injects all 5 dependencies correctly
- [ ] Registration follows project DI patterns
- [ ] No circular dependencies introduced
- [ ] TypeScript checks pass (`npm run typecheck`)

## Dependencies

- **MULTARRESSTAREF-012** - Implementation must exist before registration
- **MULTARRESSTAREF-013** - Tests should pass before registration

## Testing Strategy

**Validation Test:**
```javascript
describe('DI Container - Resolution Coordinator', () => {
  it('should resolve ITargetResolutionCoordinator', () => {
    const container = createContainer();
    const coordinator = container.resolve(tokens.ITargetResolutionCoordinator);
    expect(coordinator).toBeDefined();
    expect(typeof coordinator.coordinateResolution).toBe('function');
  });

  it('should inject all dependencies', () => {
    const container = createContainer();
    const coordinator = container.resolve(tokens.ITargetResolutionCoordinator);
    // Verify all 5 dependencies are injected
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
- Ensure all 5 dependencies are properly injected
- Token name follows interface naming convention (`I` prefix)
- Factory pattern allows for dependency injection
- Will be consumed by `MultiTargetResolutionStage` in next phase
