# MULTARRESSTAREF-009: Register Result Builder in DI Container

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 0.5 days
**Phase:** 2 - Result Assembly Extraction
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context

## Objective

Register `TargetResolutionResultBuilder` in the dependency injection container to make it available for injection into `MultiTargetResolutionStage`.

## Background

The result builder service needs to be registered in the DI container following the project's established dependency injection patterns.

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

  // ... existing tokens ...
};
```

#### 2. Register Service Factory
**File:** `src/dependencyInjection/registrations/pipelineServiceRegistrations.js` (or similar)

**Change:**
```javascript
import TargetResolutionResultBuilder from '../../actions/pipeline/services/implementations/TargetResolutionResultBuilder.js';
import { tokens } from '../tokens/tokens-core.js';

// In registration function:
container.register(
  tokens.ITargetResolutionResultBuilder,
  ({ resolve }) => {
    return new TargetResolutionResultBuilder({
      entityManager: resolve(tokens.IEntityManager),
      logger: resolve(tokens.ILogger),
    });
  }
);
```

#### 3. Update Stage Registration
**File:** `src/dependencyInjection/registrations/pipelineStageRegistrations.js` (or similar)

**Change:** Add `ITargetResolutionResultBuilder` to `MultiTargetResolutionStage` dependencies (will be used in MULTARRESSTAREF-010)

## Acceptance Criteria

- [ ] Token defined in `tokens-core.js`
- [ ] Service registered with factory pattern
- [ ] Factory injects `IEntityManager` and `ILogger` dependencies
- [ ] Registration follows project DI patterns
- [ ] No circular dependencies introduced
- [ ] TypeScript checks pass (`npm run typecheck`)

## Dependencies

- **MULTARRESSTAREF-007** - Implementation must exist before registration
- **MULTARRESSTAREF-008** - Tests should pass before registration

## Testing Strategy

**Validation Test:**
```javascript
describe('DI Container - Result Builder', () => {
  it('should resolve ITargetResolutionResultBuilder', () => {
    const container = createContainer();
    const builder = container.resolve(tokens.ITargetResolutionResultBuilder);
    expect(builder).toBeDefined();
    expect(typeof builder.buildFinalResult).toBe('function');
  });

  it('should inject entityManager and logger dependencies', () => {
    const container = createContainer();
    const builder = container.resolve(tokens.ITargetResolutionResultBuilder);
    // Verify dependencies are injected
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
- Ensure entityManager and logger are properly injected
- Token name follows interface naming convention (`I` prefix)
- Factory pattern allows for dependency injection
- Will be consumed by `MultiTargetResolutionStage` in next phase
